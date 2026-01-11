// @modules/user/routes/index.ts
import { features } from "../../../config/features.config";
import authRoutes from "./auth.routes";
import locationRoutes from "./location.routes";
import articleRoutes from "./article.routes";
import propertyRoutes from "./property.routes";
import { roomTypeRoutes } from "./roomtype.routes";
import { tourPackageRoutes } from "./tourpackage.routes";
import { vehicleRoutes } from "./vehicle.routes";
import { articleTagRoutes } from "./articleTag.routes";
import { tagRoutes } from "./tag.routes";
import { bookingRoutes } from "./bookings.route";
import { reviewRoutes } from "./reviews.routes";
import { r2ClientRoutes } from "./r2client.routes";
import userRoutes from "./user.routes";
import PayoutRoutes from "./payout.routes";
import RefundRoutes from "./refund.routes";
import ListingPrice from "./listingprice.routes";
import { contactRoutes } from "./contact.routes";

// Core routes - always enabled
const routes = [
  authRoutes,
  userRoutes,
  r2ClientRoutes, // Required for media uploads
  contactRoutes,
];

// Conditionally add feature routes based on feature flags
if (features.articles) {
  routes.push(articleRoutes);
  routes.push(articleTagRoutes);
}

if (features.locations) {
  routes.push(locationRoutes);
}

if (features.properties) {
  routes.push(propertyRoutes);
  routes.push(roomTypeRoutes);
}

if (features.bookings) {
  routes.push(bookingRoutes);
}

if (features.tourPackages) {
  routes.push(tourPackageRoutes);
}

if (features.vehicles) {
  routes.push(vehicleRoutes);
}

if (features.reviews) {
  routes.push(reviewRoutes);
}

if (features.payouts) {
  routes.push(PayoutRoutes);
}

if (features.refunds) {
  routes.push(RefundRoutes);
}

if (features.listingPrices) {
  routes.push(ListingPrice);
}

if (features.tags) {
  routes.push(tagRoutes);
}

export default routes;

