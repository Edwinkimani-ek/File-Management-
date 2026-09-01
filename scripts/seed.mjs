#!/usr/bin/env node
/**
 * Seeds two demo firms with users, clients, matters, diary entries and
 * fee notes, so every feature can be exercised the moment the schema is
 * applied.
 *
 * Two firms is the point: the pre-pilot security checklist asks you to
 * try reaching Firm B's records while signed in as Firm A, and that needs
 * a real second tenant with real ids to paste into the URL bar.
 *
 * Usage — note --env-file, since plain `node` does not read .env.local
 * the way Next.js does:
 *
 *   SEED_CONFIRM=yes node --env-file=.env.local scripts/seed.mjs
 *
 * Refuses to run unless SEED_CONFIRM=yes, because it writes with the
 * service role key and that key can just as easily be pointed at
 * production.
 */
import { createClient } from '@supabase/supabase-js';
import {
  demandLetterBuffer,
  saleAgreementBuffer,
  leaseAgreementBuffer,
  engagementLetterBuffer,
  witnessStatementBuffer,
} from './lib/docx-starters.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD ?? 'Wakili-Demo-2026';

if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n\n' +
      'Plain node does not read .env.local the way Next.js does, so point it at\n' +
      'the file explicitly:\n\n' +
      '  SEED_CONFIRM=yes node --env-file=.env.local scripts/seed.mjs\n',
  );
  process.exit(1);
}
if (process.env.SEED_CONFIRM !== 'yes') {
  console.error(
    `Refusing to seed ${url} without SEED_CONFIRM=yes.\n` +
      'Check that this is your staging project, not production, then re-run.',
  );
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const FIRM_A = '11111111-1111-4111-8111-111111111111';
const FIRM_B = '22222222-2222-4222-8222-222222222222';

const today = new Date();
const iso = (offsetDays) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

async function upsertFirm(id, fields) {
  const { error } = await db.from('firms').upsert({ id, ...fields });
  if (error) throw new Error(`firm ${fields.name}: ${error.message}`);
  return id;
}

/** Creates the auth user if it is not there, then its profile row. */
async function upsertUser({ firmId, email, fullName, role, phone }) {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let authUser = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!authUser) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw new Error(`auth user ${email}: ${error.message}`);
    authUser = data.user;
  }

  const { error } = await db.from('users').upsert({
    id: authUser.id,
    firm_id: firmId,
    full_name: fullName,
    email,
    phone: phone ?? null,
    role,
    status: 'active',
  });
  if (error) throw new Error(`profile ${email}: ${error.message}`);
  return authUser.id;
}

async function insertReturningId(table, row, matchColumns) {
  const query = db.from(table).select('id');
  for (const [column, value] of Object.entries(matchColumns)) query.eq(column, value);
  const { data: existing } = await query.maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await db.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id;
}

function safeTemplateFileName(name) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(-120) || 'template';
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function seedTemplates(firmId, createdBy) {
  const starters = [
    { name: 'Demand letter', description: 'Standard demand for payment.', builder: demandLetterBuffer },
    { name: 'Sale agreement (land)', description: 'Agreement for sale of land in Kenya.', builder: saleAgreementBuffer },
    { name: 'Lease agreement', description: 'Residential or commercial lease.', builder: leaseAgreementBuffer },
    { name: 'Letter of engagement', description: 'Client engagement and fee letter.', builder: engagementLetterBuffer },
    { name: 'Witness statement', description: 'Affidavit-style witness statement.', builder: witnessStatementBuffer },
  ];

  for (const starter of starters) {
    const { data: existing } = await db
      .from('templates')
      .select('id')
      .eq('firm_id', firmId)
      .eq('name', starter.name)
      .maybeSingle();
    if (existing) continue;

    const buffer = await starter.builder();
    const fileName = `${safeTemplateFileName(starter.name)}.docx`;
    const path = `${firmId}/${crypto.randomUUID()}-${fileName}`;

    const { error: uploadError } = await db.storage
      .from('templates')
      .upload(path, buffer, { contentType: DOCX_MIME, upsert: false });
    if (uploadError) throw new Error(`upload ${starter.name}: ${uploadError.message}`);

    const { error: insertError } = await db.from('templates').insert({
      firm_id: firmId,
      name: starter.name,
      description: starter.description,
      file_name: fileName,
      storage_path: path,
      mime_type: DOCX_MIME,
      size_bytes: buffer.byteLength,
      placeholders: [],
      is_starter: true,
      created_by: createdBy,
    });
    if (insertError) throw new Error(`insert ${starter.name}: ${insertError.message}`);
  }
}

