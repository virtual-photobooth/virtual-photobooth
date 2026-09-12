import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { validateEventSlug } from '@/lib/events/validate';
import { getStoragePublicUrl } from '@/lib/storage/url';
import GuestPhotoboothClient from '@/components/guest/GuestPhotoboothClient';
import EventUnavailable from '@/components/guest/EventUnavailable';

const RESERVED_SLUGS = new Set([
  'admin',
  'client',
  'login',
  'owner-login',
  'api',
  'event',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'brand',
  'landing',
  '_next',
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug).toLowerCase();

  if (RESERVED_SLUGS.has(decodedSlug)) {
    return {};
  }

  const result = await validateEventSlug(slug, { useAdmin: true });

  if (!result.isValid || !result.event) {
    return {
      title: 'Sebuah kenang telah selesai — sebuah.kenang',
      description: 'Link yang kamu buka sudah tidak aktif atau masa penyimpanannya telah berakhir.',
    };
  }

  const event = result.event;

  let coverUrl = 'https://virtual-photobooth-taupe.vercel.app/og-image.png';
  if (event.cover_path) {
    const publicUrl = getStoragePublicUrl(event.cover_path);
    if (publicUrl) {
      const resolvedCover = publicUrl.startsWith('http')
        ? publicUrl
        : `https://virtual-photobooth-taupe.vercel.app${publicUrl}`;
      coverUrl = `${resolvedCover}?t=${Date.now()}`;
    }
  }

  const title = `${event.name} — sebuah.kenang`;
  const description = event.subtitle
    ? `Abadikan kenangan foto ${event.name} (${event.subtitle}) & tinggalkan pesan suara ucapan!`
    : `Abadikan kenangan foto ${event.name} & tinggalkan pesan suara ucapan!`;

  return {
    title,
    description,
    metadataBase: new URL('https://virtual-photobooth-taupe.vercel.app'),
    openGraph: {
      title,
      description,
      url: `https://virtual-photobooth-taupe.vercel.app/${encodeURIComponent(event.slug)}`,
      siteName: 'sebuah.kenang',
      images: [
        {
          url: coverUrl,
          width: 1200,
          height: 630,
          alt: event.name,
        },
      ],
      locale: 'id_ID',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [coverUrl],
    },
  };
}

export default async function DirectSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug).toLowerCase();

  if (RESERVED_SLUGS.has(decodedSlug)) {
    notFound();
  }

  const result = await validateEventSlug(slug, { useAdmin: true });

  if (!result.isValid || !result.event) {
    return <EventUnavailable />;
  }

  return <GuestPhotoboothClient params={params} initialEvent={result.event} />;
}
