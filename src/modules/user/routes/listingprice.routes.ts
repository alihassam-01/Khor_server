import { FastifyInstance } from "fastify";
import { ListingPriceController } from "../controller";

export default async function refundRoutes(fastify: FastifyInstance) {
  const listingController = new ListingPriceController();

  fastify.get(
    "/listings",
    listingController.getAllListings.bind(listingController)
  );
  fastify.get(
    "/listings/:id",
    listingController.getListingById.bind(listingController)
  );
  // fastify.post("/listings", listingController.createListing.bind(listingController));
  fastify.put(
    "/listings/:id",
    listingController.updateListing.bind(listingController)
  );
  fastify.delete(
    "/listings/:id",
    listingController.deleteListing.bind(listingController)
  );
  fastify.patch(
    "/listings/:id/commission",
    listingController.changeCommissionRate.bind(listingController)
  );
}
