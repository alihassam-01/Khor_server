import { AppDataSource } from "../../../config/ormconfig";
import { Booking, Payment, Refund, Transactions } from "../entity/bookings";
import { Property, TourPackage } from "../entity/property";
import { CreateBookingDto, PaymentDetailsDto } from "../dtos/booking.dto";
import { Between, DataSource, In, Not } from "typeorm";
import { RoomType } from "../entity/room";
import { User } from "../entity/user";
import { LocationHelperService } from "./helper/location-helper.service";
import { PayoutService } from "./payout.service";
import { Vendor } from "../entity/business";
import { ListingPriceService } from "./listingPrice.service";
import { ListingPrice, Payout } from "../entity/payout";

export class BookingService {
  private repo = AppDataSource.getRepository(Booking);
  private propertyRepository = AppDataSource.getRepository(Property);
  private roomTypeRepository = AppDataSource.getRepository(RoomType);
  // private vehicleRepository = AppDataSource.getRepository("Vehicle");
  private tourPackageRepository = AppDataSource.getRepository(TourPackage);
  private userRepository = AppDataSource.getRepository(User);
  private payoutService = new PayoutService();
  private listingService = new ListingPriceService();

  private dataSource: DataSource = AppDataSource;
  private locationHelper = new LocationHelperService();
  async create(bookingData: CreateBookingDto, paymentData: PaymentDetailsDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create the booking
      const booking = new Booking();
      // get the user from user usign customer_id
      booking.customer = await this.userRepository.findOneByOrFail({
        id: bookingData.customer_id,
      });
      // check availability of roomType
      if (bookingData.booking_type === "hotel") {
        const isAvailable = await this.checkRoomAvailability(
          bookingData.room_type_id || "",
          bookingData.check_in_date,
          bookingData.check_out_date
        );
        if (!isAvailable) {
          throw new Error(
            "Selected room type is not available for the given dates."
          );
        }
      } else if (bookingData.booking_type === "tour") {
        if (
          bookingData.participants_count === undefined ||
          !bookingData.tour_package_id ||
          !bookingData.check_in_date
        ) {
          throw new Error("Missing required booking data for tour.");
        }
        if (
          bookingData.participants_count >
          (await this.getAvailableSeatsForTour(
            bookingData.tour_package_id,
            bookingData.check_in_date
          ))
        ) {
          throw new Error("Not enough available seats for the selected tour.");
        }

        const tourPackage = await this.tourPackageRepository.findOneByOrFail({
          id: bookingData.tour_package_id,
        });
        if (tourPackage.schedule) {
          const { type, days, dates } = tourPackage.schedule;
          const checkInDate = new Date(bookingData.check_in_date);
          if (type === "anytime") {
            // Anytime is always available
          } else if (type === "specific-days") {
            // Check if the booking dates match any of the specified days
            const bookingDays = [checkInDate.getDay()];
            // Convert days to numbers (0-6 for Sunday-Saturday)
            const daysMap: Record<string, number> = {
              sunday: 0,
              monday: 1,
              tuesday: 2,
              wednesday: 3,
              thursday: 4,
              friday: 5,
              saturday: 6,
            };
            if (
              !days.some((day) =>
                bookingDays.includes(daysMap[day.toLowerCase()])
              )
            ) {
              throw new Error(
                "Selected dates do not match the tour package schedule."
              );
            }
          } else if (type === "specific-dates") {
            const bookingDates = [checkInDate.getDate()];
            if (!dates.some((date) => bookingDates.includes(date))) {
              throw new Error(
                "Selected dates do not match the tour package schedule."
              );
            }
          }
        }
      }
      booking.booking_type = bookingData.booking_type;
      booking.total_amount = bookingData.total_amount;
      booking.check_in_date = bookingData.check_in_date;
      booking.special_requests = bookingData.special_requests;
      booking.participants_count = bookingData.participants_count;
      booking.booking_status = "pending";
      booking.payment_status = "pending";
      booking.check_out_date = bookingData.check_out_date;

      // data for the payout entity
      const bookingDays = this.getBookingDays(
        new Date(booking.check_in_date),
        new Date(booking.check_out_date)
      );
      const listedPayout = await this.getListedPayout(booking);
      const payoutAmount = bookingDays * Number(listedPayout?.base_price);
      // Set relationships based on booking type
      if (bookingData.property_id) {
        booking.property = await this.propertyRepository.findOneByOrFail({
          id: bookingData.property_id,
        });
      }
      if (bookingData.booking_type === "hotel" && bookingData.room_type_id) {
        booking.roomType = await this.roomTypeRepository.findOneByOrFail({
          id: bookingData.room_type_id,
        });
        booking.rooms_count = bookingData.rooms_count;
        // } else if (bookingData.booking_type === "car_rental" && bookingData.vehicle_id) {
        //   booking.vehicle = await this.vehicleRepository.findOneByOrFail({
        //     id: bookingData.vehicle_id,
        //   });
      } else if (
        bookingData.booking_type === "tour" &&
        bookingData.tour_package_id
      ) {
        booking.tourPackages = await this.tourPackageRepository.findOneByOrFail(
          {
            id: bookingData.tour_package_id,
          }
        );
      }
      const savedBooking = await queryRunner.manager.save(Booking, booking);
      // 2. Process payment
      let paymentResult;
      let transaction = new Transactions();
      let payment = new Payment();
      transaction.customer_id = bookingData.customer_id;
      transaction.amount = bookingData.total_amount;
      transaction.payment_method = paymentData.payment_method;
      transaction.booking = savedBooking;
      transaction.status = "pending";
      if (paymentData.payment_method === "credit-card") {
        try {
          // Create payment method
          // const paymentMethod = await this.paymentProcessor.createPaymentMethod({
          //   number: paymentData.card_number,
          //   exp_month: paymentData.card_exp_month,
          //   exp_year: paymentData.card_exp_year,
          //   cvc: paymentData.card_cvc,
          // });

          // // Create payment intent
          // const paymentIntent = await this.paymentProcessor.createPaymentIntent(
          //   bookingData.total_amount,
          //   "usd",
          //   { booking_id: savedBooking.id }
          // );

          // // Confirm payment
          // paymentResult = await this.paymentProcessor.confirmCardPayment(
          //   paymentIntent.id,
          //   paymentMethod.id
          // );

          // Simulating payment processing for the example
          paymentResult = {
            status: "succeeded",
            id: "pi_1234567890",
            amount_received: bookingData.total_amount,
          };
          // // Update transaction details
          transaction.status =
            paymentResult.status === "succeeded" ? "succeeded" : "failed";
          payment.amount = bookingData.total_amount;
          payment.status = paymentResult.status as
            | "pending"
            | "succeeded"
            | "failed";
          // payment.payment_processor_id = paymentIntent.id;
          // payment.last4_digits = paymentMethod.card.last4;
          // payment.card_brand = paymentMethod.card.brand;
          payment.payment_processor_id = paymentResult.id;
          payment.last4_digits = "1234";
          payment.card_brand = "VISA";
          if (paymentResult.status === "succeeded") {
            savedBooking.payment_status = "paid";
            booking.payment_status = "paid";
          } else {
            // transaction.failure_reason = paymentResult.last_payment_error?.message || "Payment failed";
          }
        } catch (error: any) {
          transaction.status = "failed";

          transaction.failure_reason = error.message;
          transaction.failure_code = error.code;
          throw error;
        }
      } else {
        // Handle other payment methods (cash, bank transfer, etc.)
        transaction.status = "pending";
      }

      // Save transaction
      const savedTransaction = await queryRunner.manager.save(transaction);
      payment.transaction = savedTransaction;
      await queryRunner.manager.save(payment);
      // Update booking with transaction
      savedBooking.transaction = savedTransaction;
      const bookingWithRelations = await queryRunner.manager.findOne(Booking, {
        where: { id: savedBooking.id },
        relations: ["property", "property.vendor"],
      });
      if (savedTransaction.status === "succeeded") {
        await this.payoutService.create({
          manager: queryRunner.manager,
          amount: payoutAmount,
          vendor: { id: bookingWithRelations?.property.vendor.id } as Vendor,
          transaction: { id: savedTransaction.id } as Transactions,
        });
      }
      await queryRunner.manager.save(savedBooking);
      await queryRunner.commitTransaction();
      return {
        booking: savedBooking,
        transaction: savedTransaction,
        paymentResult,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get all bookings with their related entities
   */
  async findAll() {
    const bookings = await this.repo.find({
      relations: [
        "property",
        "property.address",
        "property.address.location",
        "property.address.location.parent",
        "roomType",
        "vehicle",
        "tourPackages",
        "transaction",
        "customer.vendor",
        "customer.customerProfile",
      ],
    });
    // in the bookings.customer only pass the name, userId and email
    bookings.forEach((booking) => {
      if (booking.customer) {
        booking.customer = {
          email: booking.customer.email,
          userId: booking.customer.id,
          username:
            booking.customer.userType === "vendor"
              ? booking.customer.vendor?.username
              : booking.customer.customerProfile?.username,
          profile_picture:
            booking.customer.userType === "vendor"
              ? booking.customer.vendor?.profile_picture
              : booking.customer.customerProfile?.profile_picture,
        } as any;
      }
    });
    // remove the customer.vendor and customer.customerProfile
    bookings.forEach((booking) => {
      if (booking.customer) {
        delete booking.customer.vendor;
        delete booking.customer.customerProfile;
      }
    });
    return bookings;
  }
  /**
   * Get booking by ID
   */
  async findById(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: [
        "property",
        "roomType",
        "vehicle",
        "tourPackages",
        "transaction",
      ],
    });
  }

