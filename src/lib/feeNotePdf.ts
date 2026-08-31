import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { formatKes } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import type { FeeNote, Firm } from '@/lib/types';

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const INK = rgb(0.12, 0.15, 0.2);
const MUTED = rgb(0.36, 0.44, 0.57);
const RULE = rgb(0.81, 0.85, 0.89);
const BRAND = rgb(0.145, 0.396, 0.318);

export interface FeeNotePdfInput {
  firm: Firm;
  feeNote: FeeNote;
  clientName: string;
  clientAddress: string | null;
  matterReference: string;
  matterTitle: string;
  courtCaseNumber: string | null;
  logo: { bytes: Uint8Array; mimeType: string } | null;
  payments: { payment_date: string; method: string; reference: string | null; amount: number }[];
}

/**
 * Builds the fee note as a PDF on the firm's letterhead. All amounts are
 * rendered through formatKes, so the document reads "KSh 150,000.00" the
 * way a Kenyan bill of costs does.
 */
export async function renderFeeNotePdf(input: FeeNotePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const newPage = () => {
    page = pdf.addPage(A4);
    y = A4[1] - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 60) newPage();
  };

  // ------------------------------------------------------- letterhead
  if (input.logo) {
    try {
      const image =
        input.logo.mimeType === 'image/png'
          ? await pdf.embedPng(input.logo.bytes)
          : await pdf.embedJpg(input.logo.bytes);
      const height = 46;
      const width = (image.width / image.height) * height;
      page.drawImage(image, { x: MARGIN, y: y - height, width, height });
      y -= height + 12;
    } catch {
      // A logo that will not embed must not cost the firm its fee note.
    }
  }

  page.drawText(input.firm.name, { x: MARGIN, y: y - 16, size: 16, font: bold, color: BRAND });
  y -= 22;

  for (const line of [input.firm.address, contactLine(input.firm)].filter(Boolean) as string[]) {
    for (const wrapped of wrap(line, regular, 9, A4[0] - MARGIN * 2)) {
      page.drawText(wrapped, { x: MARGIN, y: y - 10, size: 9, font: regular, color: MUTED });
      y -= 12;
    }
  }

  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4[0] - MARGIN, y },
    thickness: 1,
    color: BRAND,
  });
  y -= 26;

  // ------------------------------------------------------------ title
  page.drawText('FEE NOTE', { x: MARGIN, y, size: 14, font: bold, color: INK });
  page.drawText(input.feeNote.fee_note_number ?? '', {
    x: A4[0] - MARGIN - bold.widthOfTextAtSize(input.feeNote.fee_note_number ?? '', 12),
    y,
    size: 12,
    font: bold,
    color: INK,
  });
  y -= 24;

  // ------------------------------------------------ parties and matter
  const details: [string, string][] = [
    ['To', input.clientName],
    ...(input.clientAddress ? ([['Address', input.clientAddress]] as [string, string][]) : []),
    ['Date', formatDate(input.feeNote.created_at)],
    ['Our reference', input.matterReference],
    ['Matter', input.matterTitle],
    ...(input.courtCaseNumber
      ? ([['Court case number', input.courtCaseNumber]] as [string, string][])
      : []),
  ];

  for (const [label, value] of details) {
    ensure(16);
    page.drawText(label, { x: MARGIN, y, size: 9, font: bold, color: MUTED });
    const lines = wrap(value, regular, 10, A4[0] - MARGIN * 2 - 120);
    lines.forEach((line, index) => {
      page.drawText(line, { x: MARGIN + 120, y: y - index * 12, size: 10, font: regular, color: INK });
    });
    y -= Math.max(16, lines.length * 12 + 4);
  }

  y -= 12;

  // ------------------------------------------------------- line items
  const amountRight = A4[0] - MARGIN;
  const descriptionWidth = A4[0] - MARGIN * 2 - 120;

  page.drawText('Particulars', { x: MARGIN, y, size: 9, font: bold, color: MUTED });
  page.drawText('Amount', {
    x: amountRight - bold.widthOfTextAtSize('Amount', 9),
    y,
    size: 9,
    font: bold,
    color: MUTED,
  });
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: amountRight, y }, thickness: 0.75, color: RULE });
  y -= 16;

  for (const item of input.feeNote.line_items) {
    const lines = wrap(item.description, regular, 10, descriptionWidth);
    ensure(lines.length * 13 + 8);
    lines.forEach((line, index) => {
      page.drawText(line, { x: MARGIN, y: y - index * 13, size: 10, font: regular, color: INK });
    });
    const amount = formatKes(item.amount);
    page.drawText(amount, {
      x: amountRight - regular.widthOfTextAtSize(amount, 10),
      y,
      size: 10,
      font: regular,
      color: INK,
    });
    y -= lines.length * 13 + 6;
  }

  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: amountRight, y }, thickness: 0.75, color: RULE });
  y -= 18;

  const totals: [string, string, boolean][] = [
    ['Subtotal', formatKes(input.feeNote.subtotal), false],
    ...(input.feeNote.vat_applicable
      ? ([[
          `VAT at ${(input.firm.vat_rate_bp / 100).toFixed(input.firm.vat_rate_bp % 100 === 0 ? 0 : 2)}%`,
          formatKes(input.feeNote.vat_amount),
          false,
        ]] as [string, string, boolean][])
      : []),
    ['Total', formatKes(input.feeNote.total), true],
    ...(input.feeNote.amount_paid > 0
      ? ([
          ['Paid', formatKes(input.feeNote.amount_paid), false],
          ['Balance due', formatKes(input.feeNote.total - input.feeNote.amount_paid), true],
        ] as [string, string, boolean][])
      : []),
  ];

  for (const [label, value, emphasised] of totals) {
    ensure(18);
    const font = emphasised ? bold : regular;
    const size = emphasised ? 11 : 10;
    page.drawText(label, { x: amountRight - 260, y, size, font, color: INK });
    page.drawText(value, {
      x: amountRight - font.widthOfTextAtSize(value, size),
      y,
      size,
      font,
      color: INK,
    });
    y -= emphasised ? 20 : 16;
  }

  // --------------------------------------------------------- payments
  if (input.payments.length > 0) {
    y -= 14;
    ensure(40);
    page.drawText('Payments received', { x: MARGIN, y, size: 10, font: bold, color: INK });
    y -= 16;
    for (const payment of input.payments) {
      ensure(16);
      const line = `${formatDate(payment.payment_date)} · ${payment.method}${
        payment.reference ? ` · ${payment.reference}` : ''
      }`;
      page.drawText(line, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
      const amount = formatKes(payment.amount);
      page.drawText(amount, {
        x: amountRight - regular.widthOfTextAtSize(amount, 9),
        y,
        size: 9,
        font: regular,
        color: MUTED,
      });
      y -= 14;
    }
  }

  if (input.feeNote.notes) {
    y -= 14;
    for (const line of wrap(input.feeNote.notes, regular, 9, A4[0] - MARGIN * 2)) {
      ensure(14);
      page.drawText(line, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
      y -= 12;
    }
  }

  // ----------------------------------------------------------- footer
  for (const each of pdf.getPages()) {
    each.drawText(
      input.feeNote.status === 'draft'
        ? 'DRAFT — not yet approved for issue'
        : `${input.firm.name} · ${input.feeNote.fee_note_number ?? ''}`,
      { x: MARGIN, y: MARGIN - 18, size: 8, font: regular, color: MUTED },
    );
  }

  return pdf.save();
}

function contactLine(firm: Firm): string | null {
  const parts = [firm.phone, firm.email].filter(Boolean);
  return parts.length > 0 ? parts.join('  ·  ') : null;
}

/** Greedy word wrap against the real measured width of the font. */
function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}
