'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Camera, Home, Users, Image as ImageIcon, Mic, Settings, LogOut } from 'lucide-react';

import { getClientScope } from '@/lib/utils/client-scope';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [monogram, setMonogram] = useState<string>('VP');
  const [eventName, setEventName] = useState<string>('Portal Klien');

  useEffect(() => {
    async function getUserAndEvent() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || 'Client Host');
      }

      try {
        const scope = await getClientScope(supabase);
        if (scope.events && scope.events.length > 0) {
          const activeEvt = scope.events[0];
          if (activeEvt.monogram) setMonogram(activeEvt.monogram);
          if (activeEvt.name) setEventName(activeEvt.name);
        }
      } catch (e) {
        console.warn('Failed to fetch monogram:', e);
      }
    }
    getUserAndEvent();
  }, [supabase]);

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('client_session');
      document.cookie = 'client_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'Overview', href: '/client', icon: Home },
    { label: 'Guests', href: '/client/guests', icon: Users },
    { label: 'Photos', href: '/client/photos', icon: ImageIcon },
    { label: 'Voice Messages', href: '/client/voice', icon: Mic },
  ];

  return (
    <div className="min-h-screen bg-[#F9F6F0] text-[#2C2A29] flex flex-col font-sans selection:bg-[#B8926A] selection:text-white">
      {/* Editorial Header */}
      <header className="border-b border-[#E8E2D8] bg-[#F4EFE6]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E2D9CC] border border-[#D4A373]/30 flex items-center justify-center font-serif italic text-sm font-bold text-[#8C6D46] px-1 text-center truncate">
              {monogram}
            </div>
            <div>
              <h2 className="font-serif font-bold text-base text-[#2C2A29] max-w-[180px] sm:max-w-xs truncate">
                {eventName}
              </h2>
              <span className="text-[10px] uppercase tracking-wider text-[#78716C]">Client Host View</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition-all ${
                    isActive
                      ? 'bg-[#8C6D46] text-white shadow-md'
                      : 'text-[#78716C] hover:text-[#2C2A29] hover:bg-[#E8E2D8]/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#E8E2D8] hover:bg-[#E2D9CC] text-xs font-semibold text-[#2C2A29] cursor-pointer transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-10">{children}</main>
    </div>
  );
}
