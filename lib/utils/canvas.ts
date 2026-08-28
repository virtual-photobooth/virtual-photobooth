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
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        })
    )
  );

  // Load custom PNG frame first if available (to auto-detect cutout windows)
  let frameImg: HTMLImageElement | null = null;
  if (frameImageUrl) {
    try {
      frameImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = frameImageUrl;
      });
    } catch (e) {
      console.warn('Could not pre-load frame image:', e);
    }
  }

  // Calculate layout grid based on photo count
  let slots: Array<{ x: number; y: number; w: number; h: number }> = [];

  if (frameImg) {
    // FULL-BLEED SLOT MATH: Photos bleed 100% behind transparent windows of the PNG frame.
    // The PNG frame sitting ON TOP at (0, 0) acts as the natural stencil mask for rounded corners, borders & text!
    if (photoCount === 2) {
      // 2-Photo Seamless Mid-Bar Dividing Boundary (y: 1620):
      // Slot 1 covers y: 0 to 1620; Slot 2 covers y: 1620 to 3240.
      // The boundary line y=1620 sits 100% hidden behind the solid blue middle bar under "Anniversary 14".
      // Photos fill 100% of their cutout windows with ZERO white gaps AND ZERO visible photo edges poking out!
      slots = [
        { x: 0, y: 0, w: canvasWidth, h: 1620 },
        { x: 0, y: 1620, w: canvasWidth, h: 1620 },
      ];
    } else if (photoCount === 3) {
      // 3-Photo Seamless Strip Boundaries
      const h3 = canvasHeight / 3;
      slots = [
        { x: 0, y: 0, w: canvasWidth, h: h3 },
        { x: 0, y: h3, w: canvasWidth, h: h3 },
        { x: 0, y: h3 * 2, w: canvasWidth, h: h3 },
      ];
    } else if (photoCount === 4) {
      // 4-Photo Seamless Grid Boundaries
      const w2 = canvasWidth / 2;
      const h2 = canvasHeight / 2;
      slots = [
        { x: 0, y: 0, w: w2, h: h2 },
        { x: w2, y: 0, w: w2, h: h2 },
        { x: 0, y: h2, w: w2, h: h2 },
        { x: w2, y: h2, w: w2, h: h2 },
      ];
    } else {
      // Default N-Photo Full Bleed
      const cols = photoCount > 2 ? 2 : 1;
      const rows = Math.ceil(photoCount / cols);
      const cellW = canvasWidth / cols;
      const cellH = canvasHeight / rows;
      for (let i = 0; i < photoCount; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        slots.push({
          x: c * cellW,
          y: r * cellH,
          w: cellW,
          h: cellH,
        });
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

  // Draw photos inside slots (Cover fit)
  loadedImages.forEach((img, index) => {
    if (index >= slots.length) return;
    const slot = slots[index];

    ctx.save();
    ctx.beginPath();
    ctx.rect(slot.x, slot.y, slot.w, slot.h);
    ctx.clip();

    // Calculate object-fit cover
    const imgRatio = img.width / img.height;
    const slotRatio = slot.w / slot.h;
    let renderW = slot.w;
    let renderH = slot.h;
    let renderX = slot.x;
    let renderY = slot.y;

    if (imgRatio > slotRatio) {
      renderW = slot.h * imgRatio;
      renderX = slot.x - (renderW - slot.w) / 2;
    } else {
      renderH = slot.w / imgRatio;
      renderY = slot.y - (renderH - slot.h) / 2;
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

  return canvas.toDataURL('image/png', 0.95);
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

function detectCutoutWindows(
  frameImg: HTMLImageElement,
  width: number,
  height: number,
  expectedCount: number
): Array<{ x: number; y: number; w: number; h: number }> | null {
  try {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return null;

    offCtx.drawImage(frameImg, 0, 0, width, height);
    const imgData = offCtx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const isTransparentRow = new Array(height);
    for (let y = 0; y < height; y++) {
      let transparentCount = 0;
      const samples = 20;
      for (let s = 0; s < samples; s++) {
        const x = Math.floor(width * 0.25 + (width * 0.5 * s) / samples);
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha < 100) transparentCount++;
      }
      isTransparentRow[y] = transparentCount > samples * 0.5;
    }

    const yRanges: Array<{ yMin: number; yMax: number }> = [];
    let inRange = false;
    let startY = 0;

    for (let y = 0; y < height; y++) {
      if (isTransparentRow[y] && !inRange) {
        inRange = true;
        startY = y;
      } else if (!isTransparentRow[y] && inRange) {
        inRange = false;
        if (y - startY > 150) {
          yRanges.push({ yMin: startY, yMax: y });
        }
      }
    }
    if (inRange && height - startY > 150) {
      yRanges.push({ yMin: startY, yMax: height });
    }

    if (yRanges.length === expectedCount) {
      const detected: Array<{ x: number; y: number; w: number; h: number }> = [];
      for (const r of yRanges) {
        const midY = Math.floor((r.yMin + r.yMax) / 2);
        let xMin = width;
        let xMax = 0;

        for (let x = 0; x < width; x += 5) {
          const alpha = data[(midY * width + x) * 4 + 3];
          if (alpha < 100) {
            if (x < xMin) xMin = x;
            if (x > xMax) xMax = x;
          }
        }

        if (xMin < xMax && xMax - xMin > 200) {
          detected.push({
            x: xMin,
            y: r.yMin,
            w: xMax - xMin,
            h: r.yMax - r.yMin,
          });
        }
      }

      if (detected.length === expectedCount) {
        return detected;
      }
    }
  } catch (e) {
    console.warn('Auto cutout detection skipped:', e);
  }
  return null;
}
