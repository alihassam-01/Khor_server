import { EmailConfig } from "@config/emailConfig/emailConfig";
import { sendSMTP } from "./provider/smtpProvider";
import { sendResend } from "./provider/resendProvider";
// import { sendSES } from "./provider/sesProvider"; // Disabled - not using SES

export async function sendEmail({
  to,
  subject,
  html,
  attachment,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  attachment?: any;
  replyTo?: string;
}) {
    try {
      if (EmailConfig.provider === "smtp") {
        await sendSMTP({ to, subject, html, attachment, replyTo });
      } else if (EmailConfig.provider === "resend") {
        await sendResend({ to, subject, html, attachment, replyTo });
      } else {
        throw new Error(`Unknown email provider: ${EmailConfig.provider}`);
      }
      return true;
  } catch (err) {
    console.error(`Email send failed:`, err);
    return false;
  }
}
