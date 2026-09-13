export interface FrameValidationResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  orientation?: 'portrait' | 'landscape' | 'square';
}

/**
 * Validates a frame file on the client side.
 * Accepts ANY PNG file with valid dimensions (portrait, landscape, square, or custom ratio).
 */
export async function validateFrameFile(file: File): Promise<FrameValidationResult> {
  // 1. Format check: PNG only
  if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
    return {
      valid: false,
      error: 'Format frame tidak valid. Harap upload file gambar dengan format PNG.',
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { width, height } = img;

      if (!width || !height || width <= 0 || height <= 0) {
        return resolve({
          valid: false,
          error: 'File PNG rusak atau dimensi tidak dapat dibaca.',
        });
      }

      const orientation = height > width ? 'portrait' : height < width ? 'landscape' : 'square';
      const aspectRatio = width / height;

      return resolve({
        valid: true,
        width,
        height,
        aspectRatio,
        orientation,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: 'Gagal membaca file gambar PNG. Pastikan file tidak rusak.',
      });
    };

    img.src = objectUrl;
  });
}

/**
 * Validates a binary PNG buffer on server or client using standard DataView.
 * Checks PNG magic bytes and extracts IHDR dimensions.
 * Accepts ANY valid PNG image (portrait, landscape, square, or custom ratio).
 */
export function validateFrameBuffer(
  buffer: Uint8Array | ArrayBuffer | { buffer: ArrayBuffer; byteOffset?: number; byteLength?: number }
): FrameValidationResult {
  const bytes = buffer instanceof Uint8Array
    ? buffer
    : buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset || 0, buffer.byteLength || buffer.buffer.byteLength);

  // 1. Min length for PNG header (8 bytes) + IHDR length (4) + IHDR type (4) + IHDR data (13)
  if (bytes.length < 24) {
    return {
      valid: false,
      error: 'File tidak valid: ukuran file terlalu kecil untuk format PNG.',
    };
  }

  // 2. Format check: PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  if (!isPng) {
    return {
      valid: false,
      error: 'Format frame tidak valid. Harap upload file gambar dengan format PNG.',
    };
  }

  // 3. Extract width and height from IHDR chunk (bytes 16-23, big-endian)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);

  if (!width || !height || width <= 0 || height <= 0) {
    return {
      valid: false,
      error: 'Gambar PNG rusak: tidak dapat membaca dimensi gambar.',
    };
  }

  const orientation = height > width ? 'portrait' : height < width ? 'landscape' : 'square';
  const aspectRatio = width / height;

  return {
    valid: true,
    width,
    height,
    aspectRatio,
    orientation,
  };
}
