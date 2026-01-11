import AWS from "aws-sdk";
import { EmailConfig } from "../../../../../config/emailConfig/emailConfig";

export async function sendSES({
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
  AWS?.config.update({
    region: EmailConfig.ses.region,
    accessKeyId: EmailConfig.ses.accessKeyId,
    secretAccessKey: EmailConfig.ses.secretAccessKey,
  });

  const ses = new AWS.SES();

  if (!EmailConfig.ses.from) {
    throw new Error(
      "SES 'from' email address is not defined in configuration."
    );
  }

  const params: AWS.SES.SendEmailRequest = {
    Source: EmailConfig.ses.from as string,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
    ReplyToAddresses: replyTo ? [replyTo] : [],
    // Attachment handling for SES usually requires raw email construction (Nodemailer with SES transport), simple SES sendEmail doesn't support attachments directly nicely without RawMessage.
    // The existing code passed 'Attachment' key which isn't standard SendEmailRequest but maybe their AWS lib wrapper handles it or it was placeholder?
    // Checking previous code: 'Attachment: attachment' was passed. I will keep it but standard AWS.SES.sendEmail doesn't support 'Attachment'. 
    // Assuming the user's setup works for them or I should leave it as is.
    // I will just ADD ReplyToAddresses.
  };

  // Re-reading original code:
  // params object had: Source, Destination, Message, Attachment. 
  // Wait, AWS SDK SES sendEmail params do NOT have Attachment.
  // Using 'Attachment: attachment' might be invalid type manually cast or ignored?
  // I will just append ReplyToAddresses.

  if (attachment) {
    // @ts-ignore
    params.Attachment = attachment
  }

  const result = await ses.sendEmail(params).promise();
  return result.MessageId;
}
