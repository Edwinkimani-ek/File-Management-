import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { renderFeeNotePdf } from '@/lib/feeNotePdf';
import type { FeeNote } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Renders a fee note as a PDF on the firm's letterhead. The lookup runs as
 * the signed-in user, so a clerk — who has no select policy on fee_notes —
 * gets a 404 here just as they do everywhere else, and so does anyone
 * pasting an id from another firm.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const supabase = createClient();

  const { data: feeNote } = await supabase
    .from('fee_notes')
    .select(
      '*, clients:client_id (full_name, physical_address),' +
        ' matters:matter_id (file_reference, title, court_case_number)',
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!feeNote) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const record = feeNote as unknown as FeeNote & {
    clients: { full_name: string; physical_address: string | null } | null;
    matters: { file_reference: string; title: string; court_case_number: string | null } | null;
  };

  const { data: payments } = await supabase
    .from('payments')
    .select('payment_date, method, reference, amount')
    .eq('fee_note_id', record.id)
    .order('payment_date');

  let logo: { bytes: Uint8Array; mimeType: string } | null = null;
  if (session.firm.logo_url) {
    const { data: file } = await supabase.storage.from('logos').download(session.firm.logo_url);
    if (file) {
      logo = {
        bytes: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type || 'image/png',
      };
    }
  }

  const pdf = await renderFeeNotePdf({
    firm: session.firm,
    feeNote: record,
    clientName: record.clients?.full_name ?? 'Client',
    clientAddress: record.clients?.physical_address ?? null,
    matterReference: record.matters?.file_reference ?? '',
    matterTitle: record.matters?.title ?? '',
    courtCaseNumber: record.matters?.court_case_number ?? null,
    logo,
    payments: payments ?? [],
  });

  await logActivity(supabase, {
    firmId: session.firm.id,
    userId: session.user.id,
    action: 'fee_note.pdf_downloaded',
    entityType: 'fee_note',
    entityId: record.id,
    matterId: record.matter_id,
    detail: record.fee_note_number,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${record.fee_note_number ?? 'fee-note'}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
