import { IEmailBookingData } from "@modules/user/dtos/bookingConfirmation.dto";
import { sendEmail } from "./index";
import { accountActivationTemplate } from "./templates/accountActivation";
import { AuditLogStatus, AuditLogEventType, EMAIL_SUBJECTS } from "@modules/user/constant/audit.constant";
import { AuditLogService } from "@modules/user/service/audit-log.service";
import { bookingConfirmationEmailTemplate } from "./templates/bookingConfirmation";

export class SendEmail {
  private auditLogService = new AuditLogService();

  async sendForgotPasswordEmail(
    name: string,
    email: string,
    resetLink: string
  ) {
    const { forgotPasswordTemplate } = await import("./templates/forgotPassword");
    const html = forgotPasswordTemplate(name, resetLink);
    const success = await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.FORGOT_PASSWORD_OTP,
      html,
    });

    await this.auditLogService.log(
      AuditLogEventType.FORGOT_PASSWORD_OTP,
      email,
      success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
      success ? undefined : "Email service returned failure",
      { name }
    );

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
      subject: EMAIL_SUBJECTS.ACCOUNT_ACTIVATION,
      html,
    });

    await this.auditLogService.log(
      AuditLogEventType.ACCOUNT_ACTIVATION,
      email,
      success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
      success ? undefined : "Email service returned failure",
      { name }
    );

    return success ? { status: "ok" } : { status: "error" };
  }

  async sendBookingConfirmationEmail(
    bookingInfo: IEmailBookingData,
    pdfBuffer: Buffer
  ) {
    const html = bookingConfirmationEmailTemplate(bookingInfo);

    const success = await sendEmail({
      to: bookingInfo.customerEmail,
      subject: EMAIL_SUBJECTS.BOOKING_CONFIRMATION,
      html,
      attachment: [
        {
          filename: "booking-confirmation.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    await this.auditLogService.log(
      AuditLogEventType.BOOKING_CONFIRMATION,
      bookingInfo.customerEmail,
      success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
      success ? undefined : "Email service returned failure",
      { bookingId: bookingInfo.bookingId }
    );

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

    await this.auditLogService.log(
      AuditLogEventType.CONTACT_US_FORWARD,
      adminEmail,
      success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
      success ? undefined : "Email service returned failure",
      { fromName: name, fromEmail: email, subject }
    );

    return success ? { status: "ok" } : { status: "error" };
  }

  async sendAnalyticsReportEmail(
    vendorName: string,
    email: string,
    period: string,
    adsStats: any[]
  ) {
    const { analyticsReportTemplate } = await import("./templates/analyticsReport");
    const html = analyticsReportTemplate(vendorName, period, adsStats);
    
    const success = await sendEmail({
      to: email,
      subject: `${EMAIL_SUBJECTS.ANALYTICS_REPORT} - ${period}`,
      html,
    });

    await this.auditLogService.log(
      AuditLogEventType.ANALYTICS_REPORT,
      email,
      success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
      success ? undefined : "Email service returned failure",
      { vendorName, period, adCount: adsStats.length }
    );
    
    return success ? { status: "ok" } : { status: "error" };
  }

  async sendAdActivationEmail(
    vendorName: string,
    email: string,
    adName: string,
    adType: string,
    expiryDate: Date
  ) {
    const { adActivationTemplate } = await import("./templates/adActivation");
    const html = adActivationTemplate(vendorName, adName, adType, expiryDate.toLocaleDateString());
    
    const success = await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.AD_ACTIVATION,
      html,
    });

    await this.auditLogService.log(
      AuditLogEventType.AD_ACTIVATION,
      email,
      success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
      success ? undefined : "Email service returned failure",
      { vendorName, adName, adType, expiryDate }
    );

    return success ? { status: "ok" } : { status: "error" };
  }

  async sendAdExpirationWarningEmail(
    vendorName: string,
    email: string,
    adName: string,
    adType: string,
    expiryDate: Date,
    daysRemaining: number
  ) {
    const { adExpirationWarningTemplate } = await import("./templates/adExpirationWarning");
    const html = adExpirationWarningTemplate(vendorName, adName, adType, expiryDate.toLocaleDateString(), daysRemaining);
    
    const success = await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.AD_EXPIRATION_WARNING,
      html,
    });

    await this.auditLogService.log(
      AuditLogEventType.AD_EXPIRATION_WARNING,
      email,
      success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
      success ? undefined : "Email service returned failure",
      { vendorName, adName, adType, expiryDate, daysRemaining }
    );

    return success ? { status: "ok" } : { status: "error" };
  }

  async sendAdExpiredEmail(
    vendorName: string,
    email: string,
    adName: string,
    adType: string,
    expiryDate: Date
  ) {
    const { adExpiredTemplate } = await import("./templates/adExpired");
    const html = adExpiredTemplate(vendorName, adName, adType, expiryDate.toLocaleDateString());
    
    const success = await sendEmail({
      to: email,
      subject: EMAIL_SUBJECTS.AD_EXPIRED,
      html,
    });

    await this.auditLogService.log(
      AuditLogEventType.AD_EXPIRED,
      email,
      success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
      success ? undefined : "Email service returned failure",
      { vendorName, adName, adType, expiryDate }
    );

    return success ? { status: "ok" } : { status: "error" };
  }
}
