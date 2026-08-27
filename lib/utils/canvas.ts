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

  // Calculate layout grid based on photo count (default 4 photos = 2x2 grid or vertical strip)
  let slots: Array<{ x: number; y: number; w: number; h: number }> = [];

  if (photoCount === 4) {
    // 2x2 Grid with margins
    const paddingX = 120;
    const paddingTop = 400;
    const gap = 60;
    const cellW = (canvasWidth - paddingX * 2 - gap) / 2;
    const cellH = (cellW * 3) / 4; // 4:3 landscape ratio per photo slot

    slots = [
      { x: paddingX, y: paddingTop, w: cellW, h: cellH },
      { x: paddingX + cellW + gap, y: paddingTop, w: cellW, h: cellH },
      { x: paddingX, y: paddingTop + cellH + gap, w: cellW, h: cellH },
      { x: paddingX + cellW + gap, y: paddingTop + cellH + gap, w: cellW, h: cellH },
    ];
  } else if (photoCount === 3) {
    // Vertical 3-strip
    const paddingX = 160;
    const paddingTop = 360;
    const gap = 50;
    const cellW = canvasWidth - paddingX * 2;
    const cellH = (canvasHeight - paddingTop - 500 - gap * 2) / 3;

    slots = [
      { x: paddingX, y: paddingTop, w: cellW, h: cellH },
      { x: paddingX, y: paddingTop + cellH + gap, w: cellW, h: cellH },
      { x: paddingX, y: paddingTop + (cellH + gap) * 2, w: cellW, h: cellH },
    ];
  } else if (photoCount === 2) {
    // 2-Photo Full Bleed Layout (100% Zero-Gap Masking for 2-cutout template overlays like @memoriephotobooth_)
    // Slot 1 covers y: 0 to 1420 (bleeding behind middle bar). Slot 2 covers y: 1390 to 2740 (bleeding behind middle bar & floral footer).
    slots = [
      { x: 0, y: 0, w: canvasWidth, h: 1420 },
      { x: 0, y: 1390, w: canvasWidth, h: 1350 },
    ];
  } else {
    // Default grid math for N photos
    const cols = photoCount > 2 ? 2 : 1;
    const rows = Math.ceil(photoCount / cols);
    const paddingX = 120;
    const paddingTop = 400;
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

  // If a custom PNG frame is provided, overlay it on top!
  if (frameImageUrl) {
    try {
      const frameImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = frameImageUrl;
      });

      ctx.drawImage(frameImg, 0, 0, canvasWidth, canvasHeight);
    } catch (e) {
      console.warn('Failed to load custom PNG frame, using fallback template text:', e);
      drawDefaultBranding(ctx, canvasWidth, canvasHeight, eventName, eventDate);
    }
  } else {
    // Draw default editorial branding text & border at bottom
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
