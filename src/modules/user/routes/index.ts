// @modules/user/routes/index.ts
import authRoutes from './auth.routes';
import locationRoutes from './location.routes';
import articleRoutes from './article.routes';
import propertyRoutes from './property.routes';
import { roomTypeRoutes } from './roomtype.routes';
import { tourPackageRoutes } from './tourpackage.routes';
import { vehicleRoutes } from './vehicle.routes';
// import businessRoutes from './business.routes';
// import hotelRoutes from './hotel.routes';
import { articleTagRoutes } from './articleTag.routes';
import { tagRoutes } from './tag.routes';

const routes = [
  authRoutes,
  locationRoutes,
  articleRoutes,
  propertyRoutes,
  roomTypeRoutes,
  tourPackageRoutes,
  articleTagRoutes,
  tagRoutes,
  vehicleRoutes,
  // businessRoutes,
  // hotelRoutes,
];

export default routes;
