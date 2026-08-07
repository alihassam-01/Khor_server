import crypto from "node:crypto";
import Safepay from "@sfpy/node-core";
import { CONFIG } from "@config/config";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { logInfo } from "@lib/logger";

type CreateCheckoutSessionInput = {
    basketId: string;
    amount: number;
    customerEmail: string;
    customerMobile: string;
    customerIp?: string;
    description: string;
    successUrl: string;
    failureUrl: string;
    checkoutUrl: string;
};

type SafepayTransactionResult = {
    state: "paid" | "failed" | "cancelled" | "pending";
    transactionId?: string | null;
    message?: string | null;
    trackerToken?: string | null;
};

type SafepayWebhook = {
    token?: string;
    type?: string;
    data?: {
        tracker?: string;
        state?: string;
        success?: boolean;
        amount?: number;
        currency?: string;
        metadata?: Record<string, unknown>;
        transaction_id?: string;
        message?: string;
    };
};

const normalizeResponse = (response: any): any => response?.data ?? response;

export class SafepayService {
    private client(): Safepay {
        if (!CONFIG.safepay.secretKey || !CONFIG.safepay.apiKey) {
            throw new AppError(
                "Safepay credentials are not configured.",
                503,
                ErrorCodes.INTERNAL_SERVER_ERROR,
            );
        }

        return new Safepay(CONFIG.safepay.secretKey, {
            authType: "secret",
            host: CONFIG.safepay.host,
        });
    }

    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{
        checkoutUrl: string;
        trackerToken: string;
        formFields: Record<string, string>;
    }> {
        const client = this.client();
        const amount = Math.round(input.amount * 100);
        const sessionResponse = await client.payments.session.setup({
            merchant_api_key: CONFIG.safepay.apiKey,
            intent: CONFIG.safepay.intent,
            mode: "payment",
            entry_mode: "raw",
            currency: "PKR",
            amount,
            metadata: {
                order_id: input.basketId,
            },
            include_fees: false,
        });
        const session = normalizeResponse(sessionResponse);
        const trackerToken = String(session?.tracker?.token ?? "");
        if (!trackerToken) {
            throw new AppError("Safepay did not return a tracker token.", 502, ErrorCodes.INTERNAL_SERVER_ERROR);
        }

        const passportResponse = await client.client.passport.create();
        const passportToken = String(normalizeResponse(passportResponse) ?? "");
        if (!passportToken) {
            throw new AppError("Safepay did not return an authentication token.", 502, ErrorCodes.INTERNAL_SERVER_ERROR);
        }

        const checkoutUrl = client.checkout.createCheckoutUrl({
            tracker: trackerToken,
            tbt: passportToken,
            env: CONFIG.safepay.environment,
            source: "hosted",
            redirect_url: input.successUrl,
            cancel_url: input.failureUrl,
        });

        logInfo("Safepay checkout session created", {
            basketId: input.basketId,
            trackerToken,
            expiresInMinutes: CONFIG.safepay.checkoutHoldMinutes,
        });

        return { checkoutUrl, trackerToken, formFields: {} };
    }

    async getTransactionStatus(input: {
        trackerToken?: string | null;
        transactionId?: string | null;
        basketId?: string | null;
    }): Promise<SafepayTransactionResult> {
        const trackerToken = input.trackerToken ?? input.transactionId;
        if (!trackerToken) {
            return { state: "pending", message: "Safepay tracker is not available." };
        }

        const response = normalizeResponse(await this.client().reporter.payments.fetch(trackerToken));
        const tracker = response?.tracker ?? response?.data?.tracker ?? {};
        const state = String(
            tracker.state
            ?? response?.state
            ?? response?.data?.state
            ?? "",
        ).toUpperCase();
        const action = response?.action ?? response?.data?.action ?? {};
        const charge = response?.charge ?? response?.data?.charge ?? {};
        const transactionId = action?.token
            ?? response?.transaction_id
            ?? response?.data?.transaction_id
            ?? charge?.token
            ?? null;

        if (state === "TRACKER_ENDED") return { state: "paid", transactionId, trackerToken };
        if (state === "TRACKER_CANCELLED") return { state: "cancelled", transactionId, trackerToken };
        if (state === "TRACKER_EXPIRED") return { state: "failed", transactionId, trackerToken, message: "Safepay tracker expired." };
        return { state: "pending", transactionId, trackerToken, message: state || "Safepay payment is pending." };
    }

    verifyWebhook(rawBody: Buffer | string, signature?: string): SafepayWebhook {
        if (!CONFIG.safepay.hmacKey || !signature) {
            throw new AppError("Safepay webhook signature is missing.", 400, ErrorCodes.VALIDATION_ERROR);
        }
        const expected = crypto.createHmac("sha512", CONFIG.safepay.hmacKey).update(rawBody).digest("hex");
        const received = signature.trim().replace(/^sha512=/i, "");
        if (received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
            throw new AppError("Safepay webhook signature is invalid.", 400, ErrorCodes.VALIDATION_ERROR);
        }
        try {
            return JSON.parse(rawBody.toString()) as SafepayWebhook;
        } catch {
            throw new AppError("Safepay webhook payload is invalid.", 400, ErrorCodes.VALIDATION_ERROR);
        }
    }

    isSuccessfulWebhook(event: SafepayWebhook): boolean {
        return event.type === "payment.succeeded" && (
            event.data?.success === true
        ) && event.data?.state === "TRACKER_ENDED";
    }

    getWebhookTracker(event: SafepayWebhook): string | null {
        return event.data?.tracker ? String(event.data.tracker) : null;
    }

    getWebhookEventToken(event: SafepayWebhook): string | null {
        return event.token ? String(event.token) : null;
    }

    getWebhookTransactionId(event: SafepayWebhook): string | null {
        return event.data?.transaction_id ? String(event.data.transaction_id) : null;
    }

    validateReturnHash(_input?: unknown): boolean {
        return true;
    }
}
