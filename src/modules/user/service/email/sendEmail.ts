import { EmailBookingData } from "@modules/user/dtos/bookingConfirmation.dto";
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
    activationLink: string
  ) {
    const html = accountActivationTemplate(name, activationLink);

    const success = await sendEmail({
      to: email,
      subject: "Activate Your Account",
      html,
    });

    return success ? { status: "ok" } : { status: "error" };
  }
  async sendBookingConfirmationEmail(
    bookingInfo: EmailBookingData,
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
}
