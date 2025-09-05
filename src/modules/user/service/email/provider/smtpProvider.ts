import nodemailer from 'nodemailer';
import { EmailConfig } from '../../../../../config/emailConfig/emailConfig';

export async function sendSMTP({ to, subject, html }: { to: string; subject: string; html: string }) {
  const transporter = nodemailer.createTransport({
    host: EmailConfig.smtp.host,
    port: EmailConfig.smtp.port,
    secure: EmailConfig.smtp.secure,
    auth: {
      user: EmailConfig.smtp.user,
      pass: EmailConfig.smtp.pass
    }
  });

  const info = await transporter.sendMail({
    from: EmailConfig.smtp.from,
    to,
    subject,
    html
  });

  return info.messageId;
}
