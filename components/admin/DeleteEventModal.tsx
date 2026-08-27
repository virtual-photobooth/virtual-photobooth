'use client';

import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface DeleteEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventName: string;
  isDeleting?: boolean;
}

export default function DeleteEventModal({
  isOpen,
  onClose,
  onConfirm,
  eventName,
  isDeleting = false,
}: DeleteEventModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div
        className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center space-y-6 transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Icon Button */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute right-5 top-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon Badge */}
        <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
          <Trash2 className="w-8 h-8 animate-pulse" />
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-slate-900">
            Hapus Event Permanen?
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Apakah Anda yakin ingin menghapus event <strong className="text-slate-900 font-extrabold">&quot;{eventName}&quot;</strong>?
          </p>
        </div>

        {/* Highlighted Warning Box */}
        <div className="p-4 rounded-2xl bg-red-50/80 border border-red-200/80 text-left space-y-1.5 text-xs text-red-900">
          <div className="flex items-center gap-2 font-bold text-red-800 uppercase tracking-wider text-[10px]">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>Peringatan Tindakan Permanen</span>
          </div>
          <p className="text-[11px] text-red-700 leading-normal">
            Seluruh foto komposit tamu, rekaman suara ucapan, bingkai foto PNG, dan foto cover event ini akan <strong className="font-bold underline">dihapus permanen</strong> dari database dan cloud storage.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Permanen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
