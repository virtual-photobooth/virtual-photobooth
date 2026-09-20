import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.sebuahkenang.com";

export const metadata: Metadata = {
  title: {
    default: "sebuah.kenang — Virtual Photobooth Wedding & Event Momen Spesial",
    template: "%s | sebuah.kenang",
  },
  description:
    "Platform virtual photobooth pernikahan (wedding) dan event interaktif di Indonesia. Abadikan momen berharga dengan foto, GIF, dan audio guestbook instan via scan QR code tanpa install aplikasi.",
  keywords: [
    "virtual photobooth",
    "virtual photobooth wedding",
    "photobooth pernikahan",
    "photobooth online",
    "digital photobooth",
    "photobooth barcode wedding",
    "photobooth qr code",
    "jasa virtual photobooth pernikahan",
    "audio guestbook wedding",
    "digital guestbook pernikahan",
    "souvenir foto digital pernikahan",
    "virtual photobooth indonesia",
    "sebuah kenang",
  ],
  authors: [{ name: "sebuah.kenang" }],
  creator: "sebuah.kenang",
  publisher: "sebuah.kenang",
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: baseUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "google7c378d00a4a343d8",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "sebuah.kenang — Virtual Photobooth Wedding & Event Momen Spesial",
    description:
      "Virtual photobooth pernikahan (wedding) dan event interaktif di Indonesia. Abadikan momen dengan foto, GIF, dan audio guestbook instan via scan QR code.",
    url: baseUrl,
    siteName: "sebuah.kenang",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "sebuah.kenang — Virtual Photobooth Wedding & Event Momen Spesial",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "sebuah.kenang — Virtual Photobooth Wedding & Event Momen Spesial",
    description:
      "Virtual photobooth pernikahan (wedding) dan event interaktif di Indonesia. Abadikan momen dengan foto, GIF, dan audio guestbook instan via scan QR code.",
    images: ["/og-image.png"],
  },
};

const jsonLdData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService",
      "@id": `${baseUrl}/#organization`,
      name: "sebuah.kenang",
      alternateName: ["Sebuah Kenang", "Virtual Photobooth sebuah.kenang"],
      url: baseUrl,
      logo: `${baseUrl}/icon.png`,
      image: `${baseUrl}/og-image.png`,
      description:
        "Platform virtual photobooth modern untuk wedding (pernikahan), birthday, dan corporate event di Indonesia. Dilengkapi foto kustom frame, GIF, dan audio guestbook tanpa aplikasi.",
      address: {
        "@type": "PostalAddress",
        addressCountry: "ID",
      },
      sameAs: [
        "https://www.instagram.com/sebuah.kenang",
      ],
      priceRange: "$$",
      areaServed: {
        "@type": "Country",
        name: "Indonesia",
      },
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Paket Virtual Photobooth",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Virtual Photobooth Wedding & Celebration",
              description: "Layanan photobooth digital via scan QR code untuk resepsi pernikahan dan selebrasi dengan custom frame, GIF, dan audio guestbook.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Virtual Photobooth Intimate & Birthday",
              description: "Solusi virtual photobooth untuk perayaan intim, engagement, dan ulang tahun.",
            },
          },
        ],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${baseUrl}/#website`,
      url: baseUrl,
      name: "sebuah.kenang",
      description: "Virtual Photobooth Wedding & Event Momen Spesial",
      inLanguage: "id-ID",
    },
    {
      "@type": "FAQPage",
      "@id": `${baseUrl}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Apa itu virtual photobooth untuk wedding dan event?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Virtual photobooth adalah teknologi photobooth digital berbasis web di mana tamu undangan cukup memindai (scan) QR code menggunakan smartphone mereka sendiri tanpa perlu download atau instal aplikasi. Tamu dapat berfoto dengan frame kustom bertema wedding, merekam GIF, dan mengirim pesan audio guestbook secara langsung.",
          },
        },
        {
          "@type": "Question",
          name: "Apakah tamu undangan perlu mengunduh atau install aplikasi?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Tidak perlu sama sekali. Tamu hanya perlu membuka kamera smartphone, memindai barcode / QR code yang ada di meja atau signage acara, dan web photobooth langsung terbuka secara instan di browser ponsel mereka.",
          },
        },
        {
          "@type": "Question",
          name: "Apakah frame foto bisa dikustomisasi sesuai tema pernikahan kami?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Ya, sangat bisa. Desain frame dapat dikustomisasi sepenuhnya mengikuti tema warna, monogram, nama kedua mempelai, tanggal acara, serta font pernikahan Anda.",
          },
        },
        {
          "@type": "Question",
          name: "Berapa lama galeri foto dan rekaman suara tamu tersimpan?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Semua foto, GIF, dan pesan suara dari para tamu tersimpan aman di cloud gallery selama 1 tahun penuh, dan penyelenggara/pengantin dapat mengunduh seluruh file resolusi tinggi (High Resolution ZIP) kapan saja melalui Client Portal.",
          },
        },
        {
          "@type": "Question",
          name: "Bagaimana cara memesan layanan sebuah.kenang untuk pernikahan atau acara?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Anda dapat langsung menghubungi tim kami melalui WhatsApp untuk konsultasi tanggal, pemilihan paket, dan pengiriman aset desain frame pernikahan Anda.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
