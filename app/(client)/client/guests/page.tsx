'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Guest } from '@/lib/types/database';
import { Users, Search, AtSign, Image as ImageIcon, Mic, Calendar } from 'lucide-react';

import { getClientScope } from '@/lib/utils/client-scope';

export default function ClientGuestsPage() {
  const supabase = createClient();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadGuests() {
      try {
        setLoading(true);
        const scope = await getClientScope(supabase);

        if (scope.eventIds.length === 0) {
          setGuests([]);
          return;
        }

        const { data, error } = await (supabase.from('guests') as any)
          .select('*')
          .in('event_id', scope.eventIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) setGuests(data as Guest[]);
      } catch (err) {
        console.error('Failed to load guests:', err);
      } finally {
        setLoading(false);
      }
    }

    loadGuests();
  }, [supabase]);

  const filteredGuests = guests.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.instagram && g.instagram.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2C2A29]">Daftar Tamu Acara</h1>
          <p className="text-xs text-[#78716C] mt-1 font-serif italic">
            Semua tamu yang telah berfoto dan membagikan kenangan indah.
          </p>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider text-[#8C6D46] bg-[#F4EFE6] px-4 py-2 rounded-full border border-[#E2D9CC] self-start">
          Total {guests.length} Tamu
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari berdasarkan nama atau akun Instagram..."
          className="w-full bg-[#F4EFE6] border border-[#E2D9CC] focus:border-[#8C6D46] rounded-full py-3 pl-11 pr-4 text-xs text-[#2C2A29] placeholder-[#A8A29E] focus:outline-none transition-all"
        />
      </div>

      {/* Guests Grid / List */}
      {loading ? (
        <div className="py-16 text-center text-[#78716C] text-xs font-serif italic">
          Memuat daftar tamu...
        </div>
      ) : filteredGuests.length === 0 ? (
        <div className="py-16 text-center text-[#78716C] text-xs font-serif italic bg-[#F4EFE6] rounded-3xl border border-[#E2D9CC]">
          Belum ada data tamu terdaftar saat ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuests.map((guest) => (
            <div
              key={guest.id}
              className="bg-[#F4EFE6] border border-[#E2D9CC] rounded-3xl p-6 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#E8E2D8] border border-[#D4A373]/30 flex items-center justify-center font-serif italic text-base font-bold text-[#8C6D46]">
                    {guest.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#2C2A29]">{guest.name}</h3>
                    {guest.instagram ? (
                      <a
                        href={`https://instagram.com/${guest.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#8C6D46] hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <AtSign className="w-3 h-3" />
                        <span>{guest.instagram}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-[#A8A29E]">Tanpa Instagram</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E2D9CC] flex items-center justify-between text-[11px] text-[#78716C]">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#8C6D46]" />
                  <span>{new Date(guest.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 bg-[#E8E2D8] px-2.5 py-0.5 rounded-full text-[#8C6D46] font-semibold">
                    <ImageIcon className="w-3 h-3" />
                    <span>Foto</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
