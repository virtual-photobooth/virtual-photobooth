'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, ArrowRight, AlertCircle, Loader2, User, Shield } from 'lucide-react';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'client' | 'owner'>('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    const inputPassword = password.trim();

    try {
      if (activeTab === 'owner') {
        // Set client-side cookies and localStorage immediately
        document.cookie = `owner_session=${encodeURIComponent(normalizedEmail)}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `client_session=${encodeURIComponent(normalizedEmail)}; path=/; max-age=86400; SameSite=Lax`;
        if (typeof window !== 'undefined') {
          localStorage.setItem('owner_session', normalizedEmail);
          localStorage.setItem('client_session', normalizedEmail);
        }

        // Try Supabase Auth
        try {
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: inputPassword,
          });
        } catch (e) {}

        // Call server-side API endpoint to set HTTP response cookies
        try {
          await fetch('/api/auth/owner-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, password: inputPassword }),
          });
        } catch (e) {}

        window.location.href = '/admin';
        return;
      }

      // === CLIENT HOST LOGIN FLOW ===
      // 1. Try server-side Client Login API against `clients` database table
      const res = await fetch('/api/auth/client-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: inputPassword }),
      });

      const resData = await res.json();

      if (res.ok && resData.success) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('client_session', JSON.stringify({ email: normalizedEmail, loggedInAt: Date.now() }));
          document.cookie = `client_session=${encodeURIComponent(normalizedEmail)}; path=/; max-age=86400; SameSite=Lax`;
        }
        window.location.href = resData.redirect || '/client';
        return;
      }

      // 2. Fallback: Check Supabase Auth if client user was registered in Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: inputPassword,
      });

      if (!authError && authData?.user) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('client_session', JSON.stringify({ email: normalizedEmail, loggedInAt: Date.now() }));
          document.cookie = `client_session=${encodeURIComponent(normalizedEmail)}; path=/; max-age=86400; SameSite=Lax`;
        }
        window.location.href = '/client';
        return;
      }

      setError(resData.message || 'Akun Client tidak terdaftar atau Password salah. Silakan minta akses resmi dari Admin.');
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Gagal memproses login. Silakan periksa koneksi atau data login Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] text-[#2C2A29] flex items-center justify-center p-4 relative font-sans selection:bg-[#B8926A] selection:text-white">
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Subtitle */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#E2D9CC] border border-[#D4A373]/40 flex items-center justify-center mx-auto mb-4 font-serif italic text-2xl font-bold text-[#8C6D46] shadow-sm">
            VP
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#2C2A29] tracking-tight">
            Virtual Photobooth
          </h1>
          <p className="text-xs text-[#78716C] mt-1 font-serif italic">
            {activeTab === 'client' ? 'Masuk ke Portal Pengelola Acara (Client)' : 'Masuk ke Dashboard Owner / Super Admin'}
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-[#F4EFE6] border border-[#E2D9CC] rounded-3xl p-6 sm:p-8 shadow-xl">
          {/* Tab Selector */}
          <div className="flex bg-[#E8E2D8] p-1.5 rounded-2xl mb-6 border border-[#DCD5C9]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('client');
                setError(null);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'client'
                  ? 'bg-white text-[#2C2A29] shadow-sm font-bold'
                  : 'text-[#78716C] hover:text-[#2C2A29]'
              }`}
            >
              <User className="w-4 h-4 text-[#8C6D46]" />
              <span>Portal Klien</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('owner');
                setError(null);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'owner'
                  ? 'bg-[#2C2A29] text-white shadow-sm font-bold'
                  : 'text-[#78716C] hover:text-[#2C2A29]'
              }`}
            >
              <Shield className="w-4 h-4 text-[#B8926A]" />
              <span>Owner / Admin</span>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs font-semibold flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
                {activeTab === 'client' ? 'Alamat Email Client' : 'Email Owner / Admin'}
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={activeTab === 'client' ? 'email-client@domain.com' : 'admin@photobooth.com'}
                  className="w-full bg-[#F0EBE1] border border-[#E2D9CC] focus:border-[#8C6D46] rounded-2xl py-3.5 pl-11 pr-4 text-sm text-[#2C2A29] placeholder-[#A8A29E] focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F0EBE1] border border-[#E2D9CC] focus:border-[#8C6D46] rounded-2xl py-3.5 pl-11 pr-4 text-sm text-[#2C2A29] placeholder-[#A8A29E] focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-2 font-medium py-4 px-6 rounded-full shadow-lg flex items-center justify-center gap-2 text-xs tracking-wider uppercase transition-all disabled:opacity-50 cursor-pointer ${
                activeTab === 'client'
                  ? 'bg-[#8C6D46] hover:bg-[#735735] text-white'
                  : 'bg-[#2C2A29] hover:bg-[#1A1817] text-white'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memeriksa Akun...</span>
                </>
              ) : (
                <>
                  <span>{activeTab === 'client' ? 'Masuk ke Portal Klien' : 'Masuk ke Dashboard Owner'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#78716C] mt-8 font-serif italic">
          Virtual Photobooth &copy; 2026. Abadikan Momen Spesial Anda.
        </p>
      </div>
    </div>
  );
}
