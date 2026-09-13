'use client';

import React from 'react';
import { EventFrame } from '@/lib/types/database';
import { Check, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';

interface ResultFrameSwitcherProps {
  frames: EventFrame[];
  selectedFrame: EventFrame | null;
  currentPhotoCount: number;
  switchingFrameId: string | null;
  onSelectFrame: (frame: EventFrame) => void;
}

export default function ResultFrameSwitcher({
  frames,
  selectedFrame,
  currentPhotoCount,
  switchingFrameId,
  onSelectFrame,
}: ResultFrameSwitcherProps) {
  // If only 1 frame exists, do not show the frame switcher (keep existing single-frame UI untouched)
  if (!frames || frames.length <= 1) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center py-2 px-1">
      {/* Header Label */}
      <div className="flex items-center gap-1.5 mb-2 text-[#78716C]">
        <Sparkles className="w-3.5 h-3.5 text-[#8C6D46]" />
        <span className="text-[11px] font-medium tracking-wide uppercase font-serif">
          Ganti Desain Frame ({frames.length} Pilihan)
        </span>
      </div>

      {/* Horizontal Frame Scroll Strip */}
      <div className="w-full flex items-center justify-center gap-3 overflow-x-auto py-1 px-2 no-scrollbar max-w-sm">
        {frames.map((frame) => {
          const isSelected = selectedFrame?.id === frame.id;
          const isCompatible = frame.photo_count === currentPhotoCount;
          const isSwitching = switchingFrameId === frame.id;
          const frameUrl = frame.publicUrl || frame.frameUrl;

          return (
            <button
              key={frame.id}
              type="button"
              disabled={!isCompatible || isSwitching || isSelected}
              onClick={() => {
                if (isCompatible && !isSelected && !isSwitching) {
                  onSelectFrame(frame);
                }
              }}
              title={
                !isCompatible
                  ? `Tidak kompatibel: Frame ini membutuhkan ${frame.photo_count} foto (Anda mengambil ${currentPhotoCount} foto)`
                  : isSelected
                  ? 'Frame saat ini aktif'
                  : `Ganti ke frame ${frame.name}`
              }
              className={`group flex flex-col items-center gap-1 transition-all text-left relative focus:outline-none ${
                isSelected
                  ? 'scale-105'
                  : isCompatible
                  ? 'cursor-pointer hover:scale-102 opacity-85 hover:opacity-100'
                  : 'cursor-not-allowed opacity-40'
              }`}
            >
              {/* Thumbnail Container */}
              <div
                className={`relative w-15 h-20 sm:w-16 sm:h-22 rounded-xl overflow-hidden border-2 transition-all flex items-center justify-center shadow-xs ${
                  isSelected
                    ? 'border-[#8C6D46] ring-2 ring-[#8C6D46]/40 bg-white shadow-md'
                    : isCompatible
                    ? 'border-[#E2D9CC] bg-[#F4EFE6] group-hover:border-[#8C6D46]/60'
                    : 'border-dashed border-[#E2D9CC] bg-[#E5DFD5]/40 grayscale'
                }`}
              >
                {/* Frame Image or Placeholder */}
                {frameUrl ? (
                  <img
                    src={frameUrl}
                    alt={frame.name}
                    className="w-full h-full object-contain p-0.5"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#8C6D46]/30">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                )}

                {/* Switching Spinner Overlay */}
                {isSwitching && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-20">
                    <Loader2 className="w-5 h-5 text-[#8C6D46] animate-spin" />
                  </div>
                )}

                {/* Active Checkmark Badge */}
                {isSelected && !isSwitching && (
                  <div className="absolute top-1 right-1 bg-[#8C6D46] text-white p-0.5 rounded-full shadow-sm z-10">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}

                {/* Incompatible Overlay Badge */}
                {!isCompatible && (
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center p-0.5 z-10">
                    <span className="text-[8px] font-bold tracking-tighter uppercase px-1 py-0.5 rounded bg-black/60 text-white leading-none">
                      {frame.photo_count} Foto
                    </span>
                  </div>
                )}
              </div>

              {/* Frame Label & Pose Count */}
              <div className="flex flex-col items-center max-w-[68px] text-center">
                <span
                  className={`text-[10px] truncate w-full ${
                    isSelected ? 'font-bold text-[#2C2A29]' : 'font-medium text-[#78716C]'
                  }`}
                >
                  {frame.name}
                </span>
                <span className="text-[9px] text-[#8C6D46] font-mono leading-none">
                  {frame.photo_count} Pose
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Incompatible Helper Hint if some frames are disabled */}
      {frames.some((f) => f.photo_count !== currentPhotoCount) && (
        <p className="text-[9px] text-[#78716C]/80 mt-1 font-serif italic">
          * Frame dengan jumlah pose berbeda tidak dapat dipilih tanpa foto ulang
        </p>
      )}
    </div>
  );
}
