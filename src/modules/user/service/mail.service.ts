import * as SibApiV3Sdk from '@getbrevo/brevo';
import {config} from "@config/config"
export class MailService {
  private readonly apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

  constructor() {
    const apiKey = config.smtp.apiKey;
    if (!apiKey) {
      throw new Error('SMTP_API_KEY is not configured');
    }
    this.apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, apiKey);
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    if (!config.web_domain) {
      throw new Error('FRONTEND_URL is not configured');
    }
  
    const verificationLink = `${config.web_domain.url}/auth/verify-email?token=${token}`;
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    // sendSmtpEmail.templateId = 1; // 

    sendSmtpEmail.subject = 'Verify Your Account';
    sendSmtpEmail.htmlContent = `
      <h1>Welcome to our Travel Platform!</h1>
      <p>Please click the button below to verify your email address:</p>
      <a href="${verificationLink}" style="
        display: inline-block;
        padding: 10px 20px;
        background-color: #4CAF50;
        color: white;
        text-decoration: none;
        border-radius: 5px;
      ">Verify Email</a>
      <p>Or copy this link: ${verificationLink}</p>
    `;
    sendSmtpEmail.sender = { 
      name: 'Khor', 
      email: 'travelbalti@gmail.com' 
    };
    sendSmtpEmail.to = [{ email }];

    try {
      await this.apiInstance.sendTransacEmail(sendSmtpEmail);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }
}
