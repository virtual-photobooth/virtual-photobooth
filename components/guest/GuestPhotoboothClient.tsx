'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Event, EventFrame } from '@/lib/types/database';
import { createFinalPhotoComposite } from '@/lib/utils/canvas';
import { generateSlug } from '@/lib/utils/slug';
import { getStoragePublicUrl } from '@/lib/storage/url';
import {
  Camera,
  RotateCcw,
  Download,
  CheckCircle2,
  Check,
  Zap,
  ZapOff,
  Timer,
  TimerOff,
  Mic,
  Square,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Heart,
  QrCode,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  Printer,
} from 'lucide-react';
import { validateEventSlug } from '@/lib/events/validate';
import EventUnavailable from '@/components/guest/EventUnavailable';
import FrameSelector from './FrameSelector';
import ResultFrameSwitcher from './ResultFrameSwitcher';
import AndroidBrowserAdvisor from './AndroidBrowserAdvisor';
import GuestRequestPrintModal from './GuestRequestPrintModal';

interface GuestPhotoboothClientProps {
  params: Promise<{ slug: string }>;
  initialEvent?: Event | null;
  initialCoverUrl?: string | null;
  initialFrameUrl?: string | null;
  initialFrames?: EventFrame[] | null;
  isUnavailable?: boolean;
}

