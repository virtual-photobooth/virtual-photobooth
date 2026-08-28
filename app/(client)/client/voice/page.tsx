'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { VoiceMessage } from '@/lib/types/database';
import { Mic, Play, Pause, Download, Clock, AlertCircle } from 'lucide-react';

import { getClientScope } from '@/lib/utils/client-scope';

export default function ClientVoicePage() {
  const supabase = createClient();
  const [voices, setVoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  useEffect(() => {
    async function loadVoices() {
      try {
        setLoading(true);
        const scope = await getClientScope(supabase);

        if (scope.eventIds.length === 0) {
          setVoices([]);
          return;
        }

        // 1. Attempt full select with guest name & is_deleted filter
        let { data, error } = await (supabase.from('voice_messages') as any)
          .select('*, guest:guests(name)')
          .in('event_id', scope.eventIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        // 2. Fallback if is_deleted column or guest join is missing
        if (error) {
          console.warn('Voice query fallback triggered:', error.message);
          let { data: fbData, error: fbErr } = await (supabase.from('voice_messages') as any)
            .select('*, guest:guests(name)')
            .in('event_id', scope.eventIds)
            .order('created_at', { ascending: false });

          if (fbErr) {
            let { data: simpleData, error: simpleErr } = await (supabase.from('voice_messages') as any)
              .select('*')
              .in('event_id', scope.eventIds)
              .order('created_at', { ascending: false });

            if (simpleErr) throw simpleErr;
            data = simpleData;
          } else {
            data = fbData;
          }
        }

        if (data) {
          const resolvedVoices = data.map((v: any) => {
            const { data: publicUrlData } = supabase.storage
              .from('virtual-photobooth')
              .getPublicUrl(v.audio_path);

            return {
              ...v,
              publicUrl: publicUrlData?.publicUrl || '',
            };
          });

          setVoices(resolvedVoices);
        }
      } catch (err) {
        console.error('Failed to load voice messages:', err);
      } finally {
        setLoading(false);
      }
    }

    loadVoices();
  }, [supabase]);

  const togglePlay = (id: string) => {
    const audioEl = audioRefs.current[id];
    if (!audioEl) return;

    if (playingId === id) {
      audioEl.pause();
      setPlayingId(null);
    } else {
      // Pause any currently playing audio
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId]?.pause();
      }
      audioEl.play();
      setPlayingId(id);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatSeconds = (secs?: number | null) => {
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2C2A29]">Buku Tamu Pesan Suara</h1>
          <p className="text-xs text-[#78716C] mt-1 font-serif italic">
            Dengarkan ucapan hangat dan doa manis dari para tamu acara Anda.
          </p>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider text-[#8C6D46] bg-[#F4EFE6] px-4 py-2 rounded-full border border-[#E2D9CC] self-start">
          {voices.length} Pesan Suara
        </div>
      </div>

      {/* Expiration Note */}
      <div className="p-4 rounded-2xl bg-[#F4EFE6] border border-[#E2D9CC] flex items-center gap-3 text-xs text-[#78716C]">
        <Clock className="w-4 h-4 text-[#8C6D46] shrink-0" />
        <span>
          Pesan suara disimpan otomatis selama masa retensi acara (7 Hari). Silakan unduh pesan suara favorit Anda.
        </span>
      </div>

      {/* Voice Messages List */}
      {loading ? (
        <div className="py-16 text-center text-[#78716C] text-xs font-serif italic">
          Memuat pesan suara...
        </div>
      ) : voices.length === 0 ? (
        <div className="py-16 text-center text-[#78716C] text-xs font-serif italic bg-[#F4EFE6] rounded-3xl border border-[#E2D9CC]">
          Belum ada pesan suara yang ditinggalkan oleh tamu.
        </div>
      ) : (
        <div className="space-y-4">
          {voices.map((voice) => {
            const isPlaying = playingId === voice.id;
            return (
              <div
                key={voice.id}
                className="bg-[#F4EFE6] border border-[#E2D9CC] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <audio
                  ref={(el) => {
                    audioRefs.current[voice.id] = el;
                  }}
                  src={voice.publicUrl}
                  onEnded={() => setPlayingId(null)}
                />

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => togglePlay(voice.id)}
                    className="w-12 h-12 rounded-full bg-[#8C6D46] hover:bg-[#735735] text-white flex items-center justify-center shadow-md transition-all shrink-0 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>

                  <div>
                    <h3 className="font-serif font-bold text-base text-[#2C2A29]">
                      {voice.guest?.name || 'Tamu Spesial'}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-[#78716C] mt-0.5 font-mono">
                      <span>Durasi: {formatSeconds(voice.duration_seconds)}</span>
                      <span>&bull;</span>
                      <span>{new Date(voice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    handleDownload(voice.publicUrl, `ucapan-${voice.guest?.name || 'tamu'}-${voice.id}.webm`)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#E8E2D8] hover:bg-[#E2D9CC] text-[#8C6D46] text-xs font-semibold uppercase tracking-wider transition-all self-end sm:self-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Audio</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
