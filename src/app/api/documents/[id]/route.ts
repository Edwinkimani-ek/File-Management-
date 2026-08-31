import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { SIGNED_URL_TTL_SECONDS } from '@/lib/storage';

/**
 * Hands out a short-lived signed URL for a document and records the fact
 * in the activity log.
 *
 * The lookup runs as the signed-in user, so a document id belonging to
 * another firm — or to a matter this user is not on — simply returns no
 * row and this answers 404. Nothing is ever served from a public bucket.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const download = new URL(request.url).searchParams.get('download') === '1';
  const supabase = createClient();

  const { data: document } = await supabase
    .from('documents')
    .select('id, file_name, storage_path, matter_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: download ? document.file_name : undefined,
    });

  if (error || !signed) {
    return NextResponse.json({ error: 'Could not prepare that file' }, { status: 403 });
  }

  await logActivity(supabase, {
    firmId: session.firm.id,
    userId: session.user.id,
    action: download ? 'document.downloaded' : 'document.viewed',
    entityType: 'document',
    entityId: document.id,
    matterId: document.matter_id,
    detail: document.file_name,
  });

  // The signed URL expires in ten minutes; nothing about it may be cached.
  return NextResponse.redirect(signed.signedUrl, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
