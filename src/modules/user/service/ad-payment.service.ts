import { AppDataSource } from "@config/ormconfig";
import { AdPayment } from "@modules/user/entity/ads";
import {
    ICreateAdPaymentDTO,
    IUpdateAdPaymentDTO,
    IAdPaymentDTO,
} from "../dtos/ad-payment.dto";
import { PaymentStatus, AdType } from "@modules/user/entity/ENUM/ad-payment.enum";

export class AdPaymentService {
    private paymentRepository = AppDataSource.getRepository(AdPayment);

    private async toPaymentDTO(payment: AdPayment, hotel?: any, restaurant?: any): Promise<IAdPaymentDTO> {
        const ad = payment.ad_type === AdType.HOTEL ? hotel : restaurant;
        
        return {
            payment_id: payment.payment_id,
            ad_id: payment.ad_id,
            ad_type: payment.ad_type,
            vendor_id: payment.vendor_id,
            vendor_name: payment.vendor?.customerProfile?.username || payment.vendor?.vendor?.username,
            vendor_email: payment.vendor?.email,
            vendor_phone: payment.vendor?.vendor?.phone_number || payment.vendor?.customerProfile?.phone_number,
            ad_name: ad?.name,
            ad_location: ad?.location_name,
            plan: ad?.subscription_type,
            is_featured: ad?.is_featured,
            expires_at: ad?.expires_at,
            amount: Number(payment.amount),
            payment_status: payment.payment_status,
            payment_method: payment.payment_method,
            transaction_id: payment.transaction_id,
            notes: payment.notes,
            receipt_url: payment.receipt_url,
            created_at: payment.created_at,
            updated_at: payment.updated_at,
        };
    }

    async createPayment(
        paymentData: ICreateAdPaymentDTO
    ): Promise<IAdPaymentDTO> {
        const payment = new AdPayment();
        payment.ad_id = paymentData.ad_id;
        payment.ad_type = paymentData.ad_type;
        payment.vendor_id = paymentData.vendor_id;
        payment.amount = paymentData.amount;
        payment.payment_method = paymentData.payment_method;
        payment.transaction_id = paymentData.transaction_id;
        payment.notes = paymentData.notes;
        payment.receipt_url = paymentData.receipt_url;
        payment.payment_status = PaymentStatus.PENDING;

        const savedPayment = await this.paymentRepository.save(payment);
        const savedPaymentWithRelations = await this.paymentRepository.findOne({
            where: { payment_id: savedPayment.payment_id },
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
        });

        // Fetch ad data for enrichment
        const { Hotel } = await import("@modules/user/entity/ads/hotel.entity");
        const { Restaurant } = await import("@modules/user/entity/ads/restaurant.entity");
        
        let ad = null;
        if (savedPayment.ad_type === AdType.HOTEL) {
            ad = await AppDataSource.getRepository(Hotel).findOne({
                where: { id: savedPayment.ad_id },
            });
        } else if (savedPayment.ad_type === AdType.RESTAURANT) {
            ad = await AppDataSource.getRepository(Restaurant).findOne({
                where: { id: savedPayment.ad_id },
            });
        }

        return this.toPaymentDTO(savedPaymentWithRelations!, ad);
    }

