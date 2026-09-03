import JSZip from 'jszip';

export interface ExportGalleryItem {
  id: string;
  guestName: string;
  photoUrl: string;
  voiceUrl: string | null;
  durationSeconds?: number;
}

/**
 * Triggers a native browser download for a Blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Fetches an image URL as Blob and triggers download (solves cross-origin download issues).
 */
export async function downloadImageDirectly(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Gagal mengunduh gambar');
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

/**
 * Merges a photo strip image and voice note audio into an MP4/WebM video.
 * Silently renders audio (no speaker blast), animates a subtle audio waveform pill on the canvas,
 * and records into a video Blob.
 */
export async function exportPhotoWithAudioToVideo(
  photoUrl: string,
  audioUrl: string,
  onProgress?: (progressPct: number) => void
): Promise<{ blob: Blob; ext: string }> {
  // 1. Fetch and decode audio
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error('Gagal mengunduh file rekaman suara');
  const audioArrayBuffer = await audioRes.arrayBuffer();

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Browser tidak mendukung Web Audio API');
  }

  const audioCtx = new AudioContextClass();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer);
  } catch (decodeErr) {
    audioCtx.close();
    throw new Error('Gagal membaca format audio: ' + decodeErr);
  }

  const duration = Math.max(1, audioBuffer.duration);

  // 2. Load image with crossOrigin = 'anonymous'
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Gagal memuat foto strip'));
    img.src = photoUrl;
  });

  // 3. Setup canvas
  const canvas = document.createElement('canvas');
  const width = img.naturalWidth || 1080;
  const height = img.naturalHeight || 1620;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    audioCtx.close();
    throw new Error('Canvas 2D context tidak tersedia');
  }

  // 4. Setup Web Audio graph (silent output to MediaStreamDestination)
  const dest = audioCtx.createMediaStreamDestination();
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  source.connect(analyser);
  analyser.connect(dest);
  // Crucial: source is NOT connected to audioCtx.destination, so nothing plays out of the speaker!

  // 5. Setup MediaRecorder
  const canvasStream = canvas.captureStream(30); // 30 FPS
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const candidateTypes = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  let selectedMime = '';
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
    selectedMime = candidateTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  }

  const isMp4 = selectedMime.includes('mp4');
  const fileExt = isMp4 ? 'mp4' : 'webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: selectedMime || undefined,
    videoBitsPerSecond: 3500000, // 3.5 Mbps for crisp photostrip quality
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  // 6. Start recording and animation loop
  return new Promise<{ blob: Blob; ext: string }>((resolve, reject) => {
    let animId: number;
    let startTime = 0;
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);

    const cleanup = () => {
      if (animId) cancelAnimationFrame(animId);
      try {
        source.stop();
      } catch (_) {}
      source.disconnect();
      analyser.disconnect();
      audioCtx.close().catch(() => {});
    };

    recorder.onerror = (event: any) => {
      cleanup();
      reject(new Error(event?.error?.message || 'Perekaman video gagal'));
    };

    recorder.onstop = () => {
      cleanup();
      const videoBlob = new Blob(chunks, { type: selectedMime || 'video/mp4' });
      resolve({ blob: videoBlob, ext: fileExt });
    };

    const renderFrame = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = (now - startTime) / 1000;
      const progressRatio = Math.min(1, elapsed / duration);

      onProgress?.(Math.round(progressRatio * 100));

      // Draw pristine photostrip image
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Draw elegant subtle animated waveform pill at bottom of photostrip
      analyser.getByteFrequencyData(frequencyData);

      const scale = width / 1080;
      const pillWidth = 420 * scale;
      const pillHeight = 64 * scale;
      const pillX = (width - pillWidth) / 2;
      const pillY = height - (100 * scale) - pillHeight;
      const radius = pillHeight / 2;

      // Dark glassmorphism pill background
      ctx.save();
      ctx.fillStyle = 'rgba(28, 25, 23, 0.82)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, radius);
      ctx.fill();

      // Border outline
      ctx.strokeStyle = 'rgba(212, 163, 115, 0.4)';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();

      // Audio waveform bars inside pill
      const barCount = 14;
      const barSpacing = 4 * scale;
      const barWidth = 3 * scale;
      const totalWaveWidth = (barCount * barWidth) + ((barCount - 1) * barSpacing);
      const startWaveX = pillX + (36 * scale);
      const centerY = pillY + (pillHeight / 2);

      for (let b = 0; b < barCount; b++) {
        const val = frequencyData[b % frequencyData.length] / 255;
        // Natural pulsing wave height
        const minHeight = 6 * scale;
        const maxHeight = (pillHeight - 20 * scale);
        const barH = minHeight + (val * (maxHeight - minHeight));
        const bx = startWaveX + (b * (barWidth + barSpacing));

        ctx.fillStyle = '#D4A373';
        ctx.beginPath();
        ctx.roundRect(bx, centerY - (barH / 2), barWidth, barH, barWidth / 2);
        ctx.fill();
      }

      // Audio label & timer text
      ctx.font = `bold ${Math.round(18 * scale)}px sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Voice Note', startWaveX + totalWaveWidth + (20 * scale), centerY);

      // Timer display: mm:ss
      const currentSec = Math.floor(elapsed);
      const currentMins = Math.floor(currentSec / 60);
      const currentRemSec = currentSec % 60;
      const timerStr = `${String(currentMins).padStart(2, '0')}:${String(currentRemSec).padStart(2, '0')}`;
      
      ctx.font = `${Math.round(16 * scale)}px monospace`;
      ctx.fillStyle = '#D4A373';
      ctx.textAlign = 'right';
      ctx.fillText(timerStr, pillX + pillWidth - (28 * scale), centerY);

      ctx.restore();

      if (elapsed < duration + 0.3) {
        animId = requestAnimationFrame(renderFrame);
      }
    };

    // Listen for end of audio
    source.onended = () => {
      // Extra 300ms buffer then stop recorder
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 350);
    };

    // Safety timeout in case onended doesn't fire
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, (duration + 2) * 1000);

    // Start everything
    recorder.start(100); // 100ms timeslices
    source.start(0);
    animId = requestAnimationFrame(renderFrame);
  });
}

/**
 * Batches all gallery items:
 * - Items with Voice Notes become MP4 videos
 * - Items without Voice Notes are saved as JPG images
 * - Bundled into a single ZIP file downloaded to device
 */
export async function batchDownloadGallery(
  items: ExportGalleryItem[],
  eventName: string,
  onProgress: (info: { current: number; total: number; message: string; percent: number }) => void,
  shouldCancel?: () => boolean
): Promise<void> {
  const zip = new JSZip();
  const total = items.length;

  if (total === 0) {
    throw new Error('Tidak ada kenangan yang dapat diunduh.');
  }

  for (let i = 0; i < total; i++) {
    if (shouldCancel?.()) {
      throw new Error('Unduhan dibatalkan oleh pengguna.');
    }

    const item = items[i];
    const cleanGuestName = (item.guestName || 'Tamu')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_') || `Tamu_${i + 1}`;

    const itemIndex = String(i + 1).padStart(2, '0');

    if (item.voiceUrl) {
      onProgress({
        current: i + 1,
        total,
        message: `Membuat video ucapan untuk ${item.guestName}...`,
        percent: Math.round((i / total) * 100),
      });

      try {
        const { blob, ext } = await exportPhotoWithAudioToVideo(
          item.photoUrl,
          item.voiceUrl,
          (subPct) => {
            const overall = Math.round(((i + subPct / 100) / total) * 100);
            onProgress({
              current: i + 1,
              total,
              message: `Memproses video ${item.guestName} (${subPct}%)...`,
              percent: overall,
            });
          }
        );

        zip.file(`${itemIndex}_${cleanGuestName}_VoiceNote.${ext}`, blob);
      } catch (err) {
        console.warn(`Gagal me-render video untuk ${item.guestName}, menyimpan foto saja:`, err);
        // Fallback: save photo if video render fails
        try {
          const imgRes = await fetch(item.photoUrl);
          const imgBlob = await imgRes.blob();
          zip.file(`${itemIndex}_${cleanGuestName}.jpg`, imgBlob);
        } catch (imgErr) {
          console.error(`Gagal menyimpan foto cadangan ${item.guestName}:`, imgErr);
        }
      }
    } else {
      onProgress({
        current: i + 1,
        total,
        message: `Mengambil foto ${item.guestName}...`,
        percent: Math.round(((i + 0.5) / total) * 100),
      });

      try {
        const imgRes = await fetch(item.photoUrl);
        if (imgRes.ok) {
          const imgBlob = await imgRes.blob();
          zip.file(`${itemIndex}_${cleanGuestName}.jpg`, imgBlob);
        }
      } catch (err) {
        console.error(`Gagal mengambil foto ${item.guestName}:`, err);
      }
    }
  }

  onProgress({
    current: total,
    total,
    message: 'Mengompresi seluruh file ke dalam ZIP...',
    percent: 96,
  });

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const safeEventName = (eventName || 'Photobooth')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  downloadBlob(zipBlob, `Kenangan_${safeEventName}_${Date.now()}.zip`);

  onProgress({
    current: total,
    total,
    message: 'Unduhan berhasil diselesaikan!',
    percent: 100,
  });
}
