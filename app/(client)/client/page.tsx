'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Image as ImageIcon,
  Mic,
  Clock,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Download,
  Play,
  Pause,
  ArrowRight,
  Trash2,
  X,
  Search,
  AlertTriangle,
  RefreshCw,
  Film,
  Volume2,
  Loader2,
  LogOut,
  Sparkles,
} from 'lucide-react';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/client';
import { Event, Guest } from '@/lib/types/database';
import {
  exportPhotoWithAudioToVideo,
  downloadImageDirectly,
  downloadBlob,
} from '@/lib/utils/media-export';

type TabType = 'overview' | 'photos' | 'guests';

function ClientDashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const urlTab = searchParams.get('tab') as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(
    urlTab && ['overview', 'photos', 'guests'].includes(urlTab)
      ? urlTab
      : 'overview'
  );

  // Sync state if URL changes
  useEffect(() => {
    if (urlTab && ['overview', 'photos', 'guests'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `/client?tab=${tab}`);
  };

  // Data states
  const [events, setEvents] = useState<Event[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [voices, setVoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search in guests
  const [guestSearch, setGuestSearch] = useState('');

  // Link copy state
  const [copied, setCopied] = useState(false);

  // QR Modal state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Photo Lightbox modal
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);

  // Modal Audio Playback State
  const [modalAudioPlaying, setModalAudioPlaying] = useState(false);
  const [modalCurrentTime, setModalCurrentTime] = useState(0);
  const [modalAudioDuration, setModalAudioDuration] = useState(0);
  const [modalAudioError, setModalAudioError] = useState(false);
  const modalAudioRef = useRef<HTMLAudioElement | null>(null);

  // Single Item Video Export state
  const [isVideoExporting, setIsVideoExporting] = useState(false);
  const [videoExportProgress, setVideoExportProgress] = useState(0);
  const [videoExportError, setVideoExportError] = useState<string | null>(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'photo' | 'voice' | 'guest' | null;
    id: string | null;
    title: string;
    loading: boolean;
  }>({
    isOpen: false,
    type: null,
    id: null,
    title: '',
    loading: false,
  });

  // ZIP Download progress state
  const [zipDownloading, setZipDownloading] = useState<{
    isDownloading: boolean;
    type: 'photos' | 'voices' | null;
    progressText: string;
  }>({
    isDownloading: false,
    type: null,
    progressText: '',
  });

  // Audio player state for overview & voice list
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  // Sign out handler
  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('client_session');
      document.cookie = 'client_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Fetch client data
  const loadClientData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/client/data');
      const data = await res.json();

      if (data) {
        setEvents(data.events || []);
        setGuests(data.guests || []);
        setPhotos(data.photos || []);
        setVoices(data.voiceMessages || []);
      }
    } catch (err) {
      console.error('Error fetching client overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientData();
  }, []);

  const activeEvent = events.length > 0 ? events[0] : null;
  const eventUrl =
    typeof window !== 'undefined' && activeEvent?.slug
      ? `${window.location.origin}/event/${activeEvent.slug}`
      : activeEvent?.slug
      ? `/event/${activeEvent.slug}`
      : '';

  const handleCopyLink = () => {
    if (!eventUrl) return;
    navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Retention calculation based on event_date + 7 days
  const retentionDays = (activeEvent as any)?.voice_retention_days
    ? Number((activeEvent as any).voice_retention_days)
    : 7;
  let formattedExpiry = '';
  let retentionDaysLeft = 7;

  if (activeEvent?.event_date) {
    const d = new Date(activeEvent.event_date);
    d.setDate(d.getDate() + retentionDays);
    d.setHours(23, 59, 59, 999);
    formattedExpiry = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const nowTime = Date.now();
    const diffTime = d.getTime() - nowTime;
    retentionDaysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Time format helper
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const mm = mins < 10 ? `0${mins}` : `${mins}`;
    const ss = secs < 10 ? `0${secs}` : `${secs}`;
    return `${mm}:${ss}`;
  };

  // Audio Handler when modal selectedPhoto changes -> AUTO PLAY VOICE!
  useEffect(() => {
    setModalAudioError(false);
    setModalAudioPlaying(false);
    setModalCurrentTime(0);
    setModalAudioDuration(0);

    if (modalAudioRef.current) {
      try {
        modalAudioRef.current.pause();
      } catch {
        // silent
      }
      modalAudioRef.current = null;
    }

    if (!selectedPhoto || !selectedPhoto.voiceUrl) {
      return;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = selectedPhoto.voiceUrl;
    modalAudioRef.current = audio;

    const handleLoadedMetadata = () => {
      setModalAudioDuration(audio.duration || selectedPhoto.voiceDuration || 1);
    };
    const handleTimeUpdate = () => {
      setModalCurrentTime(audio.currentTime);
    };
    const handleEnded = () => {
      setModalAudioPlaying(false);
      setModalCurrentTime(0);
    };
    const handleError = () => {
      setModalAudioPlaying(false);
      setModalAudioError(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    if (selectedPhoto.voiceDuration) {
      setModalAudioDuration(selectedPhoto.voiceDuration);
    }

    // Auto-play voice if supported
    audio
      .play()
      .then(() => setModalAudioPlaying(true))
      .catch((e: any) => {
        setModalAudioPlaying(false);
        if (e?.name === 'NotSupportedError') {
          setModalAudioError(true);
        }
        console.warn('Audio auto-play prevented or not supported:', e?.message || e);
      });

    return () => {
      try {
        audio.pause();
      } catch {
        // silent
      }
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [selectedPhoto]);

  const toggleModalAudio = () => {
    if (!modalAudioRef.current || modalAudioError) return;
    if (modalAudioPlaying) {
      try {
        modalAudioRef.current.pause();
      } catch {
        // silent
      }
      setModalAudioPlaying(false);
    } else {
      modalAudioRef.current
        .play()
        .then(() => setModalAudioPlaying(true))
        .catch((e: any) => {
          setModalAudioPlaying(false);
          if (e?.name === 'NotSupportedError' || e?.name === 'NotAllowedError') {
            setModalAudioError(true);
          }
          console.warn('Audio play handled gracefully:', e?.message || e);
        });
    }
  };

  // Download Single Photo
  const handleDownloadSinglePhoto = (photo: any) => {
    const rawName = photo.guest?.name || photo.guest_name || 'kenangan';
    const cleanGuestName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `foto_${cleanGuestName}_${photo.id.substring(0, 6)}.jpg`;
    downloadImageDirectly(photo.publicUrl, filename);
  };

  // Download Single Video (Photo + Voice Audio Export)
  const handleDownloadSingleVideo = async (photo: any) => {
    if (!photo.voiceUrl) {
      handleDownloadSinglePhoto(photo);
      return;
    }

    setIsVideoExporting(true);
    setVideoExportProgress(10);
    setVideoExportError(null);

    try {
      setVideoExportProgress(35);
      const { blob, ext } = await exportPhotoWithAudioToVideo(
        photo.publicUrl,
        photo.voiceUrl
      );
      setVideoExportProgress(90);

      const rawName = photo.guest?.name || photo.guest_name || 'kenangan';
      const cleanGuestName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `video_${cleanGuestName}_${photo.id.substring(0, 6)}.${ext}`;

      downloadBlob(blob, filename);
      setVideoExportProgress(100);
    } catch (err: any) {
      console.error('Failed to export video:', err);
      setVideoExportError(
        'Gagal merender video di browser ini. Foto JPG akan diunduh sebagai cadangan.'
      );
      handleDownloadSinglePhoto(photo);
    } finally {
      setTimeout(() => {
        setIsVideoExporting(false);
        setVideoExportProgress(0);
      }, 800);
    }
  };

  // Toggle voice playback in list
  const toggleVoicePlay = (voiceId: string, url: string) => {
    if (playingVoiceId === voiceId) {
      const currentAudio = audioRefs.current[voiceId];
      if (currentAudio) {
        currentAudio.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    if (playingVoiceId && audioRefs.current[playingVoiceId]) {
      audioRefs.current[playingVoiceId]?.pause();
    }

    if (!audioRefs.current[voiceId]) {
      audioRefs.current[voiceId] = new Audio(url);
      audioRefs.current[voiceId]?.addEventListener('ended', () => {
        setPlayingVoiceId(null);
      });
    }

    const nextAudio = audioRefs.current[voiceId];
    if (nextAudio) {
      nextAudio
        .play()
        .then(() => setPlayingVoiceId(voiceId))
        .catch((err) => console.warn('Audio play handled gracefully:', err));
    }
  };

  // ZIP Download all photos (JPG + MP4 if voiced)
  const handleDownloadAllPhotosZip = async () => {
    if (photos.length === 0) return;
    setZipDownloading({
      isDownloading: true,
      type: 'photos',
      progressText: `Menyiapkan arsip untuk ${photos.length} foto...`,
    });

    try {
      const zip = new JSZip();
      const folderName = `Arsip_Foto_${(activeEvent?.name || 'sebuah-kenang').replace(/\s+/g, '_')}`;
      const folder = zip.folder(folderName) || zip;

      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const num = String(i + 1).padStart(2, '0');
        const rawName = p.guest?.name || p.guest_name || `tamu_${i + 1}`;
        const cleanGuestName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');

        setZipDownloading({
          isDownloading: true,
          type: 'photos',
          progressText: `[${i + 1}/${photos.length}] Menyimpan foto JPG (${rawName})...`,
        });

        try {
          const resp = await fetch(p.publicUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            folder.file(`${num}_${cleanGuestName}_foto.jpg`, blob);
          }
        } catch (err) {
          console.warn('Gagal memuat foto JPG untuk zip:', err);
        }

        if (p.voiceUrl) {
          setZipDownloading({
            isDownloading: true,
            type: 'photos',
            progressText: `[${i + 1}/${photos.length}] Membuat video MP4 bersuara (${rawName})...`,
          });

          try {
            const { blob: videoBlob, ext } = await exportPhotoWithAudioToVideo(
              p.publicUrl,
              p.voiceUrl
            );
            folder.file(`${num}_${cleanGuestName}_video.${ext}`, videoBlob);
          } catch (videoErr) {
            console.warn('Gagal membuat video MP4 untuk zip:', videoErr);
          }
        }
      }

      setZipDownloading({
        isDownloading: true,
        type: 'photos',
        progressText: 'Mengompres seluruh arsip ke dalam file .ZIP...',
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating ZIP:', err);
      alert('Gagal membuat file ZIP. Silakan coba lagi.');
    } finally {
      setZipDownloading({ isDownloading: false, type: null, progressText: '' });
    }
  };

  // Open delete confirmation modal
  const promptDelete = (type: 'photo' | 'voice' | 'guest', id: string, title: string) => {
    setDeleteModal({
      isOpen: true,
      type,
      id,
      title,
      loading: false,
    });
  };

  // Execute deletion
  const handleConfirmDelete = async () => {
    if (!deleteModal.type || !deleteModal.id) return;
    setDeleteModal((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch('/api/client/data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: deleteModal.type,
          id: deleteModal.id,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menghapus item');
      }

      // Optimistic state update
      if (deleteModal.type === 'photo') {
        const deletedPhoto = photos.find((p) => p.id === deleteModal.id);
        const guestIdToDelete = json.deletedGuestId || deletedPhoto?.guest_id;

        setPhotos((prev) => prev.filter((p) => p.id !== deleteModal.id));
        if (guestIdToDelete) {
          setGuests((prev) => prev.filter((g) => g.id !== guestIdToDelete));
          setVoices((prev) => prev.filter((v) => v.guest_id !== guestIdToDelete));
        }
        if (selectedPhoto?.id === deleteModal.id) {
          setSelectedPhoto(null);
        }
      } else if (deleteModal.type === 'guest') {
        setGuests((prev) => prev.filter((g) => g.id !== deleteModal.id));
        setPhotos((prev) => prev.filter((p) => p.guest_id !== deleteModal.id));
        setVoices((prev) => prev.filter((v) => v.guest_id !== deleteModal.id));
      } else if (deleteModal.type === 'voice') {
        setVoices((prev) => prev.filter((v) => v.id !== deleteModal.id));
      }

      setDeleteModal({
        isOpen: false,
        type: null,
        id: null,
        title: '',
        loading: false,
      });
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menghapus data.');
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Filtered guests
  const filteredGuests = guests.filter(
    (g) =>
      g.name.toLowerCase().includes(guestSearch.toLowerCase()) ||
      (g.instagram && g.instagram.toLowerCase().includes(guestSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col font-sans selection:bg-[#111111] selection:text-white">
      {/* =========================================================================
          TOP STICKY NAVBAR (ZARA x UNIQLO x SEBUAH.KENANG EDITORIAL)
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E1DA]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          {/* Brand Logo: Monogram Crest + Typography */}
          <Link href="/client" className="flex items-center gap-3 group shrink-0">
            <img
              src="/brand/crest.png"
              alt="sebuah.kenang Crest"
              className="h-8 w-auto object-contain transition-opacity group-hover:opacity-85"
            />
            <div className="flex flex-col">
              <span className="font-serif text-lg sm:text-xl tracking-tight text-[#111111] font-normal leading-none">
                sebuah.kenang
              </span>
              <span className="text-[9px] font-mono tracking-[0.25em] uppercase text-[#A27A49] mt-0.5">
                Virtual Photobooth
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-sans">
            <button
              onClick={() => switchTab('overview')}
              className={`transition-all cursor-pointer py-1 ${
                activeTab === 'overview'
                  ? 'text-[#111111] font-medium border-b-2 border-[#111111]'
                  : 'text-[#666666] hover:text-[#111111]'
              }`}
            >
              Ringkasan
            </button>
            <button
              onClick={() => switchTab('photos')}
              className={`transition-all cursor-pointer py-1 ${
                activeTab === 'photos'
                  ? 'text-[#111111] font-medium border-b-2 border-[#111111]'
                  : 'text-[#666666] hover:text-[#111111]'
              }`}
            >
              Foto
            </button>
            <button
              onClick={() => switchTab('guests')}
              className={`transition-all cursor-pointer py-1 ${
                activeTab === 'guests'
                  ? 'text-[#111111] font-medium border-b-2 border-[#111111]'
                  : 'text-[#666666] hover:text-[#111111]'
              }`}
            >
              Tamu
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {eventUrl && (
              <a
                href={eventUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] hover:bg-[#292624] text-white text-xs font-mono uppercase tracking-wider transition-all shadow-2xs cursor-pointer"
              >
                <span>Buka Photobooth</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              onClick={handleSignOut}
              title="Keluar dari Portal"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-neutral-50 border border-[#E5E1DA] text-xs font-mono text-[#666666] hover:text-[#111111] transition-all cursor-pointer shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Navigation Tabs */}
        <div className="md:hidden border-t border-[#E5E1DA] px-4 py-2.5 flex items-center justify-center gap-6 bg-white text-xs font-sans">
          <button
            onClick={() => switchTab('overview')}
            className={`transition-all py-1 ${
              activeTab === 'overview'
                ? 'text-[#111111] font-medium border-b-2 border-[#111111]'
                : 'text-[#666666]'
            }`}
          >
            Ringkasan
          </button>
          <button
            onClick={() => switchTab('photos')}
            className={`transition-all py-1 ${
              activeTab === 'photos'
                ? 'text-[#111111] font-medium border-b-2 border-[#111111]'
                : 'text-[#666666]'
            }`}
          >
            Foto ({photos.length})
          </button>
          <button
            onClick={() => switchTab('guests')}
            className={`transition-all py-1 ${
              activeTab === 'guests'
                ? 'text-[#111111] font-medium border-b-2 border-[#111111]'
                : 'text-[#666666]'
            }`}
          >
            Tamu ({guests.length})
          </button>
        </div>
      </header>

      {/* =========================================================================
          MAIN CONTAINER
          ========================================================================= */}
      <main className="max-w-[1240px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 sm:space-y-8 flex-1">
        {/* =========================================================================
            1. HERO EVENT BANNER WITH EDITORIAL RIGHT CARD
            ========================================================================= */}
        <section className="bg-white border border-[#E5E1DA] rounded-2xl overflow-hidden shadow-2xs flex flex-col lg:flex-row items-stretch">
          {/* Left: Event Details */}
          <div className="flex-1 p-6 sm:p-8 lg:p-10 flex flex-col justify-center space-y-3 sm:space-y-4">
            <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666666] block">
              PORTAL PENYELENGGARA
            </span>

            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-serif text-3xl sm:text-5xl font-light tracking-tight text-[#111111]">
                {loading ? 'Memuat Acara...' : `${activeEvent?.name || 'Vena & Vero'}.`}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[#111111]/5 text-[#111111] border border-[#111111]/10 font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A27A49] animate-pulse" />
                LIVE EVENT
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#666666] font-light">
              Tanggal Acara:{' '}
              <strong className="font-mono text-[#111111] font-medium">
                {activeEvent?.event_date
                  ? new Date(activeEvent.event_date).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '13 September 2026'}
              </strong>
            </p>

            <p className="text-xs sm:text-sm text-[#666666] font-light leading-relaxed max-w-xl">
              Kelola foto, dengarkan pesan suara tamu, dan download seluruh arsip acara Anda.
            </p>
          </div>

          {/* Right: Editorial Photo Banner with Floating Actions (Event Cover from Picture 2) */}
          <div className="w-full lg:w-[460px] xl:w-[500px] relative h-[240px] sm:h-[280px] lg:h-auto min-h-[220px] overflow-hidden bg-[#FDFBF7] shrink-0">
            {activeEvent?.coverUrl ? (
              <img
                src={activeEvent.coverUrl}
                alt={activeEvent.name || 'Event Cover'}
                className="w-full h-full object-cover object-center"
              />
            ) : loading ? (
              <div className="w-full h-full flex items-center justify-center bg-[#FAF7EE] animate-pulse">
                <img
                  src="/brand/crest.png"
                  alt="sebuah.kenang"
                  className="w-12 h-auto opacity-20 object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#FAF7EE]">
                <img
                  src="/brand/crest.png"
                  alt="sebuah.kenang"
                  className="w-12 h-auto opacity-30 object-contain"
                />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

            {/* Floating Buttons on Bottom-Right */}
            <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/95 hover:bg-white text-[#111111] text-xs font-mono tracking-wider border border-[#E5E1DA] shadow-md transition-all cursor-pointer backdrop-blur-xs"
              >
                <QrCode className="w-3.5 h-3.5 text-[#A27A49]" />
                <span>Lihat QR Stand</span>
              </button>

              {eventUrl && (
                <a
                  href={eventUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] hover:bg-[#292624] text-white text-xs font-mono tracking-wider shadow-md transition-all cursor-pointer"
                >
                  <span>Buka Photobooth</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </section>

        {/* =========================================================================
            2. EVENT ACCESS BAR (LINK AKSES TAMU)
            ========================================================================= */}
        <section className="bg-white border border-[#E5E1DA] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 shadow-2xs">
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#666666] shrink-0">
            LINK AKSES TAMU
          </span>

          <div className="relative flex-1">
            <input
              type="text"
              readOnly
              value={eventUrl}
              className="w-full bg-[#F7F7F5] border border-[#E5E1DA] rounded-xl px-4 py-2.5 pr-10 text-xs font-mono text-[#111111] select-all truncate focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              title="Salin Link"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#111111] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-50 border border-[#E5E1DA] text-xs font-mono text-[#111111] transition-all cursor-pointer shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5 text-[#666666]" />
              <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
            </button>

            {activeEvent && (
              <a
                href={`/event/${activeEvent.slug}/gallery`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-50 border border-[#E5E1DA] text-xs font-mono text-[#111111] transition-all shadow-2xs"
              >
                <span>Galeri Tamu</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </section>

        {/* =========================================================================
            3. INFORMATION BLOCKS (4 STATS CARDS)
            ========================================================================= */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Block 1: Total Tamu */}
          <div
            onClick={() => switchTab('guests')}
            className="bg-white border border-[#E5E1DA] hover:border-[#111111] rounded-2xl p-5 sm:p-6 transition-all duration-200 cursor-pointer shadow-2xs flex flex-col justify-between"
          >
            <div>
              <Users className="w-4 h-4 text-[#A27A49]" />
              <div className="font-serif text-4xl sm:text-5xl font-light tracking-tight text-[#111111] mt-3">
                {loading ? '...' : guests.length}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#666666] mt-2">
                TOTAL TAMU
              </div>
            </div>
            <p className="text-xs text-[#666666] font-light mt-1">
              Tamu yang telah berpartisipasi.
            </p>
          </div>

          {/* Block 2: Foto Tersimpan */}
          <div
            onClick={() => switchTab('photos')}
            className="bg-white border border-[#E5E1DA] hover:border-[#111111] rounded-2xl p-5 sm:p-6 transition-all duration-200 cursor-pointer shadow-2xs flex flex-col justify-between"
          >
            <div>
              <ImageIcon className="w-4 h-4 text-[#A27A49]" />
              <div className="font-serif text-4xl sm:text-5xl font-light tracking-tight text-[#111111] mt-3">
                {loading ? '...' : photos.length}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#666666] mt-2">
                FOTO TERSIMPAN
              </div>
            </div>
            <p className="text-xs text-[#666666] font-light mt-1">
              Foto berbingkai eksklusif.
            </p>
          </div>

          {/* Block 3: Pesan Suara */}
          <div
            onClick={() => switchTab('photos')}
            className="bg-white border border-[#E5E1DA] hover:border-[#111111] rounded-2xl p-5 sm:p-6 transition-all duration-200 cursor-pointer shadow-2xs flex flex-col justify-between"
          >
            <div>
              <Mic className="w-4 h-4 text-[#A27A49]" />
              <div className="font-serif text-4xl sm:text-5xl font-light tracking-tight text-[#111111] mt-3">
                {loading ? '...' : voices.length}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#666666] mt-2">
                PESAN SUARA
              </div>
            </div>
            <p className="text-xs text-[#666666] font-light mt-1">
              Ucapan & doa manis para tamu.
            </p>
          </div>

          {/* Block 4: Masa Retensi */}
          <div className="bg-white border border-[#E5E1DA] rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
            <div>
              <Clock className="w-4 h-4 text-[#A27A49]" />
              <div className="font-serif text-4xl sm:text-5xl font-light tracking-tight text-[#111111] mt-3">
                {retentionDaysLeft} Hari
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#666666] mt-2">
                MASA RETENSI
              </div>
            </div>
            <p className="text-xs text-[#666666] font-light mt-1">
              Batas unduh:{' '}
              <strong className="font-medium text-[#111111]">
                {formattedExpiry || '20 September 2026'}
              </strong>
            </p>
          </div>
        </section>

        {/* =========================================================================
            4. RETENTION NOTIFICATION BAR (AUTO DELETE NOTICE)
            ========================================================================= */}
        <section className="bg-white border border-[#E5E1DA] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 shadow-2xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#F7F3EC] text-[#A27A49] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-mono font-semibold tracking-wider uppercase text-[#111111] block">
                KENANGAN ANDA AKAN OTOMATIS DIHAPUS
              </span>
              <p className="text-xs text-[#666666] font-light leading-relaxed max-w-2xl">
                Untuk menjaga privasi dan kebersihan data, seluruh foto, rekaman suara, dan daftar tamu akan otomatis dibersihkan pada{' '}
                <strong className="font-mono text-[#111111] font-medium">
                  {formattedExpiry || '20 September 2026'}
                </strong>
                . Pastikan Anda telah mengunduh seluruh arsip acara Anda.
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadAllPhotosZip}
            disabled={zipDownloading.isDownloading || photos.length === 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#111111] hover:bg-[#292624] text-white text-xs font-mono uppercase tracking-wider transition-all shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Semua (.ZIP)</span>
          </button>
        </section>

        {/* =========================================================================
            5. TAB CONTENT
            ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-8 sm:space-y-10">
            {/* Foto Terkini / Kenangan Terbaru */}
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666666] block">
                    FOTO TERKINI
                  </span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-light text-[#111111] tracking-tight mt-1">
                    Kenangan Terbaru
                  </h2>
                  <p className="text-xs text-[#666666] font-light mt-0.5">
                    Foto terbaru dari para tamu di acara Anda.
                  </p>
                </div>

                {photos.length > 0 && (
                  <button
                    onClick={() => switchTab('photos')}
                    className="text-xs font-mono tracking-wider uppercase text-[#111111] hover:text-[#A27A49] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Lihat Semua Foto ({photos.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {photos.length === 0 ? (
                <div className="bg-white border border-[#E5E1DA] rounded-2xl p-12 text-center space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#A27A49] block">
                    BELUM ADA KENANGAN
                  </span>
                  <p className="text-sm font-light text-[#666666]">
                    Foto dari tamu akan muncul di sini saat acara dimulai.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {photos.slice(0, 4).map((photo) => (
                    <div
                      key={photo.id}
                      className="group bg-white border border-[#E5E1DA] hover:border-[#111111] rounded-2xl overflow-hidden p-3 transition-all duration-200 flex flex-col justify-between shadow-2xs space-y-3"
                    >
                      <div
                        className="aspect-[2/3] bg-[#F7F3EC] rounded-xl overflow-hidden relative cursor-pointer"
                        onClick={() => setSelectedPhoto(photo)}
                      >
                        <img
                          src={photo.publicUrl}
                          alt={photo.guest?.name || photo.guest_name || 'Candid'}
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                        />
                        {photo.voiceUrl && (
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-xs text-white text-[10px] font-mono flex items-center gap-1 shadow-sm">
                            <Mic className="w-3 h-3 text-[#C5A880]" />
                            <span>{formatTime(photo.voiceDuration || 1)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="min-w-0 pr-2">
                          <h4 className="text-xs font-medium text-[#111111] truncate">
                            {photo.guest?.name || photo.guest_name || 'Tamu Istimewa'}
                          </h4>
                          <span className="text-[10px] font-mono text-[#666666] block">
                            {new Date(photo.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleDownloadSinglePhoto(photo)}
                            title="Download Foto"
                            className="p-1.5 text-[#666666] hover:text-[#111111] transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              promptDelete(
                                'photo',
                                photo.id,
                                photo.guest?.name || photo.guest_name || 'Foto'
                              )
                            }
                            title="Hapus Foto"
                            className="p-1.5 text-[#666666] hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Panduan Singkat Penyelenggara (Cara Kerja Virtual Photobooth) */}
            <section className="bg-white border border-[#E5E1DA] rounded-2xl overflow-hidden flex flex-col lg:flex-row items-stretch shadow-2xs">
              {/* Left Column: 3 Editorial Steps */}
              <div className="flex-1 p-6 sm:p-8 lg:p-10 space-y-6">
                <div>
                  <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666666] block">
                    PANDUAN SINGKAT PENYELENGGARA
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl font-light text-[#111111] mt-1">
                    Cara Kerja Virtual Photobooth di Acara Anda
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 pt-2">
                  {/* Step 1 */}
                  <div className="md:pr-6 md:border-r border-[#E5E1DA] space-y-2">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-[#A27A49] font-medium block">
                      01 &bull; SHARE
                    </span>
                    <h4 className="text-sm font-medium text-[#111111]">
                      Bagikan Link atau Pasang QR
                    </h4>
                    <p className="text-xs text-[#666666] font-light leading-relaxed">
                      Cetak QR Code untuk diletakkan di meja tamu atau kirim link undangan melalui WhatsApp.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="md:px-6 md:border-r border-[#E5E1DA] space-y-2">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-[#A27A49] font-medium block">
                      02 &bull; CAPTURE
                    </span>
                    <h4 className="text-sm font-medium text-[#111111]">
                      Tamu Foto Tanpa Install Aplikasi
                    </h4>
                    <p className="text-xs text-[#666666] font-light leading-relaxed">
                      Tamu cukup membuka kamera browser di HP masing-masing, memilih frame cantik Anda, dan berfoto secara instan.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="md:pl-6 space-y-2">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-[#A27A49] font-medium block">
                      03 &bull; COLLECT
                    </span>
                    <h4 className="text-sm font-medium text-[#111111]">
                      Pantau & Unduh Kapan Saja
                    </h4>
                    <p className="text-xs text-[#666666] font-light leading-relaxed">
                      Seluruh foto resolusi tinggi dan pesan suara otomatis masuk ke portal ini secara real-time dan siap Anda unduh.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Aesthetic Graphic */}
              <div className="w-full lg:w-[320px] xl:w-[360px] bg-[#F7F3EC] p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[200px] border-t lg:border-t-0 lg:border-l border-[#E5E1DA]">
                <img
                  src="/brand/crest.png"
                  alt="sebuah.kenang Crest"
                  className="w-16 h-auto opacity-40 mb-3 object-contain"
                />
                <div className="text-center space-y-1">
                  <p className="font-serif italic text-lg text-[#111111]">
                    Your event.
                  </p>
                  <p className="font-serif italic text-lg text-[#111111]">
                    Your stories.
                  </p>
                  <p className="font-serif italic text-lg text-[#111111]">
                    Your kenangan.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Tab: FOTO */}
        {activeTab === 'photos' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E1DA] pb-5">
              <div>
                <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666666] block">
                  GALERI FOTO
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="font-serif text-3xl font-light text-[#111111] tracking-tight">
                    Foto Acara
                  </h2>
                  <span className="text-xs font-mono uppercase text-[#666666] px-2.5 py-0.5 rounded-full bg-white border border-[#E5E1DA]">
                    {photos.length} Kenangan
                  </span>
                </div>
              </div>

              <button
                onClick={handleDownloadAllPhotosZip}
                disabled={zipDownloading.isDownloading || photos.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] hover:bg-[#292624] text-white text-xs font-mono uppercase tracking-wider transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Semua (.ZIP)</span>
              </button>
            </div>

            {photos.length === 0 ? (
              <div className="bg-white border border-[#E5E1DA] rounded-2xl p-16 text-center space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#A27A49] block">
                  BELUM ADA KENANGAN
                </span>
                <p className="text-sm font-light text-[#666666]">
                  Foto dari tamu akan otomatis muncul di sini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group bg-white border border-[#E5E1DA] hover:border-[#111111] rounded-2xl overflow-hidden p-3 transition-all duration-200 flex flex-col justify-between shadow-2xs space-y-3"
                  >
                    <div
                      className="aspect-[2/3] bg-[#F7F3EC] rounded-xl overflow-hidden relative cursor-pointer"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <img
                        src={photo.publicUrl}
                        alt={photo.guest?.name || photo.guest_name || 'Kenangan'}
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      />
                      {photo.voiceUrl && (
                        <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-xs text-white text-[10px] font-mono flex items-center gap-1.5 shadow-sm">
                          <Mic className="w-3 h-3 text-[#C5A880]" />
                          <span>{formatTime(photo.voiceDuration || 1)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="min-w-0 pr-2">
                        <h4 className="text-sm font-medium text-[#111111] truncate">
                          {photo.guest?.name || photo.guest_name || 'Tamu Istimewa'}
                        </h4>
                        <span className="text-[10px] font-mono text-[#666666] block mt-0.5">
                          {new Date(photo.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleDownloadSinglePhoto(photo)}
                          title="Download Foto"
                          className="p-2 rounded-full hover:bg-neutral-100 text-[#666666] hover:text-[#111111] transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            promptDelete(
                              'photo',
                              photo.id,
                              photo.guest?.name || photo.guest_name || 'Foto'
                            )
                          }
                          title="Hapus Foto"
                          className="p-2 rounded-full hover:bg-rose-50 text-[#666666] hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dedicated Voice Note Archive Section */}
            <div className="mt-12 pt-8 border-t border-[#E5E1DA] space-y-4">
              <div>
                <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A27A49] block">
                  PESAN SUARA
                </span>
                <h3 className="font-serif text-2xl font-light text-[#111111] mt-1">
                  “Beberapa kenangan lebih baik didengar.”
                </h3>
              </div>

              {voices.length === 0 ? (
                <div className="bg-white border border-[#E5E1DA] rounded-2xl p-8 text-center text-xs text-[#666666] font-light">
                  Belum ada rekaman pesan suara dari tamu.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {voices.map((voice) => {
                    const isPlaying = playingVoiceId === voice.id;
                    return (
                      <div
                        key={voice.id}
                        className="bg-white border border-[#E5E1DA] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => toggleVoicePlay(voice.id, voice.publicUrl)}
                            className="w-10 h-10 rounded-full bg-[#111111] text-white flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>
                          <div className="min-w-0">
                            <h5 className="text-xs font-medium text-[#111111] truncate">
                              {voice.guest?.name || 'Tamu'}
                            </h5>
                            <span className="text-[10px] font-mono text-[#666666] block">
                              Durasi: {voice.duration_seconds || 5} detik
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => promptDelete('voice', voice.id, voice.guest?.name || 'Pesan Suara')}
                          className="p-1.5 text-[#666666] hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: TAMU */}
        {activeTab === 'guests' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E1DA] pb-5">
              <div>
                <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666666] block">
                  BUKU TAMU
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="font-serif text-3xl font-light text-[#111111] tracking-tight">
                    Daftar Tamu
                  </h2>
                  <span className="text-xs font-mono uppercase text-[#666666] px-2.5 py-0.5 rounded-full bg-white border border-[#E5E1DA]">
                    {guests.length} Tamu Terdaftar
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666666]" />
                <input
                  type="text"
                  placeholder="Cari nama atau instagram..."
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-[#E5E1DA] rounded-full text-xs font-sans text-[#111111] placeholder:text-[#666666] focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>

            {filteredGuests.length === 0 ? (
              <div className="bg-white border border-[#E5E1DA] rounded-2xl p-16 text-center space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#A27A49] block">
                  BELUM ADA TAMU
                </span>
                <p className="text-sm font-light text-[#666666]">
                  {guestSearch ? 'Tidak ditemukan tamu yang cocok.' : 'Tamu yang berpartisipasi akan terdaftar di sini.'}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-[#E5E1DA] rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-[#F7F7F5] border-b border-[#E5E1DA] text-[10px] font-mono uppercase tracking-wider text-[#666666]">
                      <tr>
                        <th className="py-3 px-4 sm:px-6">Nama Tamu</th>
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">Foto</th>
                        <th className="py-3 px-4">Pesan Suara</th>
                        <th className="py-3 px-4 sm:px-6 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1DA]">
                      {filteredGuests.map((guest) => {
                        const guestPhotos = photos.filter((p) => p.guest_id === guest.id);
                        const guestVoice = voices.find((v) => v.guest_id === guest.id);

                        return (
                          <tr key={guest.id} className="hover:bg-neutral-50/50 transition-colors">
                            <td className="py-3.5 px-4 sm:px-6">
                              <div className="font-medium text-[#111111]">{guest.name}</div>
                              {guest.instagram && (
                                <span className="text-[11px] font-mono text-[#666666]">
                                  @{guest.instagram.replace(/^@/, '')}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[#666666] text-[11px]">
                              {new Date(guest.created_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3.5 px-4">
                              {guestPhotos.length > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  {guestPhotos.slice(0, 2).map((gp) => (
                                    <img
                                      key={gp.id}
                                      src={gp.publicUrl}
                                      alt="Thumbnail"
                                      className="w-8 h-8 object-cover rounded-lg border border-[#E5E1DA] cursor-pointer hover:scale-105 transition-transform"
                                      onClick={() => setSelectedPhoto(gp)}
                                    />
                                  ))}
                                  {guestPhotos.length > 2 && (
                                    <span className="text-[10px] font-mono text-[#666666]">
                                      +{guestPhotos.length - 2}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[#666666] text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {guestVoice ? (
                                <button
                                  onClick={() => toggleVoicePlay(guestVoice.id, guestVoice.publicUrl)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F7F3EC] text-[#A27A49] text-[10px] font-mono cursor-pointer border border-[#A27A49]/20"
                                >
                                  {playingVoiceId === guestVoice.id ? (
                                    <Pause className="w-3 h-3" />
                                  ) : (
                                    <Play className="w-3 h-3" />
                                  )}
                                  <span>{guestVoice.duration_seconds || 5}s</span>
                                </button>
                              ) : (
                                <span className="text-[#666666] text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 sm:px-6 text-right">
                              <button
                                onClick={() => promptDelete('guest', guest.id, guest.name)}
                                title="Hapus Tamu"
                                className="p-1.5 rounded-full hover:bg-rose-50 text-[#666666] hover:text-rose-600 transition-colors cursor-pointer inline-flex items-center"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =========================================================================
          FOOTER (EDITORIAL MINIMAL)
          ========================================================================= */}
      <footer className="border-t border-[#E5E1DA] bg-white py-8 mt-12">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#666666]">
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm text-[#111111]">sebuah.kenang</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Your Event</span>
            <span>&bull;</span>
            <span>Your Stories</span>
            <span>&bull;</span>
            <span>Your Kenangan</span>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          PROGRESS OVERLAY: ZIP DOWNLOAD
          ========================================================================= */}
      {zipDownloading.isDownloading && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-[#E5E1DA] shadow-2xl relative flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#F7F3EC] flex items-center justify-center text-[#A27A49]">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-medium tracking-tight text-[#111111]">
                Menyiapkan Arsip .ZIP
              </h3>
              <p className="text-xs text-[#666666] leading-relaxed">
                {zipDownloading.progressText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: PHOTO LIGHTBOX (RESPONSIVE & PROPORTIONAL)
          ========================================================================= */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setSelectedPhoto(null)}
        >
          {/* Modal Card — Responsive Split on Desktop (md:), Stack on Mobile */}
          <div
            className="relative bg-[#2C2A29] border border-[#423E3C] rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-6 md:p-7 max-w-sm sm:max-w-md md:max-w-3xl lg:max-w-4xl w-full text-white shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-20 -left-20 w-48 h-48 bg-[#D4A373]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-[#8C6D46]/20 rounded-full blur-3xl pointer-events-none" />

            {/* Mobile Header (Shown on < md only) */}
            <div className="md:hidden flex items-center justify-between pb-3 border-b border-white/10 mb-4 z-10 relative">
              <div>
                <span className="text-[9px] font-mono tracking-[0.25em] uppercase text-[#D4A373] block">
                  WEDDING MEMORIES OF
                </span>
                <h3 className="text-sm font-serif font-bold tracking-wider uppercase text-white/95 truncate max-w-[200px]">
                  {activeEvent?.name || 'sebuah.kenang'}
                </h3>
              </div>

              <button
                onClick={() => setSelectedPhoto(null)}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono tracking-wider uppercase transition-all border border-white/20 cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Tutup</span>
              </button>
            </div>

            {/* Content Container: 2-Column on Desktop (md:), 1-Column on Mobile */}
            <div className="flex flex-col md:flex-row items-center md:items-stretch gap-4 sm:gap-6 lg:gap-8 z-10 relative">
              {/* Left Column: Photo Strip (Proportional & Pristine) */}
              <div className="w-full md:w-[48%] flex items-center justify-center bg-white rounded-2xl p-2 sm:p-3 shadow-2xl border border-white/20 shrink-0">
                <img
                  src={selectedPhoto.publicUrl}
                  alt={selectedPhoto.guest?.name || selectedPhoto.guest_name || 'Kenangan'}
                  className="w-full h-auto max-h-[44vh] sm:max-h-[50vh] md:max-h-[72vh] object-contain rounded-xl block mx-auto"
                />
              </div>

              {/* Right Column: Editorial Details & Controls */}
              <div className="w-full md:w-[52%] flex flex-col justify-between space-y-4 pt-1 md:pt-0">
                {/* Desktop Header (Shown on md: and above) */}
                <div className="hidden md:flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#D4A373] font-bold block">
                      WEDDING MEMORIES OF
                    </span>
                    <h3 className="text-base lg:text-lg font-serif tracking-wide text-white uppercase font-extrabold">
                      {activeEvent?.name || 'sebuah.kenang'}
                    </h3>
                  </div>

                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold tracking-widest uppercase transition-all border border-white/20 cursor-pointer active:scale-95 flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Tutup</span>
                  </button>
                </div>

                {/* Guest Info */}
                <div className="text-center md:text-left space-y-1">
                  <h4 className="text-base sm:text-lg lg:text-xl font-serif font-bold uppercase tracking-wider text-white">
                    {selectedPhoto.guest?.name || selectedPhoto.guest_name || 'Tamu Istimewa'}
                  </h4>
                  <p className="text-[11px] font-mono text-[#D4A373]/90">
                    {new Date(selectedPhoto.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Audio Player Container or Friendly Empty State */}
                {selectedPhoto.voiceUrl && !modalAudioError ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5 text-[#D4A373]">
                        <Mic className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-serif font-bold uppercase tracking-wider">
                          Pesan Suara (Voice Note)
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#D4A373]/80">
                        {formatTime(modalCurrentTime > 0 ? modalCurrentTime : modalAudioDuration)}
                      </span>
                    </div>

                    <div className="w-full bg-[#F4EFE6] text-[#2C2A29] rounded-full p-2.5 sm:p-3 shadow-xl flex items-center justify-between border-2 border-white/90">
                      {/* Play / Pause Toggle Button */}
                      <button
                        onClick={toggleModalAudio}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-[#D4A373] flex items-center justify-center shadow-lg cursor-pointer transition-all active:scale-90 shrink-0 border border-[#423E3C]"
                      >
                        {modalAudioPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>

                      {/* Audio Timer Display */}
                      <div className="px-2 font-mono text-xs sm:text-sm font-bold text-[#8C6D46] shrink-0">
                        {formatTime(modalCurrentTime > 0 ? modalCurrentTime : modalAudioDuration)}
                      </div>

                      {/* Animated Waveform Dots Indicator */}
                      <div className="flex items-center gap-1 px-2 flex-1 justify-center overflow-hidden">
                        {[40, 75, 100, 60, 90, 50, 85, 45, 95, 65, 30].map((heightPct, idx) => (
                          <span
                            key={idx}
                            style={{
                              height: modalAudioPlaying ? `${Math.max(20, heightPct * (idx % 2 === 0 ? 1 : 0.7))}%` : '35%',
                            }}
                            className={`w-1 sm:w-1.5 rounded-full transition-all duration-200 ${
                              modalAudioPlaying ? 'bg-[#8C6D46] animate-pulse' : 'bg-[#8C6D46]/40'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Volume Badge */}
                      <div className="pr-2 text-[#8C6D46] shrink-0">
                        <Volume2 className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full bg-white/[0.04] border border-[#D4A373]/25 rounded-2xl p-4 text-center space-y-1 backdrop-blur-xs shadow-inner">
                    <div className="flex items-center justify-center gap-2 text-[#D4A373]">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4A373]" />
                      <span className="text-[11px] font-serif font-bold uppercase tracking-widest text-[#E6C594]">
                        Kenangan Foto
                      </span>
                    </div>
                    <p className="text-xs text-[#FAF7EE]/90 font-serif italic leading-relaxed px-2">
                      Tamu ini mengabadikan senyuman manis lewat foto tanpa rekaman suara.
                    </p>
                    <span className="text-[10px] text-white/40 tracking-wider block">
                      Setiap momen tetap tersimpan abadi dan bermakna ✨
                    </span>
                  </div>
                )}

                {/* Error notification if any */}
                {videoExportError && (
                  <div className="w-full bg-rose-500/20 border border-rose-500/40 rounded-xl p-2.5 text-center text-[11px] text-rose-300">
                    {videoExportError}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  {selectedPhoto.voiceUrl && !modalAudioError ? (
                    <>
                      <button
                        onClick={() => handleDownloadSingleVideo(selectedPhoto)}
                        disabled={isVideoExporting}
                        className="w-full py-3 px-4 rounded-full bg-gradient-to-r from-[#D4A373] to-[#B88746] hover:from-[#C5925F] hover:to-[#A77838] text-[#1A1817] font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-95 disabled:opacity-75"
                      >
                        {isVideoExporting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#1A1817]" />
                            <span>Membuat Video ({videoExportProgress}%)...</span>
                          </>
                        ) : (
                          <>
                            <Film className="w-4 h-4 text-[#1A1817]" />
                            <span>Download Video (MP4 + Suara)</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDownloadSinglePhoto(selectedPhoto)}
                        disabled={isVideoExporting}
                        className="w-full py-2.5 px-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 border border-white/20 cursor-pointer active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5 text-[#D4A373]" />
                        <span>Download Foto Saja (JPG)</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleDownloadSinglePhoto(selectedPhoto)}
                      className="w-full py-3 px-4 rounded-full bg-[#D4A373] hover:bg-[#C5925F] text-[#1A1817] font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-95"
                    >
                      <Download className="w-4 h-4 text-[#1A1817]" />
                      <span>Download Foto (JPG)</span>
                    </button>
                  )}

                  {/* Delete Button */}
                  <div className="flex justify-center pt-1">
                    <button
                      onClick={() =>
                        promptDelete('photo', selectedPhoto.id, selectedPhoto.guest?.name || selectedPhoto.guest_name || 'Foto')
                      }
                      className="text-[11px] font-mono text-rose-400/80 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer py-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Foto Ini</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: DELETE CONFIRMATION
          ========================================================================= */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-[#E5E1DA] shadow-2xl relative flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-medium tracking-tight text-[#111111]">
                Hapus {deleteModal.type === 'photo' ? 'Foto & Data Tamu' : deleteModal.type === 'guest' ? 'Data Tamu & Kenangannya' : 'Pesan Suara'}?
              </h3>
              <p className="text-xs text-[#666666] leading-relaxed">
                {deleteModal.type === 'photo'
                  ? `Menghapus foto ini juga akan menghapus rekaman suara dan nama tamu ${deleteModal.title} dari daftar tamu secara permanen.`
                  : deleteModal.type === 'guest'
                  ? `Menghapus tamu ${deleteModal.title} akan menghapus seluruh foto dan pesan suara terkait secara permanen.`
                  : `Tindakan ini akan menghapus rekaman pesan suara dari ${deleteModal.title} secara permanen.`}
              </p>
            </div>

            <div className="w-full flex items-center gap-3 pt-3 border-t border-[#E5E1DA]">
              <button
                onClick={() =>
                  setDeleteModal({ isOpen: false, type: null, id: null, title: '', loading: false })
                }
                disabled={deleteModal.loading}
                className="flex-1 py-2.5 rounded-full border border-[#E5E1DA] hover:bg-neutral-50 text-xs font-mono uppercase tracking-wider text-[#111111] transition-all cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>

              <button
                onClick={handleConfirmDelete}
                disabled={deleteModal.loading}
                className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {deleteModal.loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{deleteModal.loading ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: QR CODE DISPLAY & PRINT
          ========================================================================= */}
      {isQrModalOpen && activeEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-[#E5E1DA] shadow-2xl relative flex flex-col items-center text-center space-y-5 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute right-4 top-4 p-2 rounded-full text-[#666666] hover:text-[#111111] hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 pt-2">
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#A27A49]">
                SCAN TO PHOTOBOOTH
              </span>
              <h3 className="text-xl font-serif tracking-tight text-[#111111]">
                {activeEvent.name}
              </h3>
              <p className="text-xs text-[#666666] font-mono">/event/{activeEvent.slug}</p>
            </div>

            {/* QR Code */}
            <div className="p-4 bg-white border border-[#E5E1DA] rounded-2xl shadow-xs">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
                  eventUrl
                )}&format=png`}
                alt="QR Code Event"
                className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
              />
            </div>

            <p className="text-[11px] text-[#666666] leading-relaxed max-w-xs font-light">
              Arahkan kamera smartphone ke QR Code di atas untuk langsung membuka Virtual Photobooth
              tanpa aplikasi.
            </p>

            <div className="w-full flex items-center gap-3 pt-2 border-t border-[#E5E1DA]">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2.5 rounded-full border border-[#E5E1DA] hover:bg-neutral-50 text-xs font-mono uppercase tracking-wider text-[#111111] transition-all cursor-pointer"
              >
                {copied ? 'Tersalin!' : 'Salin Link'}
              </button>

              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(
                  eventUrl
                )}&format=png`}
                download={`qr-${activeEvent.slug}.png`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-full bg-[#111111] hover:bg-[#292624] text-white text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh QR</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientHomePage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-xs font-mono text-[#666666]">
          Memuat Portal Klien...
        </div>
      }
    >
      <ClientDashboardInner />
    </Suspense>
  );
}
