import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { validateEventSlug } from '@/lib/events/validate';
import GuestGalleryClient from '@/components/guest/GuestGalleryClient';
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
  const title = `Wedding Memories Gallery — ${event.name}`;
  const description = `Lihat galeri foto kenangan & dengarkan pesan suara ucapan tamu di ${event.name}`;

  return {
    title,
    description,
  };
}

export default async function DirectSlugGalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug).toLowerCase();

  if (RESERVED_SLUGS.has(decodedSlug)) {
    notFound();
  }

  const result = await validateEventSlug(slug, { useAdmin: true });

  if (!result.isValid || !result.event) {
    return <EventUnavailable />;
  }

  return <GuestGalleryClient params={params} />;
}