    async updatePaymentStatus(
        paymentId: string,
        updateData: IUpdateAdPaymentDTO
    ): Promise<IAdPaymentDTO> {
        const payment = await this.paymentRepository.findOne({
            where: { payment_id: paymentId },
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
        });

        if (!payment) {
            throw new Error("Payment not found");
        }

        if (updateData.payment_status !== undefined) {
            if (updateData.payment_status === PaymentStatus.COMPLETED && payment.payment_status !== PaymentStatus.COMPLETED) {
                const { Hotel } = await import("@modules/user/entity/ads/hotel.entity");
                const { Restaurant } = await import("@modules/user/entity/ads/restaurant.entity");
                const { SUBSCRIPTION_DURATION_DAYS } = await import("../constant/ad-subscription.constant");
                
                if (payment.ad_type === AdType.HOTEL) {
                    const hotelRepo = AppDataSource.getRepository(Hotel);
                    const hotel = await hotelRepo.findOne({ where: { id: payment.ad_id }});
                    if (hotel) {
                        const durationKey = hotel.subscription_type.toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
                        const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey] || 30; // fallback
                        const now = new Date();
                        const currentExpiry = hotel.expires_at && hotel.expires_at > now ? hotel.expires_at : now;
                        hotel.is_active = true;
                        hotel.is_paid = true;
                        hotel.expires_at = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000);
                        await hotelRepo.save(hotel);
                    }
                } else if (payment.ad_type === AdType.RESTAURANT) {
                    const restRepo = AppDataSource.getRepository(Restaurant);
                    const rest = await restRepo.findOne({ where: { id: payment.ad_id }});
                    if (rest) {
                        const durationKey = rest.subscription_type.toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
                        const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey] || 30;
                        const now = new Date();
                        const currentExpiry = rest.expires_at && rest.expires_at > now ? rest.expires_at : now;
                        rest.is_active = true;
                        rest.is_paid = true;
                        rest.expires_at = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000);
                        await restRepo.save(rest);
                    }
                }
            }
            payment.payment_status = updateData.payment_status;
        }
        if (updateData.payment_method !== undefined) {
            payment.payment_method = updateData.payment_method;
        }
        if (updateData.transaction_id !== undefined) {
            payment.transaction_id = updateData.transaction_id;
        }
        if (updateData.notes !== undefined) {
            payment.notes = updateData.notes;
        }
        if (updateData.receipt_url !== undefined) {
            payment.receipt_url = updateData.receipt_url;
        }

        const updatedPayment = await this.paymentRepository.save(payment);
        
        // Fetch ad data for enrichment
        const { Hotel } = await import("@modules/user/entity/ads/hotel.entity");
        const { Restaurant } = await import("@modules/user/entity/ads/restaurant.entity");
        
        let ad = null;
        if (updatedPayment.ad_type === AdType.HOTEL) {
            ad = await AppDataSource.getRepository(Hotel).findOne({
                where: { id: updatedPayment.ad_id },
            });
        } else if (updatedPayment.ad_type === AdType.RESTAURANT) {
            ad = await AppDataSource.getRepository(Restaurant).findOne({
                where: { id: updatedPayment.ad_id },
            });
        }

        return this.toPaymentDTO(updatedPayment, ad);
    }

    async getPaymentById(paymentId: string): Promise<IAdPaymentDTO | null> {
        const payment = await this.paymentRepository.findOne({
            where: { payment_id: paymentId },
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
        });

        if (!payment) {
            return null;
        }

        // Fetch ad data for enrichment
        const { Hotel } = await import("@modules/user/entity/ads/hotel.entity");
        const { Restaurant } = await import("@modules/user/entity/ads/restaurant.entity");
        
        let ad = null;
        if (payment.ad_type === AdType.HOTEL) {
            ad = await AppDataSource.getRepository(Hotel).findOne({
                where: { id: payment.ad_id },
            });
        } else if (payment.ad_type === AdType.RESTAURANT) {
            ad = await AppDataSource.getRepository(Restaurant).findOne({
                where: { id: payment.ad_id },
            });
        }

        return this.toPaymentDTO(payment, ad);
    }

    async getPaymentsByVendor(vendorId: string): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepository.find({
            where: { vendor_id: vendorId },
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
            order: { created_at: "DESC" },
        });

        const { Hotel } = await import("@modules/user/entity/ads/hotel.entity");
        const { Restaurant } = await import("@modules/user/entity/ads/restaurant.entity");

        return Promise.all(payments.map(async (payment) => {
            let ad = null;
            if (payment.ad_type === AdType.HOTEL) {
                ad = await AppDataSource.getRepository(Hotel).findOne({
                    where: { id: payment.ad_id },
                });
            } else if (payment.ad_type === AdType.RESTAURANT) {
                ad = await AppDataSource.getRepository(Restaurant).findOne({
                    where: { id: payment.ad_id },
                });
            }
            return this.toPaymentDTO(payment, ad);
        }));
    }

    async getPaymentsByAd(
        adId: string,
        adType: AdType
    ): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepository.find({
            where: { ad_id: adId, ad_type: adType },
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
            order: { created_at: "DESC" },
        });

        const { Hotel } = await import("@modules/user/entity/ads/hotel.entity");
        const { Restaurant } = await import("@modules/user/entity/ads/restaurant.entity");

        return Promise.all(payments.map(async (payment) => {
            let ad = null;
            if (payment.ad_type === AdType.HOTEL) {
                ad = await AppDataSource.getRepository(Hotel).findOne({
                    where: { id: payment.ad_id },
                });
            } else if (payment.ad_type === AdType.RESTAURANT) {
                ad = await AppDataSource.getRepository(Restaurant).findOne({
                    where: { id: payment.ad_id },
                });
            }
            return this.toPaymentDTO(payment, ad);
        }));
    }

    async getPendingPayments(): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepository.find({
            where: { payment_status: PaymentStatus.PENDING },
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
            order: { created_at: "DESC" },
        });

        const { Hotel } = await import("@modules/user/entity/ads/hotel.entity");
        const { Restaurant } = await import("@modules/user/entity/ads/restaurant.entity");

        return Promise.all(payments.map(async (payment) => {
            let ad = null;
            if (payment.ad_type === AdType.HOTEL) {
                ad = await AppDataSource.getRepository(Hotel).findOne({
                    where: { id: payment.ad_id },
                });
            } else if (payment.ad_type === AdType.RESTAURANT) {
                ad = await AppDataSource.getRepository(Restaurant).findOne({
                    where: { id: payment.ad_id },
                });
            }
            return this.toPaymentDTO(payment, ad);
        }));
    }

    async getAllPayments(): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepository.find({
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
            order: { created_at: "DESC" },
        });

        const { Hotel } = await import("@modules/user/entity/ads/hotel.entity");
        const { Restaurant } = await import("@modules/user/entity/ads/restaurant.entity");

        return Promise.all(payments.map(async (payment) => {
            let ad = null;
            if (payment.ad_type === AdType.HOTEL) {
                ad = await AppDataSource.getRepository(Hotel).findOne({
                    where: { id: payment.ad_id },
                });
            } else if (payment.ad_type === AdType.RESTAURANT) {
                ad = await AppDataSource.getRepository(Restaurant).findOne({
                    where: { id: payment.ad_id },
                });
            }
            return this.toPaymentDTO(payment, ad);
        }));
    }

    async deletePayment(paymentId: string): Promise<void> {
        const payment = await this.paymentRepository.findOne({
            where: { payment_id: paymentId },
        });

        if (!payment) {
            throw new Error("Payment not found");
        }

        await this.paymentRepository.remove(payment);
    }
}
