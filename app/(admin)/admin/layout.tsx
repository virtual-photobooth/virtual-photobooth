'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Camera,
  LayoutDashboard,
  Calendar,
  Users,
  HardDrive,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Layers,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      // 1. Check API endpoint
      try {
        const res = await fetch('/api/auth/check-owner');
        const data = await res.json();

        if (res.ok && data?.authenticated) {
          setUserEmail(data.email || 'Owner Admin');
          setCheckingAuth(false);
          return;
        }
      } catch (err) {
        console.warn('Auth check error:', err);
      }

      // 2. Check localStorage & document.cookie in browser
      if (typeof window !== 'undefined') {
        const getCookie = (name: string) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '');
          return null;
        };

        const ownerCookie = getCookie('owner_session');
        const clientCookie = getCookie('client_session');
        const localOwner = localStorage.getItem('owner_session');
        const localClient = localStorage.getItem('client_session');

        if (ownerCookie || clientCookie || localOwner || localClient) {
          const emailVal = ownerCookie || clientCookie || localOwner || localClient || 'Owner Admin';
          setUserEmail(emailVal);
          setCheckingAuth(false);
          return;
        }
      }

      // 3. Fallback: check Supabase client auth user
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || 'Owner Admin');
          setCheckingAuth(false);
          return;
        }
      } catch (e) {}

      router.push('/login');
    }

    checkAuth();
  }, [supabase, router]);

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('owner_session');
      localStorage.removeItem('client_session');
      document.cookie = 'owner_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'client_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#142420] text-emerald-200 flex flex-col items-center justify-center p-8 text-xs font-semibold gap-3">
        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <span>Memverifikasi Akses Login Owner...</span>
      </div>
    );
  }

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Events', href: '/admin/events', icon: Calendar },
    { label: 'Clients', href: '/admin/clients', icon: Users },
    { label: 'Storage & Analytics', href: '/admin/storage', icon: HardDrive },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-[#1A2621] flex font-sans">
      {/* Sidebar Desktop - Dark Emerald Theme */}
      <aside className="hidden lg:flex w-64 bg-[#142420] text-[#E8F0E5] flex-col justify-between p-6 shrink-0 sticky top-0 h-screen shadow-xl">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3B6E5F] to-[#609986] p-0.5 shadow-md">
              <div className="w-full h-full bg-[#142420] rounded-[10px] flex items-center justify-center">
                <Camera className="w-5 h-5 text-[#8CB89F]" />
              </div>
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-tight text-white uppercase">Virtual Photobooth</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8CB89F] bg-[#8CB89F]/10 px-2 py-0.5 rounded-full border border-[#8CB89F]/20">
                Super Admin
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    isActive
                      ? 'bg-[#2A473E] text-white shadow-sm font-bold border-l-4 border-[#8CB89F]'
                      : 'text-[#A0B5AA] hover:text-white hover:bg-[#1E362F]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#8CB89F]' : 'text-[#82998C]'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="border-t border-[#233A33] pt-4 px-2">
          <div className="mb-3">
            <p className="text-xs font-bold text-white truncate">{userEmail}</p>
            <p className="text-[10px] text-[#82998C] uppercase tracking-wider">Owner Account</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#233A33] hover:bg-rose-900/30 text-rose-300 text-xs font-semibold transition-all cursor-pointer border border-rose-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Mobile Header */}
        <header className="lg:hidden h-16 bg-[#142420] border-b border-[#233A33] px-4 flex items-center justify-between sticky top-0 z-40 text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#8CB89F]" />
            <span className="font-bold text-sm">Virtual Photobooth</span>
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 text-[#A0B5AA]">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 bg-[#142420]/95 backdrop-blur-xl z-50 p-6 flex flex-col justify-between text-white">
            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold text-lg">Owner Navigation</span>
                <button onClick={() => setMobileOpen(false)} className="text-[#A0B5AA]">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium ${
                        isActive
                          ? 'bg-[#2A473E] text-white font-bold'
                          : 'text-[#A0B5AA] hover:bg-[#1E362F]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-[#8CB89F]" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </Link>
                  );
                })}
              </nav>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500/20 text-rose-300 font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        <main className="flex-1 p-6 sm:p-10 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
