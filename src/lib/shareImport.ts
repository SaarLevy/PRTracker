/** Reading back a workout another app shared in — parked in the cache by share-target-sw.js. */

export interface SharedWod {
  text?: string;
  image?: Blob;
}

export interface OcrProgress {
  /** Tesseract stage name, e.g. "loading language traineddata", "recognizing text". */
  status: string;
  /** 0..1 within the current stage. */
  progress: number;
}

const CACHE_NAME = 'shared-wod';
const TEXT_KEY = '/shared-text';
const IMAGE_KEY = '/shared-image';

/** Retrieves and clears a pending shared workout, or null when nothing was shared. */
export async function takeSharedWod(): Promise<SharedWod | null> {
  if (!('caches' in window)) return null;

  const cache = await caches.open(CACHE_NAME);
  const [textResponse, imageResponse] = await Promise.all([cache.match(TEXT_KEY), cache.match(IMAGE_KEY)]);
  if (!textResponse && !imageResponse) return null;

  const shared: SharedWod = {};
  if (textResponse) shared.text = await textResponse.text();
  if (imageResponse) shared.image = await imageResponse.blob();

  await Promise.all([cache.delete(TEXT_KEY), cache.delete(IMAGE_KEY)]);
  return shared;
}

/**
 * Extracts text from a shared workout image.
 *
 * tesseract.js is imported on demand so only image shares ever pay for it; the wasm core and
 * English model come from tesseract's CDN on first use, so the first OCR needs a connection.
 */
export async function ocrImage(image: Blob, onProgress: (p: OcrProgress) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m) => onProgress({ status: m.status, progress: m.progress ?? 0 }),
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
