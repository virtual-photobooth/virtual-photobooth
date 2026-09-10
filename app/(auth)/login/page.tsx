'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, ArrowRight, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export default function VendorLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const handleVendorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    const inputPassword = password.trim();

    try {
      // 1. Try server-side Client Login API against `clients` database table
      const res = await fetch('/api/auth/client-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: inputPassword }),
      });

      const resData = await res.json();

      if (res.ok && resData.success) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'client_session',
            JSON.stringify({ email: normalizedEmail, loggedInAt: Date.now() })
          );
          document.cookie = `client_session=${encodeURIComponent(normalizedEmail)}; path=/; max-age=86400; SameSite=Lax`;
        }
        window.location.href = resData.redirect || '/client';
        return;
      }

      // 2. Fallback: Check Supabase Auth if client user was registered directly in Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: inputPassword,
      });

      if (!authError && authData?.user) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'client_session',
            JSON.stringify({ email: normalizedEmail, loggedInAt: Date.now() })
          );
          document.cookie = `client_session=${encodeURIComponent(normalizedEmail)}; path=/; max-age=86400; SameSite=Lax`;
        }
        window.location.href = '/client';
        return;
      }

      setError(
        resData.message ||
          'Akun Vendor / Klien tidak terdaftar atau Password salah. Silakan periksa kembali email & password dari Admin.'
      );
    } catch (err: any) {
      console.error('Vendor login error:', err);
      setError('Gagal memproses login. Silakan periksa koneksi internet Anda dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#111111] flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans selection:bg-[#A27A49] selection:text-white">
      {/* Top Navbar Brand Link */}
      <header className="w-full max-w-md mx-auto pt-2 sm:pt-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#666666] hover:text-[#111111] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Beranda</span>
        </Link>
      </header>

      {/* Main Login Card Container */}
      <main className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
        <div className="bg-white border border-[#E5E1DA] rounded-[2rem] p-7 sm:p-9 shadow-sm relative overflow-hidden">
          {/* Brand Logo & Header */}
          <div className="text-center mb-7 space-y-3">
            <Link href="/" className="inline-block transition-transform hover:scale-102">
              <img
                src="/brand/logo.png"
                alt="sebuah.kenang"
                className="h-10 sm:h-11 w-auto mx-auto object-contain"
              />
            </Link>

            <div className="pt-2">
              <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A27A49] font-medium block">
                PORTAL PENGELOLA ACARA & VENDOR
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-light text-[#111111] tracking-tight mt-1">
                Masuk ke Portal Anda
              </h1>
              <p className="text-xs text-[#666666] font-light mt-1.5 leading-relaxed px-2">
                Pantau foto tamu secara langsung, dengarkan pesan suara, dan unduh seluruh arsip acara.
              </p>
            </div>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs font-medium flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form Login Vendor */}
          <form onSubmit={handleVendorLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#666666] mb-2 font-medium">
                Alamat Email Vendor / Klien
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email-klien@domain.com"
                  className="w-full bg-[#FAF9F5] border border-[#E5E1DA] focus:border-[#111111] focus:bg-white rounded-2xl py-3.5 pl-11 pr-4 text-sm text-[#111111] placeholder-[#999999] focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#666666] mb-2 font-medium">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#FAF9F5] border border-[#E5E1DA] focus:border-[#111111] focus:bg-white rounded-2xl py-3.5 pl-11 pr-4 text-sm text-[#111111] placeholder-[#999999] focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3.5 px-6 rounded-full bg-[#111111] hover:bg-[#292624] text-white text-xs font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Memeriksa Akses...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Portal Klien</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Discreet Help Note */}
          <div className="mt-6 pt-5 border-t border-[#F0EBE1] text-center">
            <p className="text-[11px] text-[#888888] font-light leading-relaxed">
              Belum memiliki akun atau lupa password? Hubungi tim administrator / organizer acara Anda untuk mendapatkan kredensial resmi.
            </p>
          </div>
        </div>
      </main>

      {/* Brand Footer */}
      <footer className="w-full max-w-md mx-auto pb-4 text-center">
        <p className="text-[11px] font-mono text-[#888888]">
          <span className="font-serif italic font-normal text-[#111111]">sebuah.kenang</span> &bull; Virtual Photobooth for Moments Worth Remembering.
        </p>
      </footer>
    </div>
  );
}
