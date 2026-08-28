import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/client';
import { generateSlug } from '@/lib/utils/slug';
import GuestPhotoboothClient from '@/components/guest/GuestPhotoboothClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const normalizedSlug = generateSlug(decodedSlug);
  const supabase = createClient();

  // Fetch event from Supabase database
  let { data: event } = await (supabase.from('events') as any)
    .select('*')
    .eq('slug', decodedSlug)
    .maybeSingle();

  if (!event && normalizedSlug) {
    const { data: normData } = await (supabase.from('events') as any)
      .select('*')
      .eq('slug', normalizedSlug)
      .maybeSingle();
    if (normData) event = normData;
  }

  if (!event) {
    const { data: ilikeData } = await (supabase.from('events') as any)
      .select('*')
      .ilike('slug', decodedSlug)
      .maybeSingle();
    if (ilikeData) event = ilikeData;
  }

  if (!event) {
    return {
      title: 'Virtual Photobooth — Premium Event Experience',
      description: 'Abadikan kenangan foto acara spesial Anda & tinggalkan pesan suara langsung dengan bingkai eksklusif.',
    };
  }

  // Cover photo URL or fallback OG Banner image
  let coverUrl = 'https://virtual-photobooth-taupe.vercel.app/og-image.png';
  if (event.cover_path) {
    const { data: coverData } = supabase.storage
      .from('virtual-photobooth')
      .getPublicUrl(event.cover_path);
    if (coverData?.publicUrl) {
      coverUrl = `${coverData.publicUrl}?t=${Date.now()}`;
    }
  }

  const title = `${event.name} — Virtual Photobooth`;
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
      url: `https://virtual-photobooth-taupe.vercel.app/event/${encodeURIComponent(event.slug)}`,
      siteName: 'Virtual Photobooth',
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

export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  return <GuestPhotoboothClient params={params} />;
}
