export interface CompositeOptions {
  photos: string[]; // Array of base64/DataURL images captured by camera
  frameImageUrl?: string | null; // URL of event's custom PNG frame
  eventName: string;
  eventDate: string;
  photoCount: number;
}

export async function createFinalPhotoComposite(options: CompositeOptions): Promise<string> {
  const { photos, frameImageUrl, eventName, eventDate, photoCount } = options;

  // Load custom PNG frame first to detect native aspect ratio & dimensions
  let frameImg: HTMLImageElement | null = null;
  if (frameImageUrl) {
    frameImg = await loadFrameImage(frameImageUrl);
  }

  // Calibrated target maximum dimension for photobooth print quality (300 DPI at 4R)
  // while ensuring transparent PNG payloads strictly fit within serverless limits (< 3.5MB).
  const MAX_TARGET_DIMENSION = 1800;
  const MIN_TARGET_DIMENSION = 1200;

  let canvasWidth = 1200;
  let canvasHeight = 1800;

  if (frameImg && frameImg.naturalWidth > 0 && frameImg.naturalHeight > 0) {
    const fW = frameImg.naturalWidth;
    const fH = frameImg.naturalHeight;
    const ratio = fW / fH;
    const maxNatural = Math.max(fW, fH);

    // If natural resolution is between MIN and MAX, use natural dimensions directly for 1:1 pixel perfection.
    // If it exceeds MAX (e.g. 4K frame), cap at MAX_TARGET_DIMENSION to prevent memory overflows.
    // If it is smaller than MIN, scale up to MIN_TARGET_DIMENSION for crisp print resolution.
    const targetMax = Math.min(MAX_TARGET_DIMENSION, Math.max(MIN_TARGET_DIMENSION, maxNatural));

    if (fW >= fH) {
      // Landscape or Square
      canvasWidth = targetMax;
      canvasHeight = Math.max(600, Math.round(targetMax / ratio));
    } else {
      // Portrait
      canvasHeight = targetMax;
      canvasWidth = Math.max(600, Math.round(targetMax * ratio));
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // For frames, keep outer canvas transparent so die-cut/floating frames (tickets, polaroids)
  // produce crisp, authentic transparent PNGs for sticker cutting and IG stories.
  // For events without custom frames, fill crisp white paper base.
  if (!frameImg) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

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

  // Calculate layout grid based on photo count
  let slots: Array<{ x: number; y: number; w: number; h: number }> = [];

  if (frameImg) {
    // Try auto-detecting transparent cutout windows pixel-by-pixel using 2D component detection
    const autoDetectedSlots = detectCutoutWindows(frameImg, canvasWidth, canvasHeight, photoCount);

    if (autoDetectedSlots && autoDetectedSlots.length === photoCount) {
      slots = autoDetectedSlots;
    } else {
      // High quality fallback layout matching photobooth PNG templates
      if (canvasWidth >= canvasHeight) {
        // Landscape fallback layouts
        const paddingX = Math.round(canvasWidth * 0.05);
        const paddingY = Math.round(canvasHeight * 0.08);
        const gap = Math.round(canvasWidth * 0.02);

        if (photoCount === 1) {
          slots = [
            {
              x: paddingX,
              y: paddingY,
              w: canvasWidth - paddingX * 2,
              h: canvasHeight - paddingY * 2,
            },
          ];
        } else if (photoCount === 2) {
          const cellW = Math.floor((canvasWidth - paddingX * 2 - gap) / 2);
          const cellH = canvasHeight - paddingY * 2;
          slots = [
            { x: paddingX, y: paddingY, w: cellW, h: cellH },
            { x: paddingX + cellW + gap, y: paddingY, w: cellW, h: cellH },
          ];
        } else if (photoCount === 3) {
          const cellW = Math.floor((canvasWidth - paddingX * 2 - gap * 2) / 3);
          const cellH = canvasHeight - paddingY * 2;
          slots = [
            { x: paddingX, y: paddingY, w: cellW, h: cellH },
            { x: paddingX + cellW + gap, y: paddingY, w: cellW, h: cellH },
            { x: paddingX + (cellW + gap) * 2, y: paddingY, w: cellW, h: cellH },
          ];
        } else if (photoCount === 4) {
          const cellW = Math.floor((canvasWidth - paddingX * 2 - gap) / 2);
          const cellH = Math.floor((canvasHeight - paddingY * 2 - gap) / 2);
          slots = [
            { x: paddingX, y: paddingY, w: cellW, h: cellH },
            { x: paddingX + cellW + gap, y: paddingY, w: cellW, h: cellH },
            { x: paddingX, y: paddingY + cellH + gap, w: cellW, h: cellH },
            { x: paddingX + cellW + gap, y: paddingY + cellH + gap, w: cellW, h: cellH },
          ];
        } else {
          const cols = Math.ceil(Math.sqrt(photoCount * (canvasWidth / canvasHeight)));
          const rows = Math.ceil(photoCount / cols);
          const cellW = Math.floor((canvasWidth - paddingX * 2 - gap * (cols - 1)) / cols);
          const cellH = Math.floor((canvasHeight - paddingY * 2 - gap * (rows - 1)) / rows);

          for (let i = 0; i < photoCount; i++) {
            const r = Math.floor(i / cols);
            const c = i % cols;
            slots.push({
              x: paddingX + c * (cellW + gap),
              y: paddingY + r * (cellH + gap),
              w: cellW,
              h: cellH,
            });
          }
        }
      } else {
        // Portrait fallback layouts (Standard 2:3 photobooth)
        if (photoCount === 1) {
          const paddingX = 100;
          const paddingTop = 240;
          const bottomPadding = 260;
          slots = [
            {
              x: paddingX,
              y: paddingTop,
              w: canvasWidth - paddingX * 2,
              h: canvasHeight - paddingTop - bottomPadding,
            },
          ];
        } else if (photoCount === 2) {
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
      renderY = targetY - (renderH - targetH) * 0.42;
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

  let resultDataUrl = canvas.toDataURL('image/png');

  // Hard safety guard: Vercel serverless request body limit is 4.5MB.
  // If base64 length exceeds 3.5MB (~2.6MB raw file), downscale slightly to guarantee successful upload.
  const MAX_B64_SAFE_LENGTH = 3.5 * 1024 * 1024;
  if (resultDataUrl.length > MAX_B64_SAFE_LENGTH) {
    const scaleFactor = Math.sqrt((2.8 * 1024 * 1024) / resultDataUrl.length);
    const safeW = Math.round(canvasWidth * scaleFactor);
    const safeH = Math.round(canvasHeight * scaleFactor);

    const safeCanvas = document.createElement('canvas');
    safeCanvas.width = safeW;
    safeCanvas.height = safeH;
    const safeCtx = safeCanvas.getContext('2d');
    if (safeCtx) {
      safeCtx.imageSmoothingEnabled = true;
      safeCtx.imageSmoothingQuality = 'high';
      safeCtx.drawImage(canvas, 0, 0, safeW, safeH);
      resultDataUrl = safeCanvas.toDataURL('image/png');
    }
  }

  // Memory cleanup: release image resources to avoid OOM crashes on low-end Android devices
  try {
    loadedImages.forEach((img) => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
    });
    if (frameImg) {
      frameImg.onload = null;
      frameImg.onerror = null;
      frameImg.src = '';
    }
  } catch (e) {
    // Ignore cleanup error
  }

  return resultDataUrl;
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
  const topY = Math.max(120, Math.round(canvasHeight * 0.07));
  ctx.fillStyle = '#2C2A29';
  ctx.font = 'bold 64px "Playfair Display", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('VIRTUAL PHOTOBOOTH', canvasWidth / 2, topY);

  // Bottom Event Title & Date
  const bottomY = canvasHeight - Math.max(160, Math.round(canvasHeight * 0.075));
  ctx.fillStyle = '#1A1817';
  ctx.font = 'bold 88px "Playfair Display", Georgia, serif';
  ctx.fillText(eventName.toUpperCase(), canvasWidth / 2, bottomY);

  ctx.fillStyle = '#78716C';
  ctx.font = '500 48px sans-serif';
  ctx.fillText(eventDate, canvasWidth / 2, bottomY + 80);
}

/**
 * 2D Connected-Component (Blob) detection of transparent cutout windows.
 * Accurately detects 2-photo (vertical/horizontal) and 4-photo (2x2 grid or 1x4 strip)
/**
 * 2D Connected-Component (Blob) detection of transparent cutout windows.
 * Universally handles all frame types:
 * 1. Full-bleed frames (solid borders with inner cutouts)
 * 2. Die-cut & floating frames (ripped tickets, polaroids, shaped borders with outer transparency)
 * 3. Minimalist overlay frames (graceful fallback to balanced proportional grids)
 */
function detectCutoutWindows(
  frameImg: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  expectedCount: number
): Array<{ x: number; y: number; w: number; h: number }> | null {
  try {
    // Proportional grid resolution matching target canvas aspect ratio
    // for ultra-fast (sub-20ms) and distortion-free 2D analysis.
    const gridW = 216;
    const gridH = Math.max(50, Math.round(gridW * (canvasHeight / canvasWidth)));
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
      perimeterTouches: number;
      touchesLeft: boolean;
      touchesRight: boolean;
      touchesTop: boolean;
      touchesBottom: boolean;
    }> = [];

    // Minimum area threshold: at least 1.2% of total grid for 4 photos, 1.8% for 2 photos
    const minThreshold = (gridW * gridH) * (expectedCount > 2 ? 0.012 : 0.018);

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const idx = gy * gridW + gx;
        if (isTransparent[idx] === 1 && !visited[idx]) {
          let minGx = gx;
          let maxGx = gx;
          let minGy = gy;
          let maxGy = gy;
          let count = 0;
          let perimeterTouches = 0;
          let touchesLeft = false;
          let touchesRight = false;
          let touchesTop = false;
          let touchesBottom = false;

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

            // Check if pixel is on the outer image perimeter
            const onPerimeter = (cx === 0 || cx === gridW - 1 || cy === 0 || cy === gridH - 1);
            if (onPerimeter) {
              perimeterTouches++;
              if (cx === 0) touchesLeft = true;
              if (cx === gridW - 1) touchesRight = true;
              if (cy === 0) touchesTop = true;
              if (cy === gridH - 1) touchesBottom = true;
            }

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
            rawComponents.push({
              minGx,
              maxGx,
              minGy,
              maxGy,
              count,
              perimeterTouches,
              touchesLeft,
              touchesRight,
              touchesTop,
              touchesBottom,
            });
          }
        }
      }
    }

    if (rawComponents.length === 0) return null;

    // Filter out Outer Canvas Backgrounds:
    // In die-cut frames (ripped tickets, polaroids, floating strips), the space
    // OUTSIDE the frame touches multiple outer borders or covers the canvas span.
    // Real photo cutout slots are enclosed within the frame artwork.
    const totalPerimeterPixels = 2 * (gridW + gridH - 2);

    const validPhotoSlots = rawComponents.filter((c) => {
      const spanW = (c.maxGx - c.minGx + 1) / gridW;
      const spanH = (c.maxGy - c.minGy + 1) / gridH;

      // Rule 1: A component that spans almost the entire width AND height is the outer canvas background
      // ONLY apply this if expectedCount > 1, because a 1-photo frame naturally takes up >75% of canvas!
      if (expectedCount > 1 && spanW > 0.75 && spanH > 0.75) {
        return false;
      }

      // Rule 2: A component that touches 3 or 4 outer image borders is surrounding the frame
      const borderSideCount =
        (c.touchesLeft ? 1 : 0) +
        (c.touchesRight ? 1 : 0) +
        (c.touchesTop ? 1 : 0) +
        (c.touchesBottom ? 1 : 0);

      if (borderSideCount >= 3) {
        return false;
      }

      // Rule 3: A component touching opposing borders (both left AND right, or both top AND bottom) with wide perimeter span
      if ((c.touchesLeft && c.touchesRight) || (c.touchesTop && c.touchesBottom)) {
        if (c.perimeterTouches > totalPerimeterPixels * 0.08) {
          return false;
        }
      }

      // Rule 4: Reject extreme thin slivers (accidental transparent cut lines or decorative slits)
      const compRatio = (c.maxGx - c.minGx + 1) / (c.maxGy - c.minGy + 1);
      if (compRatio > 7.0 || compRatio < 0.12) {
        return false;
      }

      return true;
    });

    // If candidate slots match expected count exactly, use them
    let candidates = validPhotoSlots;

    // If more valid slots found than expected (e.g. extra decorative holes), pick largest by area
    if (candidates.length > expectedCount) {
      candidates.sort((a, b) => b.count - a.count);
      candidates = candidates.slice(0, expectedCount);
    }

    // If we didn't find the expected number of enclosed slots (e.g. minimalist frame without cutouts),
    // return null to gracefully trigger the calibrated fallback grid.
    if (candidates.length !== expectedCount) {
      return null;
    }

    // Sort detected components in natural reading order: Top-to-bottom, Left-to-right
    const isLandscape = canvasWidth >= canvasHeight;
    const rowTolerance = isLandscape
      ? (gridH / Math.max(2, Math.ceil(expectedCount / 2))) * 0.45
      : (gridH / (expectedCount > 2 ? 4 : 2)) * 0.45;

    candidates.sort((a, b) => {
      if (Math.abs(a.minGy - b.minGy) > rowTolerance) {
        return a.minGy - b.minGy;
      }
      return a.minGx - b.minGx;
    });

    // Map grid coordinates back to full target canvas dimensions
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
