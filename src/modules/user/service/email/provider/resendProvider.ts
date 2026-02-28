import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendResend({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  attachment?: any;
  replyTo?: string;
}) {
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || "noreply@gokhor.com";

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data?.id;
}
