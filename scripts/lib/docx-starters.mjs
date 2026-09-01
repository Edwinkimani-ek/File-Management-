/**
 * Five Kenyan-legal starter templates, built with the docx package.
 *
 * Each buffer is a valid .docx with bracketed placeholders so the setup
 * screen can turn them into {{token}} markers with one click.
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';

function p(runs, options = {}) {
  return new Paragraph({
    children: Array.isArray(runs) ? runs : [runs],
    spacing: { after: 120 },
    ...options,
  });
}

function text(value, bold = false) {
  return new TextRun({ text: value, bold, font: 'Calibri', size: 22 });
}

function placeholder(token) {
  return new TextRun({ text: `[${token}]`, bold: true, font: 'Calibri', size: 22 });
}

function heading(title) {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
  });
}

function subHeading(title) {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  });
}

export async function demandLetterBuffer() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        heading('DEMAND LETTER'),
        p([text('Our ref: '), placeholder('FILE_REFERENCE')]),
        p([text('Date: '), placeholder('TODAY_DATE')]),
        p([]),
        p([placeholder('CLIENT_NAME'), text(' c/o '), placeholder('ADVOCATE_NAME')]),
        p([text('Matter: '), placeholder('MATTER_TITLE')]),
        p([]),
        p([text('Dear Sir/Madam,')]),
        p([
          text('RE: DEMAND FOR PAYMENT OF KES '),
          placeholder('KES_AMOUNT'),
          text(' PLUS ACCRUED INTEREST'),
        ]),
        p([
          text('We act for '),
          placeholder('CLIENT_NAME'),
          text(' and have instructions to demand from you the sum of KES '),
          placeholder('KES_AMOUNT'),
          text(' being the outstanding amount due and owing.'),
        ]),
        p([
          text('Unless the said sum is paid in full within '),
          text('seven (7)', true),
          text(' days from the date hereof, we shall institute legal proceedings against you without further reference to you.'),
        ]),
        p([text('Yours faithfully,')]),
        p([]),
        p([placeholder('ADVOCATE_NAME')]),
        p([text('Advocate for '), placeholder('CLIENT_NAME')]),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

export async function saleAgreementBuffer() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        heading('AGREEMENT FOR SALE OF LAND'),
        p([text('File reference: '), placeholder('FILE_REFERENCE')]),
        p([text('Date: '), placeholder('TODAY_DATE')]),
        p([]),
        p([
          text('This Agreement is made on '),
          placeholder('TODAY_DATE'),
          text(' between '),
          placeholder('CLIENT_NAME'),
          text(' ("the Purchaser") and the Vendor.'),
        ]),
        subHeading('1. Property'),
        p([
          text('The Vendor agrees to sell and the Purchaser agrees to purchase the land comprised in '),
          placeholder('MATTER_TITLE'),
          text(' at the purchase price of KES '),
          placeholder('KES_AMOUNT'),
          text('.'),
        ]),
        subHeading('2. Deposit'),
        p([text('The Purchaser shall pay a deposit of 10% of the purchase price upon execution hereof.')]),
        subHeading('3. Completion'),
        p([
          text('Completion shall take place within '),
          text('ninety (90)', true),
          text(' days from the date hereof, subject to the issuance of all requisite regulatory consents.'),
        ]),
        subHeading('4. Advocates'),
        p([
          text('The Purchaser is represented by '),
          placeholder('ADVOCATE_NAME'),
          text('.'),
        ]),
        p([]),
        p([text('SIGNED by the Purchaser: ___________________________')]),
        p([placeholder('CLIENT_NAME')]),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

export async function leaseAgreementBuffer() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        heading('LEASE AGREEMENT'),
        p([text('File reference: '), placeholder('FILE_REFERENCE')]),
        p([text('Date: '), placeholder('TODAY_DATE')]),
        p([]),
        p([
          text('This Lease Agreement is entered into between the Landlord and '),
          placeholder('CLIENT_NAME'),
          text(' ("the Tenant").'),
        ]),
        subHeading('1. Premises'),
        p([
          text('The Landlord lets to the Tenant the premises described as: '),
          placeholder('MATTER_TITLE'),
          text('.'),
        ]),
        subHeading('2. Term and Rent'),
        p([
          text('The term shall be for a period of two (2) years commencing on '),
          placeholder('TODAY_DATE'),
          text(', at a monthly rent of KES '),
          placeholder('KES_AMOUNT'),
          text('.'),
        ]),
        subHeading('3. Use'),
        p([text('The premises shall be used for lawful purposes only and in compliance with all municipal by-laws.')]),
        subHeading('4. Legal representation'),
        p([
          text('Prepared by: '),
          placeholder('ADVOCATE_NAME'),
          text('.'),
        ]),
        p([]),
        p([text('TENANT: ___________________________')]),
        p([placeholder('CLIENT_NAME')]),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

export async function engagementLetterBuffer() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        heading('LETTER OF ENGAGEMENT'),
        p([text('Our ref: '), placeholder('FILE_REFERENCE')]),
        p([text('Date: '), placeholder('TODAY_DATE')]),
        p([]),
        p([placeholder('CLIENT_NAME')]),
        p([text('Matter: '), placeholder('MATTER_TITLE')]),
        p([]),
        p([text('Dear ') , placeholder('CLIENT_NAME'), text(',')]),
        p([
          text('Thank you for instructing '),
          placeholder('ADVOCATE_NAME'),
          text(' to act on your behalf in the above matter.'),
        ]),
        subHeading('Scope of work'),
        p([
          text('We shall provide legal services in respect of '),
          placeholder('MATTER_TITLE'),
          text(', including correspondence, drafting, and court or negotiation attendance as may be required.'),
        ]),
        subHeading('Fees'),
        p([
          text('Our professional fees shall be KES '),
          placeholder('KES_AMOUNT'),
          text(' plus disbursements and applicable VAT.'),
        ]),
        subHeading('Termination'),
        p([
          text('Either party may terminate this engagement by giving '),
          text('thirty (30)', true),
          text(' days’ written notice.'),
        ]),
        p([text('Yours faithfully,')]),
        p([]),
        p([placeholder('ADVOCATE_NAME')]),
        p([text('Advocate')]),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

export async function witnessStatementBuffer() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        heading('WITNESS STATEMENT'),
        p([text('In the matter of: '), placeholder('MATTER_TITLE')]),
        p([text('File reference: '), placeholder('FILE_REFERENCE')]),
        p([text('Date: '), placeholder('TODAY_DATE')]),
        p([]),
        subHeading('Deponent'),
        p([text('I, '), placeholder('CLIENT_NAME'), text(', of full age and an adult of sound mind, do state as follows:')]),
        p([
          text('1. I am the deponent in this matter and my statement is true to the best of my knowledge, information and belief.'),
        ]),
        p([
          text('2. I have been advised on this statement by '),
          placeholder('ADVOCATE_NAME'),
          text('.'),
        ]),
        p([
          text('3. I understand that this statement may be used in court in respect of the matter reference '),
          placeholder('FILE_REFERENCE'),
          text('.'),
        ]),
        p([]),
        p([text('Sworn/affirmed by the said deponent at ___________________________')]),
        p([text('This '), placeholder('TODAY_DATE'), text('.')]),
        p([]),
        p([text('_________________________________')]),
        p([placeholder('CLIENT_NAME')]),
        p([text('Deponent')]),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}
