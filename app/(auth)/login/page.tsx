'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Camera, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
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

    try {
      // 1. Try Supabase Auth Sign In first
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!authError && data?.user) {
        const { data: profile } = await (supabase.from('profiles') as any)
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile?.role === 'owner' || normalizedEmail.includes('owner') || normalizedEmail.includes('admin')) {
          window.location.href = '/admin';
        } else {
          document.cookie = `client_session=${encodeURIComponent(normalizedEmail)}; path=/; max-age=86400; SameSite=Lax`;
          window.location.href = '/client';
        }
        return;
      }

      // 2. Call server-side Client Login API
      const res = await fetch('/api/auth/client-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
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

      setError(resData.message || 'Akun tidak terdaftar di database. Silakan minta Email & Password Client resmi dari Admin.');
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Gagal memproses login. Silakan periksa kembali email & password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] text-[#2C2A29] flex items-center justify-center p-4 relative font-sans selection:bg-[#B8926A] selection:text-white">
      <div className="w-full max-w-md relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#E2D9CC] border border-[#D4A373]/40 flex items-center justify-center mx-auto mb-4 font-serif italic text-2xl font-bold text-[#8C6D46] shadow-sm">
            VP
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#2C2A29] tracking-tight">
            Virtual Photobooth
          </h1>
          <p className="text-xs text-[#78716C] mt-1 font-serif italic">
            Masuk ke Dashboard Pengelola Acara
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-[#F4EFE6] border border-[#E2D9CC] rounded-3xl p-8 shadow-xl">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs font-semibold flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
                Alamat Email Client
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email-client@domain.com"
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
              className="w-full mt-2 bg-[#2C2A29] hover:bg-[#1A1817] text-white font-medium py-4 px-6 rounded-full shadow-lg flex items-center justify-center gap-2 text-xs tracking-wider uppercase transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memeriksa Akun...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
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
