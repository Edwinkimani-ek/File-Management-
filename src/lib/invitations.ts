import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';
import { escapeHtml, layoutEmail, sendMail } from '@/lib/email';

/** Only the hash is stored, so a database dump does not hand out logins. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

export function inviteUrl(token: string): string {
  return `${env.siteUrl}/invite/${token}`;
}

export async function sendInviteEmail(args: {
  firmName: string;
  to: string;
  fullName: string;
  roleLabel: string;
  token: string;
}) {
  const url = inviteUrl(args.token);
  const body = `<p style="margin:0 0 12px">Hello ${escapeHtml(args.fullName)},</p>
<p style="margin:0 0 12px">You have been invited to join <strong>${escapeHtml(args.firmName)}</strong> on Wakili Case Manager as ${escapeHtml(args.roleLabel)}.</p>
<p style="margin:0 0 20px">Use the link below to set your password. It expires in seven days.</p>
<p style="margin:0 0 12px"><a href="${url}" style="display:inline-block;background:#256551;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none">Set your password</a></p>
<p style="margin:0;font-size:12px;color:#5b7191;word-break:break-all">${url}</p>`;

  return sendMail({
    to: args.to,
    subject: `You have been invited to ${args.firmName} on Wakili`,
    html: layoutEmail(args.firmName, 'Your invitation', body),
    text: `Hello ${args.fullName},\n\nYou have been invited to join ${args.firmName} on Wakili Case Manager as ${args.roleLabel}.\n\nSet your password: ${url}\n\nThe link expires in seven days.`,
  });
}
