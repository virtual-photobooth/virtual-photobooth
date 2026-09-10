'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, ArrowRight, AlertCircle, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function OwnerLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    const inputPassword = password.trim();

    try {
      // 1. Set client-side cookies and localStorage immediately
      document.cookie = `owner_session=${encodeURIComponent(normalizedEmail)}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `client_session=${encodeURIComponent(normalizedEmail)}; path=/; max-age=86400; SameSite=Lax`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('owner_session', normalizedEmail);
        localStorage.setItem('client_session', normalizedEmail);
      }

      // 2. Try Supabase Auth
      try {
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: inputPassword,
        });
      } catch (e) {
        // silent fallback
      }

      // 3. Call server-side API endpoint to set HTTP response cookies
      const res = await fetch('/api/auth/owner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: inputPassword }),
      });

      const resData = await res.json();

      if (res.ok && resData.success) {
        window.location.href = resData.redirect || '/admin';
        return;
      }

      setError(resData.message || 'Gagal login. Periksa email & password administrator Anda.');
    } catch (err: any) {
      console.error('Owner login error:', err);
      setError('Terjadi kesalahan saat menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans selection:bg-[#A27A49] selection:text-white">
      {/* Top Navbar */}
      <header className="w-full max-w-md mx-auto pt-2 sm:pt-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Beranda</span>
        </Link>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
        <div className="bg-[#1C1A19] border border-[#33302C] rounded-[2rem] p-7 sm:p-9 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#D4A373]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-7 space-y-3 relative z-10">
            <Link href="/" className="inline-block transition-transform hover:scale-105">
              <img
                src="/brand/crest.png"
                alt="sebuah.kenang Crest"
                className="w-14 h-auto mx-auto object-contain drop-shadow-md"
              />
            </Link>

            <div className="pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4A373]/15 border border-[#D4A373]/30 text-[#D4A373] text-[10px] font-mono tracking-widest uppercase mb-2">
                <ShieldCheck className="w-3 h-3" />
                <span>SUPER ADMIN & OWNER PORTAL</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-light text-white tracking-tight">
                Akses Administrator
              </h1>
              <p className="text-xs text-white/60 font-light mt-1.5 leading-relaxed px-2">
                Masuk ke konsol utama untuk mengelola seluruh event, vendor, dan pengaturan sistem.
              </p>
            </div>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-medium flex items-start gap-3 relative z-10">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleOwnerLogin} className="space-y-4 relative z-10">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-2 font-medium">
                Email Administrator
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@photobooth.com"
                  className="w-full bg-[#262321] border border-[#3D3935] focus:border-[#D4A373] focus:bg-[#2C2926] rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-white/30 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/60 mb-2 font-medium">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#262321] border border-[#3D3935] focus:border-[#D4A373] focus:bg-[#2C2926] rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-white/30 focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3.5 px-6 rounded-full bg-gradient-to-r from-[#D4A373] to-[#B88746] hover:from-[#C5925F] hover:to-[#A77838] text-[#111111] font-bold text-xs font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#111111]" />
                  <span>Memverifikasi Akses...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard Owner</span>
                  <ArrowRight className="w-4 h-4 text-[#111111]" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto pb-4 text-center">
        <p className="text-[11px] font-mono text-white/40">
          <span className="font-serif italic text-white/70">sebuah.kenang</span> &bull; Protected Super Admin Console.
        </p>
      </footer>
    </div>
  );
}
