'use client';

import { useState, useRef } from 'react';
import { Download, QrCode, X, Printer, Sparkles } from 'lucide-react';

interface PrintableQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventName: string;
  monogram?: string;
  eventDate: string;
  eventUrl: string;
  slug: string;
}

export default function PrintableQrModal({
  isOpen,
  onClose,
  eventName,
  monogram,
  eventDate,
  eventUrl,
  slug,
}: PrintableQrModalProps) {
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const handleDownloadHighResQrCard = async () => {
    setDownloading(true);

    try {
      // Create high-resolution printable canvas (1200 x 1600 px)
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background - Warm Cream
      ctx.fillStyle = '#F8F5F0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Decorative Outer Border
      ctx.strokeStyle = '#D4A373';
      ctx.lineWidth = 12;
      ctx.strokeRect(60, 60, canvas.width - 120, canvas.height - 120);

      // Inner Fine Border
      ctx.strokeStyle = '#E2D9CC';
      ctx.lineWidth = 4;
      ctx.strokeRect(80, 80, canvas.width - 160, canvas.height - 160);

      // Top Monogram Initials
      if (monogram && monogram.trim().length > 0) {
        ctx.fillStyle = '#8C6D46';
        ctx.font = 'bold 56px "Playfair Display", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(monogram, canvas.width / 2, 220);
      }

      // Event Name
      ctx.fillStyle = '#2C2A29';
      ctx.font = 'bold 64px "Playfair Display", Georgia, serif';
      ctx.fillText(eventName.toUpperCase(), canvas.width / 2, 340);

      // Event Date
      ctx.fillStyle = '#78716C';
      ctx.font = '500 36px sans-serif';
      ctx.fillText(eventDate, canvas.width / 2, 420);

      // Render High-Res QR Code Image
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
        eventUrl
      )}&format=png`;

      const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = qrApiUrl;
      });

      // Draw QR Image Centered
      const qrSize = 520;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 500;

      // QR White Background Card
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
      ctx.shadowBlur = 30;
      ctx.fillRect(qrX - 40, qrY - 40, qrSize + 80, qrSize + 80);
      ctx.shadowColor = 'transparent';

      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Instruction Text
      const textY = qrY + qrSize + 140;
      ctx.fillStyle = '#2C2A29';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText('SCAN QR CODE TO START', canvas.width / 2, textY);

      ctx.fillStyle = '#78716C';
      ctx.font = '36px "Playfair Display", Georgia, italic';
      ctx.fillText('Create a memory for our special day ♡', canvas.width / 2, textY + 70);

      ctx.fillStyle = '#8C6D46';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('VIRTUAL PHOTOBOOTH', canvas.width / 2, canvas.height - 120);

      // Trigger Download
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `QR-Card-${slug}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate high-res QR card:', err);
    } finally {
      setDownloading(false);
    }
  };

  const qrPreviewUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    eventUrl
  )}&format=png`;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Printable QR Card</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Preview */}
        <div className="bg-[#F8F5F0] border-4 border-[#D4A373] rounded-2xl p-6 text-center shadow-inner space-y-4 my-2 text-[#2C2A29]">
          {monogram && monogram.trim().length > 0 && (
            <span
              className={`font-serif italic font-bold text-[#8C6D46] whitespace-nowrap block ${
                monogram.length > 4
                  ? 'text-sm'
                  : monogram.length > 2
                  ? 'text-base'
                  : 'text-xl'
              }`}
            >
              {monogram}
            </span>
          )}
          <h3 className="font-serif font-bold text-xl">{eventName}</h3>
          <p className="text-xs text-[#78716C]">{eventDate}</p>

          <div className="p-3 bg-white rounded-xl shadow-md inline-block my-2">
            <img src={qrPreviewUrl} alt="QR Code Preview" className="w-36 h-36 object-contain" />
          </div>

          <p className="text-xs font-bold text-[#2C2A29] uppercase tracking-wider">
            Scan QR Code to Start Photobooth
          </p>
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          High-resolution PNG image ready for acrylic board or table print.
        </p>

        <div className="pt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-400 text-sm font-medium hover:bg-slate-800"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleDownloadHighResQrCard}
            disabled={downloading}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Generating PNG...' : 'Download Printable QR (PNG)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
