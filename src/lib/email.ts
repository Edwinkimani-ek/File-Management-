import 'server-only';
import { Resend } from 'resend';
import { env } from '@/lib/env';

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends an email through Resend. With no API key configured — local
 * development, and any staging box that has not been wired up yet — the
 * message is written to the server log instead so the flow can still be
 * exercised end to end.
 */
export async function sendMail(mail: Mail): Promise<{ sent: boolean; error?: string }> {
  if (!env.resendApiKey) {
    console.info(
      `[email:not-sent] to=${mail.to} subject="${mail.subject}"\n${mail.text}`,
    );
    return { sent: false, error: 'RESEND_API_KEY is not configured' };
  }

  try {
    const resend = new Resend(env.resendApiKey);
    const { error } = await resend.emails.send({
      from: env.mailFrom,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (error) {
      console.error('email send failed', mail.subject, error);
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error('email send threw', error);
    return { sent: false, error: (error as Error).message };
  }
}

export function layoutEmail(firmName: string, heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f7fa;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2733">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #cfd8e3;border-radius:8px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5b7191">${escapeHtml(firmName)}</p>
    <h1 style="margin:0 0 16px;font-size:18px;color:#1f2733">${escapeHtml(heading)}</h1>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#7c90ad">Sent by Wakili Case Manager.</p>
  </div></body></html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
