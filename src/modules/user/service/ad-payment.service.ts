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

    private toPaymentDTO(payment: AdPayment): IAdPaymentDTO {
        return {
            payment_id: payment.payment_id,
            ad_id: payment.ad_id,
            ad_type: payment.ad_type,
            vendor_id: payment.vendor_id,
            vendor_name: payment.vendor?.customerProfile?.username || payment.vendor?.vendor?.username,
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
        return this.toPaymentDTO(savedPayment);
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
        return this.toPaymentDTO(updatedPayment);
    }

    async getPaymentById(paymentId: string): Promise<IAdPaymentDTO | null> {
        const payment = await this.paymentRepository.findOne({
            where: { payment_id: paymentId },
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
        });

        if (!payment) {
            return null;
        }

        return this.toPaymentDTO(payment);
    }

    async getPaymentsByVendor(vendorId: string): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepository.find({
            where: { vendor_id: vendorId },
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
            order: { created_at: "DESC" },
        });

        return payments.map((payment) => this.toPaymentDTO(payment));
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

        return payments.map((payment) => this.toPaymentDTO(payment));
    }

    async getPendingPayments(): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepository.find({
            where: { payment_status: PaymentStatus.PENDING },
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
            order: { created_at: "DESC" },
        });

        return payments.map((payment) => this.toPaymentDTO(payment));
    }

    async getAllPayments(): Promise<IAdPaymentDTO[]> {
        const payments = await this.paymentRepository.find({
            relations: ["vendor", "vendor.customerProfile", "vendor.vendor"],
            order: { created_at: "DESC" },
        });

        return payments.map((payment) => this.toPaymentDTO(payment));
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
