export interface CompositeOptions {
  photos: string[]; // Array of base64/DataURL images captured by camera
  frameImageUrl?: string | null; // URL of event's custom PNG frame
  eventName: string;
  eventDate: string;
  photoCount: number;
}

export async function createFinalPhotoComposite(options: CompositeOptions): Promise<string> {
  const { photos, frameImageUrl, eventName, eventDate, photoCount } = options;

  // Target high resolution: 2160 x 3240 px (2:3 Portrait Aspect Ratio)
  const canvasWidth = 2160;
  const canvasHeight = 3240;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Fill elegant background (Warm Cream / Off-white)
  ctx.fillStyle = '#F8F5F0';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Load captured camera images
  const loadedImages: HTMLImageElement[] = await Promise.all(
    photos.map(
      (src) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          if (src.startsWith('http://') || src.startsWith('https://')) {
            img.crossOrigin = 'anonymous';
          }
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        })
    )
  );

  // Load custom PNG frame with CORS/Blob protection to prevent canvas tainting
  let frameImg: HTMLImageElement | null = null;
  if (frameImageUrl) {
    frameImg = await loadFrameImage(frameImageUrl);
  }

  // Calculate layout grid based on photo count
  let slots: Array<{ x: number; y: number; w: number; h: number }> = [];

  if (frameImg) {
    // Try auto-detecting transparent cutout windows pixel-by-pixel using 2D component detection
    const autoDetectedSlots = detectCutoutWindows(frameImg, canvasWidth, canvasHeight, photoCount);

    if (autoDetectedSlots && autoDetectedSlots.length === photoCount) {
      slots = autoDetectedSlots;
    } else {
      // High quality fallback layout matching standard 2:3 portrait photobooth PNG templates
      if (photoCount === 2) {
        const paddingX = 120;
        const paddingTop = 260;
        const bottomPadding = 300;
        const gap = 80;
        const availableH = canvasHeight - paddingTop - bottomPadding - gap;
        const cellH = Math.max(Math.floor(availableH / 2), 850);
        const cellW = canvasWidth - paddingX * 2;

        slots = [
          { x: paddingX, y: paddingTop, w: cellW, h: cellH },
          { x: paddingX, y: paddingTop + cellH + gap, w: cellW, h: cellH },
        ];
      } else if (photoCount === 3) {
        const paddingX = 140;
        const paddingTop = 240;
        const bottomPadding = 280;
        const gap = 50;
        const cellW = canvasWidth - paddingX * 2;
        const availableH = canvasHeight - paddingTop - bottomPadding - gap * 2;
        const cellH = Math.max(Math.floor(availableH / 3), 750);

        slots = [
          { x: paddingX, y: paddingTop, w: cellW, h: cellH },
          { x: paddingX, y: paddingTop + cellH + gap, w: cellW, h: cellH },
          { x: paddingX, y: paddingTop + (cellH + gap) * 2, w: cellW, h: cellH },
        ];
      } else if (photoCount === 4) {
        // Standard 4-photo photobooth 2x2 grid with proper margins and gaps
        const paddingX = 100;
        const paddingTop = 280;
        const bottomPadding = 320;
        const gapX = 50;
        const gapY = 60;
        const cellW = Math.floor((canvasWidth - paddingX * 2 - gapX) / 2);
        const availableH = canvasHeight - paddingTop - bottomPadding - gapY;
        const cellH = Math.floor(availableH / 2);

        slots = [
          { x: paddingX, y: paddingTop, w: cellW, h: cellH },
          { x: paddingX + cellW + gapX, y: paddingTop, w: cellW, h: cellH },
          { x: paddingX, y: paddingTop + cellH + gapY, w: cellW, h: cellH },
          { x: paddingX + cellW + gapX, y: paddingTop + cellH + gapY, w: cellW, h: cellH },
        ];
      } else {
        const cols = photoCount > 2 ? 2 : 1;
        const rows = Math.ceil(photoCount / cols);
        const paddingX = 120;
        const paddingTop = 280;
        const bottomPadding = 300;
        const gap = 50;
        const cellW = Math.floor((canvasWidth - paddingX * 2 - gap * (cols - 1)) / cols);
        const cellH = Math.floor((canvasHeight - paddingTop - bottomPadding - gap * (rows - 1)) / rows);

        for (let i = 0; i < photoCount; i++) {
          const r = Math.floor(i / cols);
          const c = i % cols;
          slots.push({
            x: paddingX + c * (cellW + gap),
            y: paddingTop + r * (cellH + gap),
            w: cellW,
            h: cellH,
          });
        }
      }
    }
  } else {
    // Fallback default Editorial layout when NO custom PNG frame is uploaded
    if (photoCount === 4) {
      const paddingX = 120;
      const paddingTop = 360;
      const gap = 50;
      const cellW = (canvasWidth - paddingX * 2 - gap) / 2;
      const cellH = 1150;

      slots = [
        { x: paddingX, y: paddingTop, w: cellW, h: cellH },
        { x: paddingX + cellW + gap, y: paddingTop, w: cellW, h: cellH },
        { x: paddingX, y: paddingTop + cellH + gap, w: cellW, h: cellH },
        { x: paddingX + cellW + gap, y: paddingTop + cellH + gap, w: cellW, h: cellH },
      ];
    } else if (photoCount === 3) {
      const paddingX = 160;
      const paddingTop = 280;
      const gap = 50;
      const cellW = canvasWidth - paddingX * 2;
      const cellH = 780;

      slots = [
        { x: paddingX, y: paddingTop, w: cellW, h: cellH },
        { x: paddingX, y: paddingTop + cellH + gap, w: cellW, h: cellH },
        { x: paddingX, y: paddingTop + (cellH + gap) * 2, w: cellW, h: cellH },
      ];
    } else if (photoCount === 2) {
      const paddingX = 140;
      const cellW = canvasWidth - paddingX * 2;
      const cellH = 1150;

      slots = [
        { x: paddingX, y: 260, w: cellW, h: cellH },
        { x: paddingX, y: 1670, w: cellW, h: cellH },
      ];
    } else {
      const cols = photoCount > 2 ? 2 : 1;
      const rows = Math.ceil(photoCount / cols);
      const paddingX = 120;
      const paddingTop = 360;
      const gap = 50;
      const cellW = (canvasWidth - paddingX * 2 - gap * (cols - 1)) / cols;
      const cellH = (canvasHeight - paddingTop - 450 - gap * (rows - 1)) / rows;

      for (let i = 0; i < photoCount; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        slots.push({
          x: paddingX + c * (cellW + gap),
          y: paddingTop + r * (cellH + gap),
          w: cellW,
          h: cellH,
        });
      }
    }
  }

  // Draw photos inside slots (Cover fit with 24px bleed tucked under frame borders)
  const BLEED_PX = frameImg ? 24 : 0;

  loadedImages.forEach((img, index) => {
    if (index >= slots.length) return;
    const slot = slots[index];

    // Expand slot with bleed so photo sits under frame borders
    const targetX = Math.max(0, slot.x - BLEED_PX);
    const targetY = Math.max(0, slot.y - BLEED_PX);
    const targetW = Math.min(canvasWidth - targetX, slot.w + BLEED_PX * 2);
    const targetH = Math.min(canvasHeight - targetY, slot.h + BLEED_PX * 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(targetX, targetY, targetW, targetH);
    ctx.clip();

    // Calculate object-fit cover based on target render area
    const imgRatio = img.width / img.height;
    const targetRatio = targetW / targetH;
    let renderW = targetW;
    let renderH = targetH;
    let renderX = targetX;
    let renderY = targetY;

    if (imgRatio > targetRatio) {
      renderW = targetH * imgRatio;
      renderX = targetX - (renderW - targetW) / 2;
    } else {
      renderH = targetW / imgRatio;
      renderY = targetY - (renderH - targetH) / 2;
    }

    ctx.drawImage(img, renderX, renderY, renderW, renderH);
    ctx.restore();
  });

  // Draw custom PNG frame overlay on top
  if (frameImg) {
    ctx.drawImage(frameImg, 0, 0, canvasWidth, canvasHeight);
  } else if (!frameImageUrl) {
    drawDefaultBranding(ctx, canvasWidth, canvasHeight, eventName, eventDate);
  }

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Robust cross-origin image loader that converts image to a Blob URL
 * to avoid canvas tainting issues on Safari iOS and Chrome.
 */
async function loadFrameImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      return await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = blobUrl;
      });
    }
  } catch (err) {
    console.warn('Frame blob fetch failed, trying direct Image load:', err);
  }

  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => resolve(null);
      fallbackImg.src = url;
    };
    img.src = url;
  });
}

