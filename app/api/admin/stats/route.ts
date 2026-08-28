import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();

    const [
      { count: totalEvents },
      { count: activeEvents },
      { count: totalClients },
      { count: totalGuests },
      { count: totalPhotos },
      { count: totalVoiceMessages },
      { data: eventsData },
    ] = await Promise.all([
      (supabaseAdmin.from('events') as any).select('*', { count: 'exact', head: true }),
      (supabaseAdmin.from('events') as any).select('*', { count: 'exact', head: true }).eq('status', 'active'),
      (supabaseAdmin.from('clients') as any).select('*', { count: 'exact', head: true }),
      (supabaseAdmin.from('guests') as any).select('*', { count: 'exact', head: true }),
      (supabaseAdmin.from('photos') as any).select('*', { count: 'exact', head: true }),
      (supabaseAdmin.from('voice_messages') as any).select('*', { count: 'exact', head: true }),
      (supabaseAdmin.from('events') as any)
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const photoCount = totalPhotos || 0;
    const voiceCount = totalVoiceMessages || 0;
    const estimatedGb = ((photoCount * 1.5 + voiceCount * 0.4) / 1024).toFixed(2);

    return NextResponse.json({
      success: true,
      stats: {
        totalEvents: totalEvents || 0,
        activeEvents: activeEvents || 0,
        totalClients: totalClients || 0,
        totalGuests: totalGuests || 0,
        totalPhotos: photoCount,
        totalVoiceMessages: voiceCount,
        storageUsageGb: estimatedGb,
      },
      recentEvents: eventsData || [],
    });
  } catch (err: any) {
    console.error('Error in /api/admin/stats:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
