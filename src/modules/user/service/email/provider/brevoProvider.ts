import * as SibApiV3Sdk from "@getbrevo/brevo";
import { EmailConfig } from "../../../../../config/emailConfig/emailConfig";

export async function sendBrevo({
  to,
  subject,
  html,
  attachment,
}: {
  to: string;
  subject: string;
  html: string;
  attachment?: any;
}) {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

  if (!EmailConfig.brevo.apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  apiInstance.setApiKey(
    SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
    EmailConfig.brevo.apiKey
  );

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html;
  sendSmtpEmail.sender = {
    name: EmailConfig.brevo.fromName,
    email: EmailConfig.brevo.fromEmail,
  };
  if (attachment) {
    // Ensure attachment is an array of objects with name and base64 content
    sendSmtpEmail.attachment = Array.isArray(attachment)
      ? attachment.map(att => ({
          name: att.name || att.filename || 'attachment.pdf',
          content: att.content?.toString('base64') || att.content || '',
        }))
      : [{
          name: attachment.name || attachment.filename || 'attachment.pdf',
          content: attachment.content?.toString('base64') || attachment.content || '',
        }];
  }
  sendSmtpEmail.to = [{ email: to }];

  const response = await apiInstance.sendTransacEmail(sendSmtpEmail);

  return response.body.messageId || "brevo-message-id";
}
