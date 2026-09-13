'use client';

import { useState, useEffect, useCallback } from 'react';
import { EventFrame } from '@/lib/types/database';
import { validateFrameFile } from '@/lib/utils/frame-validator';
import { getStoragePublicUrl } from '@/lib/storage/url';
import { adminFetch } from '@/lib/auth/client-admin-auth';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Image as ImageIcon,
  X,
  Layers,
  Star,
} from 'lucide-react';

interface AdminFramesManagerProps {
  eventId: string;
  initialFramePath?: string | null;
  onFramesCountChange?: (count: number) => void;
}

export default function AdminFramesManager({
  eventId,
  initialFramePath,
  onFramesCountChange,
}: AdminFramesManagerProps) {
  const [frames, setFrames] = useState<EventFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Frame Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFrameName, setNewFrameName] = useState('');
  const [newFramePhotoCount, setNewFramePhotoCount] = useState<number>(4);
  const [newFrameFile, setNewFrameFile] = useState<File | null>(null);
  const [newFramePreviewUrl, setNewFramePreviewUrl] = useState<string | null>(null);
  const [newFrameInfo, setNewFrameInfo] = useState<{ width: number; height: number; orientation: string } | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load Frames for this Event
  const fetchFrames = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch(`/api/admin/frames?eventId=${eventId}`);
      const data = await res.json();

      if (res.ok && data.success && Array.isArray(data.frames)) {
        if (data.frames.length > 0) {
          setFrames(data.frames);
          onFramesCountChange?.(data.frames.length);
        } else {
          setFrames([]);
          onFramesCountChange?.(0);
        }
      } else {
        throw new Error(data.message || 'Gagal memuat data frame');
      }
    } catch (err: any) {
      console.error('Error fetching event frames:', err);
      setMessage({ type: 'error', text: err.message || 'Gagal mengambil daftar frame.' });
    } finally {
      setLoading(false);
    }
  }, [eventId, initialFramePath, onFramesCountChange]);

  useEffect(() => {
    fetchFrames();
  }, [fetchFrames]);

  // Handle File Selection (Portrait, Landscape, or any aspect ratio)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileValidationError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validateFrameFile(file);
    if (!validation.valid) {
      setFileValidationError(validation.error || 'Format tidak valid. Wajib file PNG.');
      setNewFrameFile(null);
      setNewFramePreviewUrl(null);
      setNewFrameInfo(null);
      return;
    }

    setNewFrameFile(file);
    setNewFramePreviewUrl(URL.createObjectURL(file));
    setNewFrameInfo({
      width: validation.width || 0,
      height: validation.height || 0,
      orientation: validation.orientation || 'portrait',
    });

    // Auto-fill suggested name if empty
    if (!newFrameName.trim()) {
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setNewFrameName(`Frame ${cleanFileName.charAt(0).toUpperCase() + cleanFileName.slice(1)}`);
    }
  };

  // Submit New Frame Upload (POST /api/admin/frames)
  const handleCreateFrame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFrameFile) {
      setFileValidationError('Silakan pilih file template PNG.');
      return;
    }

    if (!newFrameName.trim()) {
      setMessage({ type: 'error', text: 'Nama frame wajib diisi.' });
      return;
    }

    if (!newFramePhotoCount || newFramePhotoCount <= 0) {
      setMessage({ type: 'error', text: 'Jumlah foto/pose wajib ditentukan (minimal 1).' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('eventId', eventId);
      formData.append('name', newFrameName.trim());
      formData.append('photo_count', String(newFramePhotoCount));
      formData.append('file', newFrameFile);

      const res = await adminFetch('/api/admin/frames', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengupload frame baru');
      }

      setMessage({ type: 'success', text: `Frame "${newFrameName.trim()}" berhasil ditambahkan!` });
      setIsAddModalOpen(false);
      setNewFrameName('');
      setNewFramePhotoCount(4);
      setNewFrameFile(null);
      setNewFramePreviewUrl(null);
      setNewFrameInfo(null);
      setFileValidationError(null);

      // Refresh frame list
      await fetchFrames();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Terjadi kesalahan saat upload frame.' });
    } finally {
      setUploading(false);
    }
  };

  // Set Frame as Default (PATCH /api/admin/frames)
  const handleSetDefault = async (frameId: string) => {
    setActionLoading(frameId);
    setMessage(null);

    try {
      const res = await adminFetch('/api/admin/frames', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: frameId,
          eventId: eventId,
          is_default: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengubah default frame');
      }

      setMessage({ type: 'success', text: 'Frame default berhasil diperbarui!' });
      await fetchFrames();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal mengubah frame default.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Frame (DELETE /api/admin/frames)
  const handleDeleteFrame = async (frame: EventFrame) => {
    let confirmMsg = `Yakin ingin menghapus frame "${frame.name}"?`;
    if (frames.length <= 1) {
      confirmMsg = `Frame "${frame.name}" adalah satu-satunya frame untuk event ini. Jika dihapus, event akan kosong sampai frame baru ditambahkan. Yakin ingin menghapus?`;
    } else if (frame.is_default) {
      confirmMsg = `Frame "${frame.name}" adalah frame DEFAULT saat ini. Jika dihapus, frame lain akan otomatis dijadikan default. Yakin ingin menghapus?`;
    }

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(frame.id);
    setMessage(null);

    try {
      const res = await adminFetch(`/api/admin/frames?id=${frame.id}&eventId=${eventId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menghapus frame');
      }

      setMessage({ type: 'success', text: `Frame "${frame.name}" berhasil dihapus.` });
      await fetchFrames();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Gagal menghapus frame.' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-[#2A473E] flex items-center justify-center border border-emerald-200/80 shadow-2xs shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#1A2621]">Event Frames</h3>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200/80">
              {frames.length} Frame
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Kelola template PNG frame (portrait, landscape, dsb.) dan jumlah pose foto untuk event ini.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsAddModalOpen(true);
            setMessage(null);
          }}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Frame</span>
        </button>
      </div>

      {/* Inline Feedback Alerts */}
      {message && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2.5 border transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Frames List Container */}
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
          <span className="text-xs">Memuat frame event...</span>
        </div>
      ) : frames.length === 0 ? (
        <div className="py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-4 text-center">
          <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs font-medium text-slate-500">Belum ada frame yang diupload</p>
          <p className="text-[10px] text-slate-400 mt-1">
            Klik &quot;Tambah Frame&quot; untuk menambahkan template frame PNG (portrait, landscape, atau bebas).
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {frames.map((frame) => {
            const frameUrl = frame.publicUrl || frame.frameUrl;
            const isProcessing = actionLoading === frame.id;
            const isSoleFrame = frames.length <= 1;

            return (
              <div
                key={frame.id}
                className={`relative p-3.5 rounded-2xl border transition-all flex items-center gap-3.5 bg-white shadow-2xs ${
                  frame.is_default
                    ? 'border-emerald-300 ring-1 ring-emerald-200/60 bg-gradient-to-r from-emerald-50/25 to-white'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Frame Thumbnail Preview */}
                <div className="relative w-18 h-22 shrink-0 rounded-xl overflow-hidden border border-slate-200/90 bg-slate-50 flex items-center justify-center shadow-xs">
                  {frameUrl ? (
                    <img
                      src={frameUrl}
                      alt={frame.name}
                      className="w-full h-full object-contain p-0.5"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-300" />
                  )}

                  {frame.is_default && (
                    <div className="absolute top-1 right-1 bg-emerald-700 text-white p-0.5 rounded-full shadow-xs" title="Frame Default Aktif">
                      <Star className="w-2.5 h-2.5 fill-current" />
                    </div>
                  )}
                </div>

                {/* Frame Information */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-[#1A2621] truncate">
                      {frame.name}
                    </h4>
                    {frame.is_default && (
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 tracking-wider inline-flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        Default
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/80 text-amber-900 leading-none inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {frame.photo_count} Pose Foto
                    </span>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100 flex-wrap">
                    {!frame.is_default && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleSetDefault(frame.id)}
                        className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200/80 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <Star className="w-3 h-3" />
                        <span>{isProcessing ? 'Menyimpan...' : 'Jadikan Default'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleDeleteFrame(frame)}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD FRAME MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-700" />
                <h3 className="text-sm font-bold text-[#1A2621]">Tambah Frame Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateFrame} className="space-y-4">
              {/* 1. Nama Frame */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                  Nama Frame *
                </label>
                <input
                  type="text"
                  required
                  value={newFrameName}
                  onChange={(e) => setNewFrameName(e.target.value)}
                  placeholder="Contoh: Frame 2 - Minimalist Black"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 font-medium focus:outline-none"
                />
              </div>

              {/* 2. Photo Count / Jumlah Pose (Explicitly Selected) */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                  Jumlah Foto / Pose *
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Tentukan jumlah jepretan kamera yang dibutuhkan oleh desain frame ini.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setNewFramePhotoCount(count)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        newFramePhotoCount === count
                          ? 'bg-[#2A473E] text-white border-[#2A473E] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {count} Pose
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Atau ketik kustom:</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newFramePhotoCount}
                    onChange={(e) => setNewFramePhotoCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-lg p-1.5 text-xs text-slate-800 font-mono text-center focus:outline-none"
                  />
                </div>
              </div>

              {/* 3. Upload File PNG (Portrait, Landscape, or Custom Dimensions) */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                  File PNG Frame (Portrait / Landscape / Bebas) *
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Upload template frame berformat PNG dengan area transparan (mendukung portrait, landscape, square, atau ukuran bebas).
                </p>

                {newFramePreviewUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 flex items-center justify-center p-1 shadow-2xs">
                      <img
                        src={newFramePreviewUrl}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {newFrameFile?.name}
                      </p>
                      <p className="text-[11px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>
                          Format PNG Valid ({newFrameInfo?.width} × {newFrameInfo?.height} px • {newFrameInfo?.orientation === 'portrait' ? 'Portrait' : newFrameInfo?.orientation === 'landscape' ? 'Landscape' : 'Square'})
                        </span>
                      </p>
                      <label className="inline-block text-[10px] text-[#2A473E] hover:underline font-semibold cursor-pointer mt-1">
                        Ganti File
                        <input
                          type="file"
                          accept="image/png"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="w-full aspect-[4/2] bg-slate-50 hover:bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-300 flex flex-col items-center justify-center p-4 cursor-pointer transition-all">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs font-semibold text-slate-700">Pilih File PNG</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Maks 15MB • Portrait / Landscape / Bebas</span>
                    <input
                      type="file"
                      accept="image/png"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}

                {fileValidationError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium mt-2 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{fileValidationError}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={uploading || !newFrameFile}
                  className="px-5 py-2.5 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengupload...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Simpan Frame</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
