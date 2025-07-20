import { AppDataSource } from "@config/ormconfig";
import { Booking, Transactions } from "@entity/bookings";
import { Between } from "typeorm";
import { Property, TourPackage } from "../entity/property";

export class BookingService {
  private repo = AppDataSource.getRepository(Booking);

  /**
   * Create a new booking
   */
  async create(data: any) {
    const bookingData: any = {
      ...data,
      property: data.property || ({ id: data.property_id } as Property),
      tourPackage:
        data.tourPackage ||
        (data.tour_package_id
          ? ({ id: data.tour_package_id } as TourPackage)
          : undefined),
    };

    delete bookingData.property_id;
    delete bookingData.tour_package_id;

    const booking = this.repo.create(bookingData);
    return this.repo.save(booking);
  }
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
      where: { customer_id: customerId },
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
    transaction.customer_id = booking.customer_id;
    if (transaction.status === "paid") {
      await this.updatePaymentStatus(bookingId, "paid");
    }
    return AppDataSource.getRepository(Transactions).save(transaction);
  }
}
