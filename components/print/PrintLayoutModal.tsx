'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  Check,
  Columns,
  Maximize2,
  Grid,
  Scissors,
  RotateCw,
  Copy,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { PrintLayoutType } from '@/lib/types/database';

export interface PrintJobData {
  photoUrl: string;
  guestName?: string;
  layoutType?: PrintLayoutType | string;
  copies?: number;
  requestId?: string;
}

interface PrintLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: PrintJobData | null;
  onPrintComplete?: (requestId?: string) => Promise<void> | void;
}

export default function PrintLayoutModal({
  isOpen,
  onClose,
  job,
  onPrintComplete,
}: PrintLayoutModalProps) {
  const [layout, setLayout] = useState<PrintLayoutType>('strip_2x6');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [copies, setCopies] = useState<number>(1);
  const [showCutGuide, setShowCutGuide] = useState<boolean>(true);
  const [autoMarkCompleted, setAutoMarkCompleted] = useState<boolean>(true);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [mountReady, setMountReady] = useState<boolean>(false);

  // Sync incoming job layout and copies
  useEffect(() => {
    if (job) {
      if (job.layoutType && ['strip_2x6', 'full_4r', 'grid_2r', 'single_strip'].includes(job.layoutType)) {
        setLayout(job.layoutType as PrintLayoutType);
      } else {
        setLayout('strip_2x6');
      }
      setCopies(job.copies && job.copies > 0 ? job.copies : 1);
    }
  }, [job]);

  // Ensure photobooth-print-mount exists in body
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let mount = document.getElementById('photobooth-print-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'photobooth-print-mount';
      document.body.appendChild(mount);
    }
    setMountReady(true);

    return () => {
      // Keep mount in DOM for continuous printing
    };
  }, []);

  if (!isOpen || !job || !job.photoUrl) return null;

  // Execute print with browser window.print()
  const handlePrint = async () => {
    setIsPrinting(true);

    try {
      // 1. Inject precise page orientation style
      let pageStyleEl = document.getElementById('photobooth-print-page-style');
      if (!pageStyleEl) {
        pageStyleEl = document.createElement('style');
        pageStyleEl.id = 'photobooth-print-page-style';
        document.head.appendChild(pageStyleEl);
      }

      if (orientation === 'landscape') {
        pageStyleEl.innerHTML = `@page { size: 6in 4in; margin: 0; }`;
      } else {
        pageStyleEl.innerHTML = `@page { size: 4in 6in; margin: 0; }`;
      }

      // 2. Allow DOM to flush render to mount element
      await new Promise((resolve) => setTimeout(resolve, 250));

      // 3. Trigger native print
      window.print();

      // 4. If linked to an antrian request and autoMarkCompleted is checked
      if (autoMarkCompleted && job.requestId && onPrintComplete) {
        await onPrintComplete(job.requestId);
      }
    } catch (err) {
      console.error('Print execution error:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  // Render Sheet Content according to layout
  const renderSheetContent = (isForPrint: boolean = false) => {
    const isLandscape = orientation === 'landscape';

    // 1. DUAL STRIP 2x6 ON 4R (Standar Photobooth)
    if (layout === 'strip_2x6') {
      return (
        <div
          className={`w-full h-full flex ${
            isLandscape ? 'flex-col' : 'flex-row'
          } items-center justify-center bg-white relative overflow-hidden`}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Strip 1 */}
          <div className="flex-1 h-full w-full flex items-center justify-center p-0.5 overflow-hidden">
            <img
              src={job.photoUrl}
              alt="Strip 1"
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: '100%', maxWidth: '100%' }}
            />
          </div>

          {/* Cut Guideline */}
          {showCutGuide && (
            <div
              className={`relative z-10 flex items-center justify-center ${
                isLandscape
                  ? 'w-full h-[1px] border-b border-dashed border-neutral-300'
                  : 'h-full w-[1px] border-r border-dashed border-neutral-300'
              }`}
            >
              {!isForPrint && (
                <span className="absolute bg-white px-1 text-[8px] font-mono text-neutral-400 uppercase tracking-tighter">
                  Garis Potong
                </span>
              )}
            </div>
          )}

          {/* Strip 2 (Duplicate) */}
          <div className="flex-1 h-full w-full flex items-center justify-center p-0.5 overflow-hidden">
            <img
              src={job.photoUrl}
              alt="Strip 2"
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: '100%', maxWidth: '100%' }}
            />
          </div>
        </div>
      );
    }

    // 2. FULL 4R SINGLE PHOTO
    if (layout === 'full_4r') {
      return (
        <div
          className="w-full h-full flex items-center justify-center bg-white p-1 overflow-hidden"
          style={{ width: '100%', height: '100%' }}
        >
          <img
            src={job.photoUrl}
            alt="Full 4R"
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: '100%', maxWidth: '100%' }}
          />
        </div>
      );
    }

    // 3. 4x MINI 2R ON 4R GRID (Dompet / Souvenir)
    if (layout === 'grid_2r') {
      return (
        <div
          className="w-full h-full grid grid-cols-2 grid-rows-2 bg-white relative overflow-hidden"
          style={{ width: '100%', height: '100%' }}
        >
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`flex items-center justify-center p-1 relative overflow-hidden ${
                showCutGuide ? 'border border-dashed border-neutral-200' : ''
              }`}
            >
              <img
                src={job.photoUrl}
                alt={`Mini 2R ${idx + 1}`}
                className="max-w-full max-h-full object-contain"
                style={{ maxHeight: '100%', maxWidth: '100%' }}
              />
            </div>
          ))}
        </div>
      );
    }

    // 4. SINGLE STRIP 2x6 (For 2" roll / direct-cut printer)
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-white p-1 overflow-hidden"
        style={{ width: '100%', height: '100%' }}
      >
        <img
          src={job.photoUrl}
          alt="Single Strip"
          className="max-w-full max-h-full object-contain"
          style={{ maxHeight: '100%', maxWidth: '100%' }}
        />
      </div>
    );
  };

  // Portal content that will be placed inside #photobooth-print-mount
  const printMountElement = typeof document !== 'undefined' ? document.getElementById('photobooth-print-mount') : null;

  return (
    <>
      {/* 1. ON-SCREEN MODAL PREVIEW & CONTROLS */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
        <div className="bg-[#1A1817] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white">
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#24211F]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/15 text-[#D4A373] flex items-center justify-center border border-[#D4A373]/30">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-wide">
                    Print Station — Pratinjau Cetak
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A373]/20 text-[#D4A373]">
                    Kertas 4R (4×6")
                  </span>
                </div>
                <p className="text-xs text-white/50">
                  {job.guestName ? `Tamu: ${job.guestName}` : 'Foto Kenangan Photobooth'}
                  {job.requestId && ' • Permintaan Tamu'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Paper Visual Simulation (4R Sheet) */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center bg-[#121110] rounded-2xl p-4 sm:p-6 border border-white/5">
              <div className="w-full flex items-center justify-between text-xs text-white/50 mb-3 px-1">
                <span>Simulasi Lembar Kertas Fisik</span>
                <span className="font-mono text-[#D4A373]">
                  {orientation === 'landscape' ? '6" × 4" (Landscape)' : '4" × 6" (Portrait)'}
                </span>
              </div>

              {/* 4R Paper Canvas representation */}
              <div
                className={`bg-white rounded-lg shadow-2xl relative border-2 border-white/90 transition-all duration-300 flex items-center justify-center overflow-hidden ${
                  orientation === 'landscape'
                    ? 'w-full max-w-[420px] aspect-[6/4]'
                    : 'w-full max-w-[280px] aspect-[4/6]'
                }`}
                style={{
                  boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                }}
              >
                {renderSheetContent(false)}
              </div>

              <p className="text-[11px] text-white/40 text-center mt-3 max-w-xs">
                {layout === 'strip_2x6' &&
                  '2 strip identik dicetak berdampingan di kertas 4R. Potong garis tengah untuk mendapatkan 2 strip terpisah.'}
                {layout === 'full_4r' &&
                  '1 foto dicetak penuh pada 1 lembar kertas 4R (10×15 cm).'}
                {layout === 'grid_2r' &&
                  '4 foto mini ukuran dompet (2R) dalam 1 lembar kertas 4R. Sangat pas untuk souvenir tamu.'}
                {layout === 'single_strip' &&
                  '1 strip 2x6 dicetak di kertas.'}
              </p>
            </div>

            {/* Right: Print Presets & Settings */}
            <div className="lg:col-span-5 space-y-5">
              {/* 1. Layout Preset Selector */}
              <div>
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider block mb-2">
                  Format / Layout Kertas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Option: Dual Strip 2x6 */}
                  <button
                    type="button"
                    onClick={() => setLayout('strip_2x6')}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      layout === 'strip_2x6'
                        ? 'bg-[#D4A373]/15 border-[#D4A373] text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Columns className="w-4 h-4 text-[#D4A373]" />
                      {layout === 'strip_2x6' && <Check className="w-3.5 h-3.5 text-[#D4A373]" />}
                    </div>
                    <span className="text-xs font-bold block">Dual Strip 2×6"</span>
                    <span className="text-[10px] text-white/50 block">2 strip pada 4R (Standar)</span>
                  </button>

                  {/* Option: Full 4R */}
                  <button
                    type="button"
                    onClick={() => setLayout('full_4r')}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      layout === 'full_4r'
                        ? 'bg-[#D4A373]/15 border-[#D4A373] text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Maximize2 className="w-4 h-4 text-[#D4A373]" />
                      {layout === 'full_4r' && <Check className="w-3.5 h-3.5 text-[#D4A373]" />}
                    </div>
                    <span className="text-xs font-bold block">Full 4R (1 Foto)</span>
                    <span className="text-[10px] text-white/50 block">1 lembar penuh (10×15 cm)</span>
                  </button>

                  {/* Option: 4x Mini 2R Grid */}
                  <button
                    type="button"
                    onClick={() => setLayout('grid_2r')}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      layout === 'grid_2r'
                        ? 'bg-[#D4A373]/15 border-[#D4A373] text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Grid className="w-4 h-4 text-[#D4A373]" />
                      {layout === 'grid_2r' && <Check className="w-3.5 h-3.5 text-[#D4A373]" />}
                    </div>
                    <span className="text-xs font-bold block">4× Mini 2R</span>
                    <span className="text-[10px] text-white/50 block">4 foto mini dompet di 4R</span>
                  </button>

                  {/* Option: Single Strip 2x6 */}
                  <button
                    type="button"
                    onClick={() => setLayout('single_strip')}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      layout === 'single_strip'
                        ? 'bg-[#D4A373]/15 border-[#D4A373] text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Scissors className="w-4 h-4 text-[#D4A373]" />
                      {layout === 'single_strip' && <Check className="w-3.5 h-3.5 text-[#D4A373]" />}
                    </div>
                    <span className="text-xs font-bold block">Single Strip 2×6"</span>
                    <span className="text-[10px] text-white/50 block">1 strip tunggal</span>
                  </button>
                </div>
              </div>

              {/* 2. Orientation & Cut Guide */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-white/70 uppercase tracking-wider block mb-2">
                    Orientasi Kertas
                  </label>
                  <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setOrientation('portrait')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                        orientation === 'portrait'
                          ? 'bg-[#D4A373] text-[#1A1817] shadow-sm'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientation('landscape')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                        orientation === 'landscape'
                          ? 'bg-[#D4A373] text-[#1A1817] shadow-sm'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 uppercase tracking-wider block mb-2">
                    Garis Potong
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCutGuide(!showCutGuide)}
                    className={`w-full py-2.5 px-3 rounded-2xl border text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                      showCutGuide
                        ? 'bg-[#D4A373]/10 border-[#D4A373]/50 text-[#D4A373]'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <span>{showCutGuide ? 'Aktif (Garis Tipis)' : 'Tanpa Garis'}</span>
                    <Scissors className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 3. Number of Copies */}
              <div>
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider block mb-2">
                  Jumlah Lembar Cetak
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCopies(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        copies === num
                          ? 'bg-[#D4A373] text-[#1A1817] border-[#D4A373]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {num} Lembar
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Auto Mark Completed Checkbox */}
              {job.requestId && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoMarkCompleted}
                    onChange={(e) => setAutoMarkCompleted(e.target.checked)}
                    className="w-4 h-4 rounded text-[#D4A373] focus:ring-[#D4A373] bg-[#2C2A29] border-white/20"
                  />
                  <span className="text-xs text-white/80">
                    Otomatis tandai antrian ini sebagai <strong>"Selesai Dicetak"</strong>
                  </span>
                </label>
              )}

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#D4A373] via-[#E5B887] to-[#B88746] hover:from-[#C5925F] hover:to-[#A77838] text-[#1A1817] font-bold text-sm tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-75"
                >
                  {isPrinting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-[#1A1817]" />
                      <span>Mempersiapkan Cetak...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-5 h-5 text-[#1A1817]" />
                      <span>Cetak Sekarang (Print)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl text-white/60 hover:text-white text-xs font-medium transition-colors text-center cursor-pointer"
                >
                  Tutup Pratinjau
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. OFF-SCREEN PRINT MOUNT PORTAL (Only visible during window.print()) */}
      {mountReady && printMountElement && createPortal(
        <div
          style={{
            width: orientation === 'landscape' ? '6in' : '4in',
            height: orientation === 'landscape' ? '4in' : '6in',
            margin: 0,
            padding: 0,
            background: '#ffffff',
            boxSizing: 'border-box',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}
        >
          {Array.from({ length: copies }).map((_, cIdx) => (
            <div
              key={cIdx}
              style={{
                width: orientation === 'landscape' ? '6in' : '4in',
                height: orientation === 'landscape' ? '4in' : '6in',
                pageBreakAfter: cIdx < copies - 1 ? 'always' : 'auto',
                breakAfter: cIdx < copies - 1 ? 'page' : 'auto',
                overflow: 'hidden',
              }}
            >
              {renderSheetContent(true)}
            </div>
          ))}
        </div>,
        printMountElement
      )}
    </>
  );
}