export default function GuestPhotoboothClient({
  params,
  initialEvent,
  initialCoverUrl,
  initialFrameUrl,
  initialFrames,
  isUnavailable,
}: GuestPhotoboothClientProps) {
  const { slug } = use(params);
  const supabase = createClient();

  const [event, setEvent] = useState<Event | null>(initialEvent || null);

  // Multi-frame state
  const [frames, setFrames] = useState<EventFrame[]>(() => {
    if (initialFrames && initialFrames.length > 0) return initialFrames;
    if (initialEvent?.frame_path) {
      const fallbackUrl = initialFrameUrl || getStoragePublicUrl(initialEvent.frame_path);
      return [
        {
          id: 'legacy-default',
          event_id: initialEvent.id,
          name: 'Default Frame',
          frame_path: initialEvent.frame_path,
          photo_count: initialEvent.photo_count || 4,
          sort_order: 0,
          is_default: true,
          created_at: initialEvent.created_at || new Date().toISOString(),
          updated_at: initialEvent.updated_at || new Date().toISOString(),
          frameUrl: fallbackUrl,
          publicUrl: fallbackUrl,
        },
      ];
    }
    return [];
  });

  const [selectedFrame, setSelectedFrame] = useState<EventFrame | null>(() => {
    if (initialFrames && initialFrames.length > 0) {
      return initialFrames.find((f) => f.is_default) || initialFrames[0];
    }
    if (initialEvent?.frame_path) {
      const fallbackUrl = initialFrameUrl || getStoragePublicUrl(initialEvent.frame_path);
      return {
        id: 'legacy-default',
        event_id: initialEvent.id,
        name: 'Default Frame',
        frame_path: initialEvent.frame_path,
        photo_count: initialEvent.photo_count || 4,
        sort_order: 0,
        is_default: true,
        created_at: initialEvent.created_at || new Date().toISOString(),
        updated_at: initialEvent.updated_at || new Date().toISOString(),
        frameUrl: fallbackUrl,
        publicUrl: fallbackUrl,
      };
    }
    return null;
  });

  // Active photo count strictly driven by selected frame (fallback to event.photo_count)
  const activePhotoCount = selectedFrame?.photo_count || event?.photo_count || 4;

  const [framePublicUrl, setFramePublicUrl] = useState<string | null>(
    selectedFrame?.publicUrl || selectedFrame?.frameUrl || initialFrameUrl || (initialEvent?.frame_path ? getStoragePublicUrl(initialEvent.frame_path) : null)
  );
  const [coverPublicUrl, setCoverPublicUrl] = useState<string | null>(
    initialCoverUrl || (initialEvent?.cover_path ? getStoragePublicUrl(initialEvent.cover_path) : null)
  );
  const [loading, setLoading] = useState(!initialEvent && !isUnavailable);
  const [error, setError] = useState<string | null>(isUnavailable ? 'unavailable' : null);

  // Flow Step State: 1: Welcome, 1.5: Frame Select, 2: Camera, 3: Result, 4: Name, 5: Voice, 6: Thanks
  const [step, setStep] = useState<number>(1);

  // Camera & Capture State
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [screenFlash, setScreenFlash] = useState(false);
  const [capturedSnapshots, setCapturedSnapshots] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [chromeIntentUrl, setChromeIntentUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Setup Android Chrome Intent URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href.replace(/^https?:\/\//, '');
      setChromeIntentUrl(`intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end`);
    }
  }, []);

  // Final Composited Image
  const [compositedImage, setCompositedImage] = useState<string | null>(null);
  const compositedImageRef = useRef<string | null>(null);
  const capturedSnapshotsRef = useRef<string[]>([]);
  const [processingComposite, setProcessingComposite] = useState(false);
  const [switchingFrameId, setSwitchingFrameId] = useState<string | null>(null);

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

  // Auto-Upload to Gallery State (Background sync on Step 3)
  const [autoUploadStatus, setAutoUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [autoUploadError, setAutoUploadError] = useState<string | null>(null);
  const [uploadedGuestId, setUploadedGuestId] = useState<string | null>(null);
  const [uploadedPhotoId, setUploadedPhotoId] = useState<string | null>(null);
  const uploadedGuestIdRef = useRef<string | null>(null);
  const uploadedPhotoIdRef = useRef<string | null>(null);

  // Guest Print Request State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [hasRequestedPrint, setHasRequestedPrint] = useState(false);

  // Load Event Details by Slug with Strict Validation (ONE URL = ONE EVENT)
  useEffect(() => {
    if (isUnavailable) {
      setLoading(false);
      setError('unavailable');
      return;
    }

    if (initialEvent) {
      setEvent(initialEvent);

      if (initialFrames && initialFrames.length > 0) {
        setFrames(initialFrames);
        const def = initialFrames.find((f) => f.is_default) || initialFrames[0];
        setSelectedFrame(def);
        if (def.publicUrl || def.frameUrl) {
          setFramePublicUrl(def.publicUrl || def.frameUrl || null);
        }
      } else if (initialEvent.frame_path) {
        const publicUrl = initialFrameUrl || getStoragePublicUrl(initialEvent.frame_path);
        const legacyFrame: EventFrame = {
          id: 'legacy-default',
          event_id: initialEvent.id,
          name: 'Default Frame',
          frame_path: initialEvent.frame_path,
          photo_count: initialEvent.photo_count || 4,
          sort_order: 0,
          is_default: true,
          created_at: initialEvent.created_at || new Date().toISOString(),
          updated_at: initialEvent.updated_at || new Date().toISOString(),
          frameUrl: publicUrl,
          publicUrl: publicUrl,
        };
        setFrames([legacyFrame]);
        setSelectedFrame(legacyFrame);
        if (publicUrl) setFramePublicUrl(publicUrl);
      }

      if (initialCoverUrl) {
        setCoverPublicUrl(initialCoverUrl);
      } else if (initialEvent.cover_path) {
        const cb = initialEvent.updated_at ? `?v=${new Date(initialEvent.updated_at).getTime()}` : '';
        const coverUrl = getStoragePublicUrl(initialEvent.cover_path);
        if (coverUrl) setCoverPublicUrl(`${coverUrl}${cb}`);
      } else {
        setCoverPublicUrl(null);
      }
      setLoading(false);
      return;
    }

    async function loadEventData() {
      try {
        setLoading(true);
        const result = await validateEventSlug(slug);

        if (!result.isValid || !result.event) {
          setEvent(null);
          setError('unavailable');
          return;
        }

        const data = result.event;

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

        const cleanRawMonogram =
          resolvedMonogram && resolvedMonogram !== 'WE' && resolvedMonogram !== 'C | B'
            ? resolvedMonogram.trim()
            : null;

        const mergedEvent = {
          ...data,
          monogram: cleanRawMonogram,
          subtitle: resolvedSubtitle !== undefined && resolvedSubtitle !== null ? resolvedSubtitle : (data.subtitle || ''),
        };

        setEvent(mergedEvent as Event);

        const cacheBust = data.updated_at ? `?v=${new Date(data.updated_at).getTime()}` : '';

        // Query event_frames for client fallback
        const { data: dbFrames } = await supabase
          .from('event_frames')
          .select('*')
          .eq('event_id', data.id)
          .order('is_default', { ascending: false })
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        let loadedFrames: EventFrame[] = (dbFrames || []).map((f: any) => ({
          ...f,
          frameUrl: f.frame_path ? `${getStoragePublicUrl(f.frame_path)}${cacheBust}` : null,
          publicUrl: f.frame_path ? `${getStoragePublicUrl(f.frame_path)}${cacheBust}` : null,
        }));

        if (loadedFrames.length === 0 && data.frame_path) {
          const fallbackUrl = `${getStoragePublicUrl(data.frame_path)}${cacheBust}`;
          loadedFrames = [
            {
              id: 'legacy-default',
              event_id: data.id,
              name: 'Default Frame',
              frame_path: data.frame_path,
              photo_count: data.photo_count || 4,
              sort_order: 0,
              is_default: true,
              created_at: data.created_at || new Date().toISOString(),
              updated_at: data.updated_at || new Date().toISOString(),
              frameUrl: fallbackUrl,
              publicUrl: fallbackUrl,
            },
          ];
        }

        setFrames(loadedFrames);
        const def = loadedFrames.find((f) => f.is_default) || loadedFrames[0] || null;
        setSelectedFrame(def);
        if (def?.publicUrl || def?.frameUrl) {
          setFramePublicUrl(def.publicUrl || def.frameUrl || null);
        } else if (data.frame_path) {
          const publicUrl = getStoragePublicUrl(data.frame_path);
          if (publicUrl) {
            setFramePublicUrl(`${publicUrl}${cacheBust}`);
          }
        }

        if (data.cover_path) {
          const coverUrl = getStoragePublicUrl(data.cover_path);
          if (coverUrl) {
            setCoverPublicUrl(`${coverUrl}${cacheBust}`);
          }
        } else {
          setCoverPublicUrl(null);
        }
      } catch (err: any) {
        console.error('Error loading event:', err);
        setError('unavailable');
      } finally {
        setLoading(false);
      }
    }

    loadEventData();
  }, [slug, initialEvent, isUnavailable]);

  // Clean up camera stream on unmount or step change
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const applyTorch = async (enabled: boolean, stream: MediaStream | null = streamRef.current): Promise<boolean> => {
    if (!stream) return false;
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') return false;

    // Method 1: WebRTC standard advanced constraint
    try {
      await track.applyConstraints({
        advanced: [{ torch: enabled } as any],
      });
      return enabled;
    } catch (e1) {
      // ignore & try next method
    }

    // Method 2: Direct constraint
    try {
      await track.applyConstraints({
        torch: enabled,
      } as any);
      return enabled;
    } catch (e2) {
      // ignore & try next method
    }

    // Method 3: Chromium ImageCapture API (Android Chrome fallback)
    try {
      if (typeof window !== 'undefined' && 'ImageCapture' in window) {
        const ic = new (window as any).ImageCapture(track);
        if (ic && track.applyConstraints) {
          await track.applyConstraints({
            advanced: [{ fillLightMode: enabled ? 'flash' : 'off', torch: enabled } as any],
          });
          return enabled;
        }
      }
    } catch (e3) {
      // ignore
    }

    return false;
  };

  const stopCamera = () => {
    if (streamRef.current) {
      applyTorch(false, streamRef.current);
      setTorchActive(false);
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Native Camera Capture Fallback (Triggered via phone's native camera when WebRTC is restricted)
  const handleNativeCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setCapturedSnapshots((prev) => {
          const updated = [...prev, dataUrl];
          capturedSnapshotsRef.current = updated;
          return updated;
        });
        setCurrentPhotoIndex((prev) => Math.min(prev + 1, activePhotoCount));
        setCameraError(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startCamera = async (facing: 'user' | 'environment' = facingMode) => {
    stopCamera();
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Akses kamera live tidak didukung di peramban ini. Buka di Google Chrome atau gunakan tombol Ambil Foto via Kamera HP di bawah.');
      return;
    }

    try {
      // Stage 1: Ideal portrait resolution constraints
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1440 },
          aspectRatio: { ideal: 3 / 4 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();

        // If flash was already enabled, apply torch on new stream
        if (flashEnabled) {
          setTimeout(async () => {
            const success = await applyTorch(true, newStream);
            setTorchActive(success);
          }, 350);
        }
      }
    } catch (err) {
      console.warn('Stage 1 camera constraint error, attempting Stage 2 fallback:', err);
      try {
        // Stage 2: Adaptive facing mode without rigid dimensions
        const stage2Stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        streamRef.current = stage2Stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stage2Stream;
          await videoRef.current.play();
        }
      } catch (e2) {
        console.warn('Stage 2 camera error, attempting Stage 3 minimal fallback:', e2);
        try {
          // Stage 3: Minimal fallback
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play();
          }
        } catch (e3: any) {
          console.error('All camera fallback tiers failed:', e3);
          const isPermissionDenied =
            e3?.name === 'NotAllowedError' ||
            e3?.name === 'PermissionDeniedError' ||
            e3?.name === 'SecurityError';

          setCameraError(
            isPermissionDenied
              ? 'Izin kamera ditolak oleh browser Anda. Izinkan akses kamera atau buka halaman ini di Google Chrome.'
              : 'Kamera tidak dapat diakses di browser ini. Buka di Google Chrome atau gunakan opsi Ambil Foto via Kamera HP di bawah.'
          );
        }
      }
    }
  };

  const toggleCameraFacing = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    await applyTorch(false);
    setTorchActive(false);
    setFacingMode(nextFacing);
    setZoomLevel(1.0);
    await startCamera(nextFacing);
  };

  const toggleZoom = () => {
    setZoomLevel((prev) => (prev > 1.1 ? 1.0 : 1.25));
  };

  const toggleFlash = async () => {
    const nextState = !flashEnabled;
    setFlashEnabled(nextState);

    // Try applying torch immediately
    const isTorchOn = await applyTorch(nextState);
    setTorchActive(isTorchOn);
  };

  const toggleTimer = () => {
    setTimerEnabled((prev) => !prev);
  };

  // Trigger Single Photo Capture with Manual Control
  const handleCaptureSinglePhoto = async () => {
    if (!event || capturing) return;
    const totalPhotos = activePhotoCount;
    if (capturedSnapshots.length >= totalPhotos) return;

    setCapturing(true);
    const targetSlotIndex = capturedSnapshots.length;
    setCurrentPhotoIndex(targetSlotIndex + 1);
    const initialCountdown = event.countdown_seconds || 3;

    // Countdown loop for current single photo (only if timer enabled)
    if (timerEnabled && initialCountdown > 0) {
      for (let c = initialCountdown; c > 0; c--) {
        setCountdown(c);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCountdown(0); // CAPTURE flash!
    }

    if (flashEnabled) {
      setScreenFlash(true);
      await applyTorch(true);
      // Wait for screen to become fully white and camera sensor to register light
      await new Promise((r) => setTimeout(r, 220));
    } else {
      await new Promise((r) => setTimeout(r, timerEnabled ? 150 : 50));
    }

    // Snap frame from video with precise WYSIWYG matching 3:4 preview & zoom
    if (videoRef.current) {
      const v = videoRef.current;
      const vw = v.videoWidth || 1080;
      const vh = v.videoHeight || 1440;

      // Target preview aspect ratio is 3:4 (0.75)
      const targetAspect = 3 / 4;
      const videoAspect = vw / vh;

      // Calculate unzoomed 3:4 base crop
      let baseW = vw;
      let baseH = vh;
      if (videoAspect > targetAspect) {
        // Video is wider than 3:4 (e.g. 4:3 or landscape 16:9)
        baseW = vh * targetAspect;
        baseH = vh;
      } else {
        // Video is taller than 3:4 (e.g. 9:16 mobile portrait)
        baseW = vw;
        baseH = vw / targetAspect;
      }

      // Apply active zoom level
      const currentZoom = zoomLevel || 1.0;
      const cropW = baseW / currentZoom;
      const cropH = baseH / currentZoom;

      // Determine focal anchor matching preview's object-position (center 42% for front camera)
      const anchorX = 0.5;
      const anchorY = facingMode === 'user' ? 0.42 : 0.5;

      const sxRaw = (vw - cropW) * anchorX;
      const syRaw = (vh - cropH) * anchorY;

      const sx = Math.max(0, Math.min(vw - cropW, sxRaw));
      const sy = Math.max(0, Math.min(vh - cropH, syRaw));
      const sw = Math.min(cropW, vw - sx);
      const sh = Math.min(cropH, vh - sy);

      // Render crisp, standardized 1080x1440 (3:4) canvas snapshot
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1440;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

        setCapturedSnapshots((prev) => {
          const updated = [...prev];
          updated[targetSlotIndex] = dataUrl;
          capturedSnapshotsRef.current = updated;
          return updated;
        });
      }
    }

    if (flashEnabled) {
      setTimeout(() => {
        setScreenFlash(false);
        // If not in permanent torch mode, turn off temporary flash torch
        if (!torchActive) {
          applyTorch(false);
        }
      }, 180);
    }

    setCurrentPhotoIndex(Math.min(targetSlotIndex + 2, totalPhotos));
    setCountdown(null);
    setCapturing(false);
  };

  // Retake a specific photo by index (0-based)
  const handleRetakePhotoSlot = (slotIndex: number) => {
    setCapturedSnapshots((prev) => {
      const updated = prev.filter((_, idx) => idx !== slotIndex);
      capturedSnapshotsRef.current = updated;
      return updated;
    });
    setCurrentPhotoIndex(slotIndex + 1);
  };

  // Trigger Background Auto-Upload to Event Gallery
  const triggerAutoUpload = async (imageB64: string, frameId?: string | null) => {
    if (!event) return;
    setAutoUploadStatus('uploading');
    setAutoUploadError(null);

    try {
      const res = await fetch('/api/guest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          guestName: guestName.trim() || 'Tamu Undangan',
          selectedFrameId: frameId || selectedFrame?.id || null,
          photoBase64: imageB64,
          guestId: uploadedGuestIdRef.current || null,
          photoId: uploadedPhotoIdRef.current || null,
        }),
      });

      let resData: any = null;
      try {
        const text = await res.text();
        resData = text ? JSON.parse(text) : null;
      } catch {
        resData = null;
      }

      if (!res.ok || !resData?.success) {
        if (res.status === 413) {
          throw new Error('Ukuran foto terlalu besar untuk disimpan otomatis.');
        }
        throw new Error(resData?.message || (res.status >= 500 ? 'Server sedang sibuk, silakan coba beberapa saat lagi.' : 'Gagal menyimpan foto otomatis.'));
      }

      if (resData.guestId) {
        setUploadedGuestId(resData.guestId);
        uploadedGuestIdRef.current = resData.guestId;
      }
      if (resData.photoId) {
        setUploadedPhotoId(resData.photoId);
        uploadedPhotoIdRef.current = resData.photoId;
      }

      setAutoUploadStatus('success');
    } catch (err: any) {
      console.error('Auto upload to gallery error:', err);
      setAutoUploadStatus('error');
      setAutoUploadError(err?.message || 'Gagal menyimpan foto otomatis ke galeri.');
    }
  };

  // Retake All Photos - cleanly deletes draft upload if already saved
  const handleRetakeAll = async () => {
    if (uploadedPhotoIdRef.current || uploadedGuestIdRef.current) {
      try {
        await fetch('/api/guest/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'retake',
            photoId: uploadedPhotoIdRef.current,
            guestId: uploadedGuestIdRef.current,
          }),
        });
      } catch (e) {
        console.warn('Retake cleanup failed:', e);
      }
    }

    setUploadedPhotoId(null);
    uploadedPhotoIdRef.current = null;
    setUploadedGuestId(null);
    uploadedGuestIdRef.current = null;
    setAutoUploadStatus('idle');
    setAutoUploadError(null);
    setHasRequestedPrint(false);
    setIsPrintModalOpen(false);

    setCapturedSnapshots([]);
    capturedSnapshotsRef.current = [];
    setCompositedImage(null);
    compositedImageRef.current = null;
    setCurrentPhotoIndex(1);
    setStep(2);
    startCamera();
  };

  // Generate Final Composited Photo with Event PNG Frame
  const handleProceedToComposite = async () => {
    const targetPhotos = capturedSnapshots.length > 0 ? capturedSnapshots : capturedSnapshotsRef.current;
    if (!event || targetPhotos.length === 0) return;
    setProcessingComposite(true);
    try {
      stopCamera();
      const finalImageBase64 = await createFinalPhotoComposite({
        photos: targetPhotos,
        frameImageUrl: framePublicUrl,
        eventName: event.name,
        eventDate: event.event_date,
        photoCount: activePhotoCount,
      });

      compositedImageRef.current = finalImageBase64;
      setCompositedImage(finalImageBase64);
      setStep(3); // Go to Result Step

      // Auto-upload immediately in the background so photo is 100% saved in gallery
      triggerAutoUpload(finalImageBase64, selectedFrame?.id);
    } catch (err) {
      console.error('Error generating composite:', err);
      alert('Gagal memproses foto bingkai. Mencoba kembali...');
    } finally {
      setProcessingComposite(false);
    }
  };

  // Switch Result Frame: Re-composite strictly from pristine RAW snapshots + target frame
  const handleSwitchResultFrame = async (targetFrame: EventFrame) => {
    if (targetFrame.id === selectedFrame?.id) return;

    const targetPhotos = capturedSnapshots.length > 0 ? capturedSnapshots : capturedSnapshotsRef.current;
    if (targetFrame.photo_count !== targetPhotos.length) {
      // Different photo_count: Incompatible in Phase 2C-3, no auto-retake
      return;
    }

    if (!event || targetPhotos.length === 0) return;

    setSwitchingFrameId(targetFrame.id);
    try {
      const targetFrameUrl =
        targetFrame.publicUrl ||
        targetFrame.frameUrl ||
        (targetFrame.frame_path ? getStoragePublicUrl(targetFrame.frame_path) : null);

      // Re-composite directly from pristine RAW snapshots + target frame design
      const newComposite = await createFinalPhotoComposite({
        photos: targetPhotos, // Pristine RAW captured photos (NEVER stacked composites)
        frameImageUrl: targetFrameUrl,
        eventName: event.name,
        eventDate: event.event_date,
        photoCount: targetFrame.photo_count,
      });

      compositedImageRef.current = newComposite;
      setCompositedImage(newComposite);
      setSelectedFrame(targetFrame);
      setFramePublicUrl(targetFrameUrl);

      // Update the uploaded composite in gallery with the new frame
      triggerAutoUpload(newComposite, targetFrame.id);
    } catch (err) {
      console.error('Error switching frame composite:', err);
      alert('Gagal mengganti bingkai foto. Silakan coba lagi.');
    } finally {
      setSwitchingFrameId(null);
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
      // Wait for MediaRecorder onstop callback to finalize blob
      for (let i = 0; i < 10; i++) {
        if (latestVoiceBlobRef.current || voiceBlob) break;
        await new Promise((r) => setTimeout(r, 100));
      }
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

      let targetPhotoBase64 = compositedImage || compositedImageRef.current;

      if (!targetPhotoBase64 && capturedSnapshotsRef.current.length > 0) {
        try {
          targetPhotoBase64 = await createFinalPhotoComposite({
            photos: capturedSnapshotsRef.current,
            frameImageUrl: framePublicUrl,
            eventName: event.name,
            eventDate: event.event_date,
            photoCount: activePhotoCount,
          });
        } catch (e) {
          console.warn('Fallback composite generation:', e);
        }
      }

      const res = await fetch('/api/guest/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          guestId: uploadedGuestIdRef.current || null,
          photoId: uploadedPhotoIdRef.current || null,
          guestName: guestName.trim() || 'Tamu Undangan',
          wishes: guestNote.trim() || null,
          selectedFrameId: selectedFrame?.id || null,
          photoBase64: !uploadedPhotoIdRef.current ? (targetPhotoBase64 || null) : null,
          voiceBase64: voiceBase64,
          voiceMimeType: recordedMimeType,
          durationSeconds: recordingTime > 0 ? recordingTime : 0,
        }),
      });

      let resData: any = null;
      try {
        const text = await res.text();
        resData = text ? JSON.parse(text) : null;
      } catch {
        resData = null;
      }

      if (!res.ok || !resData?.success) {
        console.error('Guestbook submit failed:', resData?.message || res.status);
        if (res.status === 413) {
          alert('Ukuran berkas terlalu besar untuk disimpan ke server.');
          return;
        }
        alert(resData?.message || 'Gagal menyimpan memory ke database.');
        return;
      }

      setStep(6); // Go to Thank You Step
    } catch (err: any) {
      console.error('Error submitting guestbook:', err);
      alert(err?.message || 'Gagal mengirim data kenangan. Pastikan koneksi internet Anda stabil lalu coba lagi.');
    } finally {
      setUploadingVoice(false);
    }
  };

  const downloadCompositedPhoto = () => {
    if (!compositedImage) return;
    const isPng = compositedImage.startsWith('data:image/png');
    const a = document.createElement('a');
    a.href = compositedImage;
    a.download = `photobooth-${event?.slug || 'memory'}-${Date.now()}.${isPng ? 'png' : 'jpg'}`;
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

  if (error || !event || isUnavailable) {
    return <EventUnavailable />;
  }

  // Sanitize monogram: strictly exclude 'WE', 'C | B', empty strings, or whitespace
  const rawMonogram = event?.monogram?.trim();
  const cleanMonogram =
    rawMonogram && rawMonogram !== 'WE' && rawMonogram !== 'C | B'
      ? rawMonogram
      : null;

  return (
    <div className={`min-h-[100dvh] ${flashEnabled && step === 2 ? 'bg-white' : 'bg-[#F7F4EF]'} text-[#2C2A29] flex flex-col items-center ${step === 2 ? 'justify-start h-[100dvh] overflow-hidden' : 'justify-center min-h-screen'} font-sans antialiased selection:bg-[#D4A373] selection:text-white transition-colors duration-300 relative`}>
      {/* Fullscreen White Screen Flash Effect - top-level so it is never clipped by transforms or overflow */}
      {screenFlash && (
        <div className="fixed inset-0 bg-white z-[999999] opacity-100 pointer-events-none transition-opacity duration-75" />
      )}

      {/* Mobile Frame Container with Defensive Inline Fallbacks */}
      <div
        style={{
          width: '100%',
          maxWidth: '448px',
          margin: '0 auto',
          height: step === 2 ? '100dvh' : undefined,
          minHeight: step === 2 ? '100dvh' : '100vh',
          backgroundColor: flashEnabled && step === 2 ? '#ffffff' : '#F9F6F0',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
        className={`w-full max-w-md ${
          step === 2
            ? 'h-[100dvh] max-h-[100dvh] sm:h-auto sm:min-h-[92vh] sm:my-2'
            : 'min-h-screen sm:min-h-[92vh] sm:my-4'
        } sm:rounded-[40px] sm:shadow-2xl sm:border ${
          flashEnabled && step === 2
            ? 'sm:border-white bg-white shadow-[0_0_80px_rgba(255,255,255,1)]'
            : 'sm:border-[#E8E2D8] bg-[#F9F6F0]'
        } flex flex-col overflow-hidden relative transition-colors duration-300`}
      >
        <div className={`flex-1 flex flex-col justify-between ${
          step === 2
            ? 'px-3 py-1.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-5'
            : 'p-6 sm:p-8'
        } relative overflow-hidden selection:bg-[#B8926A] selection:text-white transition-colors duration-300 ${
          flashEnabled && step === 2 ? 'bg-white' : 'bg-[#F9F6F0]'
        }`}>
      {/* STEP 1: WELCOME SCREEN - LUXURY EDITORIAL CARD */}
      {step === 1 && (
        <div className="flex-1 flex flex-col justify-center items-center text-center py-2 sm:py-6 animate-fade-in my-auto w-full">
          {/* Smart Android OEM & In-App Browser Advisory */}
          <div className="w-full max-w-sm sm:max-w-md mb-2">
            <AndroidBrowserAdvisor variant="banner" />
          </div>

          <div
            style={{
              width: '100%',
              maxWidth: '448px',
              backgroundColor: '#ffffff',
              borderRadius: '2.5rem',
              border: '1px solid #E2D9CC',
              padding: '1.25rem',
              margin: 'auto 0',
              boxSizing: 'border-box',
            }}
            className="w-full max-w-sm sm:max-w-md bg-white/90 backdrop-blur-xl rounded-[2.5rem] border border-[#E2D9CC]/90 p-5 sm:p-7 shadow-2xl flex flex-col items-center justify-between space-y-4 relative overflow-hidden"
          >
            {/* Soft Ambient Gold Glow Inside Card */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-[#D4A373]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-[#8C6D46]/10 rounded-full blur-2xl pointer-events-none" />

            {/* Top Monogram / Eyebrow Header */}
            {cleanMonogram && (
              <div className="space-y-2 pt-1 z-10 w-full">
                <div className="inline-flex items-center justify-center gap-2 text-[#8C6D46] font-serif italic text-2xl font-bold tracking-widest px-4 py-0.5">
                  <span>{cleanMonogram}</span>
                </div>
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

            {/* Center Cover Photo Container */}
            <div className="w-full relative flex flex-col items-center z-10 px-1 py-1">
              <div
                style={{
                  width: '100%',
                  borderRadius: '1rem',
                  overflow: 'hidden',
                  backgroundColor: '#F4EFE6',
                  border: '1px solid #E2D9CC',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
                className="w-full rounded-2xl overflow-hidden relative shadow-lg border border-[#E2D9CC] bg-[#F4EFE6] flex items-center justify-center p-1"
              >
                {coverPublicUrl ? (
                  <img
                    src={coverPublicUrl}
                    alt={event.name}
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      maxHeight: '32vh',
                      objectFit: 'contain',
                      borderRadius: '0.75rem',
                      display: 'block',
                      margin: '0 auto',
                    }}
                    className="w-full h-auto max-h-[30vh] sm:max-h-[35vh] object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-full h-40 sm:h-48 bg-[#F4EFE6] rounded-xl flex items-center justify-center text-[#8C6D46]/30">
                    <ImageIcon className="w-8 h-8 opacity-40" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[#78716C] italic font-serif mt-2 relative z-10">
                Create a memory for our special day
              </p>
            </div>

            {/* Bottom Start Photobooth Button */}
            <div className="w-full pt-1 z-10">
              <button
                onClick={() => {
                  if (frames.length > 1) {
                    setStep(1.5);
                  } else {
                    const singleFrame = frames[0] || selectedFrame;
                    if (singleFrame) {
                      setSelectedFrame(singleFrame);
                      if (singleFrame.publicUrl || singleFrame.frameUrl) {
                        setFramePublicUrl(singleFrame.publicUrl || singleFrame.frameUrl || null);
                      }
                    }
                    setStep(2);
                    startCamera();
                  }
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

      {/* STEP 1.5: FRAME SELECTOR (Only shown for multi-frame events) */}
      {step === 1.5 && (
        <FrameSelector
          frames={frames}
          selectedFrame={selectedFrame}
          onSelectFrame={(frame) => {
            setSelectedFrame(frame);
            if (frame.publicUrl || frame.frameUrl) {
              setFramePublicUrl(frame.publicUrl || frame.frameUrl || null);
            }
          }}
          onConfirm={() => {
            if (selectedFrame?.publicUrl || selectedFrame?.frameUrl) {
              setFramePublicUrl(selectedFrame.publicUrl || selectedFrame.frameUrl || null);
            }
            setStep(2);
            startCamera();
          }}
          onBack={() => setStep(1)}
          eventName={event?.name}
          monogram={event?.monogram}
        />
      )}

      {/* STEP 2: CAMERA VIEW & COUNTDOWN */}
      {step === 2 && (
        <div className="flex-1 flex flex-col justify-between items-center relative animate-fade-in w-full max-h-[100dvh] overflow-hidden py-1 px-1">
          {/* Top Controls Header (Clean, Modern & Thumb-Friendly) */}
          <div className="w-full flex items-center justify-between z-20 pb-1.5 px-0.5 pt-0 shrink-0 gap-1.5">
            {/* Left: Quick Toggles (Flash & Timer) */}
            <div className="flex items-center gap-1.5">
              {/* Flash Toggle Button */}
              <button
                type="button"
                onClick={toggleFlash}
                disabled={capturing}
                title={flashEnabled ? 'Matikan Flash' : 'Aktifkan Flash'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md transition-all border cursor-pointer active:scale-95 disabled:opacity-50 ${
                  flashEnabled
                    ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.6)]'
                    : 'bg-[#2C2A29]/85 backdrop-blur-md text-white/80 border-[#E2D9CC]/20 hover:bg-[#1A1817]'
                }`}
              >
                {flashEnabled ? (
                  <>
                    <Zap className="w-3.5 h-3.5 text-white fill-white animate-pulse" />
                    <span className="text-[11px] font-bold">
                      {torchActive ? 'LED On' : 'Flash On'}
                    </span>
                  </>
                ) : (
                  <>
                    <ZapOff className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-[11px] text-white/70">Flash</span>
                  </>
                )}
              </button>

              {/* Timer Toggle Button */}
              <button
                type="button"
                onClick={toggleTimer}
                disabled={capturing}
                title={timerEnabled ? `Timer Aktif (${event.countdown_seconds || 3} detik)` : 'Timer Nonaktif (Instan)'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md transition-all border cursor-pointer active:scale-95 disabled:opacity-50 ${
                  timerEnabled
                    ? 'bg-[#8C6D46] text-white border-[#D4A373]/50 shadow-[0_0_14px_rgba(140,109,70,0.4)]'
                    : 'bg-[#2C2A29]/85 backdrop-blur-md text-white/60 border-[#E2D9CC]/20 hover:bg-[#1A1817]'
                }`}
              >
                {timerEnabled ? (
                  <>
                    <Timer className="w-3.5 h-3.5 text-[#F4EFE6]" />
                    <span className="text-[11px] font-bold">{event.countdown_seconds || 3}s</span>
                  </>
                ) : (
                  <>
                    <TimerOff className="w-3.5 h-3.5 text-white/50" />
                    <span className="text-[11px] font-bold text-white/50">Off</span>
                  </>
                )}
              </button>
            </div>

            {/* Center: Photo Counter Badge */}
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C6D46] bg-[#F4EFE6]/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#E2D9CC] shadow-xs">
              {capturing
                ? `Foto ${currentPhotoIndex} / ${activePhotoCount}`
                : `Foto ${Math.min(capturedSnapshots.length + 1, activePhotoCount)} / ${activePhotoCount}`}
            </div>

            {/* Right: Camera Flip Button */}
            <button
              type="button"
              onClick={toggleCameraFacing}
              disabled={capturing}
              title={facingMode === 'user' ? 'Ganti ke Kamera Belakang' : 'Ganti ke Kamera Depan'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2C2A29]/85 backdrop-blur-md text-white hover:bg-[#1A1817] text-xs font-semibold shadow-md transition-all disabled:opacity-40 cursor-pointer active:scale-95 border border-[#D4A373]/30"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#D4A373]" />
              <span className="text-[11px] font-medium tracking-wide">Balik</span>
            </button>
          </div>

          {/* Flash Mode Guidance Banner */}
          {flashEnabled && (
            <div className="w-full flex justify-center -mt-1 mb-1 z-20 animate-fade-in">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white/95 text-[#8C6D46] border border-[#D4A373]/50 shadow-md backdrop-blur-md">
                {torchActive ? (
                  <>
                    <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>Lampu Kilat LED Menyala</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>
                      {facingMode === 'user'
                        ? 'Flash Layar Aktif (Menerangi Wajah). Balik untuk LED.'
                        : 'Flash Layar Aktif saat Ambil Foto'}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Video Preview Container (Dynamically Scaled Studio Ring Light) */}
          <div
            className={`w-full max-w-[min(22rem,calc(44vh*3/4))] sm:max-w-[min(24rem,calc(50vh*3/4))] aspect-[3/4] max-h-[44vh] sm:max-h-[50vh] rounded-3xl overflow-hidden relative shadow-2xl transition-all shrink-1 my-auto mx-auto ${
              flashEnabled
                ? 'border-4 border-white ring-[18px] ring-white shadow-[0_0_120px_rgba(255,255,255,1)] bg-white'
                : 'border-2 border-[#E2D9CC] bg-[#1A1817]'
            }`}
          >
            {/* Hidden native camera capture fallback input */}
            <input
              type="file"
              accept="image/*"
              capture={facingMode === 'user' ? 'user' : 'environment'}
              ref={fileInputRef}
              className="hidden"
              onChange={handleNativeCameraCapture}
            />

            {cameraError ? (
              <div className="absolute inset-0 bg-[#1A1817] p-5 flex flex-col items-center justify-center text-center text-white z-30 overflow-y-auto">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2.5 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-serif font-bold text-[#E2D9CC] mb-1">
                  Kamera Tidak Dapat Diakses
                </h3>
                <p className="text-[11px] text-stone-300 max-w-xs leading-relaxed mb-4">
                  {cameraError}
                </p>

                <div className="flex flex-col gap-2 w-full max-w-xs">
                  {chromeIntentUrl && (
                    <a
                      href={chromeIntentUrl}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#D4A373] text-stone-900 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka di Google Chrome</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-600 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span>Ambil Foto via Kamera HP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="w-full py-2 px-3 rounded-xl text-stone-400 hover:text-stone-200 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Coba Lagi di Sini</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: facingMode === 'user' ? 'center 42%' : 'center center',
                    transform: `${facingMode === 'user' ? 'scaleX(-1)' : ''} scale(${zoomLevel})`,
                    transformOrigin: 'center 42%',
                    maxWidth: 'none',
                    transition: 'transform 0.25s ease-out',
                  }}
                  className="absolute inset-0 w-full h-full object-cover max-w-none"
                />

                {/* Zoom / Framing Switcher Button (1x / 1.25x) */}
                {countdown === null && (
                  <button
                    type="button"
                    onClick={toggleZoom}
                    title={zoomLevel > 1.1 ? 'Ganti ke Sudut Lebar (1x)' : 'Ganti ke Mode Potret (1.25x)'}
                    className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-full bg-[#1A1817]/75 backdrop-blur-md text-white border border-[#D4A373]/40 text-[11px] font-bold shadow-lg hover:bg-black/90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="text-[#D4A373] text-[10px]">{zoomLevel > 1.1 ? '🔍' : '📐'}</span>
                    <span>{zoomLevel > 1.1 ? '1.25x' : '1x'}</span>
                  </button>
                )}
              </>
            )}

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
              {Array.from({ length: activePhotoCount }).map((_, idx) => {
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
            ) : capturedSnapshots.length < activePhotoCount ? (
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
                  <span>Proses & Lihat Hasil Bingkai</span>
                  <ArrowRight className="w-4 h-4 text-[#D4A373]" />
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
          <div className="space-y-1 pt-1">
            <h2 className="font-serif text-2xl font-bold text-[#2C2A29]">Your Memories</h2>
            <p className="text-xs text-[#78716C] italic font-serif">
              Foto Anda siap diunduh &amp; otomatis masuk galeri
            </p>
          </div>

          {/* Final Composited Photo Result */}
          <div className="w-full max-w-xs sm:max-w-sm rounded-3xl overflow-hidden relative shadow-xl border-4 border-white my-2 bg-transparent flex items-center justify-center">
            <img
              src={compositedImage}
              alt="Final Photobooth Memories"
              className="w-full h-auto max-h-[36vh] sm:max-h-[44vh] object-contain rounded-2xl"
            />
          </div>

          {/* Auto-Upload Status Indicator */}
          <div className="w-full flex justify-center px-4 mb-2">
            {autoUploadStatus === 'uploading' && (
              <div className="flex items-center justify-center gap-1.5 px-3.5 py-1 bg-[#F4EFE6] border border-[#E2D9CC] rounded-full text-[11px] font-medium text-[#78716C] animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C6D46]" />
                <span>Menyimpan otomatis ke galeri acara...</span>
              </div>
            )}
            {autoUploadStatus === 'success' && (
              <div className="flex items-center justify-center gap-1.5 px-3.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-semibold text-emerald-800 shadow-xs animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Foto otomatis tersimpan di galeri!</span>
              </div>
            )}
            {autoUploadStatus === 'error' && (
              <div className="flex items-center justify-center gap-2 px-3.5 py-1 bg-rose-50 border border-rose-200 rounded-full text-[11px] font-medium text-rose-700">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Gagal simpan otomatis: {autoUploadError || 'Koneksi terputus'}</span>
                <button
                  onClick={() => compositedImage && triggerAutoUpload(compositedImage, selectedFrame?.id)}
                  className="underline font-bold hover:text-rose-900 cursor-pointer ml-1"
                >
                  Coba Lagi
                </button>
              </div>
            )}
          </div>

          {/* Frame Switcher for Multi-Frame Events */}
          {frames.length > 1 && (
            <div className="w-full mb-2">
              <ResultFrameSwitcher
                frames={frames}
                selectedFrame={selectedFrame}
                currentPhotoCount={capturedSnapshots.length || capturedSnapshotsRef.current.length}
                switchingFrameId={switchingFrameId}
                onSelectFrame={handleSwitchResultFrame}
              />
            </div>
          )}

          {/* Prominent Voice / Audio Guestbook Highlight Card (Above Download) */}
          <div className="w-full pt-1 mb-2.5">
            <button
              onClick={() => setStep(4)}
              className="w-full p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF6EE] to-[#F5EFE4] border-2 border-[#D4A373]/60 hover:border-[#8C6D46] transition-all flex items-center justify-between gap-3 text-left group cursor-pointer shadow-md hover:shadow-lg relative overflow-hidden active:scale-[0.99]"
            >
              {/* Decorative warm glow backdrop */}
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#D4A373]/10 rounded-full blur-xl pointer-events-none" />

              <div className="flex items-center gap-3 relative z-10">
                {/* Glowing Mic Icon Badge */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-[#2C2A29] text-[#D4A373] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    {voiceBlob ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Mic className="w-5 h-5 text-[#E5B887]" />
                    )}
                  </div>
                  {!voiceBlob && event?.is_voice_enabled && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4A373] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#8C6D46]"></span>
                    </span>
                  )}
                </div>

                {/* Text Content */}
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-wider uppercase bg-[#8C6D46]/10 text-[#8C6D46]">
                      {voiceBlob ? '✓ Suara Tersimpan' : event?.is_voice_enabled ? '🎙️ Audio Guestbook' : '💌 Buku Tamu'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-[#2C2A29] leading-tight">
                    {voiceBlob
                      ? 'Pesan Suara Berhasil Direkam!'
                      : event?.is_voice_enabled
                      ? 'Tinggalkan Pesan Suara & Ucapan'
                      : 'Tulis Nama & Pesan Ucapan'}
                  </p>
                  <p className="text-[11px] text-[#78716C] leading-normal mt-0.5">
                    {voiceBlob
                      ? 'Ketuk untuk mendengarkan kembali atau mengubah'
                      : event?.is_voice_enabled
                      ? 'Rekam suara doa & selamat hangat Anda untuk pengantin'
                      : 'Kirimkan doa dan ucapan manis ke galeri acara'}
                  </p>
                </div>
              </div>

              {/* Right Action Button Pill */}
              <div className="flex items-center gap-1 shrink-0 px-3 py-2 rounded-xl bg-[#2C2A29] text-white text-[11px] font-semibold shadow-xs group-hover:bg-[#1A1817] transition-all">
                <span>{voiceBlob ? 'Ubah' : event?.is_voice_enabled ? 'Rekam' : 'Tulis'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D4A373] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>

          {/* Action Buttons: Print, Download & Gallery */}
          <div className="w-full space-y-2.5">
            {/* Print Request Action Button */}
            {autoUploadStatus === 'success' && uploadedPhotoId && (
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                disabled={hasRequestedPrint}
                className={`w-full py-3.5 px-6 rounded-full font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 ${
                  hasRequestedPrint
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 cursor-default'
                    : 'bg-gradient-to-r from-[#D4A373] via-[#E5B887] to-[#B88746] hover:from-[#C5925F] hover:to-[#A77838] text-[#1A1817] cursor-pointer shadow-[#D4A373]/25'
                }`}
              >
                {hasRequestedPrint ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Permintaan Cetak Terkirim</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 text-[#1A1817]" />
                    <span>🖨️ Minta Cetak di Booth</span>
                  </>
                )}
              </button>
            )}

            {/* Primary Action: Download Photo */}
            <button
              onClick={downloadCompositedPhoto}
              className="w-full py-3.5 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-semibold text-xs tracking-widest uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-[#423E3C]"
            >
              <Download className="w-4 h-4 text-[#D4A373]" />
              <span>DOWNLOAD FOTO</span>
            </button>

            {/* Secondary Actions: Lihat Galeri & Foto Ulang */}
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href={`/event/${encodeURIComponent(event.slug)}/gallery`}
                className="py-3 px-3 rounded-full bg-white hover:bg-[#F4EFE6] text-[#2C2A29] font-semibold text-xs tracking-wider uppercase border border-[#E2D9CC] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-center"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#8C6D46]" />
                <span>LIHAT GALERI</span>
              </Link>

              <button
                onClick={handleRetakeAll}
                className="py-3 px-3 rounded-full bg-white hover:bg-[#F4EFE6] text-[#78716C] hover:text-[#2C2A29] font-medium text-xs tracking-wider uppercase border border-[#E2D9CC] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>FOTO ULANG</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: GUEST DETAILS FORM (OPTIONAL) */}
      {step === 4 && (
        <div className="flex-1 flex flex-col justify-between items-center text-center animate-fade-in py-3 max-w-sm mx-auto w-full">
          <div className="space-y-1.5 pt-2">
            <span className="px-3 py-1 rounded-full text-[10.5px] font-bold tracking-widest uppercase bg-[#8C6D46]/10 text-[#8C6D46] inline-block">
              {event?.is_voice_enabled ? 'Langkah 1: Nama & Ucapan' : 'Buku Tamu Digital'}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2C2A29]">
              {event?.is_voice_enabled ? 'Buku Tamu & Suara' : 'Buku Tamu Kenangan'}
            </h2>
            <p className="text-xs text-[#78716C] max-w-xs leading-relaxed mx-auto">
              <span className="font-semibold text-[#8C6D46]">Opsional</span> — Tuliskan nama Anda {event?.is_voice_enabled ? 'sebelum merekam pesan suara untuk pengantin' : 'untuk melengkapi album kenangan acara'}
            </p>
          </div>

          <div className="w-full space-y-4 my-4 bg-white p-5 sm:p-6 rounded-3xl border border-[#E2D9CC] shadow-xl text-left">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8C6D46] mb-1.5">
                Nama Anda (Opsional)
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Contoh: Ibu Rina & Keluarga"
                className="w-full bg-[#F9F6F0] border border-[#E2D9CC] focus:border-[#8C6D46] rounded-xl p-3 text-xs text-[#2C2A29] font-medium focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8C6D46] mb-1.5">
                Pesan Ucapan / Doa (Opsional)
              </label>
              <textarea
                rows={3}
                value={guestNote}
                onChange={(e) => setGuestNote(e.target.value)}
                placeholder="Tuliskan ucapan selamat dan doa untuk pengantin..."
                className="w-full bg-[#F9F6F0] border border-[#E2D9CC] focus:border-[#8C6D46] rounded-xl p-3 text-xs text-[#2C2A29] font-medium focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="w-full space-y-2.5">
            <button
              onClick={() => {
                if (event?.is_voice_enabled) {
                  setStep(5); // Go to Voice Note
                } else {
                  handleSubmitGuestbook();
                }
              }}
              className="w-full py-3.5 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-semibold text-xs tracking-widest uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-[#423E3C]"
            >
              <span>{event?.is_voice_enabled ? 'LANJUT REKAM SUARA 🎙️' : 'SIMPAN KE GUESTBOOK'}</span>
              <ArrowRight className="w-4 h-4 text-[#D4A373]" />
            </button>

            {event?.is_voice_enabled && (
              <button
                onClick={() => {
                  if (guestName.trim() || guestNote.trim()) {
                    handleSubmitGuestbook();
                  } else {
                    setStep(6);
                  }
                }}
                className="w-full py-3 px-6 rounded-full bg-white hover:bg-[#F4EFE6] text-[#78716C] hover:text-[#2C2A29] font-medium text-xs tracking-wider uppercase border border-[#E2D9CC] transition-all cursor-pointer shadow-xs"
              >
                <span>SIMPAN UCAPAN TEKS SAJA (TANPA SUARA)</span>
              </button>
            )}

            <button
              onClick={() => setStep(3)}
              className="text-xs text-[#78716C] hover:text-[#2C2A29] flex items-center justify-center gap-1 mx-auto pt-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Hasil Foto</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: VOICE NOTE RECORDING (OPTIONAL) */}
      {step === 5 && (
        <div className="flex-1 flex flex-col justify-between items-center text-center animate-fade-in py-3 max-w-sm mx-auto w-full">
          <div className="space-y-1.5 pt-2">
            <span className="px-3 py-1 rounded-full text-[10.5px] font-bold tracking-widest uppercase bg-[#8C6D46]/10 text-[#8C6D46] inline-block">
              Langkah 2: Rekam Suara
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2C2A29]">
              Audio Guestbook
            </h2>
            <p className="text-xs text-[#78716C] max-w-xs leading-relaxed mx-auto">
              <span className="font-semibold text-[#8C6D46]">Opsional</span> — Tinggalkan pesan suara langsung ucapan selamat dan doa kesan Anda (Maksimal 60 Detik)
            </p>
          </div>

          <div className="w-full my-4 bg-white p-6 sm:p-8 rounded-3xl border border-[#E2D9CC] shadow-xl flex flex-col items-center gap-5">
            {/* Audio Timer Badge */}
            <div className="text-3xl font-mono font-bold text-[#2C2A29] bg-[#F4EFE6] px-6 py-2 rounded-2xl border border-[#E2D9CC] shadow-inner tracking-widest">
              00:{recordingTime < 10 ? `0${recordingTime}` : recordingTime}
            </div>

            {/* Mic Record Button */}
            {!voiceBlob ? (
              <button
                onClick={recordingVoice ? stopVoiceRecording : startVoiceRecording}
                className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer active:scale-90 ${
                  recordingVoice
                    ? 'bg-rose-500 text-white animate-pulse ring-8 ring-rose-200'
                    : 'bg-[#2C2A29] hover:bg-[#1A1817] text-[#D4A373] ring-4 ring-[#D4A373]/25 hover:scale-105'
                }`}
              >
                {recordingVoice ? <Square className="w-8 h-8 fill-current text-white" /> : <Mic className="w-10 h-10" />}
              </button>
            ) : (
              <div className="flex items-center gap-4 w-full justify-center">
                <button
                  onClick={togglePlayVoice}
                  className="w-16 h-16 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white flex items-center justify-center shadow-xl cursor-pointer active:scale-95"
                >
                  {isPlayingAudio ? <Pause className="w-6 h-6 fill-current text-[#D4A373]" /> : <Play className="w-6 h-6 fill-current ml-1 text-[#D4A373]" />}
                </button>

                <button
                  onClick={() => {
                    setVoiceBlob(null);
                    setVoiceAudioUrl(null);
                    setRecordingTime(0);
                  }}
                  className="px-4 py-2.5 rounded-full bg-[#F4EFE6] hover:bg-[#E5DFD5] text-[#2C2A29] text-xs font-semibold border border-[#E2D9CC] flex items-center gap-1.5 cursor-pointer shadow-xs"
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
                : 'Ketuk Tombol Mikrofon Untuk Mulai Merekam'}
            </p>
          </div>

          <div className="w-full space-y-2.5">
            <button
              onClick={handleSubmitGuestbook}
              disabled={uploadingVoice}
              className="w-full py-3.5 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-semibold text-xs tracking-widest uppercase shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 border border-[#423E3C]"
            >
              {uploadingVoice ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#D4A373]" />
                  <span>MENYIMPAN MEMORI...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#D4A373]" />
                  <span>SELESAI &amp; SIMPAN MEMORI</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setVoiceBlob(null);
                handleSubmitGuestbook();
              }}
              disabled={uploadingVoice}
              className="w-full py-3 px-6 rounded-full bg-white hover:bg-[#F4EFE6] text-[#78716C] hover:text-[#2C2A29] font-medium text-xs tracking-wider uppercase border border-[#E2D9CC] transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <span>LEWATI SUARA &amp; SELESAI</span>
            </button>

            <button
              onClick={() => setStep(4)}
              className="text-xs text-[#78716C] hover:text-[#2C2A29] flex items-center justify-center gap-1 mx-auto pt-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
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
              className="w-full py-4 px-6 rounded-full bg-[#2C2A29] hover:bg-[#1A1817] text-white font-bold text-xs tracking-widest uppercase shadow-2xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-[#423E3C] block text-center animate-pulse"
            >
              <Sparkles className="w-4 h-4 text-[#D4A373]" />
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
      {/* GUEST REQUEST PRINT MODAL */}
      {event && compositedImage && uploadedPhotoId && (
        <GuestRequestPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          photoUrl={compositedImage}
          photoId={uploadedPhotoId}
          eventId={event.id}
          initialGuestName={guestName}
          guestId={uploadedGuestId}
          onSuccess={() => {
            setHasRequestedPrint(true);
          }}
        />
      )}
        </div>
      </div>
    </div>
  );
}
