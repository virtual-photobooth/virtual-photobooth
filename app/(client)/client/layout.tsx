import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal Penyelenggara — sebuah.kenang',
  description: 'Kelola foto, dengarkan pesan suara tamu, dan download seluruh arsip acara Anda.',
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#111111] flex flex-col font-sans selection:bg-[#111111] selection:text-white">
      {children}
    </div>
  );
}
