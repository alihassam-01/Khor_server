import { EmailConfig } from "../../../../config/emailConfig/emailConfig";
import { sendSMTP } from "./provider/smtpProvider";
import { sendSES } from "./provider/sesProvider";
import { sendBrevo } from "./provider/brevoProvider";
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    let messageId;
    if (EmailConfig.provider === "smtp") {
      messageId = await sendSMTP({ to, subject, html });
    } else if (EmailConfig.provider === "ses") {
      messageId = await sendSES({ to, subject, html });
    } else if (EmailConfig.provider === "brevo") {
      messageId = await sendBrevo({ to, subject, html });
    } else {
      throw new Error(`Unknown email provider: ${EmailConfig.provider}`);
    }

    console.log(`✅ Email sent (${EmailConfig.provider}): ${messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ Email send failed:`, err);
    return false;
  }
}
