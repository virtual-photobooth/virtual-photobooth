'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Event } from '@/lib/types/database';
import { createFinalPhotoComposite } from '@/lib/utils/canvas';
import { generateSlug } from '@/lib/utils/slug';
import {
  Camera,
  RotateCcw,
  Download,
  CheckCircle2,
  Check,
  Zap,
  ZapOff,
  Mic,
  Square,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Heart,
  QrCode,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';

export default function GuestPhotoboothClient({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const supabase = createClient();

  const [event, setEvent] = useState<Event | null>(null);
  const [framePublicUrl, setFramePublicUrl] = useState<string | null>(null);
  const [coverPublicUrl, setCoverPublicUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flow Step State: 1: Welcome, 2: Camera, 3: Result, 4: Name, 5: Voice, 6: Thanks
  const [step, setStep] = useState<number>(1);

  // Camera & Capture State
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [capturedSnapshots, setCapturedSnapshots] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Final Composited Image
  const [compositedImage, setCompositedImage] = useState<string | null>(null);
  const [processingComposite, setProcessingComposite] = useState(false);

  // Guest Details & Guestbook
  const [guestName, setGuestName] = useState('');
  const [guestNote, setGuestNote] = useState('');

  // Voice Recording State
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  // Load Event Details by Slug with Smart Multi-Format Matcher
  useEffect(() => {
    async function loadEventData() {
      try {
        setLoading(true);
        const decodedSlug = decodeURIComponent(slug);
        const normalizedSlug = generateSlug(decodedSlug);

        // 1. Try exact slug match
        let { data } = await (supabase.from('events') as any)
          .select('*')
          .eq('slug', decodedSlug)
          .maybeSingle();

        // 2. Try normalized slug match (hyphenated lowercase)
        if (!data && normalizedSlug) {
          const { data: normData } = await (supabase.from('events') as any)
            .select('*')
            .eq('slug', normalizedSlug)
            .maybeSingle();
          if (normData) data = normData;
        }

        // 3. Try case-insensitive ilike match
        if (!data) {
          const { data: ilikeData } = await (supabase.from('events') as any)
            .select('*')
            .ilike('slug', decodedSlug)
            .maybeSingle();
          if (ilikeData) data = ilikeData;
        }

        // 4. Try ID match if slug is UUID
        if (!data) {
          const { data: idData } = await (supabase.from('events') as any)
            .select('*')
            .eq('id', decodedSlug)
            .maybeSingle();
          if (idData) data = idData;
        }

        // 5. Fallback only if single active event exists
        if (!data) {
          const { data: activeFallback } = await (supabase.from('events') as any)
            .select('*')
            .eq('status', 'active')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (activeFallback) data = activeFallback;
        }

        if (!data) {
          throw new Error('Acara tidak ditemukan. Silakan periksa URL atau buat event baru di Admin.');
        }

        let resolvedMonogram = data.monogram;
        let resolvedSubtitle = data.subtitle;

        if (typeof window !== 'undefined') {
          const storedMeta = localStorage.getItem(`event_meta_${data.id}`);
          if (storedMeta) {
            try {
              const parsed = JSON.parse(storedMeta);
              if (parsed.monogram !== undefined) resolvedMonogram = parsed.monogram;
              if (parsed.subtitle !== undefined) resolvedSubtitle = parsed.subtitle;
            } catch (e) {}
          }
        }

        const mergedEvent = {
          ...data,
          monogram: resolvedMonogram !== undefined && resolvedMonogram !== null ? resolvedMonogram : (data.monogram || ''),
          subtitle: resolvedSubtitle !== undefined && resolvedSubtitle !== null ? resolvedSubtitle : (data.subtitle || ''),
        };

        setEvent(mergedEvent as Event);

        if (data.frame_path) {
          const { data: publicUrlData } = supabase.storage
            .from('virtual-photobooth')
            .getPublicUrl(data.frame_path);

          if (publicUrlData?.publicUrl) {
            setFramePublicUrl(`${publicUrlData.publicUrl}?t=${Date.now()}`);
          }
        }

        if (data.cover_path) {
          const { data: coverUrlData } = supabase.storage
            .from('virtual-photobooth')
            .getPublicUrl(data.cover_path);

          if (coverUrlData?.publicUrl) {
            setCoverPublicUrl(`${coverUrlData.publicUrl}?t=${Date.now()}`);
          }
        } else {
          // Fallback check: if cover photo exists under default storage path for event
          const defaultCoverPath = `events/${data.id}/cover/cover.jpg`;
          const { data: coverUrlData } = supabase.storage
            .from('virtual-photobooth')
            .getPublicUrl(defaultCoverPath);

          if (coverUrlData?.publicUrl) {
            setCoverPublicUrl(`${coverUrlData.publicUrl}?t=${Date.now()}`);
          }
        }
      } catch (err: any) {
        console.error('Error loading event:', err);
        setError(err.message || 'Gagal memuat detail photobooth.');
      } finally {
        setLoading(false);
      }
    }

    loadEventData();
  }, [slug, supabase]);

  // Clean up camera stream on unmount or step change
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (facing: 'user' | 'environment' = facingMode) => {
    stopCamera();
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1440 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
      } catch (e) {
        alert('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser Anda.');
      }
    }
  };

  const toggleCameraFacing = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    await startCamera(nextFacing);
  };

  const toggleFlash = async () => {
    const nextState = !flashEnabled;
    setFlashEnabled(nextState);
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = track.getCapabilities() as any;
          if (capabilities && capabilities.torch) {
            await track.applyConstraints({
              advanced: [{ torch: nextState }],
            } as any);
          }
        } catch (e) {
          console.log('Torch constraint not supported on this track');
        }
      }
    }
  };

  // Trigger Single Photo Capture with Manual Control
  const handleCaptureSinglePhoto = async () => {
    if (!event || capturing) return;
    const totalPhotos = event.photo_count || 4;
    if (capturedSnapshots.length >= totalPhotos) return;

    setCapturing(true);
    const targetSlotIndex = capturedSnapshots.length;
    const initialCountdown = event.countdown_seconds || 3;

    // Countdown loop for current single photo
    for (let c = initialCountdown; c > 0; c--) {
      setCountdown(c);
      await new Promise((r) => setTimeout(r, 1000));
    }

    setCountdown(0); // CAPTURE flash!
    if (flashEnabled) {
      setScreenFlash(true);
      setTimeout(() => setScreenFlash(false), 350);
    }
    await new Promise((r) => setTimeout(r, 200));

    // Snap frame from video
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1080;
      canvas.height = videoRef.current.videoHeight || 1440;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

        setCapturedSnapshots((prev) => {
          const updated = [...prev];
          updated[targetSlotIndex] = dataUrl;
          return updated;
        });
      }
    }

    setCountdown(null);
    setCapturing(false);
  };

  // Retake a specific photo by index (0-based)
  const handleRetakePhotoSlot = (slotIndex: number) => {
    setCapturedSnapshots((prev) => prev.filter((_, idx) => idx !== slotIndex));
    setCurrentPhotoIndex(slotIndex + 1);
  };

  // Generate Final Composited Photo with Event PNG Frame
  const handleProceedToComposite = async () => {
    if (!event || capturedSnapshots.length === 0) return;
    setProcessingComposite(true);
    try {
      stopCamera();
      const finalImageBase64 = await createFinalPhotoComposite({
        photos: capturedSnapshots,
        frameImageUrl: framePublicUrl,
        eventName: event.name,
        eventDate: event.event_date,
        photoCount: event.photo_count || 4,
      });

      setCompositedImage(finalImageBase64);
      setStep(3); // Go to Result Step
    } catch (err) {
      console.error('Error generating composite:', err);
      alert('Gagal memproses foto bingkai. Mencoba kembali...');
    } finally {
      setProcessingComposite(false);
    }
  };

  const [recordedMimeType, setRecordedMimeType] = useState<string>('audio/mp4');

  const latestVoiceBlobRef = useRef<Blob | null>(null);

  // Voice Note Recording Handlers with Cross-Platform iOS Safari Compatibility
  const startVoiceRecording = async () => {
    try {
      audioChunksRef.current = [];
      latestVoiceBlobRef.current = null;
      setVoiceBlob(null);
      setVoiceAudioUrl(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Detect supported MIME type (iOS Safari requires audio/mp4 or audio/aac)
      let selectedMimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          selectedMimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          selectedMimeType = 'audio/aac';
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          selectedMimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          selectedMimeType = 'audio/webm';
        }
      }

      setRecordedMimeType(selectedMimeType);

      const options: MediaRecorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
        latestVoiceBlobRef.current = audioBlob;
        setVoiceBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setVoiceAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setRecordingVoice(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            stopVoiceRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      alert('Tidak dapat mengakses mikrofon. Berikan izin mikrofon untuk merekam suara.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && recordingVoice) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping media recorder:', e);
      }
      setRecordingVoice(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const togglePlayVoice = async () => {
    if (!voiceAudioUrl) return;

    try {
      if (!audioPlayerRef.current || audioPlayerRef.current.src !== voiceAudioUrl) {
        const audio = new Audio(voiceAudioUrl);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setIsPlayingAudio(false);
        };
        audioPlayerRef.current = audio;
      }

      if (isPlayingAudio) {
        audioPlayerRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        await audioPlayerRef.current.play();
        setIsPlayingAudio(true);
      }
    } catch (e) {
      console.error('Audio play error:', e);
      setIsPlayingAudio(false);
    }
  };

  // Final Submission to Guestbook
  const handleSubmitGuestbook = async () => {
    if (!event) return;
    setUploadingVoice(true);

    if (recordingVoice) {
      stopVoiceRecording();
      await new Promise((r) => setTimeout(r, 300));
    }

    try {
      let voiceBase64: string | null = null;
      const targetBlob = voiceBlob || latestVoiceBlobRef.current;

      if (targetBlob) {
        voiceBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(targetBlob);
        });
      }

      const res = await fetch('/api/guest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          guestName: guestName.trim() || 'Tamu Istimewa',
          wishes: guestNote.trim() || null,
          photoBase64: compositedImage || null,
          voiceBase64: voiceBase64,
          voiceMimeType: recordedMimeType,
          durationSeconds: recordingTime > 0 ? recordingTime : 0,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        console.warn('Guestbook submit warn:', resData?.message);
      }

      setStep(6); // Go to Thank You Step
    } catch (err) {
      console.error('Error submitting guestbook:', err);
      setStep(6);
    } finally {
      setUploadingVoice(false);
    }
  };

  const downloadCompositedPhoto = () => {
    if (!compositedImage) return;
    const a = document.createElement('a');
    a.href = compositedImage;
    a.download = `photobooth-${event?.slug || 'memory'}-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F6F0] p-6 text-center">
        <Loader2 className="w-10 h-10 text-[#8C6D46] animate-spin mb-4" />
        <h2 className="font-serif text-lg font-bold text-[#2C2A29]">Memuat Photobooth...</h2>
        <p className="text-xs text-[#78716C] mt-1 font-mono">Menyiapkan pengalaman foto Anda</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F6F0] p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-lg font-bold text-[#2C2A29]">Photobooth Unavailable</h2>
        <p className="text-xs text-[#78716C] max-w-xs">{error || 'Event is currently not active.'}</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col justify-between p-6 sm:p-8 relative overflow-hidden selection:bg-[#B8926A] selection:text-white transition-colors duration-300 ${
      flashEnabled && step === 2 ? 'bg-white' : 'bg-[#F9F6F0]'
    }`}>
      {/* STEP 1: WELCOME SCREEN - LUXURY EDITORIAL CARD */}
      {step === 1 && (
        <div className="flex-1 flex flex-col justify-center items-center text-center py-2 sm:py-6 animate-fade-in my-auto w-full">
          <div className="w-full max-w-sm sm:max-w-md bg-white/90 backdrop-blur-xl rounded-[2.5rem] border border-[#E2D9CC]/90 p-5 sm:p-7 shadow-2xl flex flex-col items-center justify-between space-y-4 relative overflow-hidden">
            {/* Soft Ambient Gold Glow Inside Card */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-[#D4A373]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-[#8C6D46]/10 rounded-full blur-2xl pointer-events-none" />

            {/* Top Monogram / Gold Diamond Accent */}
            <div className="space-y-2 pt-1 z-10 w-full">
              {event.monogram && event.monogram.trim().length > 0 ? (
                <div className="inline-flex items-center justify-center gap-2 text-[#8C6D46] font-serif italic text-2xl font-bold tracking-widest px-4 py-0.5">
                  <span>{event.monogram}</span>
                </div>
              ) : (
                <div className="inline-flex items-center justify-center gap-2 text-[#D4A373] text-xs font-serif tracking-widest">
                  <span className="h-[1px] w-6 bg-[#D4A373]/40 inline-block" />
                  <span>✦</span>
                  <span className="h-[1px] w-6 bg-[#D4A373]/40 inline-block" />
                </div>
              )}

              {/* Event Title & Subtitle Badge */}
              <div className="space-y-1.5 px-1">
                <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-[#2C2A29] uppercase tracking-wider leading-snug">
                  {event.name}
                </h1>

                <div className="flex items-center justify-center gap-2 pt-0.5 flex-wrap">
                  {event.subtitle && event.subtitle.trim().length > 0 && (
                    <span className="text-[10px] uppercase tracking-[0.25em] font-extrabold text-[#8C6D46] bg-[#F4EFE6] px-3 py-1 rounded-full border border-[#E2D9CC]">
                      {event.subtitle}
                    </span>
                  )}
                  <span className="text-[10px] text-[#78716C] font-semibold font-mono bg-[#F4EFE6]/70 px-3 py-1 rounded-full border border-[#E2D9CC]/60">
                    {event.event_date}
                  </span>
                </div>
              </div>
            </div>

            {/* Center Cover Photo Container */}
            <div className="w-full relative flex flex-col items-center z-10 px-1 py-1">
              <div className="w-full rounded-2xl overflow-hidden relative shadow-lg border border-[#E2D9CC] bg-[#F4EFE6] flex items-center justify-center p-1">
                <img
                  src={coverPublicUrl || '/default-wedding-cover.png'}
                  alt="Event Cover"
                  className="w-full h-auto max-h-[30vh] sm:max-h-[35vh] object-contain rounded-xl"
                />
              </div>
              <p className="text-[11px] text-[#78716C] italic font-serif mt-2 relative z-10">
                Create a memory for our special day
              </p>
            </div>

            {/* Bottom Start Photobooth Button */}
            <div className="w-full pt-1 z-10">
              <button
                onClick={() => {
                  setStep(2);
                  startCamera();
                }}
                className="w-full py-3.5 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-bold text-xs tracking-widest uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-[#423E3C]"
              >
                <Camera className="w-4 h-4 text-[#D4A373]" />
                <span>START PHOTOBOOTH</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: CAMERA VIEW & COUNTDOWN */}
      {step === 2 && (
        <div className="flex-1 flex flex-col justify-between items-center relative animate-fade-in w-full max-h-[100dvh] overflow-hidden py-1 px-1">
          {/* Fullscreen White Screen Flash Effect */}
          {screenFlash && (
            <div className="fixed inset-0 bg-white z-[99999] opacity-100 pointer-events-none animate-pulse transition-opacity duration-150" />
          )}

          {/* Top Controls Header (100% Visible on Mobile) */}
          <div className="w-full flex items-center justify-between z-20 pb-2 px-1 pt-1 shrink-0">
            {/* Flash Toggle Button */}
            <button
              onClick={toggleFlash}
              disabled={capturing}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all border cursor-pointer active:scale-95 ${
                flashEnabled
                  ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.8)] animate-pulse'
                  : 'bg-[#2C2A29]/90 backdrop-blur-md text-white/90 border-[#E2D9CC]/30 hover:bg-[#1A1817]'
              }`}
            >
              {flashEnabled ? (
                <>
                  <Zap className="w-4 h-4 text-white fill-white" />
                  <span>Flash ON</span>
                </>
              ) : (
                <>
                  <ZapOff className="w-3.5 h-3.5 text-white/70" />
                  <span>Flash OFF</span>
                </>
              )}
            </button>

            {/* Photo Counter Badge */}
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C6D46] bg-[#F4EFE6] px-3 py-1 rounded-full border border-[#E2D9CC] shadow-xs">
              {capturing
                ? `Foto ${currentPhotoIndex} / ${event.photo_count}`
                : `Progress ${capturedSnapshots.length} / ${event.photo_count}`}
            </div>

            {/* Camera Flip Button */}
            <button
              onClick={toggleCameraFacing}
              disabled={capturing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2C2A29]/90 backdrop-blur-md text-white hover:bg-[#1A1817] text-xs font-semibold shadow-md transition-all disabled:opacity-40 cursor-pointer active:scale-95 border border-[#D4A373]/40"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#D4A373]" />
              <span className="tracking-wide">
                {facingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang'}
              </span>
            </button>
          </div>

          {/* Video Preview Container (Dynamically Scaled Studio Ring Light) */}
          <div
            className={`w-full max-w-sm aspect-[3/4] max-h-[46vh] sm:max-h-[52vh] rounded-3xl overflow-hidden relative shadow-2xl transition-all shrink-1 my-auto ${
              flashEnabled
                ? 'border-4 border-white ring-[16px] ring-white shadow-[0_0_100px_rgba(255,255,255,1)] bg-white'
                : 'border-2 border-[#E2D9CC] bg-[#1A1817]'
            }`}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              }`}
            />

            {/* Countdown Overlay Flash */}
            {countdown !== null && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center z-30">
                <div className="text-white font-serif font-extrabold text-7xl sm:text-8xl animate-ping-once drop-shadow-2xl">
                  {countdown === 0 ? '📸' : countdown}
                </div>
                <p className="text-white/90 text-xs tracking-widest uppercase mt-4 font-semibold">
                  {countdown === 0 ? 'SENYUM...' : 'GET READY...'}
                </p>
              </div>
            )}
          </div>

          {/* Bottom Shutter Controls & Photo Progress (Always Visible above Mobile Bar) */}
          <div className="w-full pt-2 pb-1 flex flex-col items-center gap-2 z-20 shrink-0">
            {/* Captured Photos Progress Bar / Thumbnails */}
            <div className="flex items-center justify-center gap-2 mb-0.5">
              {Array.from({ length: event.photo_count || 4 }).map((_, idx) => {
                const capturedSrc = capturedSnapshots[idx];
                const isCurrent = capturedSnapshots.length === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (capturedSrc && !capturing) {
                        handleRetakePhotoSlot(idx);
                      }
                    }}
                    className={`relative w-11 h-13 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      capturedSrc
                        ? 'border-emerald-600 shadow-sm'
                        : isCurrent
                        ? 'border-[#8C6D46] bg-[#F4EFE6] animate-pulse ring-2 ring-[#8C6D46]/40'
                        : 'border-[#E2D9CC] bg-[#E5DFD5]'
                    }`}
                  >
                    {capturedSrc ? (
                      <>
                        <img src={capturedSrc} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-0.5 right-0.5 bg-emerald-600 text-white rounded-full p-0.5 shadow-xs">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[10px] font-bold text-[#78716C]">
                        <span>#{idx + 1}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Shutter Button & Action Controls */}
            {capturing ? (
              <div className="text-xs font-semibold text-[#8C6D46] tracking-wider uppercase animate-pulse py-2">
                Memfoto Gambar Ke-{capturedSnapshots.length + 1}...
              </div>
            ) : capturedSnapshots.length < event.photo_count ? (
              <div className="flex flex-col items-center gap-1.5 w-full max-w-sm px-2">
                <button
                  onClick={handleCaptureSinglePhoto}
                  className="w-full py-3.5 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-bold text-xs tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 border border-[#423E3C] ring-4 ring-[#8C6D46]/20 animate-pulse"
                >
                  <Camera className="w-4 h-4 text-[#D4A373]" />
                  <span>Ambil Foto Ke-{capturedSnapshots.length + 1}</span>
                </button>

                {capturedSnapshots.length > 0 && (
                  <button
                    onClick={() => handleRetakePhotoSlot(capturedSnapshots.length - 1)}
                    className="text-[11px] font-semibold text-[#78716C] hover:text-[#2C2A29] underline transition-colors cursor-pointer py-0.5 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Ulangi Foto Ke-{capturedSnapshots.length}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 w-full max-w-sm px-2">
                <button
                  onClick={handleProceedToComposite}
                  className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#2C2A29] to-[#423E3C] hover:from-[#1A1817] hover:to-[#2C2A29] text-white font-bold text-xs tracking-widest uppercase shadow-2xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-[#D4A373]/40"
                >
                  <Sparkles className="w-4 h-4 text-[#D4A373] animate-spin" />
                  <span>Proses & Lihat Hasil Bingkai</span>
                </button>

                <button
                  onClick={() => handleRetakePhotoSlot(capturedSnapshots.length - 1)}
                  className="text-[11px] font-semibold text-[#78716C] hover:text-[#2C2A29] underline transition-colors cursor-pointer py-0.5 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Foto Ulang Jepretan Terakhir</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: RESULT VIEW & DOWNLOAD */}
      {step === 3 && compositedImage && (
        <div className="flex-1 flex flex-col justify-between items-center text-center animate-fade-in py-2 max-w-md mx-auto w-full">
          <div className="space-y-1 pt-2">
            <h2 className="font-serif text-2xl font-bold text-[#2C2A29]">Your Memories</h2>
            <p className="text-xs text-[#78716C] italic font-serif">
              Composited portrait photo with event frame
            </p>
          </div>

          {/* Final Composited Photo Result */}
          <div className="w-full max-w-xs sm:max-w-sm rounded-3xl overflow-hidden relative shadow-2xl border-4 border-white my-4 bg-transparent flex items-center justify-center">
            <img
              src={compositedImage}
              alt="Final Photobooth Memories"
              className="w-full h-auto object-contain rounded-2xl"
            />
          </div>

          {/* Download & Next Steps Action Buttons */}
          <div className="w-full space-y-3 pt-2">
            <button
              onClick={downloadCompositedPhoto}
              className="w-full py-4 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-semibold text-xs tracking-widest uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4 text-[#D4A373]" />
              <span>DOWNLOAD PHOTO</span>
            </button>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => {
                  setCapturedSnapshots([]);
                  setCompositedImage(null);
                  setStep(2);
                  startCamera();
                }}
                className="py-3 px-4 rounded-full bg-white hover:bg-[#F4EFE6] text-[#2C2A29] font-medium text-xs tracking-wider uppercase border border-[#E2D9CC] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RETAKE PHOTO</span>
              </button>

              <button
                onClick={() => setStep(4)}
                className="py-3 px-4 rounded-full bg-[#8C6D46] hover:bg-[#735735] text-white font-medium text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>CONTINUE</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: GUEST DETAILS FORM */}
      {step === 4 && (
        <div className="flex-1 flex flex-col justify-between items-center text-center animate-fade-in py-4 max-w-sm mx-auto w-full">
          <div className="space-y-2 pt-4">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2C2A29]">
              Guest Guestbook
            </h2>
            <p className="text-xs text-[#78716C] max-w-xs leading-relaxed">
              Tuliskan nama dan ucapan Anda untuk dimasukkan ke dalam album kenangan acara
            </p>
          </div>

          <div className="w-full space-y-4 my-6 bg-white p-6 rounded-3xl border border-[#E2D9CC] shadow-xl text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8C6D46] mb-1.5">
                Nama Anda (Guest Name) *
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Contoh: Celine & Brian"
                className="w-full bg-[#F9F6F0] border border-[#E2D9CC] focus:border-[#8C6D46] rounded-xl p-3.5 text-xs text-[#2C2A29] font-medium focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8C6D46] mb-1.5">
                Pesan Ucapan / Doa (Guest Message)
              </label>
              <textarea
                rows={3}
                value={guestNote}
                onChange={(e) => setGuestNote(e.target.value)}
                placeholder="Tuliskan ucapan selamat dan kebahagiaan Anda..."
                className="w-full bg-[#F9F6F0] border border-[#E2D9CC] focus:border-[#8C6D46] rounded-xl p-3.5 text-xs text-[#2C2A29] font-medium focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={() => {
                if (event?.is_voice_enabled) {
                  setStep(5); // Go to Voice Note
                } else {
                  handleSubmitGuestbook();
                }
              }}
              className="w-full py-4 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-medium text-xs tracking-widest uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>{event?.is_voice_enabled ? 'LANJUT REKAM SUARA' : 'SIMPAN KE GUESTBOOK'}</span>
              <ArrowRight className="w-4 h-4 text-[#D4A373]" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: VOICE NOTE RECORDING */}
      {step === 5 && (
        <div className="flex-1 flex flex-col justify-between items-center text-center animate-fade-in py-4 max-w-sm mx-auto w-full">
          <div className="space-y-2 pt-4">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2C2A29]">
              Voice Guestbook
            </h2>
            <p className="text-xs text-[#78716C] max-w-xs leading-relaxed">
              Tinggalkan pesan suara langsung ucapan selamat dan doa kesan Anda (Maksimal 60 Detik)
            </p>
          </div>

          <div className="w-full my-6 bg-white p-8 rounded-3xl border border-[#E2D9CC] shadow-xl flex flex-col items-center gap-6">
            {/* Audio Timer Badge */}
            <div className="text-3xl font-mono font-bold text-[#2C2A29] bg-[#F4EFE6] px-6 py-2 rounded-2xl border border-[#E2D9CC]">
              00:{recordingTime < 10 ? `0${recordingTime}` : recordingTime}
            </div>

            {/* Mic Record Button */}
            {!voiceBlob ? (
              <button
                onClick={recordingVoice ? stopVoiceRecording : startVoiceRecording}
                className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer active:scale-90 ${
                  recordingVoice
                    ? 'bg-rose-500 text-white animate-pulse ring-8 ring-rose-200'
                    : 'bg-[#8C6D46] hover:bg-[#735735] text-white'
                }`}
              >
                {recordingVoice ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-10 h-10" />}
              </button>
            ) : (
              <div className="flex items-center gap-4 w-full justify-center">
                <button
                  onClick={togglePlayVoice}
                  className="w-16 h-16 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white flex items-center justify-center shadow-xl cursor-pointer"
                >
                  {isPlayingAudio ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                </button>

                <button
                  onClick={() => {
                    setVoiceBlob(null);
                    setVoiceAudioUrl(null);
                    setRecordingTime(0);
                  }}
                  className="px-4 py-2.5 rounded-full bg-[#F4EFE6] hover:bg-[#E5DFD5] text-[#2C2A29] text-xs font-semibold border border-[#E2D9CC] flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rekam Ulang</span>
                </button>
              </div>
            )}

            <p className="text-xs font-semibold text-[#8C6D46]">
              {recordingVoice
                ? 'Sedang Merekam Suara...'
                : voiceBlob
                ? 'Pesan Suara Berhasil Direkam!'
                : 'Klik Tombol Mikrofon Untuk Mulai Merekam'}
            </p>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={handleSubmitGuestbook}
              disabled={uploadingVoice}
              className="w-full py-4 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-semibold text-xs tracking-widest uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {uploadingVoice ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#D4A373]" />
                  <span>MENYIMPAN GUESTBOOK...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#D4A373]" />
                  <span>SELESAI & SIMPAN MEMORI</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: THANK YOU SCREEN */}
      {step === 6 && (
        <div className="flex-1 flex flex-col justify-center items-center text-center animate-fade-in py-6 max-w-sm mx-auto w-full my-auto">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6 shadow-inner">
            <Heart className="w-10 h-10 fill-current animate-pulse" />
          </div>

          <h2 className="font-serif text-3xl font-bold text-[#2C2A29] mb-2">Terima Kasih!</h2>
          <p className="text-xs text-[#78716C] leading-relaxed mb-8 max-w-xs">
            Foto dan ucapan hangat Anda telah berhasil disimpan ke dalam buku tamu kenangan{' '}
            <strong className="text-[#2C2A29]">{event.name}</strong>.
          </p>

          <div className="w-full space-y-3">
            <Link
              href={`/event/${encodeURIComponent(event.slug)}/gallery`}
              className="w-full py-4 px-6 rounded-full bg-[#800020] hover:bg-[#66001A] text-white font-bold text-xs tracking-widest uppercase shadow-2xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-[#9A2B42] block text-center animate-pulse"
            >
              <Sparkles className="w-4 h-4 text-[#FFD700]" />
              <span>LIHAT GALERI KENANGAN</span>
            </Link>

            <button
              onClick={() => {
                setCapturedSnapshots([]);
                setCompositedImage(null);
                setVoiceBlob(null);
                setVoiceAudioUrl(null);
                setGuestName('');
                setGuestNote('');
                setStep(1);
              }}
              className="w-full py-3.5 px-6 rounded-full bg-white hover:bg-[#F4EFE6] text-[#2C2A29] font-semibold text-xs tracking-wider uppercase border border-[#E2D9CC] transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              <span>KEMBALI KE HALAMAN UTAMA</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
