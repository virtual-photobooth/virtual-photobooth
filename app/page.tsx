'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Menu, X, Play, Pause, Volume2, Sparkles, Check } from 'lucide-react';

export default function RootPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const toggleVoice = () => {
    setIsPlayingVoice((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-white text-[#111111] flex flex-col font-sans selection:bg-[#111111] selection:text-white">
      {/* =========================================================================
          1. NAVBAR
          Minimalist, editorial, luxury fashion/lifestyle feel.
          ========================================================================= */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E5E5E5] transition-all">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          {/* Brand Logo (lowercase, clean typography) */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative w-5 h-7 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
              <Image
                src="/brand/crest.png"
                alt="sebuah.kenang crest"
                width={20}
                height={28}
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xl md:text-2xl font-light tracking-tight text-[#111111]">
              sebuah<span className="text-[#B88E44]">.</span>kenang
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-10 text-xs tracking-[0.15em] uppercase font-medium text-[#666666]">
            <a href="#how-it-works" className="hover:text-[#111111] transition-colors">
              How it works
            </a>
            <a href="#for-events" className="hover:text-[#111111] transition-colors">
              For Events
            </a>
            <a href="#pricing" className="hover:text-[#111111] transition-colors">
              Pricing
            </a>
          </nav>

          {/* Desktop CTA Button */}
          <div className="hidden md:flex items-center">
            <a
              href="https://wa.me/6285333050605?text=Halo%20sebuah.kenang%2C%20saya%20ingin%20reservasi%20dan%20konsultasi%20virtual%20photobooth%20untuk%20acara%20saya.%20Boleh%20info%20detail%20ketersediaan%20tanggalnya%3F"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#111111] hover:bg-neutral-800 text-white text-xs tracking-[0.15em] uppercase font-medium px-6 py-3 rounded-full transition-all duration-200 hover:shadow-sm"
            >
              Book Event
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Menu"
            className="md:hidden p-2 -mr-2 text-[#111111] hover:text-neutral-600 transition-colors focus:outline-hidden"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-[#E5E5E5] px-6 py-8 flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm tracking-[0.18em] uppercase font-medium text-[#111111]"
            >
              How it works
            </a>
            <a
              href="#for-events"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm tracking-[0.18em] uppercase font-medium text-[#111111]"
            >
              For Events
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm tracking-[0.18em] uppercase font-medium text-[#111111]"
            >
              Pricing
            </a>
            <div className="pt-4 border-t border-[#E5E5E5]">
              <a
                href="https://wa.me/6285333050605?text=Halo%20sebuah.kenang%2C%20saya%20ingin%20reservasi%20dan%20konsultasi%20virtual%20photobooth%20untuk%20acara%20saya.%20Boleh%20info%20detail%20ketersediaan%20tanggalnya%3F"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full bg-[#111111] text-white text-xs tracking-[0.18em] uppercase font-medium py-3.5 rounded-full flex items-center justify-center gap-2"
              >
                <span>Book Event</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================================
          2. HERO SECTION
          Full-width, editorial photography, powerful candid moment, minimal typography.
          ========================================================================= */}
      <section className="relative w-full bg-[#111111] overflow-hidden text-white">
        {/* Background Image Container with Editorial Scrim */}
        <div className="relative w-full min-h-[660px] sm:min-h-[680px] lg:min-h-[740px] flex items-center">
          <Image
            src="/landing/hero-hd.jpg"
            alt="Friends laughing candidly taking a selfie at an evening event"
            fill
            priority
            className="object-cover object-[70%_8%] md:object-center select-none"
          />

          {/* Editorial Ambient Gradient for Mobile (ensures 100% facial clarity in upper area, pristine readability at bottom) */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/90 via-48% to-transparent md:hidden pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent md:hidden pointer-events-none h-28" />

          {/* Hero Content Overlay */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 pt-8 sm:pt-16 pb-6 sm:pb-12 flex flex-col justify-between min-h-[660px] sm:min-h-[680px] lg:min-h-[740px]">
            {/* Top Row: Event Tags & Monogram */}
            <div className="flex items-start justify-between">
              {/* Subtle Brand Watermark Monogram */}
              <div className="flex items-center gap-2 text-white/50 text-[10px] tracking-[0.25em] uppercase font-mono">
                <span>[ 01 / 04 ]</span>
              </div>

              {/* Event Categories Tag List */}
              <div className="ml-auto text-right text-[9px] sm:text-[11px] tracking-[0.25em] uppercase font-medium text-white/80 leading-relaxed drop-shadow-sm">
                <div>Wedding</div>
                <div>Birthday</div>
                <div>Corporate</div>
                <div>Gathering</div>
                <div className="text-[#C5A880]">And More</div>
              </div>
            </div>

            {/* Middle/Bottom Row: Main Editorial Headline & CTA (Anchored to bottom on mobile so faces are never covered) */}
            <div className="mt-auto md:my-auto pt-20 md:pt-0 pb-4 md:py-8 max-w-xl">
              <h1 className="text-4xl sm:text-7xl lg:text-8xl font-normal tracking-tight text-white leading-[1.08] sm:leading-[1.05]">
                Keep <br />
                the moment<span className="text-[#C5A880]">.</span>
              </h1>

              <p className="mt-3 sm:mt-5 text-xs sm:text-base md:text-lg text-white/80 font-light max-w-sm sm:max-w-md leading-relaxed tracking-wide">
                Virtual photobooth for moments worth remembering.
              </p>

              <div className="mt-6 sm:mt-10 flex items-center gap-4">
                <a
                  href="https://wa.me/6285333050605?text=Halo%20sebuah.kenang%2C%20saya%20ingin%20reservasi%20dan%20konsultasi%20virtual%20photobooth%20untuk%20acara%20saya.%20Boleh%20info%20detail%20ketersediaan%20tanggalnya%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3 bg-white text-[#111111] hover:bg-neutral-100 text-xs sm:text-sm tracking-[0.15em] uppercase font-medium px-7 sm:px-8 py-3.5 sm:py-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <span>Book Your Event</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>

            {/* Bottom Row: Story Tagline & Pagination */}
            <div className="flex items-end justify-between text-xs tracking-wider text-white/70 pt-4 sm:pt-6 border-t border-white/10 mt-2 sm:mt-0">
              <div className="text-[10px] sm:text-[11px] tracking-[0.2em] uppercase font-mono text-white/60">
                <span>01 / 04</span>
              </div>

              <div className="text-right text-[11px] sm:text-sm font-light text-white/80 leading-snug">
                More than a photo. <br />
                <span className="text-white/60 italic">A story together.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. SECTION — THE EXPERIENCE
          Simpel. Bermakna.
          3 Editorial columns with smartphone and polaroid previews.
          ========================================================================= */}
      <section className="py-24 sm:py-32 bg-[#F7F7F5] border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left Column: Editorial Headline & Copy */}
            <div className="lg:col-span-4 lg:sticky lg:top-28">
              <span className="text-xs tracking-[0.25em] uppercase font-medium text-[#666666] block mb-3">
                The Experience
              </span>

              <h2 className="text-4xl sm:text-5xl font-light text-[#111111] tracking-tight leading-[1.1]">
                Simpel. <br />
                Bermakna<span className="text-[#B88E44]">.</span>
              </h2>

              <p className="mt-6 text-[#666666] text-sm sm:text-base leading-relaxed">
                Tamu cukup membuka link event, mengambil foto, meninggalkan pesan, dan menjadi bagian dari cerita kamu.
              </p>

              <div className="mt-8">
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase font-medium text-[#111111] hover:text-[#B88E44] transition-colors border-b border-[#111111] pb-1 hover:border-[#B88E44]"
                >
                  <span>Lihat Cara Kerjanya</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Right Column: 3 Flow Columns */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              {/* Card 01: OPEN */}
              <div className="bg-white border border-[#E5E5E5] p-6 sm:p-7 flex flex-col justify-between rounded-xs group hover:border-[#111111] transition-all duration-300">
                <div>
                  <span className="text-xs font-mono font-medium text-[#B88E44] block mb-1">
                    01
                  </span>
                  <h3 className="text-xl font-normal text-[#111111] tracking-tight">
                    Open
                  </h3>
                  <p className="text-xs text-[#666666] mt-2 leading-relaxed">
                    Tamu membuka link event melalui HP.
                  </p>
                </div>

                <div className="mt-8 relative aspect-4/5 w-full bg-[#F7F7F5] overflow-hidden rounded-xs border border-[#E5E5E5] flex items-center justify-center p-2">
                  <div className="relative w-full h-full">
                    <Image
                      src="/landing/exp-open-hd.jpg"
                      alt="Guest phone photobooth screen"
                      fill
                      className="object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                </div>
              </div>

              {/* Card 02: CAPTURE */}
              <div className="bg-white border border-[#E5E5E5] p-6 sm:p-7 flex flex-col justify-between rounded-xs group hover:border-[#111111] transition-all duration-300">
                <div>
                  <span className="text-xs font-mono font-medium text-[#B88E44] block mb-1">
                    02
                  </span>
                  <h3 className="text-xl font-normal text-[#111111] tracking-tight">
                    Capture
                  </h3>
                  <p className="text-xs text-[#666666] mt-2 leading-relaxed">
                    Ambil foto dengan frame pilihanmu.
                  </p>
                </div>

                <div className="mt-8 relative aspect-4/5 w-full bg-[#F7F7F5] overflow-hidden rounded-xs border border-[#E5E5E5] flex items-center justify-center p-2">
                  <div className="relative w-full h-full">
                    <Image
                      src="/landing/exp-capture-hd.jpg"
                      alt="Polaroid photo of friends laughing"
                      fill
                      className="object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                </div>
              </div>

              {/* Card 03: REMEMBER */}
              <div className="bg-white border border-[#E5E5E5] p-6 sm:p-7 flex flex-col justify-between rounded-xs group hover:border-[#111111] transition-all duration-300">
                <div>
                  <span className="text-xs font-mono font-medium text-[#B88E44] block mb-1">
                    03
                  </span>
                  <h3 className="text-xl font-normal text-[#111111] tracking-tight">
                    Remember
                  </h3>
                  <p className="text-xs text-[#666666] mt-2 leading-relaxed">
                    Foto, GIF, dan pesan suara tersimpan dalam satu tempat.
                  </p>
                </div>

                <div className="mt-8 relative aspect-4/5 w-full bg-[#F7F7F5] overflow-hidden rounded-xs border border-[#E5E5E5] flex items-center justify-center p-2">
                  <div className="relative w-full h-full">
                    <Image
                      src="/landing/exp-remember-hd.jpg"
                      alt="Digital gallery with voice note waveform"
                      fill
                      className="object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. SECTION — THE MEMORIES
          Lebih dari sekadar foto.
          3 Formats: PHOTO, GIF, VOICE NOTE
          ========================================================================= */}
      <section className="py-24 sm:py-32 bg-white border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Header / Intro */}
            <div className="lg:col-span-4 lg:sticky lg:top-28">
              <span className="text-xs tracking-[0.25em] uppercase font-medium text-[#666666] block mb-3">
                The Memories
              </span>

              <h2 className="text-4xl sm:text-5xl font-light text-[#111111] tracking-tight leading-[1.1]">
                Lebih dari <br />
                sekadar foto<span className="text-[#B88E44]">.</span>
              </h2>

              <p className="mt-6 text-[#666666] text-sm sm:text-base leading-relaxed">
                Foto, GIF, dan pesan suara dari para tamu. Semua terkumpul, semua bermakna.
              </p>

              <div className="mt-8">
                <a
                  href="https://wa.me/6285333050605?text=Halo%20sebuah.kenang%2C%20boleh%20minta%20katalog%20contoh%20hasil%20foto%20dan%20template%20acara%20lainnya%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase font-medium text-[#111111] hover:text-[#B88E44] transition-colors border-b border-[#111111] pb-1 hover:border-[#B88E44]"
                >
                  <span>Lihat Contoh Hasil</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* 3 Formats Grid */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
              {/* Feature 1: PHOTO */}
              <div className="group">
                <div className="relative aspect-4/3 w-full bg-[#F7F7F5] overflow-hidden border border-[#E5E5E5]">
                  <Image
                    src="/landing/mem-photo-hd.jpg"
                    alt="Couple framed moment"
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="mt-4">
                  <h3 className="text-xs tracking-[0.2em] uppercase font-semibold text-[#111111]">
                    Photo
                  </h3>
                  <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                    Your moment, <br className="hidden sm:inline" />
                    beautifully framed.
                  </p>
                </div>
              </div>

              {/* Feature 2: GIF */}
              <div className="group">
                <div className="relative aspect-4/3 w-full bg-[#F7F7F5] overflow-hidden border border-[#E5E5E5]">
                  <Image
                    src="/landing/mem-gif-hd.jpg"
                    alt="Photo strip GIF movement"
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="mt-4">
                  <h3 className="text-xs tracking-[0.2em] uppercase font-semibold text-[#111111]">
                    GIF
                  </h3>
                  <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                    A little movement <br className="hidden sm:inline" />
                    to remember it by.
                  </p>
                </div>
              </div>

              {/* Feature 3: VOICE NOTE */}
              <div className="group">
                <div className="relative aspect-4/3 w-full bg-[#111111] overflow-hidden border border-[#E5E5E5]">
                  <Image
                    src="/landing/mem-voice-hd.jpg"
                    alt="Guest smiling with voice note recording"
                    fill
                    className="object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                  />

                  {/* Interactive Waveform & Play Trigger Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4">
                    <button
                      onClick={toggleVoice}
                      className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 px-3 py-2 rounded-full flex items-center justify-between text-white text-xs transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-white text-[#111111] flex items-center justify-center">
                          {isPlayingVoice ? (
                            <Pause className="w-2.5 h-2.5 fill-current" />
                          ) : (
                            <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                          )}
                        </div>
                        <span className="text-[10px] tracking-wider uppercase font-mono">
                          {isPlayingVoice ? 'Playing...' : 'Voice Note'}
                        </span>
                      </div>

                      {/* Animated audio bars */}
                      <div className="flex items-center gap-0.5 h-3">
                        <span className={`w-0.5 bg-white rounded-full transition-all duration-300 ${isPlayingVoice ? 'h-3 animate-pulse' : 'h-1.5'}`} />
                        <span className={`w-0.5 bg-white rounded-full transition-all duration-300 ${isPlayingVoice ? 'h-4 animate-pulse delay-75' : 'h-2.5'}`} />
                        <span className={`w-0.5 bg-white rounded-full transition-all duration-300 ${isPlayingVoice ? 'h-2 animate-pulse delay-150' : 'h-1'}`} />
                        <span className={`w-0.5 bg-white rounded-full transition-all duration-300 ${isPlayingVoice ? 'h-3.5 animate-pulse delay-100' : 'h-3'}`} />
                        <span className={`w-0.5 bg-white rounded-full transition-all duration-300 ${isPlayingVoice ? 'h-1.5 animate-pulse delay-200' : 'h-1.5'}`} />
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-xs tracking-[0.2em] uppercase font-semibold text-[#111111]">
                    Voice Note
                  </h3>
                  <p className="text-xs text-[#666666] mt-1 leading-relaxed">
                    Words you’ll want <br className="hidden sm:inline" />
                    to hear again.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. SECTION — CUSTOM FRAME (MADE FOR YOUR MOMENT)
          Your event. Your frame.
          5 Clean Editorial Frames Gallery
          ========================================================================= */}
      <section className="py-24 sm:py-32 bg-[#F7F7F5] border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Header */}
            <div className="lg:col-span-4 lg:sticky lg:top-28">
              <span className="text-xs tracking-[0.25em] uppercase font-medium text-[#666666] block mb-3">
                Made For Your Moment
              </span>

              <h2 className="text-4xl sm:text-5xl font-light text-[#111111] tracking-tight leading-[1.1]">
                Your event. <br />
                Your frame<span className="text-[#B88E44]">.</span>
              </h2>

              <p className="mt-6 text-[#666666] text-sm sm:text-base leading-relaxed">
                Upload frame sendiri atau pilih dari koleksi kami. Sesuaikan dengan tema dan gaya event kamu.
              </p>

              <div className="mt-8">
                <a
                  href="https://wa.me/6285333050605?text=Halo%20sebuah.kenang%2C%20boleh%20dibantu%20katalog%20pilihan%20template%20frame%20dan%20panduan%20custom%20frame%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase font-medium text-[#111111] hover:text-[#B88E44] transition-colors border-b border-[#111111] pb-1 hover:border-[#B88E44]"
                >
                  <span>Lihat Semua Template</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* 5 Frames Exhibition Row */}
            <div className="lg:col-span-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5">
                {/* Frame 1: Minimal Monogram */}
                <div className="bg-white border border-[#E5E5E5] p-2 shadow-xs group hover:border-[#111111] transition-all">
                  <div className="relative aspect-3/4 w-full bg-white overflow-hidden flex flex-col justify-between p-3">
                    <Image
                      src="/landing/frame-1-hd.jpg"
                      alt="Minimal typography frame"
                      fill
                      className="object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="pt-2 text-center">
                    <span className="text-[10px] font-mono tracking-widest text-[#666666] uppercase">
                      01 / Monogram
                    </span>
                  </div>
                </div>

                {/* Frame 2: Celine & Brian Wedding */}
                <div className="bg-white border border-[#E5E5E5] p-2 shadow-xs group hover:border-[#111111] transition-all">
                  <div className="relative aspect-3/4 w-full bg-white overflow-hidden flex flex-col justify-between p-3">
                    <Image
                      src="/landing/frame-2-hd.jpg"
                      alt="Celine and Brian wedding frame"
                      fill
                      className="object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="pt-2 text-center">
                    <span className="text-[10px] font-mono tracking-widest text-[#666666] uppercase">
                      02 / Wedding
                    </span>
                  </div>
                </div>

                {/* Frame 3: Better Together */}
                <div className="bg-white border border-[#E5E5E5] p-2 shadow-xs group hover:border-[#111111] transition-all">
                  <div className="relative aspect-3/4 w-full bg-[#111111] overflow-hidden flex flex-col justify-between p-3">
                    <Image
                      src="/landing/frame-3-hd.jpg"
                      alt="Better together dark photo frame"
                      fill
                      className="object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="pt-2 text-center">
                    <span className="text-[10px] font-mono tracking-widest text-[#666666] uppercase">
                      03 / Editorial
                    </span>
                  </div>
                </div>

                {/* Frame 4: Good People Good Memories */}
                <div className="bg-white border border-[#E5E5E5] p-2 shadow-xs group hover:border-[#111111] transition-all">
                  <div className="relative aspect-3/4 w-full bg-white overflow-hidden flex flex-col justify-between p-3">
                    <Image
                      src="/landing/frame-4-hd.jpg"
                      alt="Good People Good Memories frame"
                      fill
                      className="object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="pt-2 text-center">
                    <span className="text-[10px] font-mono tracking-widest text-[#666666] uppercase">
                      04 / Typography
                    </span>
                  </div>
                </div>

                {/* Frame 5: Botanical Border */}
                <div className="bg-white border border-[#E5E5E5] p-2 shadow-xs group hover:border-[#111111] transition-all col-span-2 sm:col-span-1">
                  <div className="relative aspect-3/4 w-full bg-white overflow-hidden flex flex-col justify-between p-3">
                    <Image
                      src="/landing/frame-5-hd.jpg"
                      alt="Botanical vintage frame"
                      fill
                      className="object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="pt-2 text-center">
                    <span className="text-[10px] font-mono tracking-widest text-[#666666] uppercase">
                      05 / Botanical
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. SECTION — HOW IT WORKS
          01 Create your event
          02 Upload your frame
          03 Share the link
          04 Collect the memories
          ========================================================================= */}
      <section id="how-it-works" className="py-24 sm:py-32 bg-white border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Section Header */}
          <div className="max-w-2xl">
            <span className="text-xs tracking-[0.25em] uppercase font-medium text-[#666666] block mb-3">
              How It Works
            </span>
            <h2 className="text-4xl sm:text-5xl font-light text-[#111111] tracking-tight">
              Mudah untuk penyelenggara, <br />
              menyenangkan untuk tamu<span className="text-[#B88E44]">.</span>
            </h2>
          </div>

          {/* 4 Steps Grid */}
          <div className="mt-16 sm:mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
            {/* Step 1 */}
            <div className="border-t border-[#111111] pt-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-[#B88E44] block mb-3">
                  01
                </span>
                <h3 className="text-xl font-normal text-[#111111] tracking-tight">
                  Create your event
                </h3>
                <p className="mt-3 text-xs sm:text-sm text-[#666666] leading-relaxed">
                  Tentukan nama acara, tanggal, dan preferensi photobooth dalam hitungan detik dari dashboard pengelola.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="border-t border-[#111111] pt-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-[#B88E44] block mb-3">
                  02
                </span>
                <h3 className="text-xl font-normal text-[#111111] tracking-tight">
                  Upload your frame
                </h3>
                <p className="mt-3 text-xs sm:text-sm text-[#666666] leading-relaxed">
                  Gunakan desain bingkai PNG kustom sesuai identitas acara atau pilih kurasi template eksklusif kami.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="border-t border-[#111111] pt-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-[#B88E44] block mb-3">
                  03
                </span>
                <h3 className="text-xl font-normal text-[#111111] tracking-tight">
                  Share the link
                </h3>
                <p className="mt-3 text-xs sm:text-sm text-[#666666] leading-relaxed">
                  Cetak QR code untuk diletakkan di meja acara atau kirimkan link langsung ke tamu undangan tanpa perlu install aplikasi.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="border-t border-[#111111] pt-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-[#B88E44] block mb-3">
                  04
                </span>
                <h3 className="text-xl font-normal text-[#111111] tracking-tight">
                  Collect the memories
                </h3>
                <p className="mt-3 text-xs sm:text-sm text-[#666666] leading-relaxed">
                  Foto, GIF, dan rekaman pesan suara langsung tersimpan rapi dan dapat diunduh lengkap secara instan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. SECTION — FOR EVENT ORGANIZERS
          Full-width, moody candlelit gathering photo, editorial banner.
          ========================================================================= */}
      <section id="for-events" className="relative w-full bg-[#111111] text-white overflow-hidden">
        <div className="relative w-full min-h-[460px] sm:min-h-[520px] flex items-center">
          <Image
            src="/landing/organizers-hd.jpg"
            alt="Candlelit banquet dinner with elegant guests gathering"
            fill
            className="object-cover object-center select-none opacity-85"
          />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 py-20 flex flex-col md:flex-row items-start md:items-end justify-between gap-12">
            {/* Left Column */}
            <div className="max-w-xl">
              <span className="text-[11px] tracking-[0.25em] uppercase font-medium text-white/70 block mb-3">
                For Event Organizers
              </span>

              <h2 className="text-4xl sm:text-6xl font-light text-white tracking-tight leading-[1.05]">
                One link. <br />
                Every memory<span className="text-[#C5A880]">.</span>
              </h2>

              <p className="mt-5 text-sm sm:text-base text-white/80 font-light max-w-md leading-relaxed">
                Solusi sederhana untuk wedding, birthday, corporate event, gathering, atau momen spesial lainnya.
              </p>

              <div className="mt-8">
                <a
                  href="https://wa.me/6285333050605?text=Halo%20sebuah.kenang%2C%20saya%20dari%20event%20organizer%2Fvendor%20ingin%20diskusi%20mengenai%20virtual%20photobooth%20untuk%20event%20kami."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3 bg-white text-[#111111] hover:bg-neutral-100 text-xs tracking-[0.18em] uppercase font-medium px-8 py-4 rounded-full transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  <span>Hubungi Kami via WhatsApp</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>

            {/* Right Column: Brand watermark & mission */}
            <div className="text-left md:text-right">
              <div className="text-2xl sm:text-3xl font-light tracking-tight text-white">
                sebuah<span className="text-[#C5A880]">.</span>kenang
              </div>
              <div className="w-16 h-px bg-white/30 my-4 md:ml-auto" />
              <p className="text-[10px] tracking-[0.25em] uppercase font-mono text-white/60 max-w-xs">
                Some moments happen once. Make them a sebuah.kenang.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. SECTION — PRICING
          Minimalist, restrained, thin borders, generous whitespace.
          ========================================================================= */}
      <section id="pricing" className="py-24 sm:py-32 bg-[#F7F7F5] border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs tracking-[0.25em] uppercase font-medium text-[#666666] block mb-3">
              Pricing Plans
            </span>
            <h2 className="text-4xl sm:text-5xl font-light text-[#111111] tracking-tight">
              Investasi sederhana untuk momen tak ternilai<span className="text-[#B88E44]">.</span>
            </h2>
            <p className="mt-4 text-[#666666] text-sm sm:text-base">
              Transparan, tanpa biaya langganan berbelit. Pilih sesuai kebutuhan event Anda.
            </p>
          </div>

          {/* Pricing Tiers Grid */}
          <div className="mt-16 sm:mt-20 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Plan 1: Intimate */}
            <div className="bg-white border border-[#E5E5E5] p-8 sm:p-10 flex flex-col justify-between rounded-xs">
              <div>
                <span className="text-xs font-mono tracking-widest text-[#666666] uppercase">
                  Personal
                </span>
                <h3 className="text-2xl font-light text-[#111111] mt-2 tracking-tight">
                  Intimate Event
                </h3>
                <p className="text-xs text-[#666666] mt-3 leading-relaxed">
                  Ideal untuk acara ulang tahun, intimate dinner, arisan, atau bridal shower.
                </p>

                <div className="my-8 pb-8 border-b border-[#E5E5E5]">
                  <span className="text-3xl sm:text-4xl font-light text-[#111111] tracking-tight">
                    Custom
                  </span>
                  <span className="text-xs text-[#666666] block mt-1">per event</span>
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-[#444444]">
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                    <span>1 Custom PNG Frame Event</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                    <span>Unlimited Pengambilan Foto & GIF Tamu</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                    <span>Fitur Voice Note Guestbook</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                    <span>Galeri Online 30 Hari & Instant Download</span>
                  </li>
                </ul>
              </div>

              <div className="mt-10">
                <a
                  href="https://wa.me/6285333050605?text=Halo%20sebuah.kenang%2C%20saya%20ingin%20konsultasi%20dan%20cek%20ketersediaan%20tanggal%20untuk%20Paket%20Intimate%20Event."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center text-xs tracking-[0.18em] uppercase font-medium border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white py-3.5 rounded-full transition-all duration-200"
                >
                  Konsultasi via WhatsApp →
                </a>
              </div>
            </div>

            {/* Plan 2: Celebration (Wedding / Featured) */}
            <div className="bg-[#111111] text-white p-8 sm:p-10 flex flex-col justify-between rounded-xs relative shadow-xl">
              <div className="absolute top-4 right-4 bg-[#C5A880] text-[#111111] text-[9px] tracking-[0.2em] uppercase font-mono font-semibold px-2.5 py-1 rounded-full">
                Most Popular
              </div>

              <div>
                <span className="text-xs font-mono tracking-widest text-[#C5A880] uppercase">
                  Signature
                </span>
                <h3 className="text-2xl font-light text-white mt-2 tracking-tight">
                  Wedding & Celebration
                </h3>
                <p className="text-xs text-white/70 mt-3 leading-relaxed">
                  Pilihan terlengkap untuk pesta pernikahan, resepsi, atau selebrasi besar.
                </p>

                <div className="my-8 pb-8 border-b border-white/20">
                  <span className="text-3xl sm:text-4xl font-light text-white tracking-tight">
                    Exclusive
                  </span>
                  <span className="text-xs text-white/60 block mt-1">full package event</span>
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-white/90">
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#C5A880] shrink-0 mt-0.5" />
                    <span>Hingga 3 Pilihan Custom Frame</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#C5A880] shrink-0 mt-0.5" />
                    <span>Unlimited Foto, GIF, & High-Res Export</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#C5A880] shrink-0 mt-0.5" />
                    <span>Buku Tamu Voice Note & Audio Export</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#C5A880] shrink-0 mt-0.5" />
                    <span>Kartu Meja QR Code Siap Cetak (Printable PDF)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#C5A880] shrink-0 mt-0.5" />
                    <span>Batch Download Seluruh Galeri (ZIP)</span>
                  </li>
                </ul>
              </div>

              <div className="mt-10">
                <a
                  href="https://wa.me/6285333050605?text=Halo%20sebuah.kenang%2C%20saya%20tertarik%20dengan%20Paket%20Wedding%20%26%20Celebration%20untuk%20acara%20saya.%20Boleh%20dibantu%20info%20detail%20pricelist%20dan%20ketersediaan%20tanggalnya%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center text-xs tracking-[0.18em] uppercase font-medium bg-[#C5A880] text-[#111111] hover:bg-white py-3.5 rounded-full transition-all duration-200"
                >
                  Tanya Paket via WhatsApp →
                </a>
              </div>
            </div>

            {/* Plan 3: Corporate & Organizer */}
            <div className="bg-white border border-[#E5E5E5] p-8 sm:p-10 flex flex-col justify-between rounded-xs">
              <div>
                <span className="text-xs font-mono tracking-widest text-[#666666] uppercase">
                  Enterprise
                </span>
                <h3 className="text-2xl font-light text-[#111111] mt-2 tracking-tight">
                  Corporate & Vendors
                </h3>
                <p className="text-xs text-[#666666] mt-3 leading-relaxed">
                  Untuk Wedding Organizer, Event Agency, dan aktivasi brand korporat.
                </p>

                <div className="my-8 pb-8 border-b border-[#E5E5E5]">
                  <span className="text-3xl sm:text-4xl font-light text-[#111111] tracking-tight">
                    Partner
                  </span>
                  <span className="text-xs text-[#666666] block mt-1">multi-event license</span>
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-[#444444]">
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                    <span>Multi-Event Management Dashboard</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                    <span>Akses Client Portal Khusus Pemilik Acara</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                    <span>Branding Kustom & White-label Options</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                    <span>Dedicated Technical Support</span>
                  </li>
                </ul>
              </div>

              <div className="mt-10">
                <a
                  href="https://wa.me/6285333050605?text=Halo%20sebuah.kenang%2C%20kami%20dari%20instansi%2Fperusahaan%20ingin%20diskusi%20mengenai%20kerja%20sama%20untuk%20Paket%20Corporate%20%26%20Vendors."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center text-xs tracking-[0.18em] uppercase font-medium border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white py-3.5 rounded-full transition-all duration-200"
                >
                  Diskusi Kolaborasi →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          9. FOOTER
          Minimal, quiet, elegant.
          ========================================================================= */}
      <footer className="py-16 bg-white border-t border-[#E5E5E5] text-[#666666]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-12 border-b border-[#E5E5E5]">
            {/* Brand Logo & Philosophy */}
            <div>
              <Link href="/" className="inline-block text-xl font-light tracking-tight text-[#111111]">
                sebuah<span className="text-[#B88E44]">.</span>kenang
              </Link>
              <p className="text-xs text-[#666666] mt-2 max-w-sm leading-relaxed">
                Some moments happen once. <br />
                Make them a sebuah.kenang.
              </p>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs tracking-[0.15em] uppercase font-medium text-[#666666]">
              <a href="#how-it-works" className="hover:text-[#111111] transition-colors">
                How it works
              </a>
              <a href="#for-events" className="hover:text-[#111111] transition-colors">
                For Events
              </a>
              <a href="#pricing" className="hover:text-[#111111] transition-colors">
                Pricing
              </a>
              <a
                href="https://wa.me/6285333050605?text=Halo%20sebuah.kenang%2C%20saya%20ingin%20bertanya%20mengenai%20layanan%20virtual%20photobooth."
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#111111] transition-colors"
              >
                Contact
              </a>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-4 text-[#111111]">
              <a
                href="https://www.instagram.com/sebuah.kenang?stkn=MW4ycjFnNzVkbHdkMA=="
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram sebuah.kenang"
                className="w-10 h-10 rounded-full border border-[#E5E5E5] flex items-center justify-center hover:border-[#111111] hover:text-black transition-colors"
              >
                <svg className="w-4 h-4 fill-none stroke-current stroke-[1.75]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok sebuah.kenang"
                className="w-10 h-10 rounded-full border border-[#E5E5E5] flex items-center justify-center hover:border-[#111111] hover:text-black transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Copyright Row */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#999999] gap-4">
            <p>&copy; 2026 sebuah.kenang. All rights reserved.</p>
            <p className="text-[11px] font-mono tracking-wider">
              Virtual Photobooth &bull; Digital Memory Brand
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
