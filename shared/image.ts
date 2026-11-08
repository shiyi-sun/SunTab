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

export function ensureImageDecodes(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法解码图片'));
    };
    image.src = objectUrl;
  });
}

export interface IconVisibility {
  blank: boolean;
  whiteOnly: boolean;
  whiteSheet: boolean;
}

const VISIBILITY_SAMPLE = 32;

function loadImageElement(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法解码图片'));
    image.src = objectUrl;
  });
}

export async function analyzeIconVisibility(
  blob: Blob,
): Promise<IconVisibility> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImageElement(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = VISIBILITY_SAMPLE;
    canvas.height = VISIBILITY_SAMPLE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return { blank: false, whiteOnly: false, whiteSheet: false };
    context.clearRect(0, 0, VISIBILITY_SAMPLE, VISIBILITY_SAMPLE);
    const width = image.naturalWidth || VISIBILITY_SAMPLE;
    const height = image.naturalHeight || VISIBILITY_SAMPLE;
    const scale = Math.min(VISIBILITY_SAMPLE / width, VISIBILITY_SAMPLE / height);
    const drawWidth = Math.max(1, Math.round(width * scale));
    const drawHeight = Math.max(1, Math.round(height * scale));
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      Math.round((VISIBILITY_SAMPLE - drawWidth) / 2),
      Math.round((VISIBILITY_SAMPLE - drawHeight) / 2),
      drawWidth,
      drawHeight,
    );
    const pixels = context.getImageData(
      0,
      0,
      VISIBILITY_SAMPLE,
      VISIBILITY_SAMPLE,
    ).data;
    let alphaWeight = 0;
    let whiteWeight = 0;
    let otherWeight = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3]! / 255;
      if (alpha < 0.06) continue;
      alphaWeight += alpha;
      const min = Math.min(pixels[index]!, pixels[index + 1]!, pixels[index + 2]!);
      if (min >= 235) {
        whiteWeight += alpha;
      } else {
        otherWeight += alpha;
      }
    }
    const total = VISIBILITY_SAMPLE * VISIBILITY_SAMPLE;
    const coverage = alphaWeight / total;
    const artwork = whiteWeight + otherWeight;
    const blank = coverage < 0.002;
    const whiteSheet = coverage >= 0.9 && otherWeight / total < 0.002;
    const whiteOnly =
      !blank &&
      !whiteSheet &&
      coverage < 0.9 &&
      whiteWeight / Math.max(artwork, 0.000001) >= 0.9;
    return { blank, whiteOnly, whiteSheet };
  } catch {
    return { blank: false, whiteOnly: false, whiteSheet: false };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
