'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Event } from '@/lib/types/database';
import { Calendar, Plus, Search, ExternalLink, Edit3, Image as ImageIcon, QrCode, Trash2 } from 'lucide-react';
import DeleteEventModal from '@/components/admin/DeleteEventModal';

export default function EventsListPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      setLoading(true);
      const { data, error } = await (supabase.from('events') as any)
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setEvents(data as Event[]);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id: eventId, name: eventName } = deleteTarget;

    try {
      setIsDeleting(true);

      // 1. Fetch photos for this event
      const { data: photos } = await (supabase.from('photos') as any)
        .select('photo_path')
        .eq('event_id', eventId);

      // 2. Fetch voice messages for this event
      const { data: voices } = await (supabase.from('voice_messages') as any)
        .select('audio_path')
        .eq('event_id', eventId);

      // Fetch event frame_path & cover_path
      const { data: eventData } = await (supabase.from('events') as any)
        .select('frame_path, cover_path')
        .eq('id', eventId)
        .single();

      // Collect storage file paths to remove
      const storagePaths: string[] = [];
      if (photos && photos.length > 0) {
        photos.forEach((p: any) => p.photo_path && storagePaths.push(p.photo_path));
      }
      if (voices && voices.length > 0) {
        voices.forEach((v: any) => v.audio_path && storagePaths.push(v.audio_path));
      }
      if (eventData?.frame_path) storagePaths.push(eventData.frame_path);
      if (eventData?.cover_path) storagePaths.push(eventData.cover_path);

      // 3. Remove files from Supabase storage
      if (storagePaths.length > 0) {
        await supabase.storage.from('virtual-photobooth').remove(storagePaths);
      }

      // 4. Delete database rows
      await (supabase.from('photos') as any).delete().eq('event_id', eventId);
      await (supabase.from('voice_messages') as any).delete().eq('event_id', eventId);
      const { error: deleteErr } = await (supabase.from('events') as any).delete().eq('id', eventId);

      if (deleteErr) throw deleteErr;

      setDeleteTarget(null);
      fetchEvents();
    } catch (err: any) {
      alert(`Gagal menghapus event: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredEvents = events.filter(
    (evt) =>
      evt.name.toLowerCase().includes(search.toLowerCase()) ||
      evt.slug.toLowerCase().includes(search.toLowerCase()) ||
      (evt.client && evt.client.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1A2621]">Event Management</h1>
          <p className="text-xs text-slate-500 mt-1">Configure and manage all photobooth events</p>
        </div>

        <Link
          href="/admin/events/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by event name, client, or slug..."
          className="w-full bg-white border border-slate-200 focus:border-[#2A473E] focus:ring-2 focus:ring-[#2A473E]/20 rounded-xl py-2.5 pl-11 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none text-xs transition-all shadow-xs"
        />
      </div>

      {/* Events Table / Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs">Loading events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8">
          No events found. Click "Create New Event" to get started.
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 uppercase tracking-wider text-slate-400 text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-4 px-5">Event Name & Slug</th>
                  <th className="py-4 px-5">Client</th>
                  <th className="py-4 px-5">Event Date</th>
                  <th className="py-4 px-5">Config</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/80 transition-all">
                    <td className="py-4 px-5">
                      <div className="font-bold text-[#1A2621] text-sm">{evt.name}</div>
                      <div className="text-[11px] text-[#2A473E] font-mono mt-0.5">/event/{evt.slug}</div>
                    </td>
                    <td className="py-4 px-5 text-slate-700 font-medium">
                      {evt.client?.name || 'Unassigned'}
                    </td>
                    <td className="py-4 px-5 text-slate-500">{evt.event_date}</td>
                    <td className="py-4 px-5">
                      <div className="text-[11px] space-y-0.5 text-slate-500">
                        <div>📸 {evt.photo_count} Photos &bull; ⏱️ {evt.countdown_seconds}s</div>
                        <div>🎤 {evt.is_voice_enabled ? `Voice (${evt.voice_retention_days}d)` : 'Disabled'}</div>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          evt.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : evt.status === 'draft'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right space-x-2">
                      <Link
                        href={`/admin/events/${evt.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR &amp; View</span>
                      </Link>
                      <Link
                        href={`/admin/events/${evt.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-[#2A473E] hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Link>
                      <button
                        onClick={() => setDeleteTarget({ id: evt.id, name: evt.name })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold transition-colors cursor-pointer"
                        title="Delete Event & Media"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modern Glassmorphism Delete Confirmation Modal */}
      <DeleteEventModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        eventName={deleteTarget?.name || ''}
        isDeleting={isDeleting}
      />
    </div>
  );
}
