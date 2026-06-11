// @modules/user/routes/index.ts
import { FEATURES } from "@config/features.config";
import authRoutes from "./auth.routes";
import locationRoutes from "./location.routes";
import articleRoutes from "./article.routes";
import { articleTagRoutes } from "./articleTag.routes";
import { tagRoutes } from "./tag.routes";
import { r2ClientRoutes } from "./r2client.routes";
import userRoutes from "./user.routes";
import { contactRoutes } from "./contact.routes";
import { hotelRoutes } from "./hotel.routes";
import { restaurantRoutes } from "./restaurant.routes";
import { adsRoutes } from "./ads.routes";
import { adPaymentRoutes } from "./ad-payment.routes";
import { subscriptionPlanRoutes } from "./subscription-plan.routes";
import { paymentSettingRoutes } from "./payment-setting.routes";
import propertyRoutes from "./property.routes";
import { mediaRoutes } from "./media.routes";
import analyticsRoutes from "./analytics.routes";
import { flightsRoutes } from "./flights.routes";
import { bookingRoutes } from "./booking.routes";
import { notificationRoutes } from "./notification.routes";
import { reviewRoutes } from "./reviews.routes";
import { payoutRoutes } from "./payout.routes";
import { supportTicketRoutes } from "./support-ticket.routes";
import partnerOnboardingRoutes from "./partner-onboarding.routes";
import adminBusinessRoutes from "./admin-business.routes";
import adminVendorPolicyRoutes from "./admin-vendor-policy.routes";


// Core routes - always enabled
const routes = [
  authRoutes,
  userRoutes,
  r2ClientRoutes, // Required for media uploads
  mediaRoutes,
  contactRoutes,
  hotelRoutes, // Admin hotel management
  restaurantRoutes, // Admin restaurant management
  adsRoutes, // Public ads endpoint
  adPaymentRoutes, // Admin payment management
  subscriptionPlanRoutes, // Public subscription plans
  paymentSettingRoutes, // Admin and public payment settings
  propertyRoutes, // Generic property routes
  bookingRoutes,
  payoutRoutes,
  supportTicketRoutes,
  notificationRoutes,
  reviewRoutes,
  analyticsRoutes,
  partnerOnboardingRoutes,
  adminBusinessRoutes,
  adminVendorPolicyRoutes,
  flightsRoutes, // Google Flights price scraper
];


// Conditionally add feature routes based on feature flags
if (FEATURES.articles) {
  routes.push(articleRoutes);
  routes.push(articleTagRoutes);
}

if (FEATURES.locations) {
  routes.push(locationRoutes);
}

if (FEATURES.tags) {
  routes.push(tagRoutes);
}

export default routes;