function drawDefaultBranding(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  eventName: string,
  eventDate: string
) {
  // Top Header Monogram
  ctx.fillStyle = '#2C2A29';
  ctx.font = 'bold 64px "Playfair Display", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('VIRTUAL PHOTOBOOTH', canvasWidth / 2, 220);

  // Bottom Event Title & Date
  const bottomY = canvasHeight - 240;
  ctx.fillStyle = '#1A1817';
  ctx.font = 'bold 88px "Playfair Display", Georgia, serif';
  ctx.fillText(eventName.toUpperCase(), canvasWidth / 2, bottomY);

  ctx.fillStyle = '#78716C';
  ctx.font = '500 48px sans-serif';
  ctx.fillText(eventDate, canvasWidth / 2, bottomY + 80);
}

/**
 * 2D Connected-Component (Blob) detection of transparent cutout windows.
 * Accurately detects 2-photo (vertical/horizontal) and 4-photo (2x2 grid or 1x4 vertical strip)
 * windows regardless of overlapping decorations, Barong masks, balloons, or typography.
 */
function detectCutoutWindows(
  frameImg: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  expectedCount: number
): Array<{ x: number; y: number; w: number; h: number }> | null {
  try {
    // We downsample to a fine 216 x 324 grid (matching 2:3 aspect ratio)
    // for ultra-fast (sub-20ms) and noise-free 2D analysis.
    const gridW = 216;
    const gridH = 324;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = gridW;
    offCanvas.height = gridH;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    if (!offCtx) return null;

    offCtx.drawImage(frameImg, 0, 0, gridW, gridH);
    const imgData = offCtx.getImageData(0, 0, gridW, gridH);
    const data = imgData.data;

    // Binary transparency grid (alpha < 128 considered transparent cutout)
    const isTransparent = new Uint8Array(gridW * gridH);
    for (let i = 0; i < gridW * gridH; i++) {
      if (data[i * 4 + 3] < 128) {
        isTransparent[i] = 1;
      }
    }

    // 2D Connected Component Labeling via Breadth-First Search (BFS)
    const visited = new Uint8Array(gridW * gridH);
    const rawComponents: Array<{
      minGx: number;
      maxGx: number;
      minGy: number;
      maxGy: number;
      count: number;
    }> = [];

    // Minimum area threshold: at least 1.5% of total grid for 4 photos, 2% for 2 photos
    const minThreshold = (gridW * gridH) * (expectedCount > 2 ? 0.015 : 0.02);

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const idx = gy * gridW + gx;
        if (isTransparent[idx] === 1 && !visited[idx]) {
          let minGx = gx;
          let maxGx = gx;
          let minGy = gy;
          let maxGy = gy;
          let count = 0;
          const queue: number[] = [gx, gy];
          visited[idx] = 1;
          let head = 0;

          while (head < queue.length) {
            const cx = queue[head++];
            const cy = queue[head++];
            count++;
            if (cx < minGx) minGx = cx;
            if (cx > maxGx) maxGx = cx;
            if (cy < minGy) minGy = cy;
            if (cy > maxGy) maxGy = cy;

            const neighbors: Array<[number, number]> = [
              [cx + 1, cy],
              [cx - 1, cy],
              [cx, cy + 1],
              [cx, cy - 1],
            ];
            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
                const nidx = ny * gridW + nx;
                if (isTransparent[nidx] === 1 && !visited[nidx]) {
                  visited[nidx] = 1;
                  queue.push(nx, ny);
                }
              }
            }
          }

          if (count >= minThreshold) {
            rawComponents.push({ minGx, maxGx, minGy, maxGy, count });
          }
        }
      }
    }

    if (rawComponents.length === 0) return null;

    let candidates = rawComponents;
    // If more components than expected (e.g. tiny decorative cuts), take largest by area
    if (candidates.length > expectedCount) {
      candidates.sort((a, b) => b.count - a.count);
      candidates = candidates.slice(0, expectedCount);
    }

    if (candidates.length !== expectedCount) {
      return null;
    }

    // Sort detected components in natural reading order: Top-to-bottom, Left-to-right
    const rowTolerance = (gridH / (expectedCount > 2 ? 4 : 2)) * 0.45;
    candidates.sort((a, b) => {
      if (Math.abs(a.minGy - b.minGy) > rowTolerance) {
        return a.minGy - b.minGy;
      }
      return a.minGx - b.minGx;
    });

    // Map grid coordinates back to full 2160x3240 canvas dimensions
    const slots = candidates.map((c) => {
      const x = Math.round((c.minGx / gridW) * canvasWidth);
      const y = Math.round((c.minGy / gridH) * canvasHeight);
      const w = Math.round(((c.maxGx - c.minGx + 1) / gridW) * canvasWidth);
      const h = Math.round(((c.maxGy - c.minGy + 1) / gridH) * canvasHeight);
      return { x, y, w, h };
    });

    return slots;
  } catch (e) {
    console.warn('Auto cutout detection skipped or error:', e);
    return null;
  }
}
