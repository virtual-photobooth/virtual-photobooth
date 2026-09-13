import type { Metadata } from 'next';
import { validateEventSlug } from '@/lib/events/validate';
import { getStoragePublicUrl } from '@/lib/storage/url';
import { createAdminClient } from '@/lib/supabase/admin';
import { EventFrame } from '@/lib/types/database';
import GuestPhotoboothClient from '@/components/guest/GuestPhotoboothClient';
import EventUnavailable from '@/components/guest/EventUnavailable';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await validateEventSlug(slug, { useAdmin: true });

  if (!result.isValid || !result.event) {
    return {
      title: 'Sebuah kenang telah selesai — sebuah.kenang',
      description: 'Link yang kamu buka sudah tidak aktif atau masa penyimpanannya telah berakhir.',
    };
  }

  const event = result.event;

  // Cover photo URL or fallback OG Banner image
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
      url: `https://virtual-photobooth-taupe.vercel.app/event/${encodeURIComponent(event.slug)}`,
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

export const dynamic = 'force-dynamic';

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await validateEventSlug(slug, { useAdmin: true });

  if (!result.isValid || !result.event) {
    return <EventUnavailable />;
  }

  const cacheBuster = result.event.updated_at
    ? `?v=${new Date(result.event.updated_at).getTime()}`
    : '';

  const initialCoverUrl = result.event.cover_path
    ? `${getStoragePublicUrl(result.event.cover_path)}${cacheBuster}`
    : null;

  // Query event_frames: is_default DESC, sort_order ASC, created_at ASC
  const supabase = createAdminClient();
  const { data: dbFrames } = await (supabase.from('event_frames') as any)
    .select('*')
    .eq('event_id', result.event.id)
    .order('is_default', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  let initialFrames: EventFrame[] = (dbFrames || []).map((f: any) => {
    const pubUrl = f.frame_path ? `${getStoragePublicUrl(f.frame_path)}${cacheBuster}` : null;
    return {
      ...f,
      frameUrl: pubUrl,
      publicUrl: pubUrl,
    };
  });

  // Legacy fallback if no rows in event_frames but events.frame_path exists
  if (initialFrames.length === 0 && result.event.frame_path) {
    const fallbackUrl = `${getStoragePublicUrl(result.event.frame_path)}${cacheBuster}`;
    initialFrames = [
      {
        id: 'legacy-default',
        event_id: result.event.id,
        name: 'Default Frame',
        frame_path: result.event.frame_path,
        photo_count: result.event.photo_count || 4,
        sort_order: 0,
        is_default: true,
        created_at: result.event.created_at || new Date().toISOString(),
        updated_at: result.event.updated_at || new Date().toISOString(),
        frameUrl: fallbackUrl,
        publicUrl: fallbackUrl,
      },
    ];
  }

  const defaultFrame = initialFrames.find((f) => f.is_default) || initialFrames[0];
  const initialFrameUrl = defaultFrame?.publicUrl || (result.event.frame_path
    ? `${getStoragePublicUrl(result.event.frame_path)}${cacheBuster}`
    : null);

  return (
    <GuestPhotoboothClient
      params={params}
      initialEvent={result.event}
      initialCoverUrl={initialCoverUrl}
      initialFrameUrl={initialFrameUrl}
      initialFrames={initialFrames}
    />
  );
}
