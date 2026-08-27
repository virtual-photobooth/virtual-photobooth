export interface FrameValidationResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
}

export async function validateFrameFile(file: File): Promise<FrameValidationResult> {
  // 1. Format check: PNG only
  if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
    return {
      valid: false,
      error: 'Invalid frame format. Please upload a portrait PNG with a 2:3 aspect ratio.',
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { width, height } = img;

      // 2. Must be Portrait (height > width)
      if (height <= width) {
        return resolve({
          valid: false,
          error: 'Invalid frame format. Please upload a portrait PNG with a 2:3 aspect ratio.',
          width,
          height,
        });
      }

      // 3. Aspect ratio 2:3 check (width / height approx 2 / 3 = 0.6667)
      const ratio = width / height;
      const targetRatio = 2 / 3;
      const tolerance = 0.03; // Allows slight pixel rounding e.g. 2160x3240 = 0.66667

      if (Math.abs(ratio - targetRatio) > tolerance) {
        return resolve({
          valid: false,
          error: 'Invalid frame format. Please upload a portrait PNG with a 2:3 aspect ratio.',
          width,
          height,
        });
      }

      return resolve({
        valid: true,
        width,
        height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: 'Invalid frame format. Please upload a portrait PNG with a 2:3 aspect ratio.',
      });
    };

    img.src = objectUrl;
  });
}
