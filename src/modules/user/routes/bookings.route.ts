import { FastifyInstance } from "fastify";
import { BookingController } from "@modules/user/controller";
import { BookingService } from "@modules/user/service/";

export async function bookingRoutes(app: FastifyInstance) {
  const service = new BookingService();
  const bookingsController = new BookingController(service);

  app.post("/bookings", bookingsController.create.bind(bookingsController));
  app.get("/bookings", bookingsController.findAll.bind(bookingsController));
  app.get("/bookings/:id", bookingsController.findById.bind(bookingsController));
  app.get("/bookings/vendor/:vendorId", bookingsController.findByVendorId.bind(bookingsController));
  app.get("/bookings/customer/:customerId", bookingsController.findByCustomer.bind(bookingsController));
  app.get("/bookings/property/:propertyId", bookingsController.findByProperty.bind(bookingsController));
  app.put("/bookings/:id", bookingsController.update.bind(bookingsController));
  app.delete("/bookings/:id", bookingsController.delete.bind(bookingsController));
  app.patch("/bookings/:id/status", bookingsController.updateStatus.bind(bookingsController));
  app.patch("/bookings/:id/payment-status", bookingsController.updatePaymentStatus.bind(bookingsController));

  app.post("/bookings/:id/transactions", bookingsController.addTransaction.bind(bookingsController));
  // all booked dates by roomType
  app.get("/bookings/roomtype/:roomTypeId/booked-dates", bookingsController.getBookedDatesForRoomType.bind(bookingsController));
  app.get("/bookings/roomtype/:roomTypeId/available-dates", bookingsController.checkRoomAvailability.bind(bookingsController));
  app.get("/bookings/tour/:tourId/available-seats", bookingsController.getAvailableSeatsForTour.bind(bookingsController));
}
