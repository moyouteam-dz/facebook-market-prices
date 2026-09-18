export const DEFAULT_OCR_MAX_EDGE = 1600;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function resizeImageForOcr(
  image: Blob,
  maxEdge = DEFAULT_OCR_MAX_EDGE,
): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(image);

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    if (scale === 1) {
      return { blob: image, width, height };
    }

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("ocr_canvas_unavailable");
    }

    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.9,
    });

    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}
