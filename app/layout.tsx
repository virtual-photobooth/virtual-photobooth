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
  title: "Virtual Photobooth — Premium Event Experience",
  description: "Abadikan kenangan foto acara spesial Anda & tinggalkan pesan suara langsung dengan bingkai eksklusif.",
  metadataBase: new URL("https://virtual-photobooth-taupe.vercel.app"),
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Virtual Photobooth — Premium Event Experience",
    description: "Abadikan kenangan foto acara spesial Anda & tinggalkan pesan suara langsung dengan bingkai eksklusif.",
    url: "https://virtual-photobooth-taupe.vercel.app",
    siteName: "Virtual Photobooth",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Virtual Photobooth Luxury Event Experience",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Virtual Photobooth — Premium Event Experience",
    description: "Abadikan kenangan foto acara spesial Anda & tinggalkan pesan suara langsung dengan bingkai eksklusif.",
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
