// @modules/user/routes/index.ts
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

const routes = [
  authRoutes,
  locationRoutes,
  articleRoutes,
  propertyRoutes,
  bookingRoutes,
  roomTypeRoutes,
  tourPackageRoutes,
  articleTagRoutes,
  tagRoutes,
  vehicleRoutes,
  r2ClientRoutes,
  reviewRoutes,
  userRoutes,
  PayoutRoutes,
  RefundRoutes,
  ListingPrice,
];

export default routes;
