import AWS from 'aws-sdk';
import { EmailConfig } from '../../../../../config/emailConfig/emailConfig';

export async function sendSES({ to, subject, html }: { to: string; subject: string; html: string }) {
  AWS?.config.update({
    region: EmailConfig.ses.region,
    accessKeyId: EmailConfig.ses.accessKeyId,
    secretAccessKey: EmailConfig.ses.secretAccessKey
  });

  const ses = new AWS.SES();

  if (!EmailConfig.ses.from) {
    throw new Error("SES 'from' email address is not defined in configuration.");
  }

  const params = {
    Source: EmailConfig.ses.from as string,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } }
    }
  };

  const result = await ses.sendEmail(params).promise();
  return result.MessageId;
}
