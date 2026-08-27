'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Calendar,
  Users,
  Image as ImageIcon,
  Mic,
  HardDrive,
  Plus,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    totalEvents: 0,
    activeEvents: 0,
    totalClients: 0,
    totalGuests: 0,
    totalPhotos: 0,
    totalVoiceMessages: 0,
    storageUsageGb: '0.0',
  });
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);

        const [
          { count: totalEvents },
          { count: activeEvents },
          { count: totalClients },
          { count: totalGuests },
          { count: totalPhotos },
          { count: totalVoiceMessages },
          { data: eventsData },
        ] = await Promise.all([
          supabase.from('events').select('*', { count: 'exact', head: true }),
          supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('clients').select('*', { count: 'exact', head: true }),
          supabase.from('guests').select('*', { count: 'exact', head: true }),
          supabase.from('photos').select('*', { count: 'exact', head: true }),
          supabase.from('voice_messages').select('*', { count: 'exact', head: true }),
          (supabase.from('events') as any)
            .select('*, client:clients(name)')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        const estimatedGb = (
          ((totalPhotos || 0) * 1.5 + (totalVoiceMessages || 0) * 0.4) /
          1024
        ).toFixed(2);

        setStats({
          totalEvents: totalEvents || 0,
          activeEvents: activeEvents || 0,
          totalClients: totalClients || 0,
          totalGuests: totalGuests || 0,
          totalPhotos: totalPhotos || 0,
          totalVoiceMessages: totalVoiceMessages || 0,
          storageUsageGb: estimatedGb,
        });

        if (eventsData) {
          setRecentEvents(eventsData);
        }
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [supabase]);

  const cards = [
    { label: 'Total Clients', value: stats.totalClients, icon: Users, accent: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Events', value: stats.totalEvents, icon: Calendar, accent: 'bg-blue-50 text-blue-600' },
    { label: 'Active Events', value: stats.activeEvents, icon: CheckCircle2, accent: 'bg-teal-50 text-teal-600' },
    { label: 'Total Guests', value: stats.totalGuests, icon: Sparkles, accent: 'bg-amber-50 text-amber-600' },
    { label: 'Total Photos', value: stats.totalPhotos, icon: ImageIcon, accent: 'bg-rose-50 text-rose-600' },
    { label: 'Total Voice Messages', value: stats.totalVoiceMessages, icon: Mic, accent: 'bg-indigo-50 text-indigo-600' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1A2621]">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">Overview of your virtual photobooth platform</p>
        </div>

        <Link
          href="/admin/events/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500">{card.label}</span>
                <div className={`p-2 rounded-xl ${card.accent}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-[#1A2621]">
                {loading ? '...' : card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Grid: Active Events Table & Storage Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2/3): Active Events */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#1A2621]">Active Events</h2>
              <p className="text-xs text-slate-500">Live photobooth sessions</p>
            </div>
            <Link
              href="/admin/events"
              className="text-xs font-semibold text-[#2A473E] hover:underline flex items-center gap-1"
            >
              <span>View all events</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading events...</div>
          ) : recentEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No active events right now.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 uppercase tracking-wider text-slate-400 text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Event Name</th>
                    <th className="py-3 px-3">Client</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-50/80 transition-all">
                      <td className="py-3.5 px-3 font-bold text-[#1A2621]">{evt.name}</td>
                      <td className="py-3.5 px-3 text-slate-500">{evt.client?.name || 'N/A'}</td>
                      <td className="py-3.5 px-3 text-slate-500">{evt.event_date}</td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            evt.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {evt.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <Link
                          href={`/admin/events/${evt.id}/edit`}
                          className="text-xs font-semibold text-[#2A473E] hover:underline"
                        >
                          Edit Frame
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column (1/3): Storage Overview */}
        <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#1A2621]">Storage Overview</h2>
            <p className="text-xs text-slate-500 mt-0.5">Media consumption metrics</p>
          </div>

          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-32 h-32 rounded-full border-8 border-[#2A473E] flex flex-col items-center justify-center shadow-inner">
              <span className="text-xl font-extrabold text-[#1A2621]">{stats.storageUsageGb} GB</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Used</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
              <span className="text-slate-600 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2A473E]" />
                Final Photos
              </span>
              <span className="font-semibold text-slate-900">{stats.totalPhotos} files</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
              <span className="text-slate-600 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8CB89F]" />
                Voice Messages
              </span>
              <span className="font-semibold text-slate-900">{stats.totalVoiceMessages} files</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
