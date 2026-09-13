'use client';

import React from 'react';
import { EventFrame } from '@/lib/types/database';
import { Camera, Check, ArrowRight, ArrowLeft, Sparkles, Image as ImageIcon } from 'lucide-react';

interface FrameSelectorProps {
  frames: EventFrame[];
  selectedFrame: EventFrame | null;
  onSelectFrame: (frame: EventFrame) => void;
  onConfirm: () => void;
  onBack: () => void;
  eventName?: string;
  monogram?: string | null;
}

export default function FrameSelector({
  frames,
  selectedFrame,
  onSelectFrame,
  onConfirm,
  onBack,
  eventName,
  monogram,
}: FrameSelectorProps) {
  const activeFrame = selectedFrame || frames[0] || null;

  return (
    <div className="flex-1 flex flex-col justify-between items-center text-center animate-fade-in py-2 max-w-lg mx-auto w-full px-2 sm:px-4">
      {/* Top Monogram & Header */}
      <div className="w-full pt-2 pb-1 space-y-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#78716C] hover:text-[#2C2A29] transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-[#F4EFE6]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Beranda</span>
        </button>

        <div className="pt-1">
          {monogram && (
            <span className="text-[10px] font-mono tracking-[0.25em] text-[#8C6D46] uppercase font-bold block mb-1">
              {monogram}
            </span>
          )}
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2C2A29] tracking-tight">
            Pilih Desain Frame
          </h2>
          <p className="text-xs text-[#78716C] font-sans mt-1">
            Pilih template photobooth yang kamu inginkan untuk sesi foto ini
          </p>
        </div>
      </div>

      {/* Frame Cards Grid / Carousel */}
      <div className="w-full my-auto py-3 overflow-y-auto max-h-[62vh] pr-1">
        <div
          className={`grid gap-3 sm:gap-4 w-full ${
            frames.length === 2
              ? 'grid-cols-2'
              : frames.length >= 3
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-1 max-w-xs mx-auto'
          }`}
        >
          {frames.map((frame) => {
            const isSelected = activeFrame?.id === frame.id;
            const previewUrl = frame.publicUrl || frame.frameUrl;

            return (
              <div
                key={frame.id}
                onClick={() => onSelectFrame(frame)}
                className={`group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 text-left border-2 ${
                  isSelected
                    ? 'border-[#8C6D46] bg-white ring-3 ring-[#8C6D46]/30 shadow-lg scale-[1.01]'
                    : 'border-[#E2D9CC] bg-white/70 hover:border-[#8C6D46]/60 hover:bg-white hover:shadow-md'
                }`}
              >
                {/* Frame Preview Container */}
                <div className="relative aspect-[3/4] w-full bg-[#F4EFE6] flex items-center justify-center overflow-hidden p-1.5">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={frame.name}
                      className="w-full h-full object-contain rounded-xl drop-shadow-sm transition-transform duration-200 group-hover:scale-102"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#8C6D46]/40 p-2 text-center">
                      <ImageIcon className="w-8 h-8 mb-1" />
                      <span className="text-[10px] font-mono">No Preview</span>
                    </div>
                  )}

                  {/* Photo Count Badge (Top-Left) */}
                  <div className="absolute top-2 left-2 z-10">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2C2A29]/90 text-white backdrop-blur-md shadow-xs">
                      <Camera className="w-2.5 h-2.5 text-[#D4A373]" />
                      <span>{frame.photo_count} Pose</span>
                    </span>
                  </div>

                  {/* Selection Checkmark Badge (Top-Right) */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-[#8C6D46] text-white flex items-center justify-center shadow-md animate-scale-up">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}

                  {/* Default Frame Tag */}
                  {frame.is_default && (
                    <div className="absolute bottom-2 right-2 z-10">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-white/90 text-[#8C6D46] border border-[#8C6D46]/30 shadow-xs">
                        Default
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Frame Name & Photo Count Details */}
                <div className="p-2.5 bg-white flex flex-col justify-between border-t border-[#E2D9CC]/60">
                  <div className="truncate font-semibold text-xs text-[#2C2A29]">
                    {frame.name || 'Frame'}
                  </div>
                  <div className="text-[10px] text-[#78716C] mt-0.5 flex items-center gap-1 font-mono">
                    <span>{frame.photo_count} kali jepretan</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Confirmation Action */}
      <div className="w-full pt-2 pb-1 space-y-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!activeFrame}
          className="w-full py-3.5 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-bold text-xs tracking-widest uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-[#423E3C] disabled:opacity-50"
        >
          <Camera className="w-4 h-4 text-[#D4A373]" />
          <span>
            LANJUT KE KAMERA ({activeFrame?.photo_count || 1} FOTO)
          </span>
          <ArrowRight className="w-4 h-4 text-[#D4A373]" />
        </button>

        <p className="text-[10px] text-[#78716C] italic font-serif">
          * Kamera akan mengambil {activeFrame?.photo_count || 1} foto sesuai layout frame yang dipilih
        </p>
      </div>
    </div>
  );
}
