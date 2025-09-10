import * as SibApiV3Sdk from "@getbrevo/brevo";
import { EmailConfig } from "../../../../../config/emailConfig/emailConfig";

export async function sendBrevo({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
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
  sendSmtpEmail.to = [{ email: to }];

  const response = await apiInstance.sendTransacEmail(sendSmtpEmail);

  return response.body.messageId || "brevo-message-id";
}
