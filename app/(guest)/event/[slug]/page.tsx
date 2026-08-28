'use client';

import { useState, useEffect, useRef, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Event } from '@/lib/types/database';
import { createFinalPhotoComposite } from '@/lib/utils/canvas';
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
} from 'lucide-react';

export default function GuestPhotoboothPage({ params }: { params: Promise<{ slug: string }> }) {
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [capturedSnapshots, setCapturedSnapshots] = useState<string[]>([]);
  const [finalCompositeUrl, setFinalCompositeUrl] = useState<string | null>(null);
  const [compositing, setCompositing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);

  // Guest Details State
  const [guestName, setGuestName] = useState('');
  const [instagram, setInstagram] = useState('');
  const [guestId, setGuestId] = useState<string | null>(null);
  const [savingGuest, setSavingGuest] = useState(false);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  // Load Event Details by Slug with Resilient Fallback
  useEffect(() => {
    async function loadEventData() {
      try {
        setLoading(true);
        // 1. Primary lookup by slug
        let { data, error: fetchErr } = await (supabase.from('events') as any)
          .select('*')
          .eq('slug', slug)
          .single();

        // 2. Resilient fallback lookup if URL slug was edited
        if (fetchErr || !data) {
          const { data: activeFallback } = await (supabase.from('events') as any)
            .select('*')
            .eq('status', 'active')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activeFallback) {
            data = activeFallback;
          } else {
            const { data: anyEvent } = await (supabase.from('events') as any)
              .select('*')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (anyEvent) data = anyEvent;
          }
        }

        if (!data) {
          throw new Error('Acara tidak ditemukan. Silakan buat event baru di dashboard Admin.');
        }

        // 3. Status check with active fallback
        if (data.status !== 'active') {
          const { data: liveEvent } = await (supabase.from('events') as any)
            .select('*')
            .eq('status', 'active')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (liveEvent) {
            data = liveEvent;
          } else {
            throw new Error(
              `Acara "${data.name}" saat ini berstatus "${data.status.toUpperCase()}". Ubah status ke "Active (Live)" di Admin Events agar tamu dapat masuk.`
            );
          }
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
          subtitle: resolvedSubtitle !== undefined && resolvedSubtitle !== null ? resolvedSubtitle : (data.subtitle || 'WEDDING'),
        };

        setEvent(mergedEvent as Event);

        if (data.frame_path) {
          const { data: publicUrlData } = supabase.storage
            .from('virtual-photobooth')
            .getPublicUrl(data.frame_path);

          if (publicUrlData?.publicUrl) {
            setFramePublicUrl(publicUrlData.publicUrl);
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
        setError(err.message || 'Failed to load photobooth event');
      } finally {
        setLoading(false);
      }
    }

    loadEventData();
  }, [slug, supabase]);

  // Start Camera Stream (Supports Front/Selfie & Back Camera)
  const startCamera = async (overrideMode?: 'user' | 'environment') => {
    const targetMode = overrideMode || facingMode;
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetMode },
          width: { ideal: 1080 },
          height: { ideal: 1440 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setCameraActive(true);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'NotReadableError') {
        // Silently ignore browser stream abort errors during camera switching
        return;
      }
      console.error('Camera access error:', err);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Switch Facing Camera Mode (Front/Back)
  const toggleCameraFacing = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  // Toggle Camera Flash (Torch & Screen Flash)
  const toggleFlash = async () => {
    const nextState = !flashEnabled;
    setFlashEnabled(nextState);

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (track && 'applyConstraints' in track) {
        try {
          const caps: any = track.getCapabilities ? track.getCapabilities() : {};
          if (caps.torch) {
            await track.applyConstraints({ advanced: [{ torch: nextState }] as any });
          }
        } catch (e) {
          console.log('Hardware torch constraint not available:', e);
        }
      }
    }
  };

  // Trigger Single Photo Capture with Manual Control
  const handleCaptureSinglePhoto = async () => {
    if (!event || capturing) return;
    setCapturing(true);
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
          updated[currentPhotoIndex - 1] = dataUrl;
          return updated;
        });
      }
    }

    setCountdown(null);
    setCapturing(false);

    const totalPhotos = event.photo_count || 4;
    if (currentPhotoIndex < totalPhotos) {
      setCurrentPhotoIndex((prev) => prev + 1);
    }
  };

  // Retake a specific photo by index (0-based)
  const handleRetakePhotoSlot = (slotIndex: number) => {
    if (capturing) return;
    setCapturedSnapshots((prev) => {
      const updated = [...prev];
      updated.splice(slotIndex, 1);
      return updated;
    });
    setCurrentPhotoIndex(slotIndex + 1);
  };

  // Proceed to Final Photo Composite Generation
  const handleProceedToComposite = async () => {
    if (!event || capturedSnapshots.length === 0) return;
    stopCamera();
    setCompositing(true);
    setStep(3); // Result step

    try {
      const compositeDataUrl = await createFinalPhotoComposite({
        photos: capturedSnapshots,
        frameImageUrl: framePublicUrl,
        eventName: event.name,
        eventDate: event.event_date,
        photoCount: event.photo_count,
      });

      setFinalCompositeUrl(compositeDataUrl);
    } catch (err) {
      console.error('Composite generation error:', err);
    } finally {
      setCompositing(false);
    }
  };

  // Download Final Photo
  const handleDownloadPhoto = () => {
    if (!finalCompositeUrl || !event) return;
    const link = document.createElement('a');
    link.href = finalCompositeUrl;
    link.download = `${event.slug}-photobooth-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save Guest Record (Step 4)
  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setSavingGuest(true);

    try {
      let currentGuestId = guestId;

      if (guestName.trim()) {
        const { data: newGuest, error: guestErr } = await (supabase.from('guests') as any)
          .insert({
            event_id: event.id,
            name: guestName.trim(),
            instagram: instagram.trim() || null,
          })
          .select('id')
          .single();

        if (!guestErr && newGuest) {
          currentGuestId = newGuest.id;
          setGuestId(newGuest.id);
        }
      }

      // Save Photo Record to DB
      if (finalCompositeUrl) {
        const photoId = crypto.randomUUID();
        const storagePath = `events/${event.id}/photos/${photoId}.png`;

        // Upload composite base64 blob to Supabase storage
        const res = await fetch(finalCompositeUrl);
        const blob = await res.blob();

        await supabase.storage.from('virtual-photobooth').upload(storagePath, blob, {
          contentType: 'image/png',
          upsert: true,
        });

        await (supabase.from('photos') as any).insert({
          id: photoId,
          event_id: event.id,
          guest_id: currentGuestId,
          final_photo_path: storagePath,
        });
      }

      // Move to Next Step: Voice or Thanks
      if (event.is_voice_enabled) {
        setStep(5); // Voice Message
      } else {
        setStep(6); // Thank You
      }
    } catch (err) {
      console.error('Error saving guest data:', err);
    } finally {
      setSavingGuest(false);
    }
  };

  // Helper to find supported audio MIME type across iOS Safari and Android Chrome
  const getSupportedAudioMimeType = () => {
    const mimeTypes = [
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/aac',
      'audio/ogg',
      'audio/wav',
    ];
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      }
    }
    return '';
  };

  // Start Audio Recording (Step 5)
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioChunksRef.current = [];
      const mimeType = getSupportedAudioMimeType();
      const options = mimeType ? { mimeType } : undefined;

      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const actualType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualType });
        setAudioBlob(blob);

        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const newUrl = URL.createObjectURL(blob);
        setAudioUrl(newUrl);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Slice audio data every 250ms
      setIsRecording(true);
      setRecordSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Audio recording error:', err);
      alert('Izin mikrofon diperlukan untuk merekam pesan suara.');
    }
  };

  // Stop Audio Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  // Upload Voice Recording to Supabase
  const handleSaveVoiceMessage = async () => {
    if (!audioBlob || !event) {
      setStep(6); // Skip to Thanks
      return;
    }

    setUploadingVoice(true);

    try {
      const voiceId = crypto.randomUUID();
      const isMp4 = audioBlob.type.includes('mp4') || audioBlob.type.includes('aac');
      const ext = isMp4 ? 'mp4' : 'webm';
      const storagePath = `events/${event.id}/voices/${voiceId}.${ext}`;

      // Upload audio blob to Supabase storage
      const { error: uploadErr } = await supabase.storage
        .from('virtual-photobooth')
        .upload(storagePath, audioBlob, {
          contentType: audioBlob.type || 'audio/webm',
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      const retentionDays = event.voice_retention_days || 7;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + retentionDays);

      await (supabase.from('voice_messages') as any).insert({
        id: voiceId,
        event_id: event.id,
        guest_id: guestId,
        audio_path: storagePath,
        duration_seconds: recordSeconds,
        expires_at: expiresAt.toISOString(),
      });

      setStep(6); // Thank You Page
    } catch (err) {
      console.error('Failed to save voice recording:', err);
      setStep(6);
    } finally {
      setUploadingVoice(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F9F6F0]">
        <Loader2 className="w-8 h-8 text-[#B8926A] animate-spin mb-3" />
        <p className="text-sm font-medium text-[#78716C]">Loading Photobooth...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F9F6F0]">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-lg font-bold text-[#2C2A29] mb-1">Photobooth Unavailable</h2>
        <p className="text-xs text-[#78716C] max-w-xs">{error || 'Event is currently not active.'}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 bg-[#F9F6F0] relative overflow-hidden selection:bg-[#B8926A] selection:text-white">
      {/* STEP 1: WELCOME SCREEN - MATCHING IMAGE 1 DESIGN */}
      {step === 1 && (
        <div className="flex-1 flex flex-col justify-between items-center text-center py-4 animate-fade-in">
          {/* Top Monogram Header */}
          <div className="pt-4 space-y-3">
            {event.monogram && event.monogram.trim().length > 0 ? (
              <div className="inline-flex items-center justify-center gap-2 text-[#8C6D46] font-serif italic text-2xl font-bold tracking-widest px-4 py-1">
                <span>{event.monogram}</span>
              </div>
            ) : null}

            {/* Event Title & Subtitle */}
            <div className="space-y-1">
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2C2A29] uppercase tracking-wider leading-snug px-2">
                {event.name}
              </h1>
              <p className="text-xs uppercase tracking-[0.3em] font-semibold text-[#8C6D46]">
                {event.subtitle || 'WEDDING'}
              </p>
              <p className="text-xs text-[#78716C] font-medium pt-1 font-mono">{event.event_date}</p>
            </div>
          </div>

          {/* Center Cover Photo with Smooth Bottom Gradient Fade */}
          <div className="w-full my-4 relative flex flex-col items-center px-4">
            <div className="w-full max-w-xs aspect-square sm:aspect-[4/3] rounded-3xl overflow-hidden relative shadow-xl border border-[#E2D9CC]/60 bg-[#F4EFE6] flex items-center justify-center">
              <img
                src={coverPublicUrl || '/default-wedding-cover.png'}
                alt="Event Cover"
                className="w-full h-full object-cover object-center"
              />
              {/* Bottom Gradient Fade Overlay to Cream */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#F9F6F0] via-transparent to-transparent pointer-events-none" />
            </div>
            <p className="text-xs text-[#78716C] italic font-serif mt-3 relative z-10">
              Create a memory for our special day
            </p>
          </div>

          {/* Bottom Action Button & Chevron */}
          <div className="w-full space-y-2 pt-2">
            <button
              onClick={() => {
                setStep(2);
                startCamera();
              }}
              className="w-full py-4 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-medium text-xs tracking-widest uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>START PHOTOBOOTH</span>
            </button>

            <div className="pt-1">
              <span className="inline-block text-[#8C6D46] text-sm animate-bounce opacity-70">
                &or;
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: CAMERA VIEW & COUNTDOWN */}
      {step === 2 && (
        <div className="flex-1 flex flex-col justify-between items-center relative animate-fade-in">
          {/* Fullscreen White Screen Flash Effect */}
          {screenFlash && (
            <div className="fixed inset-0 bg-white z-[999] pointer-events-none animate-pulse transition-opacity duration-100" />
          )}

          {/* Elegant Top Header Controls */}
          <div className="w-full flex items-center justify-between z-20 pb-4 px-1">
            {/* Flash Button */}
            <button
              onClick={toggleFlash}
              disabled={capturing}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg transition-all border cursor-pointer active:scale-95 ${
                flashEnabled
                  ? 'bg-[#2C2A29] text-[#F59E0B] border-[#F59E0B]/60 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  : 'bg-[#2C2A29]/80 backdrop-blur-md text-white/80 border-[#E2D9CC]/30 hover:bg-[#1A1817]'
              }`}
            >
              {flashEnabled ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B] animate-pulse" />
                  <span>Flash ON</span>
                </>
              ) : (
                <>
                  <ZapOff className="w-3.5 h-3.5 text-white/60" />
                  <span>Flash OFF</span>
                </>
              )}
            </button>

            {/* Photo Counter Progress Badge */}
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D46] bg-[#F4EFE6] px-3 py-1 rounded-full border border-[#E2D9CC] shadow-xs">
              {capturing
                ? `Foto ${currentPhotoIndex} / ${event.photo_count}`
                : `Progress ${capturedSnapshots.length} / ${event.photo_count}`}
            </div>

            {/* Elegant Camera Flip Button */}
            <button
              onClick={toggleCameraFacing}
              disabled={capturing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#2C2A29]/90 backdrop-blur-md text-white hover:bg-[#1A1817] text-xs font-semibold shadow-xl transition-all disabled:opacity-40 cursor-pointer active:scale-95 border border-[#D4A373]/40 hover:border-[#D4A373]"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#D4A373] transition-transform duration-500 hover:rotate-180" />
              <span className="tracking-wide">
                {facingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang'}
              </span>
            </button>
          </div>

          {/* Video Preview Container (Portrait Aspect 3:4) */}
          <div className="w-full relative aspect-[3/4] rounded-3xl bg-[#1A1817] overflow-hidden shadow-2xl border-2 border-[#E2D9CC]">
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
                <p className="text-white/80 text-xs tracking-widest uppercase mt-4 font-semibold">
                  {countdown === 0 ? 'CAPTURlNG...' : 'GET READY...'}
                </p>
              </div>
            )}
          </div>

          {/* Bottom Shutter Controls & Photo Progress */}
          <div className="w-full pt-4 flex flex-col items-center gap-3 z-20">
            {/* Captured Photos Progress Bar / Thumbnails */}
            <div className="flex items-center justify-center gap-2.5 mb-1">
              {Array.from({ length: event.photo_count || 4 }).map((_, idx) => {
                const capturedSrc = capturedSnapshots[idx];
                const isCurrent = currentPhotoIndex === idx + 1;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (capturedSrc && !capturing) {
                        handleRetakePhotoSlot(idx);
                      }
                    }}
                    className={`relative w-12 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      capturedSrc
                        ? 'border-emerald-600 shadow-sm'
                        : isCurrent
                        ? 'border-[#8C6D46] bg-[#F4EFE6] animate-pulse'
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
              <div className="text-xs font-semibold text-[#8C6D46] tracking-wider uppercase animate-pulse py-3">
                Memfoto Gambar Ke-{currentPhotoIndex}...
              </div>
            ) : capturedSnapshots.length < event.photo_count ? (
              <div className="flex flex-col items-center gap-2.5 w-full">
                <button
                  onClick={handleCaptureSinglePhoto}
                  className="w-full py-3.5 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-semibold text-xs tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 border border-[#423E3C]"
                >
                  <Camera className="w-4 h-4 text-[#D4A373]" />
                  <span>Ambil Foto Ke-{currentPhotoIndex}</span>
                </button>

                {capturedSnapshots.length > 0 && (
                  <button
                    onClick={() => handleRetakePhotoSlot(capturedSnapshots.length - 1)}
                    className="text-xs font-medium text-[#78716C] hover:text-[#2C2A29] underline transition-colors cursor-pointer py-1 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Ulangi Foto Ke-{capturedSnapshots.length}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5 w-full">
                <button
                  onClick={handleProceedToComposite}
                  className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#2C2A29] to-[#423E3C] hover:from-[#1A1817] hover:to-[#2C2A29] text-white font-bold text-xs tracking-widest uppercase shadow-2xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-[#D4A373]/40"
                >
                  <Sparkles className="w-4 h-4 text-[#D4A373] animate-spin" />
                  <span>Proses & Lihat Hasil Bingkai</span>
                </button>

                <button
                  onClick={() => handleRetakePhotoSlot(capturedSnapshots.length - 1)}
                  className="text-xs font-medium text-[#78716C] hover:text-[#2C2A29] underline transition-colors cursor-pointer py-1 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Foto Ulang Jepretan Terakhir</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: PHOTO RESULT PREVIEW & COMPOSITE */}
      {step === 3 && (
        <div className="flex-1 flex flex-col justify-between items-center text-center py-2 animate-fade-in">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#2C2A29]">Your Memories</h2>
            <p className="text-xs text-[#78716C] mt-1 font-serif italic">
              Composited portrait photo with event frame
            </p>
          </div>

          {/* Final Composite Display */}
          <div className="w-full my-4 flex-1 flex items-center justify-center max-h-[58vh]">
            {compositing ? (
              <div className="flex flex-col items-center justify-center p-12 text-[#78716C]">
                <Loader2 className="w-8 h-8 text-[#B8926A] animate-spin mb-3" />
                <p className="text-xs font-semibold tracking-wider uppercase">Designing Your Frame...</p>
              </div>
            ) : finalCompositeUrl ? (
              <img
                src={finalCompositeUrl}
                alt="Final Composite"
                className="h-full max-w-full object-contain rounded-2xl border border-[#E2D9CC] shadow-2xl"
              />
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-3 pt-2">
            <button
              onClick={handleDownloadPhoto}
              className="w-full py-3.5 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-medium text-xs tracking-wider uppercase shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Photo</span>
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep(2);
                  startCamera();
                }}
                className="flex-1 py-3 px-4 rounded-full border border-[#D4A373] text-[#8C6D46] hover:bg-[#F4EFE6] font-medium text-xs tracking-wider uppercase transition-all"
              >
                Retake Photo
              </button>

              <button
                onClick={() => setStep(4)}
                className="flex-1 py-3 px-4 rounded-full bg-[#8C6D46] hover:bg-[#735735] text-white font-medium text-xs tracking-wider uppercase shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: GUEST NAME & INSTAGRAM */}
      {step === 4 && (
        <div className="flex-1 flex flex-col justify-between py-6 animate-fade-in">
          <div className="text-center pt-4">
            <div className="w-12 h-12 rounded-full bg-[#F4EFE6] border border-[#E2D9CC] flex items-center justify-center mx-auto mb-4 text-[#8C6D46]">
              <Heart className="w-5 h-5 fill-[#8C6D46]/20" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#2C2A29]">One last thing ♡</h2>
            <p className="text-xs text-[#78716C] mt-1 font-serif italic">
              Leave your details for {event.name}
            </p>
          </div>

          <form onSubmit={handleSaveGuest} className="space-y-5 my-auto">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
                What&apos;s your name? *
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Aditya Putra"
                className="w-full bg-[#F0EBE1] border border-[#E2D9CC] focus:border-[#8C6D46] rounded-2xl py-3.5 px-4 text-sm text-[#2C2A29] placeholder-[#A8A29E] focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
                Instagram (Optional)
              </label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@adityaputra"
                className="w-full bg-[#F0EBE1] border border-[#E2D9CC] focus:border-[#8C6D46] rounded-2xl py-3.5 px-4 text-sm text-[#2C2A29] placeholder-[#A8A29E] focus:outline-none transition-all"
              />
            </div>

            <div className="pt-4 space-y-3">
              <button
                type="submit"
                disabled={savingGuest}
                className="w-full py-4 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-medium text-xs tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingGuest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (event.is_voice_enabled) setStep(5);
                  else setStep(6);
                }}
                className="w-full text-center text-xs font-semibold text-[#8C6D46] hover:underline"
              >
                Skip this step
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 5: VOICE MESSAGE */}
      {step === 5 && (
        <div className="flex-1 flex flex-col justify-between py-6 text-center animate-fade-in">
          <div className="pt-4">
            <div className="w-12 h-12 rounded-full bg-[#F4EFE6] border border-[#E2D9CC] flex items-center justify-center mx-auto mb-4 text-[#8C6D46]">
              <Mic className="w-5 h-5" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#2C2A29]">Leave a Voice Message</h2>
            <p className="text-xs text-[#78716C] mt-1 font-serif italic">
              Record a audio greeting for {event.name} ♡
            </p>
          </div>

          {/* Recording Circle Interface */}
          <div className="my-auto py-8 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              {isRecording && (
                <div className="absolute w-36 h-36 rounded-full bg-[#D4A373]/20 animate-ping pointer-events-none" />
              )}

              <button
                type="button"
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={`w-28 h-28 rounded-full border-4 ${
                  isRecording
                    ? 'border-rose-500 bg-rose-500 text-white'
                    : 'border-[#8C6D46] bg-[#F4EFE6] text-[#8C6D46]'
                } shadow-2xl flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95`}
              >
                {isRecording ? <Square className="w-8 h-8 fill-white" /> : <Mic className="w-10 h-10" />}
              </button>
            </div>

            <p className="text-2xl font-mono font-bold text-[#2C2A29] mt-6">{formatTime(recordSeconds)}</p>
            <p className="text-xs text-[#78716C] mt-1 font-medium">
              {isRecording ? 'Tap to Stop Recording' : audioBlob ? 'Recording Ready' : 'Tap Mic to Start'}
            </p>

            {/* Audio Preview Player */}
            {audioUrl && (
              <div className="w-full max-w-sm mt-6 p-4 bg-[#F0EBE1] border border-[#E2D9CC] rounded-2xl flex flex-col gap-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-[#2C2A29]">Hasil Rekaman Suara</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlayingAudio && audioPlayerRef.current) {
                        audioPlayerRef.current.pause();
                      }
                      setAudioBlob(null);
                      setAudioUrl(null);
                      setRecordSeconds(0);
                    }}
                    className="text-xs text-rose-600 font-semibold hover:underline cursor-pointer"
                  >
                    Rekam Ulang
                  </button>
                </div>

                <audio
                  ref={audioPlayerRef}
                  src={audioUrl}
                  controls
                  playsInline
                  onPlay={() => setIsPlayingAudio(true)}
                  onPause={() => setIsPlayingAudio(false)}
                  onEnded={() => setIsPlayingAudio(false)}
                  className="w-full h-10 rounded-lg"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSaveVoiceMessage}
              disabled={uploadingVoice}
              className="w-full py-4 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-medium text-xs tracking-wider uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {uploadingVoice ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading Audio...</span>
                </>
              ) : (
                <>
                  <span>{audioBlob ? 'Submit Voice Message' : 'Skip & Finish'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: THANK YOU SCREEN */}
      {step === 6 && (
        <div className="flex-1 flex flex-col justify-between items-center text-center py-8 animate-fade-in">
          <div className="pt-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="font-serif text-3xl font-bold text-[#2C2A29]">Thank You!</h1>
            <p className="text-xs text-[#78716C] mt-2 font-serif italic px-4">
              Your memory has been saved for {event.name}
            </p>
          </div>

          {/* QR Code view photo later */}
          <div className="my-auto space-y-4">
            <div className="p-4 bg-white rounded-2xl shadow-xl border border-[#E2D9CC] inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? window.location.href : ''
                )}`}
                alt="Event QR"
                className="w-36 h-36 object-contain"
              />
            </div>
            <p className="text-xs text-[#78716C]">Scan to view or share your photo later</p>
          </div>

          <button
            onClick={() => {
              setStep(1);
              setCapturedSnapshots([]);
              setFinalCompositeUrl(null);
              setAudioBlob(null);
              setAudioUrl(null);
            }}
            className="w-full py-4 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-medium text-xs tracking-wider uppercase shadow-xl transition-all"
          >
            Back to Home
          </button>
        </div>
      )}
    </div>
  );
}
