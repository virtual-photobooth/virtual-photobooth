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

export const metadata: Metadata = {
  title: "sebuah.kenang — Virtual Photobooth for Moments Worth Remembering",
  description: "Virtual photobooth untuk momen yang layak dikenang. Simpan foto, GIF, dan pesan suara dari setiap tamu acara dalam satu tempat.",
  metadataBase: new URL("https://virtual-photobooth-taupe.vercel.app"),
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "sebuah.kenang — Virtual Photobooth for Moments Worth Remembering",
    description: "Virtual photobooth untuk momen yang layak dikenang. Simpan foto, GIF, dan pesan suara dari setiap tamu acara dalam satu tempat.",
    url: "https://virtual-photobooth-taupe.vercel.app",
    siteName: "sebuah.kenang",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "sebuah.kenang Official Logo",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "sebuah.kenang — Virtual Photobooth for Moments Worth Remembering",
    description: "Virtual photobooth untuk momen yang layak dikenang. Simpan foto, GIF, dan pesan suara dari setiap tamu acara dalam satu tempat.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
