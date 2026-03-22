import { FastifyRequest, FastifyReply } from "fastify";
import { HotelController } from "./hotel.controller";
import { RestaurantController } from "./restaurant.controller";
import { logInfo, logError } from "@lib/logger";

export class PropertyController {
    private hotelController = new HotelController();
    private restaurantController = new RestaurantController();

    async createProperty(req: FastifyRequest, reply: FastifyReply) {
        try {
            const body = req.body as any;
            const type = body.type;
            const authUserId = req.user?.id || req.user?.userId;

            if (!authUserId) {
                return reply.code(401).send({
                    message: "Authentication required. Please log in.",
                });
            }

            logInfo(`Routing property creation for type: ${type}`, { name: body.name });

            // Map frontend fields to backend expected fields if necessary
            // Frontend: streetAddress, cityId, localityId, type, name, description, images[]
            // Backend (Hotel): name, price, location_name, description, location_id, image, amenities[]
            
            const mappedBody = {
                ...body,
                location_name: body.streetAddress || body.location_name,
                location_id: Number(body.localityId || body.cityId || body.location_id),
                image: body.images && body.images.length > 0 ? body.images[0] : body.image,
                // price is missing in FE form, defaulting to 0 or keeping as is if present
                price: body.price !== undefined ? Number(body.price) : 0,
                // Always trust authenticated user for vendor ownership.
                vendor_id: authUserId,
            };

            // Update request body with mapped data
            req.body = mappedBody;

            if (type === 'hotel') {
                return await this.hotelController.createHotel(req, reply);
            } else if (type === 'restaurant') {
                return await this.restaurantController.createRestaurant(req, reply);
            } else {
                return reply.code(400).send({ 
                    message: `Unsupported property type: ${type}. Only 'hotel' and 'restaurant' are supported currently.` 
                });
            }
        } catch (error: any) {
            logError(error, 'Property routing');
            reply.code(500).send({ message: error.message || "Internal server error during property routing" });
        }
    }
}
