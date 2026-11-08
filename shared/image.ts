export interface ProcessedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function drawContain(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = Math.round(image.width * scale);
  const drawHeight = Math.round(image.height * scale);
  context.drawImage(
    image,
    Math.round((width - drawWidth) / 2),
    Math.round((height - drawHeight) / 2),
    drawWidth,
    drawHeight,
  );
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

export async function processImage(file: Blob, maxSize = 2560): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = width;
  fullCanvas.height = height;
  const fullContext = fullCanvas.getContext('2d');
  if (!fullContext) throw new Error('无法创建画布');
  drawContain(fullContext, bitmap, width, height);

  let full = await canvasToBlob(fullCanvas, 'image/webp', 0.86);
  if (!full) {
    full = await canvasToBlob(fullCanvas, 'image/jpeg', 0.88);
  }
  if (!full) {
    bitmap.close();
    throw new Error('图片处理失败');
  }

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 360;
  thumbCanvas.height = 200;
  const thumbContext = thumbCanvas.getContext('2d');
  if (!thumbContext) {
    bitmap.close();
    throw new Error('无法创建缩略图');
  }
  drawCover(thumbContext, bitmap, thumbCanvas.width, thumbCanvas.height);

  const thumb = (await canvasToBlob(thumbCanvas, 'image/webp', 0.8)) ??
    (await canvasToBlob(thumbCanvas, 'image/jpeg', 0.82));
  bitmap.close();
  if (!thumb) throw new Error('缩略图生成失败');

  return { full, thumb, width, height };
}

export async function processIconImage(file: Blob, size = 128): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('无法创建画布');
  }

  const scale = Math.min(size / bitmap.width, size / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    bitmap,
    Math.round((size - width) / 2),
    Math.round((size - height) / 2),
    width,
    height,
  );
  bitmap.close();

  const blob =
    (await canvasToBlob(canvas, 'image/webp', 0.9)) ??
    (await canvasToBlob(canvas, 'image/png', 1));
  if (!blob) throw new Error('图标处理失败');
  return blob;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('读取缩略图失败'));
    reader.readAsDataURL(blob);
  });
}
