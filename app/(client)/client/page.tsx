'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Event } from '@/lib/types/database';
import { Users, Image as ImageIcon, Mic, Clock, Sparkles, Download, Heart } from 'lucide-react';

export default function ClientHomePage() {
  const supabase = createClient();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestsCount, setGuestsCount] = useState(0);
  const [photosCount, setPhotosCount] = useState(0);
  const [voicesCount, setVoicesCount] = useState(0);

  useEffect(() => {
    async function loadClientData() {
      try {
        setLoading(true);
        const [
          { data: eventsData },
          { count: gCount },
          { count: pCount },
          { count: vCount },
        ] = await Promise.all([
          supabase.from('events').select('*'),
          supabase.from('guests').select('*', { count: 'exact', head: true }),
          supabase.from('photos').select('*', { count: 'exact', head: true }),
          supabase.from('voice_messages').select('*', { count: 'exact', head: true }),
        ]);

        if (eventsData) setEvents(eventsData as Event[]);
        setGuestsCount(gCount || 0);
        setPhotosCount(pCount || 0);
        setVoicesCount(vCount || 0);
      } catch (err) {
        console.error('Error fetching client overview:', err);
      } finally {
        setLoading(false);
      }
    }
    loadClientData();
  }, [supabase]);

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2C2A29]">Overview</h1>
        <p className="text-xs text-[#78716C] mt-1 font-serif italic">
          Welcome back! Here is a summary of your event memories.
        </p>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#F4EFE6] border border-[#E2D9CC] rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Total Guests
            </span>
            <div className="p-2 rounded-full bg-[#E8E2D8] text-[#8C6D46]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#2C2A29] font-serif">
            {loading ? '...' : guestsCount}
          </p>
          <p className="text-[11px] text-[#78716C] mt-1">Guests captured</p>
        </div>

        <div className="bg-[#F4EFE6] border border-[#E2D9CC] rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Total Photos
            </span>
            <div className="p-2 rounded-full bg-[#E8E2D8] text-[#8C6D46]">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#2C2A29] font-serif">
            {loading ? '...' : photosCount}
          </p>
          <p className="text-[11px] text-[#78716C] mt-1">Memories taken</p>
        </div>

        <div className="bg-[#F4EFE6] border border-[#E2D9CC] rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Voice Messages
            </span>
            <div className="p-2 rounded-full bg-[#E8E2D8] text-[#8C6D46]">
              <Mic className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#2C2A29] font-serif">
            {loading ? '...' : voicesCount}
          </p>
          <p className="text-[11px] text-[#78716C] mt-1">Recorded greetings</p>
        </div>

        <div className="bg-[#F4EFE6] border border-[#E2D9CC] rounded-3xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
              Voice Retention
            </span>
            <div className="p-2 rounded-full bg-[#E8E2D8] text-[#8C6D46]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#2C2A29] font-serif">7 Days</p>
          <p className="text-[11px] text-[#78716C] mt-1">Auto-delete policy</p>
        </div>
      </div>

      {/* Events List */}
      <div className="bg-[#F4EFE6] border border-[#E2D9CC] rounded-3xl p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-[#2C2A29]">Your Active Event</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#78716C] text-xs font-serif italic">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-[#78716C] text-xs font-serif italic bg-[#F0EBE1] rounded-2xl border border-[#E2D9CC]">
            No assigned events found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="bg-[#F9F6F0] border border-[#E2D9CC] rounded-2xl p-6 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D46] bg-[#8C6D46]/10 px-3 py-1 rounded-full">
                    {evt.status}
                  </span>
                  <span className="text-xs font-mono text-[#78716C]">/event/{evt.slug}</span>
                </div>

                <h3 className="font-serif text-2xl font-bold text-[#2C2A29]">{evt.name}</h3>
                <p className="text-xs text-[#78716C] font-serif italic">{evt.event_date}</p>

                <div className="pt-2 flex justify-end">
                  <a
                    href={`/event/${evt.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 rounded-full bg-[#2C2A29] text-white text-xs font-medium tracking-wider uppercase hover:bg-[#1A1817] transition-all"
                  >
                    Open Photobooth
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
