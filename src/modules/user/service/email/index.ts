import { EmailConfig } from "../../../../config/emailConfig/emailConfig";
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
    let messageId;
    if (EmailConfig.provider === "smtp") {
      messageId = await sendSMTP({ to, subject, html, attachment, replyTo });
    } else if (EmailConfig.provider === "resend") {
      messageId = await sendResend({ to, subject, html, attachment, replyTo });
    }
    // else if (EmailConfig.provider === "ses") {
    //   messageId = await sendSES({ to, subject, html, attachment, replyTo });
    // } 
    else {
      throw new Error(`Unknown email provider: ${EmailConfig.provider}`);
    }

    console.log(`Email sent (${EmailConfig.provider}): ${messageId}`);
    return true;
  } catch (err) {
    console.error(`Email send failed:`, err);
    return false;
  }
}
