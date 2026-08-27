'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Settings as SettingsIcon, Save, CheckCircle2, User, Key, Database } from 'lucide-react';

export default function SettingsPage() {
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('owner');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserEmail(user.email || '');
          const { data: profile } = await (supabase.from('profiles') as any)
            .select('role')
            .eq('id', user.id)
            .single();

          if (profile) {
            setUserRole(profile.role);
          }
        }
      } catch (err) {
        console.error('Failed to load settings user:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [supabase]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1A2621]">Platform Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage system configurations and owner account credentials
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      {/* Account Info Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-[#1A2621]">Account Credentials</h2>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
              Account Email
            </label>
            <input
              type="email"
              disabled
              value={userEmail}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 font-mono disabled:opacity-80"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
              Role Authority
            </label>
            <input
              type="text"
              disabled
              value={userRole.toUpperCase()}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-[#2A473E] disabled:opacity-80"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#2A473E] hover:bg-[#1E362F] text-white font-semibold text-xs uppercase tracking-wider shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Preferences</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
