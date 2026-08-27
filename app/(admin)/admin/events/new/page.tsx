'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Client, EventStatus } from '@/lib/types/database';
import { generateSlug } from '@/lib/utils/slug';
import { Calendar, ArrowLeft, Loader2, Sparkles, AlertCircle, Plus } from 'lucide-react';
import Link from 'next/link';

export default function CreateEventPage() {
  const router = useRouter();
  const supabase = createClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [creatingQuickClient, setCreatingQuickClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    monogram: 'WE',
    slug: '',
    event_date: new Date().toISOString().split('T')[0],
    status: 'active' as EventStatus,
    photo_count: 4,
    countdown_seconds: 3,
    is_voice_enabled: true,
    voice_retention_days: 7,
  });

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      setLoadingClients(true);
      const { data, error } = await (supabase.from('clients') as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setClients(data);
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, client_id: data[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoadingClients(false);
    }
  }

  // Quick Create Client on the fly
  const handleQuickCreateClient = async () => {
    setCreatingQuickClient(true);
    setError(null);
    try {
      const defaultName = formData.name ? `${formData.name} Host` : 'Default Event Host';
      const { data: newClient, error: insertErr } = await (supabase.from('clients') as any)
        .insert({
          name: defaultName,
          notes: 'Auto-created client host',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      if (newClient) {
        setClients((prev) => [newClient, ...prev]);
        setFormData((prev) => ({ ...prev, client_id: newClient.id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create quick client host');
    } finally {
      setCreatingQuickClient(false);
    }
  };

  const handleNameChange = (name: string) => {
    const slug = generateSlug(name);
    setFormData((prev) => ({ ...prev, name, slug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let targetClientId = formData.client_id;

      // Auto-create a client if none exists
      if (!targetClientId) {
        const defaultName = formData.name ? `${formData.name} Host` : 'Default Event Host';
        const { data: autoClient, error: autoErr } = await (supabase.from('clients') as any)
          .insert({
            name: defaultName,
            notes: 'Auto-created during event creation',
          })
          .select()
          .single();

        if (autoErr) throw autoErr;
        targetClientId = autoClient.id;
      }

      // Check slug uniqueness
      const { data: existing } = await (supabase.from('events') as any)
        .select('id')
        .eq('slug', formData.slug)
        .single();

      if (existing) {
        throw new Error(`The slug "${formData.slug}" is already taken by another event. Please use another name or slug.`);
      }

      const insertPayload: any = {
        client_id: targetClientId,
        name: formData.name,
        monogram: formData.monogram || 'WE',
        slug: formData.slug,
        event_date: formData.event_date,
        status: formData.status,
        photo_count: Number(formData.photo_count),
        countdown_seconds: Number(formData.countdown_seconds),
        is_voice_enabled: formData.is_voice_enabled,
        voice_retention_days: Number(formData.voice_retention_days),
      };

      let { data, error: insertError } = await (supabase.from('events') as any)
        .insert(insertPayload)
        .select()
        .single();

      // Retry without monogram if column hasn't been added to DB schema yet
      if (insertError && insertError.message?.includes('monogram')) {
        delete insertPayload.monogram;
        const { data: retryData, error: retryError } = await (supabase.from('events') as any)
          .insert(insertPayload)
          .select()
          .single();

        if (retryError) throw retryError;
        data = retryData;
      } else if (insertError) {
        throw insertError;
      }

      if (data) {
        router.push(`/admin/events/${data.id}/edit`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back button & Header */}
      <div>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Events</span>
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1A2621]">Create New Event</h1>
        <p className="text-xs text-slate-500 mt-1">Configure event settings and guest parameters</p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xs space-y-6">
        {/* Client Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Select Client / Event Host *
            </label>
            <button
              type="button"
              onClick={handleQuickCreateClient}
              disabled={creatingQuickClient}
              className="text-xs font-bold text-[#2A473E] hover:underline flex items-center gap-1 cursor-pointer"
            >
              {creatingQuickClient ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Auto-Create Client Host</span>
            </button>
          </div>

          {loadingClients ? (
            <div className="text-xs text-slate-400">Loading clients...</div>
          ) : clients.length === 0 ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#2A473E] text-xs flex items-center justify-between gap-4">
              <div>
                <p className="font-bold">No Client Host found yet.</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Click "Auto-Create Client Host" or simply click "Create Event" below to automatically create one!
                </p>
              </div>
              <button
                type="button"
                onClick={handleQuickCreateClient}
                disabled={creatingQuickClient}
                className="px-4 py-2 rounded-xl bg-[#2A473E] text-white text-xs font-semibold shrink-0 cursor-pointer"
              >
                {creatingQuickClient ? 'Creating...' : '+ Create Host Now'}
              </button>
            </div>
          ) : (
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
          )}
        </div>

        {/* Event Name, Monogram & Slug */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
              Event Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Celine & Brian Wedding"
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
              Monogram Logo (e.g. &quot;C &amp; B&quot;, &quot;WE&quot;)
            </label>
            <input
              type="text"
              maxLength={6}
              value={formData.monogram}
              onChange={(e) => setFormData({ ...formData, monogram: e.target.value })}
              placeholder="C & B"
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 font-serif italic font-bold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
              Event URL Slug *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                /event/
              </span>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="celine-brian"
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl py-3 pl-16 pr-4 text-xs text-slate-800 font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Event Date & Initial Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
              Event Date *
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
              Initial Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
            >
              <option value="active">Active (Live photobooth)</option>
              <option value="draft">Draft (Setup mode)</option>
              <option value="completed">Completed</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Photobooth Configurations */}
        <h3 className="text-xs font-bold text-[#2A473E] uppercase tracking-wider">
          Photobooth Experience Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
              Photo Count per Guest Session
            </label>
            <input
              type="number"
              min={1}
              max={10}
              required
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
              required
              value={formData.countdown_seconds}
              onChange={(e) =>
                setFormData({ ...formData, countdown_seconds: parseInt(e.target.value) || 3 })
              }
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#2A473E] rounded-xl p-3 text-xs text-slate-800 focus:outline-none"
            />
          </div>
        </div>

        {/* Voice Guestbook Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="is_voice_enabled"
              checked={formData.is_voice_enabled}
              onChange={(e) => setFormData({ ...formData, is_voice_enabled: e.target.checked })}
              className="w-5 h-5 accent-[#2A473E] rounded cursor-pointer"
            />
            <label htmlFor="is_voice_enabled" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Enable Voice Guestbook
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
              Voice Audio Retention (Days)
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

        {/* Action button */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3.5 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white font-semibold text-xs uppercase tracking-wider shadow-md flex items-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Event...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Create Event & Proceed to Frame Upload</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