  /**
   * Get bookings by vendor ID
   */
  async findByVendorId(vendorId: string) {
    // First get properties with basic relations
    const properties = await this.propertyRepository.find({
      where: { vendor: { id: vendorId } },
      relations: [
        "vendor",
        "deals",
        "address",
        "address.location",
        "address.location.parent",
      ],
    });
    // Enrich properties with location data
    const enrichedProperties = await Promise.all(
      properties.map((property) =>
        this.locationHelper.enrichWithLocationData(property)
      )
    );
    // Create a map for quick lookup
    const propertyMap = new Map(enrichedProperties.map((p) => [p.id, p]));

    const bookings = await this.repo.find({
      where: { property: { id: In(enrichedProperties.map((p) => p.id)) } },
      relations: [
        "property",
        "roomType",
        "vehicle",
        "tourPackages",
        "tourPackages.destinations",
        "customer.vendor",
        "customer.customerProfile",
        "transaction",
      ],
    });

    // Remove customer details except vendor and customerProfile
    bookings.forEach((booking) => {
      if (booking.customer) {
        booking.customer = {
          email: booking.customer.email,
          vendor: booking.customer.vendor,
          customerProfile: booking.customer.customerProfile,
        } as any;
      }
    });

    // Replace each booking's property with the enriched version
    return bookings.map((booking) => {
      return {
        ...booking,
        property: propertyMap.get(booking.property.id),
      };
    });
  }
  /**
   * Get bookings for a specific customer
   */
  async findByCustomer(customerId: string) {
    return this.repo.find({
      where: { customer: { id: customerId } },
      relations: [
        "property",
        "roomType",
        "vehicle",
        "tourPackages",
        "transaction",
      ],
      order: { created_at: "DESC" },
    });
  }

