// import { FastifyInstance } from "fastify";
// import { BusinessService } from "../service/business.service";
// import { BusinessController } from "../controller/business.controller";
// import { LocationService } from "../service/location.service";
// import { UserService } from "../service/user.service";
// import { AppDataSource } from "../../../config/ormconfig";

// export default async function BusinessRoutes(fastify: FastifyInstance) {
//       const locationService = new LocationService(AppDataSource);
//       const userService = new UserService();

//     const businessService = new BusinessService(locationService, userService);
//     const businessController = new BusinessController(businessService);

//     fastify.post("/business-type",businessController.createBusinessType.bind(businessController));
//     fastify.post("/business",businessController.createBusiness.bind(businessController));
//     fastify.post("/business/business-setup",businessController.businessSetup.bind(businessController));
//     fastify.get("/business/business-profile/:userUUID", businessController.getBusinessProfile.bind(businessController));
// }
