import { AppDataSource } from "@config/ormconfig";
import { In } from "typeorm";
import { AdPayment } from "@modules/user/entity/payment/ad-payment.entity";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import {
    ICreateAdPaymentDTO,
    IUpdateAdPaymentDTO,
    IAdPaymentDTO,
} from "@modules/user/dtos";
import { PaymentStatus, PropertyType } from "@common/enums";
import { ListingType } from "@common/enums/listing.enums";
import { isValidUuid } from "@common/utils/uuid.util";
import { logInfo, logWarn, logError } from "@lib/logger";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { SendEmail } from "./email/sendEmail";
import { VendorSubscriptionService } from "./listing/vendor-subscription.service";

const propertyTypeToListingType: Record<string, ListingType> = {
    [PropertyType.HOTEL]: ListingType.HOTEL,
    [PropertyType.RESTAURANT]: ListingType.RESTAURANT,
    [PropertyType.TOUR]: ListingType.TOUR,
    [PropertyType.VEHICLE]: ListingType.VEHICLE,
    [PropertyType.CAR_RENTAL]: ListingType.VEHICLE,
};

const listingTypeToPropertyType: Record<ListingType, PropertyType> = {
    [ListingType.HOTEL]: PropertyType.HOTEL,
    [ListingType.RESTAURANT]: PropertyType.RESTAURANT,
    [ListingType.TOUR]: PropertyType.TOUR,
    [ListingType.VEHICLE]: PropertyType.VEHICLE,
};

/**
 * Façade over `ad_payments`. Externally we still expose the legacy
 * `ad_id` / `ad_type` fields; internally everything is a Listing.
 */
export class AdPaymentService {
    private paymentRepo = AppDataSource.getRepository(AdPayment);
    private listingRepo = AppDataSource.getRepository(Listing);
    private emailService = new SendEmail();
    private subscriptionService = new VendorSubscriptionService();

    private async loadListings(ids: string[]): Promise<Map<string, Listing>> {
        const valid = ids.filter(isValidUuid);
        if (valid.length === 0) return new Map();
        const rows = await this.listingRepo.find({
            where: { id: In(valid) },
            relations: ["location"],
        });
        return new Map(rows.map((l) => [l.id, l]));
    }

    private async getPrimaryListingForVendor(vendorId: string): Promise<Listing | null> {
        return this.listingRepo
            .createQueryBuilder("listing")
            .leftJoinAndSelect("listing.location", "location")
            .where("listing.vendor_id = :vendorId", { vendorId })
            .orderBy(`
                CASE
                    WHEN listing.type = :hotelType THEN 0
                    WHEN listing.type = :restaurantType THEN 1
                    ELSE 2
                END
            `, "ASC")
            .addOrderBy("listing.created_at", "ASC")
            .setParameters({
                hotelType: ListingType.HOTEL,
                restaurantType: ListingType.RESTAURANT,
            })
            .getOne();
    }