async function main() {
  console.log(`Seeding ${url}`);

  await upsertFirm(FIRM_A, {
    name: 'Kimani & Company Advocates',
    address:
      'Bishops Garden Towers, 3rd Floor\nBishops Road, Upper Hill\nP.O. Box 40123–00100, Nairobi',
    phone: '+254 20 271 4400',
    email: 'admin@kimaniadvocates.co.ke',
    default_limitation_years: 3,
  });
  await upsertFirm(FIRM_B, {
    name: 'Ochieng, Mwangi & Associates',
    address:
      'Reinsurance Plaza, 8th Floor\nOginga Odinga Street\nP.O. Box 1290–40100, Kisumu',
    phone: '+254 57 202 3311',
    email: 'info@ochiengmwangi.co.ke',
  });

  // ---------------------------------------------------------- Firm A
  const partnerA = await upsertUser({
    firmId: FIRM_A, email: 'partner@firma.test',
    fullName: 'Grace Kimani', role: 'partner', phone: '+254 722 100 100',
  });
  const associateA = await upsertUser({
    firmId: FIRM_A, email: 'associate@firma.test',
    fullName: 'Brian Otieno', role: 'associate', phone: '+254 722 100 200',
  });
  const associateA2 = await upsertUser({
    firmId: FIRM_A, email: 'associate2@firma.test',
    fullName: 'Fatuma Hassan', role: 'associate', phone: '+254 722 100 300',
  });
  const clerkA = await upsertUser({
    firmId: FIRM_A, email: 'clerk@firma.test',
    fullName: 'Peter Njoroge', role: 'clerk', phone: '+254 722 100 400',
  });

  const clientA1 = await insertReturningId(
    'clients',
    {
      firm_id: FIRM_A, type: 'individual', full_name: 'Mary Wanjiku Kariuki',
      id_number: '21458796', kra_pin: 'A004587963X', phone: '+254 733 445 566',
      email: 'mwanjiku@example.co.ke',
      physical_address: 'House 14, Kiambu Road, Nairobi', created_by: partnerA,
    },
    { firm_id: FIRM_A, full_name: 'Mary Wanjiku Kariuki' },
  );
  const clientA2 = await insertReturningId(
    'clients',
    {
      firm_id: FIRM_A, type: 'company', full_name: 'Sunrise Millers Limited',
      id_number: 'CPR/2015/198442', kra_pin: 'P051234567M', phone: '+254 20 555 1200',
      email: 'legal@sunrisemillers.co.ke',
      physical_address: 'Industrial Area, Nairobi', created_by: partnerA,
    },
    { firm_id: FIRM_A, full_name: 'Sunrise Millers Limited' },
  );
  const clientA3 = await insertReturningId(
    'clients',
    {
      firm_id: FIRM_A, type: 'individual', full_name: 'Joseph Mutiso Mwendwa',
      id_number: '30114522', phone: '+254 711 909 090', created_by: associateA,
    },
    { firm_id: FIRM_A, full_name: 'Joseph Mutiso Mwendwa' },
  );

  const year = new Date().getFullYear();

  const matterA1 = await insertReturningId(
    'matters',
    {
      firm_id: FIRM_A, file_reference: `KM/CIV/045/${year}`, client_id: clientA1,
      title: 'Wanjiku v Kenya Power & Lighting Co. — claim for damages',
      practice_area: 'civil_litigation', court_station: 'Milimani Law Courts',
      court_case_number: `HCCC E${year}/238`,
      opposing_party: 'Kenya Power & Lighting Company PLC',
      opposing_advocates: 'Mbogo, Wafula & Partners Advocates',
      status: 'active', assigned_to: associateA, visibility: 'assigned_only',
      date_opened: iso(-120), cause_of_action_date: iso(-400),
      description:
        'Claim for special and general damages arising from injuries sustained on 12 May.',
      created_by: partnerA,
    },
    { firm_id: FIRM_A, file_reference: `KM/CIV/045/${year}` },
  );
  const matterA2 = await insertReturningId(
    'matters',
    {
      firm_id: FIRM_A, file_reference: `KM/CONV/012/${year}`, client_id: clientA2,
      title: 'Sunrise Millers — purchase of LR 209/14582, Industrial Area',
      practice_area: 'conveyancing', opposing_party: 'Hillside Properties Limited',
      opposing_advocates: 'Achieng & Co. Advocates', status: 'active',
      assigned_to: partnerA, visibility: 'firm_wide', date_opened: iso(-60),
      description: 'Acting for the purchaser. Completion documents with the vendor.',
      created_by: partnerA,
    },
    { firm_id: FIRM_A, file_reference: `KM/CONV/012/${year}` },
  );
  const matterA3 = await insertReturningId(
    'matters',
    {
      firm_id: FIRM_A, file_reference: `KM/EMP/003/${year}`, client_id: clientA3,
      title: 'Mwendwa v Bluewave Logistics — unfair termination',
      practice_area: 'employment', court_station: 'Employment and Labour Relations Court, Nairobi',
      court_case_number: `ELRC E${year}/91`, opposing_party: 'Bluewave Logistics Limited',
      status: 'active', assigned_to: associateA2, visibility: 'assigned_only',
      date_opened: iso(-30), created_by: associateA2,
    },
    { firm_id: FIRM_A, file_reference: `KM/EMP/003/${year}` },
  );
  // A closed file, so the read-only behaviour has something to act on.
  await insertReturningId(
    'matters',
    {
      firm_id: FIRM_A, file_reference: `KM/SUCC/007/${year - 1}`, client_id: clientA1,
      title: 'Estate of the late Samuel Kariuki — grant of letters of administration',
      practice_area: 'succession', court_station: 'Milimani Law Courts',
      status: 'closed', assigned_to: partnerA, visibility: 'firm_wide',
      date_opened: iso(-600), date_closed: iso(-40),
      closing_note: 'Grant confirmed and distributed. File to archive.',
      created_by: partnerA,
    },
    { firm_id: FIRM_A, file_reference: `KM/SUCC/007/${year - 1}` },
  );

  const diary = [
    {
      firm_id: FIRM_A, matter_id: matterA1, title: 'Hearing — plaintiff’s case',
      event_type: 'hearing', event_date: iso(3), event_time: '09:00:00',
      court_station: 'Milimani Law Courts', assigned_to: associateA,
      reminder_days_before: [7, 3, 1], created_by: partnerA,
    },
    {
      firm_id: FIRM_A, matter_id: matterA1, title: 'File and serve witness statements',
      event_type: 'filing_deadline', event_date: iso(1), assigned_to: associateA,
      reminder_days_before: [7, 3, 1], created_by: associateA,
    },
    {
      firm_id: FIRM_A, matter_id: matterA2, title: 'Completion meeting with vendor’s advocates',
      event_type: 'client_meeting', event_date: iso(6), event_time: '14:30:00',
      assigned_to: partnerA, reminder_days_before: [3, 1], created_by: partnerA,
    },
    {
      firm_id: FIRM_A, matter_id: matterA3, title: 'Mention — directions',
      event_type: 'mention', event_date: iso(12), event_time: '09:00:00',
      court_station: 'Employment and Labour Relations Court, Nairobi',
      assigned_to: associateA2, reminder_days_before: [7, 3, 1], created_by: associateA2,
    },
    {
      firm_id: FIRM_A, matter_id: matterA1, title: 'Limitation deadline — Wanjiku claim',
      event_type: 'limitation_deadline', event_date: iso(695), assigned_to: associateA,
      reminder_days_before: [90, 30, 7], created_by: partnerA,
      outcome_notes:
        'Calculated as 3 years from the cause of action. The advocate on the file must ' +
        'verify the applicable limitation period for this claim.',
    },
    {
      firm_id: FIRM_A, matter_id: matterA2, title: 'Overdue — chase vendor’s completion documents',
      event_type: 'other', event_date: iso(-4), assigned_to: partnerA,
      reminder_days_before: [3, 1], created_by: partnerA,
    },
  ];
  for (const event of diary) {
    await insertReturningId('diary_events', event, {
      firm_id: event.firm_id, title: event.title,
    });
  }

  // Fee notes. One draft, one approved-and-sent with a part payment, one
  // settled in full, so every status is represented on day one.
  const feeNoteDraft = await insertReturningId(
    'fee_notes',
    {
      firm_id: FIRM_A, matter_id: matterA1, client_id: clientA1,
      line_items: [
        { description: 'Instructions to sue; perusal of documents', amount: 5000000 },
        { description: 'Drawing plaint, verifying affidavit and list of documents', amount: 3500000 },
        { description: 'Filing fees and court disbursements', amount: 1250000 },
      ],
      vat_applicable: true, created_by: associateA,
    },
    { firm_id: FIRM_A, matter_id: matterA1 },
  );

  const feeNoteSent = await insertReturningId(
    'fee_notes',
    {
      firm_id: FIRM_A, matter_id: matterA2, client_id: clientA2,
      line_items: [
        { description: 'Perusal of sale agreement and title documents', amount: 7500000 },
        { description: 'Attending Lands Registry; registration of transfer', amount: 4000000 },
      ],
      vat_applicable: true, created_by: partnerA,
      notes: 'Payable within 30 days. M-Pesa paybill 400200, account SUNRISE.',
    },
    { firm_id: FIRM_A, matter_id: matterA2 },
  );

  const feeNotePaid = await insertReturningId(
    'fee_notes',
    {
      firm_id: FIRM_A, matter_id: matterA3, client_id: clientA3,
      line_items: [{ description: 'Instructions to file claim; drawing memorandum', amount: 4000000 }],
      vat_applicable: false, created_by: associateA2,
    },
    { firm_id: FIRM_A, matter_id: matterA3 },
  );

  // Approvals and payments go through the same columns the app writes,
  // so the triggers do the arithmetic exactly as they will in the pilot.
  await db.from('fee_notes')
    .update({ status: 'approved', approved_by: partnerA, approved_at: new Date().toISOString() })
    .in('id', [feeNoteSent, feeNotePaid]);
  await db.from('fee_notes')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .in('id', [feeNoteSent, feeNotePaid]);

  const { data: sentNote } = await db.from('fee_notes').select('total').eq('id', feeNoteSent).single();
  const { data: paidNote } = await db.from('fee_notes').select('total').eq('id', feeNotePaid).single();

  await insertReturningId(
    'payments',
    {
      firm_id: FIRM_A, fee_note_id: feeNoteSent, amount: Math.round(sentNote.total / 2),
      method: 'mpesa', reference: 'SFK4TR9QW1', payment_date: iso(-7), recorded_by: partnerA,
    },
    { fee_note_id: feeNoteSent },
  );
  await insertReturningId(
    'payments',
    {
      firm_id: FIRM_A, fee_note_id: feeNotePaid, amount: paidNote.total,
      method: 'bank', reference: 'FT26031400921', payment_date: iso(-3), recorded_by: partnerA,
    },
    { fee_note_id: feeNotePaid },
  );

  await seedTemplates(FIRM_A, partnerA);

  // ---------------------------------------------------------- Firm B
  const partnerB = await upsertUser({
    firmId: FIRM_B, email: 'partner@firmb.test',
    fullName: 'Alice Ochieng', role: 'partner', phone: '+254 733 200 100',
  });
  await upsertUser({
    firmId: FIRM_B, email: 'associate@firmb.test',
    fullName: 'Daniel Mwangi', role: 'associate',
  });

  const clientB1 = await insertReturningId(
    'clients',
    {
      firm_id: FIRM_B, type: 'individual', full_name: 'Rose Atieno Odhiambo',
      id_number: '28776541', phone: '+254 720 313 131', created_by: partnerB,
    },
    { firm_id: FIRM_B, full_name: 'Rose Atieno Odhiambo' },
  );
  const matterB1 = await insertReturningId(
    'matters',
    {
      firm_id: FIRM_B, file_reference: `OM/CIV/019/${year}`, client_id: clientB1,
      title: 'Odhiambo v Lakeside Sacco — recovery of deposits',
      practice_area: 'civil_litigation', court_station: 'Kisumu Law Courts',
      opposing_party: 'Lakeside Sacco Society Limited', status: 'active',
      assigned_to: partnerB, visibility: 'firm_wide', date_opened: iso(-45),
      created_by: partnerB,
    },
    { firm_id: FIRM_B, file_reference: `OM/CIV/019/${year}` },
  );
  await insertReturningId(
    'fee_notes',
    {
      firm_id: FIRM_B, matter_id: matterB1, client_id: clientB1,
      line_items: [{ description: 'Instructions and drawing demand letter', amount: 2500000 }],
      vat_applicable: false, created_by: partnerB,
    },
    { firm_id: FIRM_B, matter_id: matterB1 },
  );

  await seedTemplates(FIRM_B, partnerB);

  console.log('\nDone. Sign in with any of these (password: %s)\n', password);
  console.table([
    { firm: 'Kimani & Company', role: 'partner', email: 'partner@firma.test' },
    { firm: 'Kimani & Company', role: 'associate', email: 'associate@firma.test' },
    { firm: 'Kimani & Company', role: 'associate', email: 'associate2@firma.test' },
    { firm: 'Kimani & Company', role: 'clerk', email: 'clerk@firma.test' },
    { firm: 'Ochieng, Mwangi', role: 'partner', email: 'partner@firmb.test' },
    { firm: 'Ochieng, Mwangi', role: 'associate', email: 'associate@firmb.test' },
  ]);
  console.log('\nIds to paste into the URL bar for the cross-firm checks:');
  console.log('  Firm A matter :', matterA1);
  console.log('  Firm B matter :', matterB1);
  console.log('  Firm B client :', clientB1);
}

main().catch((error) => {
  console.error('\nSeed failed:', error.message);
  process.exit(1);
});
