import { FastifyRequest, FastifyReply } from "fastify";
import { RestaurantOrderService } from "../service/restaurant-order.service";
import { 
    createOnlineOrderSchema, 
    createManualOrderSchema, 
    updateOrderStatusSchema,
    updateOrderSchema
} from "../dtos/restaurant-order.dto";
import { AppError } from "@common/errors/AppError";

export class RestaurantOrderController {
    private readonly service = new RestaurantOrderService();

    // Guest APIs
    public createOnlineOrder = async (req: FastifyRequest<{ Params: { bookingId: string } }>, reply: FastifyReply) => {
        try {
            const actor = req.user;
            if (!actor) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
            const bookingId = req.params.bookingId;
            const dto = createOnlineOrderSchema.parse(req.body);
            const order = await this.service.createOnlineOrder(actor, bookingId, dto);
            reply.status(201).send(order);
        } catch (e) {
            throw e;
        }
    };

    public getRestaurantOrderingContext = async (req: FastifyRequest<{ Params: { bookingId: string } }>, reply: FastifyReply) => {
        try {
            const actor = req.user;
            if (!actor) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
            const bookingId = req.params.bookingId;
            const context = await this.service.getRestaurantOrderingContext(actor, bookingId);
            reply.send(context);
        } catch (e) {
            throw e;
        }
    };

    public listGuestOrders = async (req: FastifyRequest<{ Params: { bookingId: string } }>, reply: FastifyReply) => {
        try {
            const actor = req.user;
            if (!actor) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
            const bookingId = req.params.bookingId;
            const orders = await this.service.listGuestOrders(actor, bookingId);
            reply.send(orders);
        } catch (e) {
            throw e;
        }
    };

    // Vendor APIs
    public createManualOrder = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const actor = req.user;
            if (!actor) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
            const dto = createManualOrderSchema.parse(req.body);
            const order = await this.service.createManualOrder(actor, dto);
            reply.status(201).send(order);
        } catch (e) {
            throw e;
        }
    };

    public listVendorOrders = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const actor = req.user;
            if (!actor) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
            const orders = await this.service.listVendorOrders(actor);
            reply.send(orders);
        } catch (e) {
            throw e;
        }
    };

    public updateOrderStatus = async (req: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) => {
        try {
            const actor = req.user;
            if (!actor) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
            const orderId = req.params.orderId;
            const dto = updateOrderStatusSchema.parse(req.body);
            const order = await this.service.updateOrderStatus(actor, orderId, dto);
            reply.status(200).send(order);
        } catch (e) {
            throw e;
        }
    };

    public emailReceipt = async (req: FastifyRequest<{ Params: { orderId: string }, Body: { html: string, email: string, subject: string } }>, reply: FastifyReply) => {
        try {
            const actor = req.user;
            if (!actor) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
            const orderId = req.params.orderId;
            const { html, email, subject } = req.body as { html: string, email: string, subject: string };
            
            await this.service.emailReceipt(actor, orderId, email, subject, html);
            reply.status(200).send({ success: true });
        } catch (e) {
            throw e;
        }
    };

    public updateOrderDetails = async (req: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) => {
        try {
            const actor = req.user;
            if (!actor) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
            const orderId = req.params.orderId;
            const dto = updateOrderSchema.parse(req.body);
            const order = await this.service.updateOrderDetails(actor, orderId, dto);
            reply.send(order);
        } catch (e) {
            throw e;
        }
    };

    public recordVendorPayment = async (req: FastifyRequest<{ Params: { orderId: string }, Body: { amount: number } }>, reply: FastifyReply) => {
        try {
            const actor = req.user;
            if (!actor) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
            const orderId = req.params.orderId;
            const { amount } = req.body as { amount: number };
            if (typeof amount !== 'number' || amount <= 0) throw new AppError("amount must be a positive number", 400, "BAD_REQUEST");
            const order = await this.service.recordVendorPayment(actor, orderId, amount);
            reply.status(200).send(order);
        } catch (e) {
            throw e;
        }
    };
}
