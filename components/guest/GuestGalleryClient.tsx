'use client';

import { useState, useEffect, useRef, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Play,
  Pause,
  X,
  Volume2,
  Mic,
  Camera,
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertCircle,
  Share2,
  Download,
  Heart,
} from 'lucide-react';
import Link from 'next/link';

interface GalleryItem {
  id: string;
  guestId: string | null;
  guestName: string;
  photoUrl: string;
  voiceUrl: string | null;
  durationSeconds: number;
  createdAt: string;
}

interface EventData {
  id: string;
  name: string;
  monogram?: string | null;
  subtitle?: string | null;
  slug: string;
  event_date: string;
  coverPublicUrl?: string | null;
}

export default function GuestGalleryClient({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const supabase = createClient();

  const [event, setEvent] = useState<EventData | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active selected item for Modal display
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);

  // Audio Playback State inside Modal
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch Gallery Data
  useEffect(() => {
    async function fetchGallery() {
      try {
        setLoading(true);
        const res = await fetch(`/api/guest/gallery?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Gagal memuat galeri event.');
        }

        setEvent(data.event);
        setItems(data.items || []);
      } catch (err: any) {
        console.error('Error loading gallery:', err);
        setError(err.message || 'Gagal memuat galeri.');
      } finally {
        setLoading(false);
      }
    }

    fetchGallery();
  }, [slug]);

  // Audio Handler when selected item changes or audio plays
  useEffect(() => {
    // Reset audio when modal closes or item changes
    if (!selectedItem || !selectedItem.voiceUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      setAudioDuration(0);
      return;
    }

    const audio = new Audio(selectedItem.voiceUrl);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration || selectedItem.durationSeconds || 5);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [selectedItem]);

  const togglePlayAudio = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.error('Play error:', e));
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const mm = mins < 10 ? `0${mins}` : `${mins}`;
    const ss = secs < 10 ? `0${secs}` : `${secs}`;
    return `${mm}:${ss}`;
  };

  const downloadPhoto = (url: string, guestName: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `photobooth-${guestName.replace(/\s+/g, '_')}-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F6F0] p-6 text-center">
        <Loader2 className="w-10 h-10 text-[#8C6D46] animate-spin mb-4" />
        <h2 className="font-serif text-lg font-bold text-[#2C2A29]">Memuat Galeri Kenangan...</h2>
        <p className="text-xs text-[#78716C] mt-1 font-mono">Menyiapkan album momen indah Anda</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F6F0] p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-lg font-bold text-[#2C2A29]">Galeri Tidak Tersedia</h2>
        <p className="text-xs text-[#78716C] max-w-xs">{error || 'Event tidak ditemukan.'}</p>
        <Link
          href={`/event/${encodeURIComponent(slug)}`}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2C2A29] text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Photobooth</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F6F0] text-[#2C2A29] flex flex-col font-sans selection:bg-[#B8926A] selection:text-white">
      {/* Top Bar Navigation */}
      <header className="sticky top-0 z-30 bg-[#F9F6F0]/90 backdrop-blur-md border-b border-[#E2D9CC] px-4 py-3 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href={`/event/${encodeURIComponent(event.slug)}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#8C6D46] hover:text-[#2C2A29] transition-colors py-1 px-3 rounded-full bg-white/80 border border-[#E2D9CC]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Photobooth</span>
          </Link>

          <div className="text-center">
            <span className="text-[10px] tracking-[0.25em] font-extrabold uppercase text-[#8C6D46] font-serif block">
              WEDDING MEMORIES
            </span>
            <h1 className="font-serif text-sm sm:text-base font-bold text-[#2C2A29] leading-none">
              {event.name}
            </h1>
          </div>

          <Link
            href={`/event/${encodeURIComponent(event.slug)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2C2A29] text-white text-[11px] font-semibold hover:bg-[#1A1817] transition-all shadow-sm"
          >
            <Camera className="w-3.5 h-3.5 text-[#D4A373]" />
            <span className="hidden sm:inline">Foto</span>
          </Link>
        </div>
      </header>

      {/* Main Gallery Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {/* Gallery Banner Header */}
        <div className="text-center space-y-2 mb-8 pt-2">
          {event.monogram && (
            <div className="inline-block text-[#8C6D46] font-serif italic text-2xl font-bold tracking-widest px-4">
              {event.monogram}
            </div>
          )}
          <h2 className="font-serif text-2xl sm:text-4xl font-extrabold uppercase tracking-wide text-[#2C2A29]">
            {event.name}
          </h2>
          <p className="text-xs sm:text-sm text-[#78716C] font-serif italic max-w-md mx-auto">
            Kumpulan momen kenangan manis & ucapan hangat dari para tamu terkasih
          </p>
          <div className="pt-2">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#8C6D46] bg-[#F4EFE6] px-3.5 py-1 rounded-full border border-[#E2D9CC]">
              {items.length} Kenangan Tersimpan
            </span>
          </div>
        </div>

        {/* Gallery Grid */}
        {items.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white/80 rounded-3xl border border-[#E2D9CC] shadow-sm max-w-md mx-auto">
            <Heart className="w-12 h-12 text-[#D4A373] mx-auto mb-3 animate-pulse" />
            <h3 className="font-serif text-lg font-bold text-[#2C2A29]">Belum Ada Foto Terpublikasi</h3>
            <p className="text-xs text-[#78716C] mt-1 mb-6">
              Jadilah tamu pertama yang mengabadikan kenangan dan merekam ucapan suara!
            </p>
            <Link
              href={`/event/${encodeURIComponent(event.slug)}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#2C2A29] text-white text-xs font-bold uppercase tracking-widest shadow-md hover:bg-[#1A1817] transition-all"
            >
              <Camera className="w-4 h-4 text-[#D4A373]" />
              <span>Ambil Foto Sekarang</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group relative bg-white rounded-2xl overflow-hidden border border-[#E2D9CC] shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col transform hover:-translate-y-1"
              >
                {/* Photo Thumbnail */}
                <div className="aspect-[2/3] w-full bg-[#F4EFE6] overflow-hidden relative">
                  <img
                    src={item.photoUrl}
                    alt={item.guestName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />

                  {/* Voice Note Indicator Badge */}
                  {item.voiceUrl && (
                    <div className="absolute top-2.5 right-2.5 bg-[#2C2A29]/90 backdrop-blur-md text-[#D4A373] text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 border border-[#D4A373]/30 animate-pulse">
                      <Mic className="w-3 h-3 text-[#D4A373]" />
                      <span>Voice Note</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                    <span className="text-white text-xs font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
                      <span>Lihat Kenangan</span>
                    </span>
                  </div>
                </div>

                {/* Guest Name Footer */}
                <div className="p-3 bg-white border-t border-[#E2D9CC]/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2C2A29] truncate font-serif">
                    {item.guestName}
                  </span>
                  {item.voiceUrl && <Volume2 className="w-3.5 h-3.5 text-[#8C6D46] shrink-0" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* DETAIL MODAL POPUP — PRESISI SESUAI THEMA EDITORIAL VIRTUAL PHOTOBOOTH (#2C2A29) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in overflow-y-auto">
          {/* Modal Container — Dark Charcoal #2C2A29 Theme matching Photobooth */}
          <div className="relative w-full max-w-sm sm:max-w-md bg-[#2C2A29] rounded-[2.5rem] shadow-2xl p-5 sm:p-7 border border-[#423E3C] text-white flex flex-col items-center my-auto overflow-hidden">
            {/* Soft Glow Circles */}
            <div className="absolute -top-16 -left-16 w-40 h-40 bg-[#D4A373]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-40 h-40 bg-[#8C6D46]/20 rounded-full blur-3xl pointer-events-none" />

            {/* Top Modal Navigation: Subtitle & TUTUP Button */}
            <div className="w-full flex items-center justify-between pb-3 z-10 border-b border-white/10 mb-4">
              <div className="text-left">
                <span className="text-[10px] tracking-[0.25em] font-serif uppercase text-[#D4A373] font-bold block">
                  WEDDING MEMORIES OF
                </span>
                <span className="text-xs font-serif font-extrabold text-white uppercase tracking-wider">
                  {event.name}
                </span>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="px-3.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold tracking-widest uppercase transition-all border border-white/20 cursor-pointer active:scale-95"
              >
                TUTUP
              </button>
            </div>

            {/* Center Photo Strip Display Container */}
            <div className="w-full bg-white rounded-2xl p-2 sm:p-3 shadow-2xl overflow-hidden relative mb-5 border border-white/20">
              <img
                src={selectedItem.photoUrl}
                alt={selectedItem.guestName}
                className="w-full h-auto max-h-[50vh] object-contain rounded-xl mx-auto block shadow-sm"
              />
            </div>

            {/* Bottom Audio Player Pill Widget (Sesuai Photobooth Theme) */}
            <div className="w-full space-y-3 z-10">
              {selectedItem.voiceUrl ? (
                <div className="w-full bg-[#F4EFE6] text-[#2C2A29] rounded-full p-2.5 sm:p-3 shadow-2xl flex items-center justify-between border-2 border-white/90">
                  {/* Play / Pause Toggle Button */}
                  <button
                    onClick={togglePlayAudio}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-[#D4A373] flex items-center justify-center shadow-lg cursor-pointer transition-all active:scale-90 shrink-0 border border-[#423E3C]"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Audio Timer Display */}
                  <div className="px-2 font-mono text-xs sm:text-sm font-bold text-[#8C6D46] shrink-0">
                    {formatTime(currentTime > 0 ? currentTime : audioDuration)}
                  </div>

                  {/* Animated Waveform Dots Indicator */}
                  <div className="flex items-center gap-1 px-2 flex-1 justify-center overflow-hidden">
                    {[40, 75, 100, 60, 90, 50, 85, 45, 95, 65, 30].map((heightPct, idx) => (
                      <span
                        key={idx}
                        style={{
                          height: isPlaying ? `${Math.max(20, (heightPct * (idx % 2 === 0 ? 1 : 0.7)))}%` : '35%',
                        }}
                        className={`w-1 sm:w-1.5 rounded-full transition-all duration-200 ${
                          isPlaying ? 'bg-[#8C6D46] animate-pulse' : 'bg-[#8C6D46]/40'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Volume / Mic Badge */}
                  <div className="pr-2 text-[#8C6D46] shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="w-full bg-white/10 rounded-full py-2.5 px-4 text-center text-xs text-[#D4A373] font-serif italic border border-white/10">
                  Tamu ini tidak meninggalkan pesan suara
                </div>
              )}

              {/* Guest Name & Wishes Text Display (Below Pill) */}
              <div className="text-center pt-1 pb-1">
                <h4 className="font-serif font-extrabold text-sm sm:text-base tracking-wider uppercase text-white drop-shadow-sm">
                  {selectedItem.guestName}
                </h4>
                <p className="text-[10px] text-[#D4A373]/80 font-mono mt-0.5">
                  {new Date(selectedItem.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {/* Download Photo Action Button */}
              <button
                onClick={() => downloadPhoto(selectedItem.photoUrl, selectedItem.guestName)}
                className="w-full py-3 px-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 border border-white/20 cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>Download Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
