'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HardDrive, Image as ImageIcon, Mic, Database, ArrowUpRight, BarChart2 } from 'lucide-react';

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

  useEffect(() => {
    async function loadStorageStats() {
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
    }

    loadStorageStats();
  }, [supabase]);

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
        <h2 className="text-base font-bold text-[#1A2621]">Supabase Storage Policy</h2>

        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <p className="font-bold text-slate-800">Final Composite PNG Photos</p>
              <p className="text-slate-400 text-[11px]">Resolution: 2160×3240 px (approx. 1.5MB each)</p>
            </div>
            <span className="font-semibold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
              7-Day Expiration Policy
            </span>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <p className="font-bold text-slate-800">Voice Guestbook Audio Files</p>
              <p className="text-slate-400 text-[11px]">Format: WEBM Opus Audio (approx. 400KB each)</p>
            </div>
            <span className="font-semibold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
              7-Day Expiration Policy
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
