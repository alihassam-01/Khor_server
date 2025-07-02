import { FastifyReply, FastifyRequest } from "fastify";
import { BookingService } from "@modules/user/service";
import { Booking } from "@entity/bookings";

export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  async create(
    req: FastifyRequest<{ Body: Partial<Booking> }>,
    reply: FastifyReply
  ) {
    try {
      const created = await this.bookingService.create(req.body);
      reply.send(created);
    } catch (error: any) {
      this.handleError(reply, error, "Error creating booking", "50001");
    }
  }

  async findAll(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const bookings = await this.bookingService.findAll();
      reply.send(bookings);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching bookings", "50002");
    }
  }

  async findById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const booking = await this.bookingService.findById(req.params.id);
      if (!booking) return reply.code(404).send({ message: "Not found", code: "40401" });
      reply.send(booking);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching booking", "50003");
    }
  }

  async findByCustomer(
    req: FastifyRequest<{ Params: { customerId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const bookings = await this.bookingService.findByCustomer(req.params.customerId);
      reply.send(bookings);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching bookings", "50004");
    }
  }

  async findByProperty(
    req: FastifyRequest<{ Params: { propertyId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const bookings = await this.bookingService.findByProperty(req.params.propertyId);
      reply.send(bookings);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching bookings", "50005");
    }
  }

  async update(
    req: FastifyRequest<{ Params: { id: string }; Body: Partial<Booking> }>,
    reply: FastifyReply
  ) {
    try {
      const updated = await this.bookingService.update(req.params.id, req.body);
      reply.send(updated);
    } catch (error: any) {
      this.handleError(reply, error, "Error updating booking", "50006");
    }
  }

  async delete(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.bookingService.delete(req.params.id);
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error deleting booking", "50007");
    }
  }

  async updateStatus(
    req: FastifyRequest<{ Params: { id: string }; Body: { booking_status: Booking["booking_status"] } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.bookingService.updateStatus(req.params.id, req.body.booking_status);
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error updating booking status", "50008");
    }
  }

  async updatePaymentStatus(
    req: FastifyRequest<{ Params: { id: string }; Body: { payment_status: Booking["payment_status"] } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.bookingService.updatePaymentStatus(req.params.id, req.body.payment_status);
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error updating payment status", "50009");
    }
  }

  private handleError(reply: FastifyReply, error: any, defaultMessage: string, code: string) {
    let parsed = { message: defaultMessage, code };
    try {
      parsed = JSON.parse(error.message);
    } catch (_) {
      parsed.message = error.message || defaultMessage;
    }
    reply.code(400).send(parsed);
  }
}
