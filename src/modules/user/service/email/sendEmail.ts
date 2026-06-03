import { IEmailBookingData } from "@modules/user/dtos/bookingConfirmation.dto";
import { sendEmail } from "./index";
import { accountActivationTemplate } from "./templates/accountActivation";
import { AuditLogStatus, AuditLogEventType, EMAIL_SUBJECTS } from "@modules/user/constant/audit.constant";
import { AuditLogService } from "@modules/user/service/audit-log.service";
import { bookingConfirmationEmailTemplate } from "./templates/bookingConfirmation";

export class SendEmail {
  private auditLogService = new AuditLogService();

  private getListingEmailSubject(kind: "activation" | "warning" | "expired", listingType: string) {
    const itemLabel = listingType.toLowerCase() === "hotel" ? "Hotel" : "Listing";

    if (kind === "activation") {
      return `Your ${itemLabel} is Now Live!`;
    }
    if (kind === "warning") {
      return `Your ${itemLabel} is About to Expire`;
    }
    return `Your ${itemLabel} has Expired`;
  }

  private async sendAuditedEmail(
    eventType: AuditLogEventType,
    to: string,
    subject: string,
    html: string,
    metadata?: Record<string, unknown>,
  ) {
    const success = await sendEmail({ to, subject, html });

    await this.auditLogService.log(
      eventType,
      to,
      success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
      success ? undefined : "Email service returned failure",
      metadata,
    );

    return success ? { status: "ok" } : { status: "error" };
  }

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

  async sendBookingLifecycleEmail(input: {
    to: string;
    recipientName?: string | null;
    subject: string;
    heading: string;
    intro: string;
    bookingNumber: string;
    hotelName: string;
    roomName: string;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
    guestCount: number;
    reason?: string | null;
    counterpartyName?: string | null;
    counterpartyEmail?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #123;">
        <h2>${input.heading}</h2>
        <p>Hi ${input.recipientName || "there"},</p>
        <p>${input.intro}</p>
        <div style="border: 1px solid #d7e3e3; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p><strong>Booking:</strong> ${input.bookingNumber}</p>
          <p><strong>Hotel:</strong> ${input.hotelName}</p>
          <p><strong>Room:</strong> ${input.roomName}</p>
          <p><strong>Check-in:</strong> ${input.checkInDate}</p>
          <p><strong>Check-out:</strong> ${input.checkOutDate}</p>
          <p><strong>Guests:</strong> ${input.guestCount}</p>
          <p><strong>Total:</strong> PKR ${Number(input.totalAmount).toLocaleString()}</p>
          ${input.counterpartyName ? `<p><strong>Contact:</strong> ${input.counterpartyName}${input.counterpartyEmail ? ` (${input.counterpartyEmail})` : ""}</p>` : ""}
          ${input.reason ? `<p><strong>Reason:</strong> ${input.reason}</p>` : ""}
        </div>
        <p>You can review the booking details in your Khor account.</p>
      </div>
    `;

    return this.sendAuditedEmail(
      AuditLogEventType.BOOKING_UPDATE,
      input.to,
      input.subject,
      html,
      input.metadata,
    );
  }

  async sendAdminBookingLifecycleEmail(input: {
    subject: string;
    heading: string;
    intro: string;
    bookingNumber: string;
    hotelName: string;
    roomName: string;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
    guestCount: number;
    customerName?: string | null;
    customerEmail?: string | null;
    vendorName?: string | null;
    vendorEmail?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const adminEmail =
      process.env.INFO_EMAIL ||
      process.env.CONTACT_EMAIL ||
      process.env.SMTP_EMAIL ||
      "info@gokhor.com";

    if (!adminEmail) {
      return { status: "error" };
    }

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #123;">
        <h2>${input.heading}</h2>
        <p>${input.intro}</p>
        <div style="border: 1px solid #d7e3e3; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p><strong>Booking:</strong> ${input.bookingNumber}</p>
          <p><strong>Hotel:</strong> ${input.hotelName}</p>
          <p><strong>Room:</strong> ${input.roomName}</p>
          <p><strong>Check-in:</strong> ${input.checkInDate}</p>
          <p><strong>Check-out:</strong> ${input.checkOutDate}</p>
          <p><strong>Guests:</strong> ${input.guestCount}</p>
          <p><strong>Total:</strong> PKR ${Number(input.totalAmount).toLocaleString()}</p>
          ${input.customerName ? `<p><strong>Customer:</strong> ${input.customerName}${input.customerEmail ? ` (${input.customerEmail})` : ""}</p>` : ""}
          ${input.vendorName ? `<p><strong>Vendor:</strong> ${input.vendorName}${input.vendorEmail ? ` (${input.vendorEmail})` : ""}</p>` : ""}
          ${input.reason ? `<p><strong>Reason:</strong> ${input.reason}</p>` : ""}
        </div>
        <p>Review this record in the Khor admin dashboard.</p>
      </div>
    `;

    return this.sendAuditedEmail(
      AuditLogEventType.BOOKING_UPDATE,
      adminEmail,
      input.subject,
      html,
      { ...input.metadata, recipient: "admin" },
    );
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
      subject: this.getListingEmailSubject("activation", adType),
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
      subject: this.getListingEmailSubject("warning", adType),
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
      subject: this.getListingEmailSubject("expired", adType),
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

  async sendTicketActivityEmail(input: {
    to: string;
    recipientName?: string | null;
    subject: string;
    heading: string;
    intro: string;
    ticketNumber: string;
    ticketSubject: string;
    ticketStatus: string;
    bookingNumber?: string | null;
    hotelName?: string | null;
    actorName?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #123;">
        <h2>${input.heading}</h2>
        <p>Hi ${input.recipientName || "there"},</p>
        <p>${input.intro}</p>
        <div style="border: 1px solid #d7e3e3; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p><strong>Ticket:</strong> ${input.ticketNumber}</p>
          <p><strong>Subject:</strong> ${input.ticketSubject}</p>
          <p><strong>Status:</strong> ${input.ticketStatus}</p>
          ${input.actorName ? `<p><strong>Updated by:</strong> ${input.actorName}</p>` : ""}
          ${input.bookingNumber ? `<p><strong>Booking:</strong> ${input.bookingNumber}</p>` : ""}
          ${input.hotelName ? `<p><strong>Hotel:</strong> ${input.hotelName}</p>` : ""}
        </div>
        <p>You can review the full conversation in your Khor account.</p>
      </div>
    `;

    return this.sendAuditedEmail(
      AuditLogEventType.TICKET_ACTIVITY,
      input.to,
      input.subject,
      html,
      input.metadata,
    );
  }
}
