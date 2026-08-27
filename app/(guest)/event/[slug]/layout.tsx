import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Virtual Photobooth',
  description: 'Capture photobooth memories and leave voice messages',
};

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F4EF] text-[#2C2A29] flex flex-col items-center justify-center font-sans antialiased selection:bg-[#D4A373] selection:text-white">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-md min-h-screen sm:min-h-[92vh] sm:my-4 sm:rounded-[40px] sm:shadow-2xl sm:border sm:border-[#E8E2D8] bg-[#F9F6F0] flex flex-col overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
