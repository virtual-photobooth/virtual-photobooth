'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Event, Client, EventStatus } from '@/lib/types/database';
import { validateFrameFile } from '@/lib/utils/frame-validator';
import {
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  QrCode,
  Save,
} from 'lucide-react';

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<Event | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    monogram: 'C | B',
    subtitle: 'WEDDING',
    slug: '',
    event_date: '',
    status: 'draft' as EventStatus,
    photo_count: 4,
    countdown_seconds: 3,
    is_voice_enabled: true,
    voice_retention_days: 7,
  });

  // Frame & Cover Upload State
  const [frameFile, setFrameFile] = useState<File | null>(null);
  const [framePreviewUrl, setFramePreviewUrl] = useState<string | null>(null);
  const [uploadingFrame, setUploadingFrame] = useState(false);
  const [frameValidationError, setFrameValidationError] = useState<string | null>(null);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const [{ data: eventData, error: eventErr }, { data: clientsData }] = await Promise.all([
          (supabase.from('events') as any).select('*').eq('id', eventId).single(),
          supabase.from('clients').select('*').order('name', { ascending: true }),
        ]);

        if (eventErr || !eventData) throw eventErr || new Error('Event not found');

        setEvent(eventData as Event);
        if (clientsData) setClients(clientsData);

        let metaMonogram = eventData.monogram;
        let metaSubtitle = eventData.subtitle;

        if (typeof window !== 'undefined') {
          const storedMeta = localStorage.getItem(`event_meta_${eventId}`);
          if (storedMeta) {
            try {
              const parsed = JSON.parse(storedMeta);
              if (parsed.monogram !== undefined) metaMonogram = parsed.monogram;
              if (parsed.subtitle !== undefined) metaSubtitle = parsed.subtitle;
            } catch (e) {}
          }
        }

        setFormData({
          client_id: eventData.client_id || '',
          name: eventData.name || '',
          monogram: metaMonogram !== undefined && metaMonogram !== null ? metaMonogram : (eventData.monogram || ''),
          subtitle: metaSubtitle !== undefined && metaSubtitle !== null ? metaSubtitle : (eventData.subtitle || ''),
          slug: eventData.slug || '',
          event_date: eventData.event_date || '',
          status: eventData.status || 'draft',
          photo_count: eventData.photo_count || 4,
          countdown_seconds: eventData.countdown_seconds || 3,
          is_voice_enabled: eventData.is_voice_enabled ?? true,
          voice_retention_days: eventData.voice_retention_days || 7,
        });

        if (eventData.frame_path) {
          const { data: publicUrlData } = supabase.storage
            .from('virtual-photobooth')
            .getPublicUrl(eventData.frame_path);

          if (publicUrlData?.publicUrl) {
            setFramePreviewUrl(publicUrlData.publicUrl);
          }
        }

        if (eventData.cover_path) {
          const { data: coverUrlData } = supabase.storage
            .from('virtual-photobooth')
            .getPublicUrl(eventData.cover_path);

          if (coverUrlData?.publicUrl) {
            setCoverPreviewUrl(`${coverUrlData.publicUrl}?t=${Date.now()}`);
          }
        } else {
          // Fallback: check if cover image exists under event storage path
          const defaultCoverPath = `events/${eventId}/cover/cover.jpg`;
          const { data: coverUrlData } = supabase.storage
            .from('virtual-photobooth')
            .getPublicUrl(defaultCoverPath);

          if (coverUrlData?.publicUrl) {
            setCoverPreviewUrl(`${coverUrlData.publicUrl}?t=${Date.now()}`);
          }
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Failed to load event data' });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [eventId, supabase]);

  const handleCoverSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadCover = async () => {
    if (!coverFile) return;
    setUploadingCover(true);
    setMessage(null);

    try {
      const storagePath = `events/${eventId}/cover/cover.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('virtual-photobooth')
        .upload(storagePath, coverFile, {
          upsert: true,
          contentType: coverFile.type || 'image/jpeg',
        });

      if (uploadErr) throw uploadErr;

      const { error: updateErr } = await (supabase.from('events') as any)
        .update({ cover_path: storagePath })
        .eq('id', eventId);

      if (updateErr && updateErr.message?.includes('cover_path')) {
        console.warn('cover_path column not in DB yet');
      } else if (updateErr) {
        throw updateErr;
      }

      const { data: publicUrlData } = supabase.storage
        .from('virtual-photobooth')
        .getPublicUrl(storagePath);

      setCoverPreviewUrl(`${publicUrlData.publicUrl}?t=${Date.now()}`);
      setCoverFile(null);
      setMessage({ type: 'success', text: 'Cover Photo uploaded successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to upload Cover Photo' });
    } finally {
      setUploadingCover(false);
    }
  };

  // Handle Frame Selection & Aspect Ratio Validation
  const handleFrameSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFrameValidationError(null);
    setMessage(null);

    const file = e.target.files?.[0];
    if (!file) return;

    // Validate 2:3 aspect ratio and portrait orientation
    const validation = await validateFrameFile(file);

    if (!validation.valid) {
      setFrameValidationError(
        validation.error || 'Invalid frame format. Please upload a portrait PNG with a 2:3 aspect ratio.'
      );
      setFrameFile(null);
      return;
    }

    setFrameFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFramePreviewUrl(objectUrl);
  };

  // Upload Frame to Supabase Storage
  const handleUploadFrame = async () => {
    if (!frameFile) return;
    setUploadingFrame(true);
    setMessage(null);

    try {
      const storagePath = `events/${eventId}/frame/frame.png`;

      // Upload/overwrite file in Supabase storage
      const { error: uploadErr } = await supabase.storage
        .from('virtual-photobooth')
        .upload(storagePath, frameFile, {
          upsert: true,
          contentType: 'image/png',
        });

      if (uploadErr) throw uploadErr;

      // Update database record
      const { error: updateErr } = await (supabase.from('events') as any)
        .update({ frame_path: storagePath })
        .eq('id', eventId);

      if (updateErr) throw updateErr;

      const { data: publicUrlData } = supabase.storage
        .from('virtual-photobooth')
        .getPublicUrl(storagePath);

      setFramePreviewUrl(`${publicUrlData.publicUrl}?t=${Date.now()}`);
      setFrameFile(null);
      setMessage({ type: 'success', text: 'PNG frame template uploaded successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to upload PNG frame' });
    } finally {
      setUploadingFrame(false);
    }
  };

  // Save Event Details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // Save metadata immediately to localStorage guaranteed
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `event_meta_${eventId}`,
        JSON.stringify({
          monogram: formData.monogram,
          subtitle: formData.subtitle,
        })
      );
    }

    try {
      const coverStoragePath = `events/${eventId}/cover/cover.jpg`;
      const frameStoragePath = `events/${eventId}/frame/frame.png`;

      // 1. Auto-upload cover file if selected
      if (coverFile) {
        const { error: coverUploadErr } = await supabase.storage
          .from('virtual-photobooth')
          .upload(coverStoragePath, coverFile, {
            upsert: true,
            contentType: coverFile.type || 'image/jpeg',
          });
        if (coverUploadErr) console.warn('Cover upload error:', coverUploadErr);
        setCoverFile(null);
        setCoverPreviewUrl(`${supabase.storage.from('virtual-photobooth').getPublicUrl(coverStoragePath).data.publicUrl}?t=${Date.now()}`);
      }

      // 2. Auto-upload frame file if selected
      if (frameFile) {
        const { error: frameUploadErr } = await supabase.storage
          .from('virtual-photobooth')
          .upload(frameStoragePath, frameFile, {
            upsert: true,
            contentType: 'image/png',
          });
        if (frameUploadErr) throw frameUploadErr;
        setFrameFile(null);
        setFramePreviewUrl(`${supabase.storage.from('virtual-photobooth').getPublicUrl(frameStoragePath).data.publicUrl}?t=${Date.now()}`);
      }

      // 3. Update database record with frame_path & cover_path
      const fullPayload: any = {
        client_id: formData.client_id,
        name: formData.name,
        monogram: formData.monogram,
        subtitle: formData.subtitle,
        slug: formData.slug,
        event_date: formData.event_date,
        status: formData.status,
        photo_count: Number(formData.photo_count),
        countdown_seconds: Number(formData.countdown_seconds),
        is_voice_enabled: formData.is_voice_enabled,
        voice_retention_days: Number(formData.voice_retention_days),
        frame_path: frameStoragePath,
        cover_path: coverStoragePath,
      };

      let { error } = await (supabase.from('events') as any)
        .update(fullPayload)
        .eq('id', eventId);

      if (error) {
        // Fallback: strip optional columns if DB schema cache has not added them
        const safePayload: any = {
          client_id: formData.client_id,
          name: formData.name,
          slug: formData.slug,
          event_date: formData.event_date,
          status: formData.status,
          photo_count: Number(formData.photo_count),
          countdown_seconds: Number(formData.countdown_seconds),
          is_voice_enabled: formData.is_voice_enabled,
          voice_retention_days: Number(formData.voice_retention_days),
          frame_path: frameStoragePath,
        };

        const { error: safeErr } = await (supabase.from('events') as any)
          .update(safePayload)
          .eq('id', eventId);

        if (safeErr) throw safeErr;
      }

      setMessage({ type: 'success', text: 'Perubahan event (Bingkai PNG, Subtitle, Monogram, Foto Cover) berhasil disimpan & disinkronkan!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update event' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-400 text-xs">Loading event...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Events</span>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1A2621]">{formData.name}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Slug: <span className="font-mono text-[#2A473E] font-bold">/event/{formData.slug}</span>
          </p>
        </div>

        <Link
          href={`/admin/events/${eventId}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all shadow-xs"
        >
          <QrCode className="w-4 h-4" />
          <span>View Details & QR</span>
        </Link>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-3 border ${
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

      {/* Grid: Frame Upload Section + Event Details Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: PNG Frame Upload */}
        <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-6 flex flex-col">
          <div>
            <h3 className="text-sm font-bold text-[#1A2621] flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-700" />
              <span>Event PNG Frame</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Upload a <strong>Portrait PNG</strong> (2:3 ratio, e.g. 2160×3240 px) with transparent background.
            </p>
          </div>

          {/* Frame Preview Container */}
          <div className="relative aspect-[2/3] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden p-2 group">
            {framePreviewUrl ? (
              <img
                src={framePreviewUrl}
                alt="Event PNG Frame Preview"
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="text-center p-4">
                <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No frame uploaded</p>
                <p className="text-[10px] text-slate-400 mt-1">2:3 Portrait PNG</p>
              </div>
            )}
          </div>

          {/* Error Message for invalid aspect ratio or non-portrait */}
          {frameValidationError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{frameValidationError}</span>
            </div>
          )}

          {/* Upload Button Controls */}
          <div className="space-y-3 pt-2 mt-auto">
            <label className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-all border border-slate-200">
              <Upload className="w-4 h-4" />
              <span>{framePreviewUrl ? 'Replace PNG Frame' : 'Select PNG Frame'}</span>
              <input
                type="file"
                accept="image/png"
                onChange={handleFrameSelection}
                className="hidden"
              />
            </label>

            {frameFile && (
              <button
                type="button"
                onClick={handleUploadFrame}
                disabled={uploadingFrame}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
              >
                {uploadingFrame ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Upload Frame</span>
                  </>
                )}
              </button>
            )}
          </div>

          <hr className="border-slate-100 my-4" />

          {/* Cover Photo Upload Card */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#1A2621] uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#8C6D46]" />
              <span>Event Cover Photo (Foto Sampul)</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Upload couple/event photo for the main Guest Welcome Screen (or leave empty for default).
            </p>

            <div className="aspect-[4/3] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden relative flex items-center justify-center">
              <img
                src={coverPreviewUrl || '/default-wedding-cover.png'}
                alt="Event Cover Preview"
                className="w-full h-full object-cover"
              />
            </div>

            <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-all border border-slate-200">
              <Upload className="w-4 h-4" />
              <span>{coverPreviewUrl ? 'Change Cover Photo' : 'Upload Cover Photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverSelection}
                className="hidden"
              />
            </label>

            {coverFile && (
              <button
                type="button"
                onClick={handleUploadCover}
                disabled={uploadingCover}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#8C6D46] hover:bg-[#735735] text-white text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
              >
                {uploadingCover ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Cover Photo</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Settings Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xs">
          <form onSubmit={handleSaveDetails} className="space-y-6">
            <h3 className="text-sm font-bold text-[#1A2621]">Event Configuration</h3>

            {/* Client */}
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                Client
              </label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Name, Monogram, Subtitle & Slug */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Event Name (e.g. &quot;CELINE &amp; BRIAN&quot;)
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 font-serif font-bold uppercase focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Monogram Header (e.g. &quot;C | B&quot;)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={formData.monogram}
                  onChange={(e) => setFormData({ ...formData, monogram: e.target.value })}
                  placeholder="C | B"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 font-serif italic font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Subtitle Badge (e.g. &quot;WEDDING&quot;, &quot;BIRTHDAY&quot;)
                </label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="WEDDING"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 uppercase tracking-widest font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  URL Slug
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Date & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Event Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Event Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active (Live)</option>
                  <option value="completed">Completed</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Photobooth Custom Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Photo Count
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.photo_count}
                  onChange={(e) => setFormData({ ...formData, photo_count: parseInt(e.target.value) || 4 })}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Countdown (Seconds)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.countdown_seconds}
                  onChange={(e) =>
                    setFormData({ ...formData, countdown_seconds: parseInt(e.target.value) || 3 })
                  }
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            {/* Voice Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="edit_is_voice_enabled"
                  checked={formData.is_voice_enabled}
                  onChange={(e) => setFormData({ ...formData, is_voice_enabled: e.target.checked })}
                  className="w-5 h-5 accent-[#2A473E] rounded cursor-pointer"
                />
                <label htmlFor="edit_is_voice_enabled" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Enable Voice Guestbook
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                  Voice Retention (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  disabled={!formData.is_voice_enabled}
                  value={formData.voice_retention_days}
                  onChange={(e) =>
                    setFormData({ ...formData, voice_retention_days: parseInt(e.target.value) || 7 })
                  }
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 focus:outline-none disabled:opacity-40"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3.5 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white font-semibold text-xs uppercase tracking-wider shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
