import { FastifyRequest, FastifyReply } from "fastify";
import { HotelController } from "./hotel.controller";
import { RestaurantController } from "./restaurant.controller";
import { logInfo, logError, logWarn } from "@lib/logger";
import { ICreateProperty } from "@modules/user/dtos";
import { isValidUuid } from "@common/utils/uuid.util";
import { UserRole } from "@common/enums";

export class PropertyController {
    private hotelController = new HotelController();
    private restaurantController = new RestaurantController();

    async createProperty(
        req: FastifyRequest<{ Body: ICreateProperty }>, 
        reply: FastifyReply
    ) {
        try {
            const body = req.body;
            const type = body.type;
            const user = req.user as { id?: string; userId?: string } | undefined;
            const authUserId = user?.id || user?.userId;

            logInfo(`Property creation request`, { 
                type, 
                authUserId, 
                userObject: user 
            });

            if (!authUserId) {
                return reply.code(401).send({
                    message: "Authentication required. Please log in.",
                });
            }

            if (!isValidUuid(authUserId)) {
                logWarn(`Invalid authUserId (non-UUID): "${authUserId}"`);
                return reply.code(400).send({
                    message: `Invalid user identity format. Please re-login. (ID: ${authUserId})`,
                });
            }

            logInfo(`Routing property creation for type: ${type}`, { name: body.name });

            // Map frontend fields (ICreateProperty) to backend expected fields
            const mappedBody = {
                ...body,
                location_name: (body as any).location_name || body.streetAddress || "",
                location_id: (body as any).location_id || Number(body.localityId),
                image: body.images && body.images.length > 0 ? body.images[0] : "",
                price: body.price || 0, // Default for routing, will be handled by sub-controllers if needed
                vendor_id: (req.user as any)?.userType === UserRole.ADMIN ? ((body as any).vendor_id || authUserId) : authUserId,
            };

            // Update request body with mapped data for sub-controllers
            // Note: We cast to 'any' here because we are dynamically swapping the body for the sub-controller
            (req as any).body = mappedBody;

            if (type === 'hotel') {
                return await this.hotelController.createHotel(req as any, reply);
            } else if (type === 'restaurant') {
                return await this.restaurantController.createRestaurant(req as any, reply);
            } else {
                return reply.code(400).send({ 
                    message: `Unsupported property type: ${type}. Only 'hotel' and 'restaurant' are supported currently.` 
                });
            }
        } catch (error: unknown) {
            const err = error as Error;
            logError(err, 'Property routing');
            reply.code(500).send({ message: err.message || "Internal server error during property routing" });
        }
    }
}
