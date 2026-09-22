'use client';

import { useState, useEffect } from 'react';
import {
  Printer,
  X,
  Check,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { PrintLayoutType } from '@/lib/types/database';

interface GuestRequestPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string;
  photoId: string;
  eventId: string;
  initialGuestName?: string;
  guestId?: string | null;
  onSuccess?: () => void;
}

export default function GuestRequestPrintModal({
  isOpen,
  onClose,
  photoUrl,
  photoId,
  eventId,
  initialGuestName = '',
  guestId = null,
  onSuccess,
}: GuestRequestPrintModalProps) {
  const [guestName, setGuestName] = useState(initialGuestName);
  const [layoutType, setLayoutType] = useState<PrintLayoutType>('strip_2x6');
  const [copies, setCopies] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-detect format based on frame/photo dimensions so guest does not need to choose
  useEffect(() => {
    if (!photoUrl) return;
    const img = new Image();
    img.src = photoUrl;
    img.onload = () => {
      if (img.naturalHeight && img.naturalWidth) {
        const ratio = img.naturalHeight / img.naturalWidth;
        // Rasio strip 2x6 biasanya ~3.0 (tinggi 3x lebar), sedangkan 4R biasanya 1.5 (portrait) atau 0.67 (landscape)
        if (ratio >= 2.0) {
          setLayoutType('strip_2x6');
        } else {
          setLayoutType('full_4r');
        }
      }
    };
  }, [photoUrl]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/print/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          photoId,
          guestId,
          guestName: guestName.trim() || 'Tamu Undangan',
          layoutType,
          copies,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.message || 'Gagal mengirim permintaan cetak.');
      }

      setSuccess(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Request print error:', err);
      setErrorMessage(err?.message || 'Terjadi kesalahan saat mengirim permintaan cetak.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#FAF6EE] text-[#2C2A29] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[#E2D9CC] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2D9CC] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#8C6D46]/10 text-[#8C6D46] flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#2C2A29]">
                Minta Cetak di Booth
              </h3>
              <p className="text-[11px] text-[#78716C]">
                Cetak lembar fisik foto kenangan Anda di lokasi acara
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F4EFE6] hover:bg-[#EAE2D5] text-[#78716C] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {success ? (
            <div className="py-6 flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-serif text-xl font-bold text-[#2C2A29]">
                Permintaan Berhasil Dikirim!
              </h4>
              <p className="text-xs text-[#78716C] leading-relaxed max-w-xs">
                Foto Anda telah masuk ke <strong>antrian print station</strong> operator. Silakan
                datangi booth photobooth untuk mengambil lembar cetak foto Anda!
              </p>

              <div className="w-full pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3.5 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-bold text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Photo Thumbnail */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-[#E2D9CC] shadow-xs">
                <div className="w-14 h-20 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0 flex items-center justify-center">
                  <img
                    src={photoUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D46] block">
                    Foto Siap Cetak
                  </span>
                  <p className="text-xs font-semibold text-[#2C2A29] truncate mt-0.5">
                    Kualitas Cetak Tajam (300 DPI)
                  </p>
                  <p className="text-[11px] text-[#78716C] mt-0.5">
                    Dicetak langsung di kertas foto profesional.
                  </p>
                </div>
              </div>

              {/* Format Cetak Otomatis (Sesuai Ukuran Kertas & Frame) */}
              <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-[#E2D9CC] shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#8C6D46]/10 text-[#8C6D46] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C6D46] block">
                      Format Cetak Otomatis
                    </span>
                    <p className="text-xs font-bold text-[#2C2A29] leading-tight mt-0.5">
                      {layoutType === 'strip_2x6' ? 'Strip Photobooth (Dual Strip 2×6" di Kertas 4R)' : 'Full Foto 4R (4×6 Inci)'}
                    </p>
                    <p className="text-[10px] text-[#78716C] mt-0.5">
                      Tata letak disesuaikan langsung dengan frame foto Anda.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <Check className="w-3 h-3" />
                  Presisi
                </span>
              </div>

              {/* Guest Name Input */}
              <div>
                <label className="block text-xs font-semibold text-[#2C2A29] mb-1.5">
                  Nama Anda / Pemesan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Masukkan nama Anda (misal: Sarah & Dimas)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2D9CC] bg-white text-xs text-[#2C2A29] focus:outline-none focus:ring-2 focus:ring-[#8C6D46]/40 focus:border-[#8C6D46]"
                />
              </div>

              {/* Number of Copies */}
              <div>
                <label className="block text-xs font-semibold text-[#2C2A29] mb-1.5">
                  Jumlah Lembar
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCopies(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        copies === num
                          ? 'bg-[#2C2A29] text-white border-[#2C2A29]'
                          : 'bg-white border-[#E2D9CC] text-[#78716C] hover:bg-[#F4EFE6]'
                      }`}
                    >
                      {num} Lembar
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message if any */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-bold text-xs tracking-wider uppercase transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-75"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#D4A373]" />
                      <span>Mengirim Permintaan...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4 text-[#D4A373]" />
                      <span>Kirim Permintaan Cetak ke Booth</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
