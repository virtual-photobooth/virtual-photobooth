import Link from 'next/link';
import { Camera, ArrowRight, Smartphone, Sparkles, Image as ImageIcon, Mic, ShieldCheck, Heart } from 'lucide-react';

export default function RootPage() {
  return (
    <div className="min-h-screen bg-[#F9F6F0] text-[#2C2A29] flex flex-col justify-between font-sans selection:bg-[#B8926A] selection:text-white">
      {/* Header Elegan */}
      <header className="border-b border-[#E8E2D8] bg-[#F4EFE6]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E2D9CC] border border-[#D4A373]/40 flex items-center justify-center font-serif italic text-lg font-bold text-[#8C6D46] shadow-xs">
              VP
            </div>
            <div>
              <span className="font-serif font-bold text-lg text-[#2C2A29] tracking-tight">
                Virtual Photobooth
              </span>
              <p className="text-[10px] text-[#78716C] tracking-wider uppercase font-semibold">
                Platform Foto Acara
              </p>
            </div>
          </div>

          <Link
            href="/login"
            className="bg-[#2C2A29] hover:bg-[#1A1817] text-white font-medium text-xs tracking-wider uppercase px-5 py-2.5 rounded-full transition-all shadow-md flex items-center gap-2"
          >
            <span>Masuk ke Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24 text-center flex-1 flex flex-col justify-center relative">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F0EBE1] border border-[#E2D9CC] text-[#8C6D46] text-xs font-semibold uppercase tracking-wider mb-6 mx-auto">
          <Sparkles className="w-4 h-4" />
          <span>Satu Platform &bull; Banyak Kenangan Spesial</span>
        </div>

        <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-[#2C2A29] mb-6 leading-tight">
          Abadikan Momen Indah Acara Anda <br />
          <span className="italic text-[#8C6D46] font-normal">
            dengan Photobooth Digital Modern
          </span>
        </h1>

        <p className="text-[#78716C] text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-serif">
          Buat pengalaman berfoto yang berkesan untuk tamu pernikahan, ulang tahun, atau acara spesial Anda. Cukup scan QR code dari HP, tanpa perlu install aplikasi.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto bg-[#2C2A29] hover:bg-[#1A1817] text-white font-medium text-xs tracking-wider uppercase px-8 py-4 rounded-full shadow-xl flex items-center justify-center gap-3 transition-all cursor-pointer"
          >
            <span>Masuk ke Dashboard Pengelola</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 3 Fitur Utama (Bahasa Mudah Dipahami) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 text-left">
          {/* Card 1 */}
          <div className="p-8 rounded-3xl bg-[#F4EFE6] border border-[#E2D9CC] shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#E8E2D8] flex items-center justify-center text-[#8C6D46] mb-5">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#2C2A29] mb-2">
                Bingkai Foto Eksklusif
              </h3>
              <p className="text-[#78716C] text-xs leading-relaxed">
                Setiap acara memiliki desain bingkai foto unik sendiri. Hasil foto tamu langsung otomatis menyatu rapi dengan bingkai acara Anda.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-8 rounded-3xl bg-[#F4EFE6] border border-[#E2D9CC] shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#E8E2D8] flex items-center justify-center text-[#8C6D46] mb-5">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#2C2A29] mb-2">
                Praktis Lansung dari HP
              </h3>
              <p className="text-[#78716C] text-xs leading-relaxed">
                Tamu cukup scan QR Code di area acara untuk foto beruntun, mengambil hasil foto, dan langsung mengunduhnya ke galeri HP.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-8 rounded-3xl bg-[#F4EFE6] border border-[#E2D9CC] shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#E8E2D8] flex items-center justify-center text-[#8C6D46] mb-5">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#2C2A29] mb-2">
                Buku Tamu Pesan Suara
              </h3>
              <p className="text-[#78716C] text-xs leading-relaxed">
                Tamu juga bisa meninggalkan pesan suara hangat untuk penyelenggara acara, yang bisa didengarkan kembali kapan saja.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8E2D8] py-8 text-center text-xs text-[#78716C] font-serif">
        <p>Virtual Photobooth &copy; 2026. Simpan Setiap Senyum, Setiap Kata, Setiap Momen Berharga ♡</p>
      </footer>
    </div>
  );
}
