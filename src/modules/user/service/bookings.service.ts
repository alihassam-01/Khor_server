import { AppDataSource } from "@config/ormconfig";
import { Booking, Payment, Transactions } from "@entity/bookings";
import { Property, TourPackage } from "../entity/property";
import { CreateBookingDto, PaymentDetailsDto } from "../dtos/booking.dto";
import { Between, DataSource } from "typeorm";
import { RoomType } from "../entity/room";
import { User } from "../entity/user";

export class BookingService {
  private repo = AppDataSource.getRepository(Booking);
  private propertyRepository = AppDataSource.getRepository(Property);
  private roomTypeRepository = AppDataSource.getRepository(RoomType);
  // private vehicleRepository = AppDataSource.getRepository("Vehicle");
  private tourPackageRepository = AppDataSource.getRepository(TourPackage);
  private userRepository = AppDataSource.getRepository(User);

  private dataSource: DataSource = AppDataSource;

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
      booking.booking_type = bookingData.booking_type;
      booking.total_amount = bookingData.total_amount;
      booking.check_in_date = bookingData.check_in_date;
      booking.check_out_date = bookingData.check_out_date;
      booking.special_requests = bookingData.special_requests;
      booking.participants_count = bookingData.participants_count;
      booking.booking_status = "pending";
      booking.payment_status = "pending";
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
        booking.tourPackage = await this.tourPackageRepository.findOneByOrFail({
          id: bookingData.tour_package_id,
        });
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
          } else {
            // transaction.failure_reason = paymentResult.last_payment_error?.message || "Payment failed";
          }
        } catch (error: any) {
          console.log("check 06");
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
   * Create a new booking
   */
  // async create(data: any) {
  //   const bookingData: any = {
  //     ...data,
  //     property: data.property || ({ id: data.property_id } as Property),
  //     tourPackage:
  //       data.tourPackage ||
  //       (data.tour_package_id
  //         ? ({ id: data.tour_package_id } as TourPackage)
  //         : undefined),
  //   };

  //   delete bookingData.property_id;
  //   delete bookingData.tour_package_id;

  //   // create a booking intent with status 'pending'
  //   bookingData.booking_status = "pending";
  //   bookingData.payment_status = "pending";

  //   const booking = this.repo.create(bookingData);
  //   return this.repo.save(booking);
  // }
  /**
   * Get all bookings with their related entities
   */
  async findAll() {
    return this.repo.find({
      relations: ["property", "roomType", "vehicle", "tourPackage"],
    });
  }

  /**
   * Get booking by ID
   */
  async findById(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: ["property", "roomType", "vehicle", "tourPackage"],
    });
  }

  /**
   * Get bookings for a specific customer
   */
  async findByCustomer(customerId: string) {
    return this.repo.find({
      where: { customer: { id: customerId } },
      relations: ["property", "roomType", "vehicle", "tourPackage"],
      order: { created_at: "DESC" },
    });
  }

  /**
   * Get bookings for a specific property
   */
  async findByProperty(propertyId: string) {
    return this.repo.find({
      where: { property: { id: propertyId } },
      relations: ["property", "roomType", "vehicle", "tourPackage"],
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
      relations: ["property"],
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
    if (transaction.status === "paid") {
      await this.updatePaymentStatus(bookingId, "paid");
    }
    return AppDataSource.getRepository(Transactions).save(transaction);
  }
}
