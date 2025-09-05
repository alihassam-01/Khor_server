import { FastifyReply, FastifyRequest } from "fastify";
import { BookingService } from "../../user/service";
import { Booking } from "../entity/bookings";
import { CreateBookingDto, PaymentDetailsDto } from "../dtos/booking.dto";

export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  async create(
    req: FastifyRequest<{
      Body: { bookingData: CreateBookingDto; paymentData: PaymentDetailsDto };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { paymentData, bookingData } = req.body;
      const created = await this.bookingService.create(
        bookingData,
        paymentData
      );
      const response = {
        status: "success",
        data: {
          booking: {
            ...created.booking,
            customer: undefined, // Remove circular references
            property: undefined,
            transaction: undefined,
          },
          transaction: {
            ...created.transaction,
            booking: undefined,
          },
          paymentResult: created.paymentResult,
        },
      };
      reply.send(response);
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
      if (!booking)
        return reply.code(404).send({ message: "Not found", code: "40401" });
      reply.send(booking);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching booking", "50003");
    }
  }
  async findByVendorId(
    req: FastifyRequest<{ Params: { vendorId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const bookings = await this.bookingService.findByVendorId(
        req.params.vendorId
      );
      if (!bookings)
        return reply.code(404).send({ message: "Not found", code: "40402" });
      reply.send(bookings);
    } catch (error: any) {
      this.handleError(
        reply,
        error,
        "Error fetching bookings by vendor",
        "50003"
      );
    }
  }
  async findByCustomer(
    req: FastifyRequest<{ Params: { customerId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const bookings = await this.bookingService.findByCustomer(
        req.params.customerId
      );
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
      const bookings = await this.bookingService.findByProperty(
        req.params.propertyId
      );
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
    req: FastifyRequest<{
      Params: { id: string };
      Body: { booking_status: Booking["booking_status"] };
    }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.bookingService.updateStatus(
        req.params.id,
        req.body.booking_status
      );
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error updating booking status", "50008");
    }
  }

  async updatePaymentStatus(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { payment_status: Booking["payment_status"] };
    }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.bookingService.updatePaymentStatus(
        req.params.id,
        req.body.payment_status
      );
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error updating payment status", "50009");
    }
  }
  async addTransaction(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { amount: number; payment_method: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const transaction = await this.bookingService.addTransaction(
        req.params.id,
        req.body
      );
      reply.send(transaction);
    } catch (error: any) {
      this.handleError(reply, error, "Error adding transaction", "50010");
    }
  }

  private handleError(
    reply: FastifyReply,
    error: any,
    defaultMessage: string,
    code: string
  ) {
    let parsed = { message: defaultMessage, code };
    try {
      parsed = JSON.parse(error.message);
    } catch (_) {
      parsed.message = error.message || defaultMessage;
    }
    reply.code(400).send(parsed);
  }

  //get all booked dates for roomtype
  async getBookedDatesForRoomType(
    req: FastifyRequest<{ Params: { roomTypeId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const bookedDates = await this.bookingService.getBookedDatesForRoomType(
        req.params.roomTypeId
      );
      reply.send(bookedDates);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching booked dates", "50011");
    }
  }

  async checkRoomAvailability(
    req: FastifyRequest<{
      Body: { roomTypeId: string; checkInDate: string; checkOutDate: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const isAvailable = await this.bookingService.checkRoomAvailability(
        req.body.roomTypeId,
        req.body.checkInDate,
        req.body.checkOutDate
      );
      reply.send({ available: isAvailable });
    } catch (error: any) {
      this.handleError(
        reply,
        error,
        "Error checking room availability",
        "50012"
      );
    }
  }

  async getAvailableSeatsForTour(
    req: FastifyRequest<{
      Params: { tourId: string };
      Querystring: { checkInDate: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const seatsAvailable = await this.bookingService.getAvailableSeatsForTour(
        req.params.tourId,
        req.query.checkInDate
      );
      reply.send(seatsAvailable);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching available seats", "50013");
    }
  }

  // confirm booking
  async confirmBooking(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const booking = await this.bookingService.confirmBooking(req.params.id);
      reply.send(booking);
    } catch (error: any) {
      this.handleError(reply, error, "Error confirming booking", "50014");
    }
  }

  // cancel booking
  async cancelBooking(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const booking = await this.bookingService.cancelBooking(req.params.id);
      reply.send(booking);
    } catch (error: any) {
      this.handleError(reply, error, "Error cancelling booking", "50015");
    }
  }

  // refund booking
  async refundBooking(
    req: FastifyRequest<{ Params: { id: string }; Body: { reason: string } }>,
    reply: FastifyReply
  ) {
    try {
      const booking = await this.bookingService.refundBooking(
        req.params.id,
        req.body.reason
      );
      reply.send(booking);
    } catch (error: any) {
      this.handleError(reply, error, "Error refunding booking", "50016");
    }
  }
}
