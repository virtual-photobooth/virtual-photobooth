import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/client';
import { generateSlug } from '@/lib/utils/slug';
import GuestGalleryClient from '@/components/guest/GuestGalleryClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const normalizedSlug = generateSlug(decodedSlug);
  const supabase = createClient();

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

  const title = event ? `Wedding Memories Gallery — ${event.name}` : 'Virtual Photobooth Gallery';
  const description = event
    ? `Lihat galeri foto kenangan & dengarkan pesan suara ucapan tamu di ${event.name}`
    : 'Galeri album foto kenangan photobooth & pesan suara ucapan.';

  return {
    title,
    description,
  };
}

export default function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  return <GuestGalleryClient params={params} />;
}