  /**
   * Get bookings for a specific property
   */
  async findByProperty(propertyId: string) {
    return this.repo.find({
      where: { property: { id: propertyId } },
      relations: [
        "property",
        "roomType",
        "vehicle",
        "tourPackages",
        "transaction",
      ],
    });
  }

  /**
   * Update booking by ID
   */
  async update(id: string, updates: Partial<Booking>) {
    await this.repo.update(id, updates);
    return this.findById(id);
  }

  /**
   * Delete a booking
   */
  async delete(id: string) {
    await this.repo.delete(id);
    return { success: true };
  }

  /**
   * Find bookings within a date range
   */
  async findWithinDates(start: string, end: string) {
    return this.repo.find({
      where: {
        check_in_date: Between(start, end),
      },
      relations: ["property", "transaction"],
    });
  }

  /**
   * Update booking status
   */
  async updateStatus(id: string, status: Booking["booking_status"]) {
    await this.repo.update(id, { booking_status: status });
    return this.findById(id);
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(id: string, status: Booking["payment_status"]) {
    await this.repo.update(id, { payment_status: status });
    return this.findById(id);
  }

  /**
   * Add a transaction to a booking
   */
  async addTransaction(
    bookingId: string,
    transactionData: Partial<Transactions>
  ) {
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    const transaction = new Transactions();
    transaction.booking = booking;
    transaction.amount = transactionData.amount || 0;
    transaction.payment_method = transactionData.payment_method || "unknown";
    transaction.transaction_date = new Date();
    transaction.status = transactionData.status || "pending";
    transaction.customer_id = booking.customer.id;
    if (transaction.status === "succeeded") {
      await this.updatePaymentStatus(bookingId, "paid");
      // add payout
      await this.payoutService.create({
        amount: transaction.amount,
        vendor: booking.property.vendor,
        transaction,
      });
    }
    return AppDataSource.getRepository(Transactions).save(transaction);
  }

  // check availability of roomType

  // get the total rooms from roomType and then check if the rooms are available by comparing the booked rooms with the total rooms
  async checkRoomAvailability(
    roomTypeId: string,
    checkInDate: string,
    checkOutDate: string
  ) {
    const roomType = await this.roomTypeRepository.findOneByOrFail({
      id: roomTypeId,
    });

    // Get all bookings for this room type within the date range
    const bookings = await this.repo.find({
      where: {
        roomType: { id: roomTypeId },
        check_in_date: Between(checkInDate, checkOutDate),
        booking_status: Not(
          In(["cancelled", "completed", "refunded", "partial_refund"])
        ),
      },
    });

    // Calculate total booked rooms
    const totalBookedRooms = bookings.reduce(
      (total, booking) => total + (booking.rooms_count || 0),
      0
    );

    return (
      roomType.total_rooms - totalBookedRooms >= (roomType.total_rooms || 1)
    );
  }

  /**
   * Get all booked dates for a room type
   **/
  async getBookedDatesForRoomType(roomTypeId: string) {
    const bookings = await this.repo.find({
      where: {
        roomType: { id: roomTypeId },
        booking_status: Not(In(["cancelled", "completed"])), // Exclude cancelled and completed bookings
      },
      select: ["check_in_date", "check_out_date"],
    });

    const bookedDates: { start: string; end: string }[] = bookings.map(
      (booking) => ({
        start: booking.check_in_date,
        end: booking.check_out_date,
      })
    );
    return bookedDates;
  }

  // seats available for tour.
  async getAvailableSeatsForTour(tourPackageId: string, checkInDate: string) {
    const tourPackage = await this.tourPackageRepository.findOneByOrFail({
      id: tourPackageId,
    });
    if (
      !tourPackage.is_flexible_participants ||
      tourPackage.schedule?.type === "anytime"
    ) {
      return tourPackage.max_participants || 0;
    }
    // Get all bookings for this tour package on the specified date
    const bookings = await this.repo.find({
      where: {
        tourPackages: { id: tourPackageId },
        check_in_date: checkInDate,
        booking_status: Not(In(["cancelled", "completed"])), // Exclude cancelled and completed bookings
      },
    });
    // Calculate total booked seats
    const totalBookedSeats = bookings.reduce(
      (total, booking) => total + (booking.participants_count || 0),
      0
    );
    return Math.max((tourPackage.max_participants || 0) - totalBookedSeats, 0);
  }

  /**
   * Get all roomType IDs booked for a given date range
   */
  async getBookedRooms(
    checkInDate: string,
    checkOutDate: string
  ): Promise<string[]> {
    // Convert passed dates to Date objects and set time to 00:00:00 for accurate comparison
    const startDate = new Date(checkInDate + "T00:00:00");
    const endDate = new Date(checkOutDate + "T23:59:59");

    const bookings = await this.repo.find({
      where: {
        check_in_date: Between(startDate.toISOString(), endDate.toISOString()),
        booking_status: Not(
          In(["cancelled", "completed", "refunded", "partial_refund"])
        ),
      },
      relations: ["roomType"],
    });

    // Collect unique roomType IDs
    const roomTypeIds = Array.from(
      new Set(bookings.filter((b) => b.roomType).map((b) => b.id))
    );
    return roomTypeIds;
  }
  /**
   * Confirm booking by ID
   */
  async confirmBooking(id: string) {
    await this.repo.update(id, { booking_status: "confirmed" });
    return this.findById(id);
  }

  /**
   * Cancel booking by ID
   */
  async cancelBooking(id: string) {
    const booking = await this.findById(id);
    if (!booking) {
      throw new Error("Booking not found");
    }
    if (new Date(booking.check_in_date) <= new Date()) {
      throw new Error("Cannot cancel booking after check-in date");
    }
    await this.repo.update(id, { booking_status: "cancelled" });
    return this.findById(id);
  }

  async refundBooking(id: string, reason: string) {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const booking = await this.findById(id);
      if (!booking) {
        throw new Error("Booking not found");
      }
      if (
        booking.booking_status === "partial_refund" ||
        booking.booking_status === "refunded" ||
        booking.booking_status === "cancelled"
      ) {
        console.error("Booking already refunded or cancelled");
        return null;
      }
      const refundRepo = queryRunner.manager.getRepository(Refund);
      const { refund: refundAmount, vendorRefund: vendorPayout } =
        await this.getRefundAmount(booking);

      // Update payout
      const payoutRepo = queryRunner.manager.getRepository(Payout);
      await payoutRepo.update(
        { transaction: { id: booking.transaction.id } },
        { amount: vendorPayout }
      );
      // Create refund entry
      const refund = refundRepo.create({
        booking: booking,
        reason: reason,
        created_at: new Date(),
        refund_amount: refundAmount,
      });

      if (refundAmount == booking.total_amount) {
        await queryRunner.manager.update(Booking, id, {
          booking_status: "refunded",
        });
        refund.refund_type = "full";
      } else if (refundAmount < booking.total_amount && refundAmount > 0) {
        await queryRunner.manager.update(Booking, id, {
          booking_status: "partial_refund",
        });
        refund.reason = "Partial Refund: " + reason;
        refund.refund_type = "partial";
      } else {
        refund.reason = "Date Not eligible for refund: " + reason;
        refund.refund_status = "denied";
        refund.refund_type = "partial";
      }

      await refundRepo.save(refund);
      await queryRunner.commitTransaction();
      return this.findById(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private getBookingDays(checkInDate: Date, checkOutDate: Date): number {
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  private async getRefundAmount(
    booking: Booking
  ): Promise<{ refund: number; vendorRefund: number }> {
    const listedPayout = await this.getListedPayout(booking);
    const commissionRate = Number(listedPayout?.commission_rate) || 0;
    const checkIn = new Date(booking.check_in_date);
    const checkOut = new Date(booking.check_out_date);
    const cancel = new Date();

    const bookingDays = this.getBookingDays(checkIn, checkOut); // total days booked
    const perDay = booking.total_amount / bookingDays;
    const vendorPerDay = perDay / (1 + commissionRate);
    let refund = 0;
    let vendorRefund = 0;
    let firstUpcomingHandled = false;

    for (let i = 0; i < bookingDays; i++) {
      const dayStart = new Date(checkIn);
      dayStart.setDate(checkIn.getDate() + i); // start of each booked day

      // If this day has already started → no refund, vendor gets full payout
      if (cancel >= dayStart) {
        vendorRefund += vendorPerDay;
        continue;
      }

      const hoursDiff =
        (dayStart.getTime() - cancel.getTime()) / (1000 * 60 * 60);

      if (hoursDiff >= 48) {
        // full refund for this day
        refund += perDay;
        // vendor gets nothing
      } else if (hoursDiff >= 12) {
        if (!firstUpcomingHandled) {
          // First upcoming day → 75% refund, vendor gets 25%
          refund += perDay * 0.75;
          vendorRefund += vendorPerDay * 0.25;
          firstUpcomingHandled = true;
        } else {
          // Later days in this window → full refund
          refund += perDay;
        }
      } else {
        // <12 hours → no refund
        vendorRefund += vendorPerDay;
      }
    }

    return { refund, vendorRefund };
  }

  private async getListedPayout(
    booking: Booking
  ): Promise<ListingPrice | null> {
    const listingType: "vehicle" | "room" | "tour" =
      booking.booking_type === "car_rental"
        ? "vehicle"
        : booking.booking_type === "hotel"
        ? "room"
        : "tour";

    let listingId: string | undefined;
    if (listingType === "room" && booking.roomType) {
      listingId = booking.roomType.id;
    } else if (listingType === "tour" && booking.tourPackages) {
      listingId = booking.tourPackages.id;
    } else if (listingType === "vehicle" && booking.vehicle) {
      listingId = booking.vehicle.id;
    } else {
      listingId = booking.property.id;
    }

    return this.listingService.findByIdAndType(listingId, listingType);
  }
}
