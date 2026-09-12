import Link from 'next/link';
import Image from 'next/image';

export default function EventUnavailable() {
  return (
    <div className="min-h-screen w-full bg-[#F7F3EC] text-[#292624] flex flex-col justify-between items-center px-6 py-12 md:py-16 selection:bg-[#292624] selection:text-[#F7F3EC]">
      {/* Top Brand Logo */}
      <header className="w-full max-w-2xl flex justify-center pt-4 md:pt-8">
        <Link href="/" className="group flex flex-col items-center gap-3 transition-opacity hover:opacity-80">
          <div className="relative w-8 h-12 flex items-center justify-center">
            <Image
              src="/brand/crest.png"
              alt="sebuah.kenang crest"
              width={32}
              height={48}
              className="object-contain"
              priority
            />
          </div>
          <span className="text-xs tracking-[0.25em] uppercase font-light text-[#292624]">
            sebuah<span className="text-[#A27A49]">.</span>kenang
          </span>
        </Link>
      </header>

      {/* Main Editorial Content with Wide Whitespace */}
      <main className="w-full max-w-xl mx-auto my-auto text-center px-4 py-12 space-y-6">
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-[#292624] leading-tight">
          Sebuah kenang<br />
          telah selesai.
        </h1>

        <p className="text-sm sm:text-base text-[#292624]/75 font-light leading-relaxed max-w-md mx-auto">
          Link yang kamu buka sudah tidak aktif atau masa penyimpanannya telah berakhir.
        </p>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium tracking-wide text-[#A27A49] hover:text-[#886236] transition-colors group"
          >
            <span>Kembali ke sebuah.kenang</span>
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </main>

      {/* Subtle Footer Note */}
      <footer className="w-full max-w-2xl text-center pb-4 text-[11px] text-[#292624]/40 font-light tracking-wider">
        <span>Moments Worth Remembering</span>
      </footer>
    </div>
  );
}