    private async resolveListingForPayment(
        vendorId: string,
        paymentData: ICreateAdPaymentDTO,
    ): Promise<Listing> {
        if (paymentData.ad_id) {
            if (!isValidUuid(paymentData.ad_id)) {
                logWarn(`Invalid ad_id UUID: "${paymentData.ad_id}"`);
                throw new AppError(
                    `Invalid ad_id format. Must be a UUID. Received: "${paymentData.ad_id}"`,
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            const listing = await this.listingRepo.findOne({
                where: { id: paymentData.ad_id },
            });
            if (!listing) {
                throw new AppError("Listing not found", 404, ErrorCodes.NOT_FOUND);
            }
            return listing;
        }

        const primaryListing = await this.getPrimaryListingForVendor(vendorId);
        if (!primaryListing) {
            throw new AppError(
                "No connected hotel or restaurant found for this vendor subscription",
                404,
                ErrorCodes.NOT_FOUND,
            );
        }
        return primaryListing;
    }

    private async toDTO(
        payment: AdPayment,
        listing?: Listing | null,
    ): Promise<IAdPaymentDTO> {
        const sub = listing
            ? await this.subscriptionService.getCurrent(AppDataSource.manager, payment.vendor_id)
            : null;
        return {
            payment_id: payment.payment_id,
            ad_id: payment.listing_id,
            ad_type: listing
                ? listingTypeToPropertyType[listing.type]
                : PropertyType.HOTEL,
            vendor_id: payment.vendor_id,
            vendor_name: payment.vendor?.profile?.username,
            vendor_email: payment.vendor?.email,
            vendor_phone: payment.vendor?.profile?.phone_number ?? undefined,
            ad_name: listing?.name,
            ad_location: listing?.location?.name,
            plan: sub?.subscription_type,
            is_featured: listing?.is_featured,
            expires_at: sub?.expires_at ?? undefined,
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

    private async toDTOs(payments: AdPayment[]): Promise<IAdPaymentDTO[]> {
        const ids = payments.map((p) => p.listing_id);
        const map = await this.loadListings(ids);
        return Promise.all(payments.map((p) => this.toDTO(p, map.get(p.listing_id) ?? null)));
    }

    async createPayment(paymentData: ICreateAdPaymentDTO): Promise<IAdPaymentDTO> {
        logInfo("Creating ad payment", {
            ad_id: paymentData.ad_id,
            vendor_id: paymentData.vendor_id,
            amount: paymentData.amount,
        });

        if (!isValidUuid(paymentData.vendor_id)) {
            logWarn(`Invalid vendor_id UUID: "${paymentData.vendor_id}"`);
            throw new AppError(
                `Invalid vendor_id format. Must be a UUID. Received: "${paymentData.vendor_id}"`,
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }

        const listing = await this.resolveListingForPayment(paymentData.vendor_id, paymentData);

        const expectedListingType = paymentData.ad_type
            ? propertyTypeToListingType[paymentData.ad_type]
            : undefined;
        if (expectedListingType && listing.type !== expectedListingType) {
            throw new AppError(
                `Listing type mismatch. Expected ${expectedListingType}, got ${listing.type}`,
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }

        const payment = new AdPayment();
        payment.listing_id = listing.id;
        payment.vendor_id = paymentData.vendor_id;
        payment.vendor_subscription_id = (
            await this.subscriptionService.getCurrent(AppDataSource.manager, paymentData.vendor_id)
        )?.id ?? null;
        payment.amount = paymentData.amount;
        payment.payment_method = paymentData.payment_method;
        payment.transaction_id = paymentData.transaction_id;
        payment.notes = paymentData.notes;
        payment.receipt_url = paymentData.receipt_url;
        payment.payment_status = PaymentStatus.PENDING;

        const saved = await this.paymentRepo.save(payment);
        const enriched = await this.paymentRepo.findOne({
            where: { payment_id: saved.payment_id },
            relations: ["vendor", "vendor.profile"],
        });
        return this.toDTO(enriched!, listing);
    }

    async createPaymentForVendor(
        vendorId: string,
        paymentData: ICreateAdPaymentDTO,
    ): Promise<IAdPaymentDTO> {
        if (paymentData.ad_id) {
            const listing = await this.listingRepo.findOne({
                where: { id: paymentData.ad_id, vendor_id: vendorId },
            });

            if (!listing) {
                throw new AppError("Listing not found or access denied", 404, ErrorCodes.NOT_FOUND);
            }
        }

        return this.createPayment({
            ...paymentData,
            vendor_id: vendorId,
        });
    }

    async updatePaymentStatus(
        paymentId: string,
        updateData: IUpdateAdPaymentDTO,
    ): Promise<IAdPaymentDTO> {
        return AppDataSource.transaction(async (em) => {
            const repo = em.getRepository(AdPayment);
            const payment = await repo.findOne({
                where: { payment_id: paymentId },
                relations: ["vendor", "vendor.profile"],
            });

            if (!payment) {
                throw new AppError("Payment not found", 404, ErrorCodes.NOT_FOUND);
            }

            const listing = await em.getRepository(Listing).findOne({
                where: { id: payment.listing_id },
            });

            const isCompleting =
                updateData.payment_status === PaymentStatus.COMPLETED &&
                payment.payment_status !== PaymentStatus.COMPLETED;

            if (isCompleting && listing) {
                await this.subscriptionService.activate(em, listing);
                const sub = payment.vendor_id
                    ? await this.subscriptionService.getCurrent(em, payment.vendor_id)
                    : null;

                if (payment.vendor?.email) {
                    const username = payment.vendor.profile?.username || "Vendor";
                    const adType = listing.type === ListingType.HOTEL ? "Hotel" : "Restaurant";
                    this.emailService
                        .sendAdActivationEmail(
                            username,
                            payment.vendor.email,
                            listing.name,
                            adType,
                            sub?.expires_at ?? new Date(),
                        )
                        .catch((e) => logError(e, "Failed to send ad activation email"));
                }
            }

            if (updateData.payment_status !== undefined) {
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

            const updated = await repo.save(payment);
            return this.toDTO(updated, listing ?? null);
        });
    }

    async getPaymentById(paymentId: string): Promise<IAdPaymentDTO | null> {
        const payment = await this.paymentRepo.findOne({
            where: { payment_id: paymentId },
            relations: ["vendor", "vendor.profile"],
        });
        if (!payment) return null;
        const map = await this.loadListings([payment.listing_id]);
        return this.toDTO(payment, map.get(payment.listing_id) ?? null);
    }

    async getPaymentsByVendor(vendorId: string): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepo.find({
            where: { vendor_id: vendorId },
            relations: ["vendor", "vendor.profile"],
            order: { created_at: "DESC" },
        });
        return this.toDTOs(payments);
    }

    async getPaymentsByAd(adId: string, adType: PropertyType): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepo.find({
            where: { listing_id: adId },
            relations: ["vendor", "vendor.profile"],
            order: { created_at: "DESC" },
        });
        const expectedType = propertyTypeToListingType[adType];
        const map = await this.loadListings(payments.map((p) => p.listing_id));
        const filtered = expectedType
            ? payments.filter((p) => map.get(p.listing_id)?.type === expectedType)
            : payments;
        return Promise.all(
            filtered.map((p) => this.toDTO(p, map.get(p.listing_id) ?? null)),
        );
    }

    async getPaymentsByAdForVendor(
        vendorId: string,
        adId: string,
        adType: PropertyType,
    ): Promise<IAdPaymentDTO[]> {
        const listing = await this.listingRepo.findOne({
            where: { id: adId, vendor_id: vendorId },
        });

        if (!listing) {
            throw new AppError("Listing not found or access denied", 404, ErrorCodes.NOT_FOUND);
        }

        return this.getPaymentsByAd(adId, adType);
    }

    async getPendingPayments(): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepo.find({
            where: { payment_status: PaymentStatus.PENDING },
            relations: ["vendor", "vendor.profile"],
            order: { created_at: "DESC" },
        });
        return this.toDTOs(payments);
    }

    async getAllPayments(): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepo.find({
            relations: ["vendor", "vendor.profile"],
            order: { created_at: "DESC" },
        });
        return this.toDTOs(payments);
    }

    async deletePayment(paymentId: string): Promise<void> {
        const payment = await this.paymentRepo.findOne({
            where: { payment_id: paymentId },
        });
        if (!payment) {
            throw new AppError("Payment not found", 404, ErrorCodes.NOT_FOUND);
        }
        await this.paymentRepo.remove(payment);
    }
}
