import { sendEmail } from "./index";
import { AuditLogStatus, AuditLogEventType, EMAIL_SUBJECTS } from "@modules/user/constant/audit.constant";
import { AuditLogService } from "@modules/user/service/audit-log.service";
import { bookingBillDailyDigestTemplate, type BookingBillDailyDigestItem } from "./templates/bookingBillDailyDigest";
import { bookingLifecycleTemplate, type BookingLifecycleTemplateInput } from "./templates/bookingLifecycle";
import { ownerDailyCheckInsTemplate, type OwnerDailyCheckInItem } from "./templates/ownerDailyCheckIns";
import { partnerApprovalTemplate, type PartnerApprovalTemplateInput } from "./templates/partnerApproval";
import { ticketActivityTemplate, type TicketActivityTemplateInput } from "./templates/ticketActivity";
import { vendorPolicyUpdateTemplate, type VendorPolicyUpdateTemplateInput } from "./templates/vendorPolicyUpdate";
import { guestSignupInvitationTemplate, type GuestSignupInvitationTemplateInput } from "./templates/guestSignupInvitation";
import { bookingLinkedNoticeTemplate, type BookingLinkedNoticeTemplateInput } from "./templates/bookingLinkedNotice";

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
    counterpartyPhone?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const html = bookingLifecycleTemplate(input as BookingLifecycleTemplateInput);

    return this.sendAuditedEmail(
      AuditLogEventType.BOOKING_UPDATE,
      input.to,
      input.subject,
      html,
      input.metadata,
    );
  }

  async sendBookingBillDailyDigestEmail(input: {
    to: string;
    customerName: string;
    hotelName: string;
    bookingNumber: string;
    dateLabel: string;
    currency: string;
    items: BookingBillDailyDigestItem[];
    totalAmount: number;
    metadata?: Record<string, unknown>;
  }) {
    const html = bookingBillDailyDigestTemplate({
      customerName: input.customerName,
      hotelName: input.hotelName,
      bookingNumber: input.bookingNumber,
      dateLabel: input.dateLabel,
      currency: input.currency,
      items: input.items,
      totalAmount: input.totalAmount,
    });

    return this.sendAuditedEmail(
      AuditLogEventType.BOOKING_UPDATE,
      input.to,
      `Your bill today: ${input.dateLabel}`,
      html,
      input.metadata,
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
    const html = ticketActivityTemplate(input as TicketActivityTemplateInput);

    return this.sendAuditedEmail(
      AuditLogEventType.TICKET_ACTIVITY,
      input.to,
      input.subject,
      html,
      input.metadata,
    );
  }

  async sendOwnerDailyCheckInsEmail(input: {
    to: string;
    ownerName: string;
    dateLabel: string;
    items: OwnerDailyCheckInItem[];
    metadata?: Record<string, unknown>;
  }) {
    const html = ownerDailyCheckInsTemplate({
      ownerName: input.ownerName,
      dateLabel: input.dateLabel,
      items: input.items,
    });

    return this.sendAuditedEmail(
      AuditLogEventType.OWNER_DAILY_CHECKINS,
      input.to,
      `Today's check-ins: ${input.dateLabel}`,
      html,
      input.metadata,
    );
  }

  async sendPartnerApprovalEmail(input: {
    to: string;
    recipientName?: string | null;
    businessName?: string | null;
    approvedCapabilities: string[];
    partnerPortalUrl: string;
    metadata?: Record<string, unknown>;
  }) {
    const html = partnerApprovalTemplate(input as PartnerApprovalTemplateInput);

    return this.sendAuditedEmail(
      AuditLogEventType.PARTNER_APPROVAL,
      input.to,
      EMAIL_SUBJECTS.PARTNER_APPROVAL,
      html,
      input.metadata,
    );
  }

  async sendVendorPolicyUpdateEmail(input: {
    to: string;
    recipientName?: string | null;
    title: string;
    content: string;
    partnerPortalUrl: string;
    metadata?: Record<string, unknown>;
  }) {
    const html = vendorPolicyUpdateTemplate(input as VendorPolicyUpdateTemplateInput);

    return this.sendAuditedEmail(
      AuditLogEventType.VENDOR_POLICY_UPDATE,
      input.to,
      EMAIL_SUBJECTS.VENDOR_POLICY_UPDATE,
      html,
      input.metadata,
    );
  }

  async sendSubscriptionPaymentReminderEmail(input: {
    to: string;
    recipientName?: string | null;
    businessName: string;
    dueMonth: string;
    dueDateLabel: string;
    metadata?: Record<string, unknown>;
  }) {
    const recipientName = input.recipientName?.trim() || "there";
    const html = `
      <div style="font-family:sans-serif;color:#374151;max-width:600px;margin:0 auto;line-height:1.6;">
        <h2 style="margin-bottom:16px;">Payment Reminder</h2>
        <p>Hi ${recipientName},</p>
        <p>Your due for the month <strong>${input.dueMonth}</strong> is due by <strong>${input.dueDateLabel}</strong>.</p>
        <p>Please make sure to make it.</p>
        <p>Thank you for being with Khor.</p>
        <p style="margin-top:20px;color:#6b7280;">Business: ${input.businessName}</p>
      </div>
    `;

    return this.sendAuditedEmail(
      AuditLogEventType.SUBSCRIPTION_PAYMENT_REMINDER,
      input.to,
      EMAIL_SUBJECTS.SUBSCRIPTION_PAYMENT_REMINDER,
      html,
      input.metadata,
    );
  }

  async sendGuestSignupInvitationEmail(input: { to: string } & GuestSignupInvitationTemplateInput) {
    const html = guestSignupInvitationTemplate(input);
    return this.sendAuditedEmail(
      "GUEST_SIGNUP_INVITATION" as any,
      input.to,
      `You have made a booking at ${input.hotelName}`,
      html,
    );
  }

  async sendBookingLinkedNoticeEmail(input: { to: string } & BookingLinkedNoticeTemplateInput) {
    const html = bookingLinkedNoticeTemplate(input);
    return this.sendAuditedEmail(
      "BOOKING_LINKED_NOTICE" as any,
      input.to,
      `A booking at ${input.hotelName} has been linked to your account`,
      html,
    );
  }
}
