'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Event, Client, EventStatus } from '@/lib/types/database';
import { validateFrameFile } from '@/lib/utils/frame-validator';
import { getStoragePublicUrl } from '@/lib/storage/url';
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
import AdminFramesManager from '@/components/admin/AdminFramesManager';
import { adminFetch } from '@/lib/auth/client-admin-auth';

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
    monogram: '',
    subtitle: '',
    slug: '',
    event_date: '',
    status: 'draft' as EventStatus,
    photo_count: 4,
    countdown_seconds: 3,
    is_voice_enabled: true,
    voice_retention_days: 7,
  });

  // Cover Upload State
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const { data: eventData, error: eventErr } = await (supabase.from('events') as any)
          .select('*')
          .eq('id', eventId)
          .single();

        const clientsRes = await adminFetch('/api/admin/clients');
        const clientsData = await clientsRes.json();

        if (eventErr || !eventData) throw eventErr || new Error('Event not found');

        setEvent(eventData as Event);
        if (clientsData?.clients) setClients(clientsData.clients);

        let initialMonogram =
          eventData.monogram && eventData.monogram !== 'WE' && eventData.monogram !== 'C | B'
            ? eventData.monogram.trim()
            : '';
        let initialSubtitle = eventData.subtitle ?? '';

        if (typeof window !== 'undefined') {
          const savedMeta = localStorage.getItem(`event_meta_${eventId}`);
          if (savedMeta) {
            try {
              const parsed = JSON.parse(savedMeta);
              if (parsed.monogram !== undefined) {
                initialMonogram =
                  parsed.monogram && parsed.monogram !== 'WE' && parsed.monogram !== 'C | B'
                    ? parsed.monogram.trim()
                    : '';
              }
              if (parsed.subtitle !== undefined) initialSubtitle = parsed.subtitle;
            } catch (e) {}
          }
        }

        setFormData({
          client_id: eventData.client_id || '',
          name: eventData.name || '',
          monogram: initialMonogram,
          subtitle: initialSubtitle,
          slug: eventData.slug || '',
          event_date: eventData.event_date || '',
          status: eventData.status || 'draft',
          photo_count: eventData.photo_count || 4,
          countdown_seconds: eventData.countdown_seconds || 3,
          is_voice_enabled: eventData.is_voice_enabled ?? true,
          voice_retention_days: eventData.voice_retention_days || 7,
        });

        if (eventData.cover_path) {
          const coverUrl = getStoragePublicUrl(eventData.cover_path);
          if (coverUrl) {
            setCoverPreviewUrl(`${coverUrl}?t=${Date.now()}`);
          }
        } else {
          // Fallback: check if cover image exists under event storage path
          const defaultCoverPath = `events/${eventId}/cover/cover.jpg`;
          const coverUrl = getStoragePublicUrl(defaultCoverPath);
          if (coverUrl) {
            setCoverPreviewUrl(`${coverUrl}?t=${Date.now()}`);
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

  const uploadFileViaAdminApi = async (path: string, file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await adminFetch('/api/admin/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        fileBase64: base64,
        contentType: file.type || (path.endsWith('.png') ? 'image/png' : 'image/jpeg'),
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to upload file via admin API');
    }
    return data.publicUrl;
  };

  const handleUploadCover = async () => {
    if (!coverFile) return;
    setUploadingCover(true);
    setMessage(null);

    try {
      const ext = coverFile.name.split('.').pop() || 'jpg';
      const storagePath = `events/${eventId}/cover/cover_${Date.now()}.${ext}`;
      const publicUrl = await uploadFileViaAdminApi(storagePath, coverFile);

      await fetch('/api/admin/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId, cover_path: storagePath }),
      });

      setEvent((prev) => (prev ? { ...prev, cover_path: storagePath } : prev));
      setCoverPreviewUrl(`${publicUrl}?v=${Date.now()}`);
      setCoverFile(null);
      setMessage({ type: 'success', text: 'Cover Photo uploaded successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to upload Cover Photo' });
    } finally {
      setUploadingCover(false);
    }
  };

  // Handle Frame Selection & Aspect Ratio Validation
  // Save Event Details
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      let updatedCoverPath = event?.cover_path || undefined;

      // 1. Auto-upload cover file via Admin API if selected
      if (coverFile) {
        try {
          const ext = coverFile.name.split('.').pop() || 'jpg';
          const newCoverPath = `events/${eventId}/cover/cover_${Date.now()}.${ext}`;
          const coverUrl = await uploadFileViaAdminApi(newCoverPath, coverFile);
          updatedCoverPath = newCoverPath;
          setCoverFile(null);
          setCoverPreviewUrl(`${coverUrl}?v=${Date.now()}`);
        } catch (e) {
          console.warn('Cover upload warning:', e);
        }
      }

      // Save metadata backup to localStorage so monogram & subtitle changes persist even if DB column is missing
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          `event_meta_${eventId}`,
          JSON.stringify({
            monogram: formData.monogram ?? '',
            subtitle: formData.subtitle ?? '',
          })
        );
      }

      // 2. Update database record via admin API endpoint (leaves frame_path managed by default frame sync)
      const updatePayload: any = {
        id: eventId,
        client_id: formData.client_id,
        name: formData.name,
        monogram: formData.monogram ?? '',
        subtitle: formData.subtitle ?? '',
        slug: formData.slug,
        event_date: formData.event_date,
        status: formData.status,
        photo_count: Number(formData.photo_count),
        countdown_seconds: Number(formData.countdown_seconds),
        is_voice_enabled: formData.is_voice_enabled,
        voice_retention_days: Number(formData.voice_retention_days),
      };

      if (updatedCoverPath !== undefined) {
        updatePayload.cover_path = updatedCoverPath;
      }

      const res = await adminFetch('/api/admin/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Failed to update event');
      }

      // Update local event state immediately
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              monogram: formData.monogram ?? '',
              subtitle: formData.subtitle ?? '',
              ...(updatedCoverPath !== undefined ? { cover_path: updatedCoverPath } : {}),
            }
          : prev
      );

      setMessage({ type: 'success', text: 'Perubahan event berhasil disimpan & disinkronkan!' });
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
    <div className="max-w-6xl mx-auto space-y-8">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Event Frames (Multi-Frame Management) & Cover Photo */}
        <div className="lg:col-span-5 space-y-8 flex flex-col">
          {/* Section: Event Frames */}
          <AdminFramesManager
            eventId={eventId}
            initialFramePath={event?.frame_path}
          />

          {/* Cover Photo Upload Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#1A2621] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#8C6D46]" />
                <span>Event Cover Photo (Foto Sampul)</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Upload couple/event photo for the main Guest Welcome Screen (or leave empty for default).
              </p>
            </div>

            <div className="aspect-[4/3] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden relative flex items-center justify-center">
              {coverPreviewUrl ? (
                <img
                  src={coverPreviewUrl}
                  alt="Event Cover Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                  <span className="text-xs">Belum ada foto sampul</span>
                </div>
              )}
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
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xs">
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
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Default Photo Count
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Jumlah pose fallback event. Saat tamu memilih frame di sebelah kiri, jumlah foto otomatis mengikuti pose frame tersebut.
                </p>
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
