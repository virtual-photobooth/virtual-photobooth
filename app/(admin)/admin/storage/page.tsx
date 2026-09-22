'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HardDrive, Image as ImageIcon, Mic, Database, ArrowUpRight, BarChart2, RefreshCw } from 'lucide-react';

export default function StoragePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    photoCount: 0,
    voiceCount: 0,
    estimatedPhotoMb: '0.0',
    estimatedVoiceMb: '0.0',
    totalMb: '0.0',
    totalGb: '0.00',
  });

  const [cleaning, setCleaning] = useState(false);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);

  const loadStorageStats = async () => {
    try {
      setLoading(true);

      const [{ count: pCount }, { count: vCount }] = await Promise.all([
        supabase.from('photos').select('*', { count: 'exact', head: true }),
        supabase.from('voice_messages').select('*', { count: 'exact', head: true }),
      ]);

      const photos = pCount || 0;
      const voices = vCount || 0;

      const photoMb = (photos * 1.5).toFixed(1);
      const voiceMb = (voices * 0.4).toFixed(1);
      const totalMbNum = photos * 1.5 + voices * 0.4;
      const totalGbNum = (totalMbNum / 1024).toFixed(2);

      setStats({
        photoCount: photos,
        voiceCount: voices,
        estimatedPhotoMb: photoMb,
        estimatedVoiceMb: voiceMb,
        totalMb: totalMbNum.toFixed(1),
        totalGb: totalGbNum,
      });
    } catch (err) {
      console.error('Failed to fetch storage stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorageStats();
  }, [supabase]);

  const handleRunCleanup = async () => {
    if (!confirm('Jalankan pembersihan sekarang? Semua event yang telah selesai atau lewat masa retensi akan dibersihkan foto, suara, antrian cetak, frame event, dan akun profil klien-nya.')) return;

    setCleaning(true);
    setCleanMessage(null);

    try {
      const res = await fetch('/api/admin/cleanup', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setCleanMessage(data.message);
        await loadStorageStats();
      } else {
        setCleanMessage(`Gagal: ${data.message || 'Terjadi kesalahan'}`);
      }
    } catch (e: any) {
      setCleanMessage(`Error: ${e.message || 'Koneksi gagal'}`);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1A2621]">Storage & Media Analytics</h1>
        <p className="text-xs text-slate-500 mt-1">
          Monitor cloud storage consumption across all guest photos and voice recordings
        </p>
      </div>

      {/* Storage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Used Storage
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-[#2A473E]">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#1A2621]">
            {loading ? '...' : `${stats.totalGb} GB`}
          </p>
          <p className="text-xs text-slate-400 mt-2">{stats.totalMb} MB media uploaded</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Photos Storage
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ImageIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#1A2621]">
            {loading ? '...' : `${stats.estimatedPhotoMb} MB`}
          </p>
          <p className="text-xs text-slate-400 mt-2">{stats.photoCount} high-res composite photos</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Voice Audio Storage
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Mic className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#1A2621]">
            {loading ? '...' : `${stats.estimatedVoiceMb} MB`}
          </p>
          <p className="text-xs text-slate-400 mt-2">{stats.voiceCount} webm audio recordings</p>
        </div>
      </div>

      {/* Storage Breakdown Details */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-[#1A2621]">Storage Provider: Cloudflare R2 (S3)</h2>
            <p className="text-xs text-slate-500 mt-0.5">High-performance S3-compatible cloud object storage with $0 egress bandwidth</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Cloudflare R2 Ready
          </span>
        </div>

        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <p className="font-bold text-slate-800">Final Composite Photos (JPEG / PNG)</p>
              <p className="text-slate-400 text-[11px]">Direct CDN delivery via Cloudflare Edge network • Zero egress bandwidth cost</p>
            </div>
            <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              $0 Egress Bandwidth
            </span>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <p className="font-bold text-slate-800">Voice Guestbook Audio (WEBM / M4A)</p>
              <p className="text-slate-400 text-[11px]">Instant audio streaming with global edge caching</p>
            </div>
            <span className="font-semibold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
              7-Day Retention Auto-Purge
            </span>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <p className="font-bold text-slate-800">Free Tier Allowance</p>
              <p className="text-slate-400 text-[11px]">Cloudflare R2 provides 10 GB standard storage free every month</p>
            </div>
            <span className="font-semibold text-slate-800 bg-slate-200 px-3 py-1 rounded-full">
              10 GB Free / Bulan
            </span>
          </div>
        </div>
      </div>

      {/* Auto-Purge & Retention Action Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#1A2621]">Pembersihan Otomatis Data Event &amp; Profil Klien</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hapus foto, rekaman suara, antrian cetak, dan akun login profil klien dari Supabase untuk event yang telah selesai atau lewat masa retensinya.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunCleanup}
            disabled={cleaning}
            className="px-5 py-3 rounded-full bg-[#1A2621] hover:bg-[#2C3B34] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${cleaning ? 'animate-spin' : ''}`} />
            <span>{cleaning ? 'Sedang Membersihkan...' : 'Jalankan Pembersihan Sekarang'}</span>
          </button>
        </div>

        {cleanMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
            {cleanMessage}
          </div>
        )}
      </div>
    </div>
  );
}
