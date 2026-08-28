'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Event } from '@/lib/types/database';
import {
  ArrowLeft,
  QrCode,
  Copy,
  Check,
  Edit3,
  ExternalLink,
  Users,
  Image as ImageIcon,
  Mic,
  Clock,
  Printer,
  Trash2,
  Loader2,
} from 'lucide-react';
import PrintableQrModal from '@/components/admin/PrintableQrModal';
import DeleteEventModal from '@/components/admin/DeleteEventModal';
import { useRouter } from 'next/navigation';

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [event, setEvent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [eventUrl, setEventUrl] = useState('');
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const [syncedEmail, setSyncedEmail] = useState<string>('');
  const [syncedPassword, setSyncedPassword] = useState<string>('');

  const clientEmail = syncedEmail || event?.client?.contact_email || `${(event?.slug || 'client').toLowerCase()}@photobooth.com`;
  const clientPassword =
    syncedPassword ||
    event?.client?.notes?.match(/Password:\s*([^\s|]+)/)?.[1] ||
    `VP-${(event?.client?.name || event?.name || 'HOST').replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()}-1234`;

  const handleCopyCredentials = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const email = clientEmail;
    const password = clientPassword;
    const clientName = event?.client?.name || event?.name || 'Client';

    const text = `Halo Kak ${clientName},\n\nBerikut adalah akses login ke Portal Virtual Photobooth Acara Anda:\n\n🌐 Link Login: ${origin}/login\n📧 Email Login: ${email}\n🔑 Password Login: ${password}\n\nMelalui portal ini, Anda dapat melihat/mengunduh semua foto kenangan tamu dan mendengarkan rekaman suara ucapan tamu. Terima kasih!`;

    navigator.clipboard.writeText(text);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2500);
  };

  const handleConfirmDelete = async () => {
    if (!event) return;

    try {
      setDeleting(true);

      // 1. Fetch photos for this event
      const { data: photos } = await (supabase.from('photos') as any)
        .select('photo_path')
        .eq('event_id', eventId);

      // 2. Fetch voice messages for this event
      const { data: voices } = await (supabase.from('voice_messages') as any)
        .select('audio_path')
        .eq('event_id', eventId);

      // Collect storage file paths to remove
      const storagePaths: string[] = [];
      if (photos && photos.length > 0) {
        photos.forEach((p: any) => p.photo_path && storagePaths.push(p.photo_path));
      }
      if (voices && voices.length > 0) {
        voices.forEach((v: any) => v.audio_path && storagePaths.push(v.audio_path));
      }
      if (event.frame_path) storagePaths.push(event.frame_path);
      if (event.cover_path) storagePaths.push(event.cover_path);

      // 3. Remove files from Supabase storage
      if (storagePaths.length > 0) {
        await supabase.storage.from('virtual-photobooth').remove(storagePaths);
      }

      // 4. Delete database rows
      await (supabase.from('photos') as any).delete().eq('event_id', eventId);
      await (supabase.from('voice_messages') as any).delete().eq('event_id', eventId);
      const { error: deleteErr } = await (supabase.from('events') as any).delete().eq('id', eventId);

      if (deleteErr) throw deleteErr;

      setDeleteModalOpen(false);
      router.push('/admin/events');
    } catch (err: any) {
      alert(`Gagal menghapus event: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    async function loadEvent() {
      try {
        setLoading(true);
        const { data, error } = await (supabase.from('events') as any)
          .select('*, client:clients(id, name, contact_email, notes)')
          .eq('id', eventId)
          .single();

        if (error || !data) throw error || new Error('Event not found');

        setEvent(data);

        // Sync and guarantee credentials are created and saved in Supabase database
        try {
          const syncRes = await fetch('/api/admin/events/sync-credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId }),
          });
          const syncData = await syncRes.json();
          if (syncData.success) {
            setSyncedEmail(syncData.email);
            setSyncedPassword(syncData.password);
          }
        } catch (sErr) {
          console.warn('Credentials sync warning:', sErr);
        }

        // Origin domain for QR code & guest link
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const fullUrl = `${origin}/event/${data.slug}`;
        setEventUrl(fullUrl);

        if (data.frame_path) {
          const { data: publicUrlData } = supabase.storage
            .from('virtual-photobooth')
            .getPublicUrl(data.frame_path);

          if (publicUrlData?.publicUrl) {
            setFrameUrl(publicUrlData.publicUrl);
          }
        }
      } catch (err) {
        console.error('Failed to load event:', err);
      } finally {
        setLoading(false);
      }
    }

    loadEvent();
  }, [eventId, supabase]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-400 text-xs">Loading event details...</div>;
  }

  if (!event) {
    return <div className="py-20 text-center text-slate-500 text-xs">Event not found.</div>;
  }

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
    eventUrl
  )}&format=png`;

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
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1A2621]">{event.name}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Client Host: <strong className="text-slate-800">{event.client?.name || 'Unassigned'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/admin/events/${eventId}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-[#2A473E] border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold transition-all shadow-xs"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Frame &amp; Config</span>
          </Link>

          <a
            href={eventUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white text-xs font-semibold shadow-md transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Test Photobooth Flow</span>
          </a>

          <button
            onClick={() => setDeleteModalOpen(true)}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 text-red-600" />
            )}
            <span>{deleting ? 'Deleting...' : 'Delete Event'}</span>
          </button>
        </div>
      </div>

      {/* Grid: QR Code Display + Details Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* QR Code Section */}
        <div className="md:col-span-1 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs text-center space-y-4 flex flex-col items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2A473E] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              QR Code Event Tamu
            </span>
            <p className="text-xs text-slate-500 mt-2">Scan with mobile camera to start photobooth</p>
          </div>

          <div className="p-4 bg-white rounded-2xl shadow-md border border-slate-200">
            <img src={qrApiUrl} alt="Event QR Code" className="w-48 h-48 object-contain" />
          </div>

          <button
            onClick={() => setQrModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Download Printable QR Card</span>
          </button>

          {/* Copy URL Box */}
          <div className="w-full space-y-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono text-[#2A473E] truncate">
              {eventUrl}
            </div>
            <button
              onClick={handleCopyUrl}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer border border-slate-200"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'URL Copied!' : 'Copy Guest Link'}</span>
            </button>
          </div>
        </div>

        {/* Details & Overview */}
        <div className="md:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1A2621]">Event Overview</h3>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                event.status === 'active'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {event.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Event Date</span>
              <span className="text-sm font-bold text-[#1A2621] mt-0.5 block">{event.event_date}</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Photos per Session</span>
              <span className="text-sm font-bold text-[#1A2621] mt-0.5 block">{event.photo_count} Shots</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Countdown Timer</span>
              <span className="text-sm font-bold text-[#1A2621] mt-0.5 block">{event.countdown_seconds} Seconds</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Voice Guestbook</span>
              <span className="text-sm font-bold text-[#1A2621] mt-0.5 block">
                {event.is_voice_enabled ? `Enabled (${event.voice_retention_days} Days)` : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Client Portal Credentials Info Box */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs text-[#2A473E]">
                <Users className="w-4 h-4 text-[#2A473E]" />
                <span>Akses Login Dashboard Client Host</span>
              </div>
              <a
                href="/client"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold text-[#2A473E] hover:underline flex items-center gap-1"
              >
                <span>Buka Dashboard Client</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-emerald-100 font-mono">
              <div><strong>Halaman Login:</strong> {typeof window !== 'undefined' ? `${window.location.origin}/login` : 'http://localhost:3000/login'}</div>
              <div><strong>Client Host:</strong> {event.client?.name || 'Unassigned'}</div>
              <div><strong>Email Login:</strong> <span className="font-bold text-[#1A2621]">{clientEmail}</span></div>
              <div><strong>Password Login:</strong> <code className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-bold">{clientPassword}</code></div>
            </div>

            <button
              onClick={handleCopyCredentials}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              {copiedCreds ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCreds ? 'Info Login Disalin!' : 'Salin Pesan Akses Login (untuk WA Klien)'}</span>
            </button>

            <p className="text-[11px] text-slate-500 italic">
              * Klien dapat mengunduh foto &amp; mendengarkan rekaman suara tamu melalui portal ini.
            </p>
          </div>

          <hr className="border-slate-100" />

          {/* PNG Frame Preview */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              PNG Frame Overlay Template
            </h4>
            {frameUrl ? (
              <div className="w-36 aspect-[2/3] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden p-2">
                <img src={frameUrl} alt="Event PNG Frame" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center justify-between">
                <span>No PNG frame overlay uploaded for this event.</span>
                <Link
                  href={`/admin/events/${eventId}/edit`}
                  className="px-3 py-1.5 rounded-lg bg-amber-200 text-amber-900 font-bold hover:bg-amber-300"
                >
                  Upload Frame
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <PrintableQrModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        eventName={event.name}
        monogram={event.monogram}
        eventDate={event.event_date}
        eventUrl={eventUrl}
        slug={event.slug}
      />

      <DeleteEventModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        eventName={event.name}
        isDeleting={deleting}
      />
    </div>
  );
}
