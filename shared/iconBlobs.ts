const objectUrls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export async function saveIconBlob(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  const db = (await import('./db')).db;
  await db.icons.put({ id, blob, createdAt: Date.now() });
  return id;
}

export async function listIconBlobs(): Promise<Array<{ id: string; blob: Blob; createdAt: number }>> {
  const db = (await import('./db')).db;
  return db.icons.toArray();
}

export async function putIconBlob(id: string, blob: Blob): Promise<void> {
  const db = (await import('./db')).db;
  await db.icons.put({ id, blob, createdAt: Date.now() });
}

export function getIconBlobUrl(id: string): Promise<string | null> {
  if (!id) return Promise.resolve(null);
  const cached = objectUrls.get(id);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(id);
  if (existing) return existing;

  const task = import('./db')
    .then(({ db }) => db.icons.get(id))
    .then((record) => {
      if (!record) return null;
      const url = URL.createObjectURL(record.blob);
      objectUrls.set(id, url);
      return url;
    })
    .catch(() => null)
    .finally(() => {
      pending.delete(id);
    });
  pending.set(id, task);
  return task;
}

export async function deleteIconBlob(id: string): Promise<void> {
  if (!id) return;
  const url = objectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }
  try {
    const db = (await import('./db')).db;
    await db.icons.delete(id);
  } catch {
    // The nav item is already updated; an orphan blob is harmless.
  }
}
