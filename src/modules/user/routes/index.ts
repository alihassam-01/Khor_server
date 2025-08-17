// @modules/user/routes/index.ts
import authRoutes from './auth.routes';
import locationRoutes from './location.routes';
import articleRoutes from './article.routes';
import propertyRoutes from './property.routes';
import { roomTypeRoutes } from './roomtype.routes';
import { tourPackageRoutes } from './tourpackage.routes';
import { vehicleRoutes } from './vehicle.routes';
import { articleTagRoutes } from './articleTag.routes';
import { tagRoutes } from './tag.routes';
import { bookingRoutes } from './bookings.route';
import { reviewRoutes } from './reviews.routes';
import { s3ClientRoutes } from './s3client.routes';
import userRoutes from './user.routes'
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
  s3ClientRoutes,
  reviewRoutes,
  userRoutes,
];

export default routes;
