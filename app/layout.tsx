import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Virtual Photobooth — Modern, Minimal & Memorable",
  description: "Abadikan kenangan foto acara spesial Anda dengan bingkai eksklusif & pesan suara ucapan.",
  metadataBase: new URL("https://virtual-photobooth-taupe.vercel.app"),
  icons: {
    icon: [
      { url: "/icon.png", type: "image/jpeg" },
    ],
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Virtual Photobooth — Modern, Minimal & Memorable",
    description: "Abadikan kenangan foto acara spesial Anda dengan bingkai eksklusif & pesan suara ucapan.",
    url: "https://virtual-photobooth-taupe.vercel.app",
    siteName: "Virtual Photobooth",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Virtual Photobooth Official Logo",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Virtual Photobooth — Modern, Minimal & Memorable",
    description: "Abadikan kenangan foto acara spesial Anda dengan bingkai eksklusif & pesan suara ucapan.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
