import { IPublicPoliciesDto } from "@modules/user/types/public-policy.types";
import * as crypto from "crypto";

const DEFAULT_LAST_UPDATED = "2026-06-12";

const buildItem = (
    policyType: "privacy" | "terms" | "refund",
    title: string,
    content: string,
    policyVersion: string,
    lastUpdated = DEFAULT_LAST_UPDATED,
) => ({
    policyType,
    title,
    content,
    policyVersion,
    lastUpdated,
    contentHash: crypto.createHash("sha256").update(content).digest("hex"),
});

export const CURRENT_PUBLIC_POLICIES: IPublicPoliciesDto = {
    privacy: buildItem(
        "privacy",
        "Privacy Policy",
        `Khor helps users discover destinations, browse hotels and restaurants, make bookings, manage bookings, contact support, and receive booking updates. This Privacy Policy explains what personal data we collect through the app and website, how we use it, and how we keep it relevant to the services we actually provide.

Information we collect

- Account data such as your name, email address, phone number, password, and profile picture.
- Booking data such as guest name, guest email, guest phone number, special requests, booking dates, room details, and booking history.
- Checkout and billing data you provide during booking, including billing address and ID or CNIC information where requested.
- Property and contact details displayed to you in relation to hotels and restaurants, including business phone, WhatsApp, email, and address information.
- Support data when you create a ticket or contact us, including your message, related booking, and follow-up replies.
- Technical and usage data such as IP address, browser or device details, pages visited, approximate time zone, and actions taken inside the app.
- Notification data related to service messages we send, such as booking emails, OTPs, and WhatsApp updates.

How we use your information

- To create and manage your account.
- To process hotel bookings, booking holds, payments, confirmations, cancellations, and refunds.
- To show your bookings, invoices, hotel policies, and payment status inside the app.
- To send service-related messages such as OTP verification, booking confirmations, booking updates, support replies, and operational reminders.
- To help hotels and restaurants fulfill bookings and respond to guest requests.
- To improve app performance, fix issues, prevent abuse, and monitor service reliability.

How we share data

We share only the data needed to deliver the service. This may include sharing booking and guest details with the hotel or restaurant you booked, payment-related details with our payment processor, and relevant contact or booking information with support or operational staff handling your request.

Payments

Payments are processed through the payment methods integrated into the app. We may store payment status, transaction references, paid amounts, and refund status, but we do not present ourselves as storing full card data inside the frontend experience.

Data security and retention

We use reasonable technical and operational measures to protect account, booking, and support data. We keep data for as long as needed to operate the service, maintain booking records, resolve disputes, meet operational needs, and comply with legal obligations.

Your choices

- You should provide accurate booking and account information.
- You can request correction of inaccurate profile or booking-related information where applicable.
- You can contact us regarding access, correction, or account concerns.
- You can manage some browser-side controls such as cookies through your browser settings.

Contact us

Questions? Email us at info@gokhor.com.`,
        "privacy_2026_06_12",
    ),
    terms: buildItem(
        "terms",
        "Terms & Conditions",
        `By using Khor, creating an account, browsing listings, making a booking, or using related support features, you agree to these Terms & Conditions.

Company Information

This platform is owned and operated by Khor. Our registered office and principal place of business is located at [Insert Your Registered Business/Shop Address Here].

Using the platform

- You may use Khor to discover destinations, view hotel and restaurant information, make bookings, manage bookings, and contact support.
- You must use the platform lawfully and provide accurate information when registering or booking.
- You may not misuse the platform, interfere with its operation, or attempt unauthorized access to accounts, data, or systems.

User accounts

You are responsible for keeping your login details secure and for activity under your account. Account, guest, and booking information must be accurate and up to date.

Bookings and listings

- Hotel and restaurant information is provided to help you evaluate and place bookings or inquiries.
- Availability, rates, room details, and booking status depend on the information and inventory managed through the platform.
- Each hotel may have its own cancellation or refund window, which should be reviewed before you complete your booking.
- Khor may support booking confirmation, payment status, cancellation requests, refunds, and support follow-up, but specific property policies still matter.

Payments

Where checkout is available, payments are handled through the payment methods integrated into the platform. You are responsible for providing correct billing and guest information during checkout.

Support and communications

By using Khor, you agree that we may send you service-related communications such as OTPs, booking confirmations, booking updates, refund-related updates, and support responses through email, phone, or WhatsApp where applicable.

Prohibited conduct

- Using false identity, false guest details, or false payment-related information.
- Misusing support channels, payment flows, refund requests, or booking systems.
- Violating applicable law, infringing others’ rights, or attempting harmful or disruptive activity.

Changes, suspension, and liability

We may update features, content, workflows, or policies from time to time. We may also suspend accounts or restrict access where needed for security, misuse prevention, operational reasons, or policy enforcement. To the extent allowed by law, Khor is not responsible for indirect losses arising from use of the platform or from inability to use it.

Governing Law and Jurisdiction

Our Terms and Conditions are governed by the laws of the Islamic Republic of Pakistan and you agree that the courts of [Insert City Name, e.g., Islamabad] (including any consumer court) will have exclusive jurisdiction in any dispute that you have with us.

Contact us

Questions? Email us at info@gokhor.com.`,
        "terms_2026_06_12",
    ),
    refund: buildItem(
        "refund",
        "Refund Policy",
        `Refund eligibility depends on the refund or cancellation window of the specific hotel you are booking. Before confirming a booking, please review the hotel's refund window and policy shown in the booking flow and booking details.

If you cancel an eligible booking or submit a refund request, the request will go through admin review. After review, a Khor representative may contact you through your registered email address or the mobile number you provided to confirm your banking details and any information required to process the refund.

A refund processing fee of 1.5% of the total booking amount will be charged when a refund is processed.

Important notes

- Not all bookings are refundable.
- Refund amounts may depend on the hotel policy, payment status, and any amount already refunded or adjusted.
- Submitting a refund request does not guarantee approval.
- Approved refund cases are generally resolved within 7 to 10 working days, depending on review, verification, and payment handling.

Need help?

If you need help with a cancellation or refund, please contact us at info@gokhor.com or open a support ticket through your account where available.`,
        "refund_2026_06_12",
    ),
};
