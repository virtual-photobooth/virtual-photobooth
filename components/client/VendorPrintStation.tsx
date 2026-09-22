'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Printer,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Columns,
  Maximize2,
  Grid,
  Scissors,
  Trash2,
  Check,
  Search,
  SlidersHorizontal,
  Image as ImageIcon,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import PrintLayoutModal, { PrintJobData } from '@/components/print/PrintLayoutModal';
import { PrintRequest, PrintLayoutType } from '@/lib/types/database';

interface VendorPrintStationProps {
  eventId: string;
  eventName: string;
  initialQueue?: PrintRequest[];
  allPhotos?: any[];
  onQueueUpdated?: () => void;
}

export default function VendorPrintStation({
  eventId,
  eventName,
  initialQueue = [],
  allPhotos = [],
  onQueueUpdated,
}: VendorPrintStationProps) {
  const [queue, setQueue] = useState<PrintRequest[]>(initialQueue);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all' | 'completed'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoPolling, setAutoPolling] = useState(true);

  // Print Layout Modal State
  const [activePrintJob, setActivePrintJob] = useState<PrintJobData | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Manual Print Picker Modal from Gallery
  const [isGalleryPickerOpen, setIsGalleryPickerOpen] = useState(false);

  // Track previous pending count to play soft chime on new request
  const prevPendingCountRef = useRef<number>(
    initialQueue.filter((i) => i.status === 'pending').length
  );

  // Fetch latest print queue
  const fetchQueue = async (isBackground = false) => {
    if (!eventId) return;
    if (!isBackground) setLoading(true);

    try {
      const res = await fetch(`/api/print/queue?eventId=${encodeURIComponent(eventId)}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.queue)) {
        setQueue(data.queue);

        const newPending = data.queue.filter((i: any) => i.status === 'pending').length;
        if (newPending > prevPendingCountRef.current) {
          // Play subtle notification chime for new order
          playChime();
        }
        prevPendingCountRef.current = newPending;

        if (onQueueUpdated) onQueueUpdated();
      }
    } catch (err) {
      console.warn('Failed to poll print queue:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Soft sound notification helper
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // silent if audio context not permitted
    }
  };

  // Sync initial queue
  useEffect(() => {
    if (initialQueue && initialQueue.length > 0) {
      setQueue(initialQueue);
      prevPendingCountRef.current = initialQueue.filter((i) => i.status === 'pending').length;
    }
  }, [initialQueue]);

  // Periodic Auto-Polling (every 8 seconds)
  useEffect(() => {
    if (!autoPolling || !eventId) return;

    const interval = setInterval(() => {
      fetchQueue(true);
    }, 8000);

    return () => clearInterval(interval);
  }, [autoPolling, eventId]);

  // Update request status (e.g. mark completed)
  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    const previousQueue = [...queue];

    try {
      // Optimistic update
      setQueue((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: newStatus as any,
                printed_at: newStatus === 'completed' ? new Date().toISOString() : item.printed_at,
              }
            : item
        )
      );

      const res = await fetch('/api/print/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.message || 'Gagal memperbarui status');
      }

      fetchQueue(true);
    } catch (err: any) {
      console.error('Update status error:', err);
      setQueue(previousQueue);
      alert(err.message || 'Gagal memperbarui status antrian.');
      fetchQueue(false);
    }
  };

  // Delete request from queue
  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Hapus antrian cetak ini?')) return;
    const previousQueue = [...queue];

    try {
      setQueue((prev) => prev.filter((i) => i.id !== requestId));

      const res = await fetch(`/api/print/queue?id=${encodeURIComponent(requestId)}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.message || 'Gagal menghapus antrian');
      }

      fetchQueue(true);
    } catch (err: any) {
      console.error('Delete queue item error:', err);
      setQueue(previousQueue);
      alert(err.message || 'Gagal menghapus antrian cetak.');
      fetchQueue(false);
    }
  };

  // Trigger print modal for an item
  const openPrintModal = (item: PrintRequest) => {
    const photoUrl = item.photo?.publicUrl;
    if (!photoUrl) {
      alert('Foto untuk antrian ini tidak dapat dimuat.');
      return;
    }

    setActivePrintJob({
      photoUrl,
      guestName: item.guest_name,
      layoutType: item.layout_type,
      copies: item.copies,
      requestId: item.id,
    });
    setIsPrintModalOpen(true);
  };

  // Trigger manual print for any photo from gallery
  const openManualPrint = (photo: any) => {
    setIsGalleryPickerOpen(false);
    setActivePrintJob({
      photoUrl: photo.publicUrl,
      guestName: photo.guest?.name || photo.guest_name || 'Kenangan Acara',
      layoutType: 'strip_2x6',
      copies: 1,
    });
    setIsPrintModalOpen(true);
  };

  // Filtered queue
  const filteredQueue = queue.filter((item) => {
    if (filterStatus === 'pending' && item.status !== 'pending') return false;
    if (filterStatus === 'completed' && item.status !== 'completed') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.guest_name?.toLowerCase().includes(q);
      const matchNotes = item.notes?.toLowerCase().includes(q);
      return matchName || matchNotes;
    }

    return true;
  });

  const pendingCount = queue.filter((i) => i.status === 'pending').length;
  const completedCount = queue.filter((i) => i.status === 'completed').length;

  const getLayoutLabel = (layout: string) => {
    switch (layout) {
      case 'strip_2x6':
        return 'Dual Strip 2×6"';
      case 'full_4r':
        return 'Full 4R (1 Lembar)';
      case 'grid_2r':
        return 'Mini 2R Grid (4x)';
      case 'single_strip':
        return 'Single Strip 2×6"';
      default:
        return 'Standar 4R';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header & Live Status Bar */}
      <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F7F3EC] text-[#A27A49] flex items-center justify-center shrink-0 border border-[#E5E1DA]">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#666666] block">
                PRINT STATION
              </span>
              <h2 className="font-serif text-2xl font-light text-[#111111] tracking-tight mt-0.5">
                Antrian Cetak Foto
              </h2>
              <p className="text-xs text-[#666666] font-light mt-0.5">
                Event: <strong className="font-medium text-[#111111]">{eventName}</strong> • Cetak langsung ke printer via browser
              </p>
            </div>
          </div>
        </div>

        {/* Live monitoring badge & actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Live Polling Toggle */}
          <button
            type="button"
            onClick={() => setAutoPolling(!autoPolling)}
            className={`px-3.5 py-2 rounded-full text-xs font-mono font-medium border transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
              autoPolling
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-white border-[#E5E1DA] text-[#666666] hover:text-[#111111]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoPolling ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
              }`}
            />
            <span>{autoPolling ? 'Live Polling Aktif (8s)' : 'Live Polling Mati'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => fetchQueue(false)}
            disabled={loading}
            className="p-2 rounded-full bg-white hover:bg-neutral-50 border border-[#E5E1DA] text-[#666666] hover:text-[#111111] transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            title="Refresh Antrian"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#A27A49]' : ''}`} />
          </button>

          {/* Manual Print from Gallery */}
          <button
            type="button"
            onClick={() => setIsGalleryPickerOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] hover:bg-[#292624] text-white text-xs font-mono uppercase tracking-wider transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Cetak dari Galeri</span>
          </button>
        </div>
      </div>

      {/* 2. Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pending Requests */}
        <div
          onClick={() => setFilterStatus('pending')}
          className={`bg-white border rounded-2xl p-5 transition-all cursor-pointer shadow-2xs flex flex-col justify-between ${
            filterStatus === 'pending'
              ? 'border-[#111111] ring-1 ring-[#111111]'
              : 'border-[#E5E1DA] hover:border-[#111111]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A27A49] font-medium">
              Menunggu Cetak
            </span>
            <div className="relative">
              <Clock className="w-4 h-4 text-[#A27A49]" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-4xl sm:text-5xl font-light tracking-tight text-[#111111]">{pendingCount}</span>
            <span className="text-xs text-[#666666] font-light">lembar foto</span>
          </div>
        </div>

        {/* Completed Requests */}
        <div
          onClick={() => setFilterStatus('completed')}
          className={`bg-white border rounded-2xl p-5 transition-all cursor-pointer shadow-2xs flex flex-col justify-between ${
            filterStatus === 'completed'
              ? 'border-[#111111] ring-1 ring-[#111111]'
              : 'border-[#E5E1DA] hover:border-[#111111]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 font-medium">
              Selesai Dicetak
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-4xl sm:text-5xl font-light tracking-tight text-[#111111]">{completedCount}</span>
            <span className="text-xs text-[#666666] font-light">lembar foto</span>
          </div>
        </div>

        {/* Total Requests */}
        <div
          onClick={() => setFilterStatus('all')}
          className={`bg-white border rounded-2xl p-5 transition-all cursor-pointer shadow-2xs flex flex-col justify-between ${
            filterStatus === 'all'
              ? 'border-[#111111] ring-1 ring-[#111111]'
              : 'border-[#E5E1DA] hover:border-[#111111]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#666666] font-medium">
              Total Permintaan
            </span>
            <Printer className="w-4 h-4 text-[#666666]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-4xl sm:text-5xl font-light tracking-tight text-[#111111]">{queue.length}</span>
            <span className="text-xs text-[#666666] font-light">keseluruhan</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Filter Pills */}
        <div className="flex items-center bg-white p-1 rounded-full border border-[#E5E1DA] shadow-2xs">
          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'pending'
                ? 'bg-[#111111] text-white font-medium shadow-xs'
                : 'text-[#666666] hover:text-[#111111]'
            }`}
          >
            <span>Menunggu Cetak</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-black font-mono font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-[#111111] text-white font-medium shadow-xs'
                : 'text-[#666666] hover:text-[#111111]'
            }`}
          >
            Semua Antrian
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('completed')}
            className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
              filterStatus === 'completed'
                ? 'bg-[#111111] text-white font-medium shadow-xs'
                : 'text-[#666666] hover:text-[#111111]'
            }`}
          >
            Selesai
          </button>
        </div>

        {/* Search by guest name */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#666666] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama tamu pemesan..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E5E1DA] rounded-full text-xs font-sans text-[#111111] placeholder:text-[#666666] shadow-2xs focus:outline-none focus:border-[#111111]"
          />
        </div>
      </div>

      {/* 4. Queue Cards Grid */}
      {filteredQueue.length === 0 ? (
        <div className="bg-white border border-[#E5E1DA] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#F7F3EC] border border-[#E5E1DA] text-[#A27A49] flex items-center justify-center">
            <Printer className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="font-serif text-lg font-normal text-[#111111]">
              {filterStatus === 'pending'
                ? 'Tidak Ada Antrian yang Menunggu'
                : 'Belum Ada Permintaan Cetak'}
            </h3>
            <p className="text-xs text-[#666666] font-light leading-relaxed">
              {filterStatus === 'pending'
                ? 'Semua permintaan cetak tamu telah selesai diproses. Foto baru yang diminta tamu akan otomatis masuk ke sini.'
                : 'Tamu dapat meminta cetak dari tombol "Minta Cetak" di HP mereka, atau Anda dapat mencetak manual foto mana saja dari galeri acara.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsGalleryPickerOpen(true)}
            className="px-5 py-2 rounded-full bg-white hover:bg-neutral-50 text-[#111111] text-xs font-mono uppercase tracking-wider transition-all border border-[#E5E1DA] shadow-2xs cursor-pointer"
          >
            Pilih Foto dari Galeri untuk Dicetak
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQueue.map((item) => {
            const isPending = item.status === 'pending';
            const photoUrl = item.photo?.publicUrl;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between shadow-2xs p-4 space-y-3 ${
                  isPending
                    ? 'border-[#E5E1DA] hover:border-[#111111]'
                    : 'border-[#E5E1DA] opacity-80'
                }`}
              >
                {/* Card Top */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {/* Guest Name & Time */}
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-[#666666] block">
                        {new Date(item.created_at).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        •{' '}
                        {new Date(item.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <h4 className="text-sm font-medium text-[#111111] truncate mt-0.5">
                        {item.guest_name}
                      </h4>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider shrink-0 ${
                        isPending
                          ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isPending ? 'Menunggu' : 'Selesai'}
                    </span>
                  </div>

                  {/* Thumbnail & Layout info */}
                  <div className="flex gap-3 items-center bg-[#F7F7F5] p-2.5 rounded-xl border border-[#E5E1DA]">
                    <div
                      onClick={() => openPrintModal(item)}
                      className="w-16 h-22 rounded-lg bg-white border border-[#E5E1DA] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer hover:opacity-85 transition-opacity"
                    >
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={item.guest_name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-neutral-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white text-[#8C6D46] border border-[#E2D9CC]">
                          {getLayoutLabel(item.layout_type)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-[#666666] bg-white border border-[#E5E1DA]">
                          {item.copies || 1} Lembar
                        </span>
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-[#666666] italic truncate">
                          "{item.notes}"
                        </p>
                      )}

                      {item.printed_at && (
                        <p className="text-[10px] text-emerald-700 font-mono">
                          Dicetak:{' '}
                          {new Date(item.printed_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-[#E5E1DA] flex items-center justify-between gap-2">
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteRequest(item.id)}
                    className="p-2 rounded-full text-[#666666] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Hapus dari antrian"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Mark as Completed / Re-queue */}
                    {isPending ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(item.id, 'completed')}
                        className="px-3 py-1.5 rounded-full bg-white hover:bg-neutral-50 text-[#111111] text-xs font-mono border border-[#E5E1DA] transition-all cursor-pointer shadow-2xs"
                      >
                        Tandai Selesai
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(item.id, 'pending')}
                        className="px-3 py-1.5 rounded-full bg-white hover:bg-neutral-50 text-[#666666] text-xs font-mono border border-[#E5E1DA] transition-all cursor-pointer shadow-2xs"
                      >
                        Cetak Ulang
                      </button>
                    )}

                    {/* Print Now button */}
                    <button
                      type="button"
                      onClick={() => openPrintModal(item)}
                      className="px-3.5 py-1.5 rounded-full bg-[#111111] hover:bg-[#292624] text-white text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#D4A373]" />
                      <span>Cetak</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. MODAL: Manual Print Photo Picker from Event Gallery */}
      {isGalleryPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E5E1DA] rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-[#111111]">
            <div className="px-6 py-4 border-b border-[#E5E1DA] flex items-center justify-between shrink-0 bg-[#FAF7EE]">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-[#A27A49]" />
                <h3 className="font-serif text-lg font-normal text-[#111111]">
                  Pilih Foto dari Galeri Acara untuk Dicetak
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGalleryPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-neutral-100 text-[#666666] hover:text-[#111111] flex items-center justify-center transition-all cursor-pointer border border-[#E5E1DA]"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-[#F7F7F5]">
              {allPhotos.length === 0 ? (
                <div className="text-center py-12 text-[#666666] text-xs">
                  Belum ada foto yang tersimpan di galeri acara ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {allPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => openManualPrint(photo)}
                      className="group bg-white rounded-2xl border border-[#E5E1DA] hover:border-[#111111] p-2.5 transition-all cursor-pointer flex flex-col items-center text-center space-y-2 hover:scale-[1.02] shadow-2xs"
                    >
                      <div className="w-full aspect-[2/3] rounded-xl overflow-hidden bg-[#FAF7EE] relative flex items-center justify-center">
                        <img
                          src={photo.publicUrl}
                          alt="Gallery Photo"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-[#111111]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="px-3 py-1.5 rounded-full bg-white text-[#111111] font-mono text-[10px] uppercase tracking-wider shadow-lg">
                            Pilih Cetak
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-[#111111] truncate w-full">
                        {photo.guest?.name || photo.guest_name || 'Tamu Undangan'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: Print Layout Preview & Execution */}
      <PrintLayoutModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        job={activePrintJob}
        onPrintComplete={async (requestId) => {
          if (requestId) {
            await handleUpdateStatus(requestId, 'completed');
          }
        }}
      />
    </div>
  );
}
