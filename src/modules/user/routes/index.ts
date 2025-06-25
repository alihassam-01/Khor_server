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

const routes = [
  authRoutes,
  locationRoutes,
  articleRoutes,
  propertyRoutes,
  roomTypeRoutes,
  tourPackageRoutes,
  vehicleRoutes,
  // businessRoutes,
  // hotelRoutes,
];

export default routes;
