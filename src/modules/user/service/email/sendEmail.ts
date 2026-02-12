import { IEmailBookingData } from "@modules/user/dtos/bookingConfirmation.dto";
import { sendEmail } from "./index";
import { accountActivationTemplate } from "./templates/accountActivation";
import { bookingConfirmationEmailTemplate } from "./templates/bookingConfirmation";
// import { bookingConfirmationEmailTemplate } from './templates/bookingConfirmation';

export class SendEmail {
  async sendForgotPasswordEmail(
    name: string,
    email: string,
    resetLink: string
  ) {
    const { forgotPasswordTemplate } = await import("./templates/forgotPassword");
    const html = forgotPasswordTemplate(name, resetLink);
    const success = await sendEmail({
      to: email,
      subject: "Reset Your Password",
      html,
    });
    return success ? { status: "ok" } : { status: "error" };
  }
  async sendAccountActivationEmail(
    name: string,
    email: string,
    activationLink: string,
    callBackUrl: string
  ) {
    const html = accountActivationTemplate(name, activationLink, callBackUrl);

    const success = await sendEmail({
      to: email,
      subject: "Activate Your Account",
      html,
    });

    return success ? { status: "ok" } : { status: "error" };
  }
  async sendBookingConfirmationEmail(
    bookingInfo: IEmailBookingData,
    pdfBuffer: Buffer
  ) {
    const html = bookingConfirmationEmailTemplate(bookingInfo);

    const success = await sendEmail({
      to: bookingInfo.customerEmail,
      subject: "Booking Confirmation",
      html,
      attachment: [
        {
          filename: "booking-confirmation.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
    return success ? { status: "ok" } : { status: "error" };
  }
  async sendContactEmail(
    name: string,
    email: string,
    subject: string,
    message: string
  ) {
    const adminEmail = process.env.INFO_EMAIL || process.env.CONTACT_EMAIL || process.env.SMTP_EMAIL || "info@gokhor.com";
    if (!adminEmail) {
      console.error("CONTACT_EMAIL or SMTP_EMAIL not configured.");
      return { status: "error", message: "Server configuration error" };
    }

    const html = `
      <h3>New Contact Message</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <br/>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `;

    const success = await sendEmail({
      to: adminEmail,
      subject: `[Contact Us] ${subject}`,
      html,
      replyTo: email,
    });

    return success ? { status: "ok" } : { status: "error" };
  }
}
