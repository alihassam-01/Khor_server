import { CONFIG } from "@config/config";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { createHash } from "node:crypto";

type CreateCheckoutSessionInput = {
    basketId: string;
    amount: number;
    customerEmail: string;
    customerMobile: string;
    description: string;
    successUrl: string;
    failureUrl: string;
    checkoutUrl: string;
};

type TransactionState = "paid" | "failed" | "pending" | "cancelled";

type PayFastTransactionResult = {
    state: TransactionState;
    transactionId?: string | null;
    message?: string | null;
    raw: Record<string, unknown>;
};

export class PayFastService {
    private sha256HexLower(input: string): string {
        return createHash("sha256").update(input, "utf8").digest("hex").toLowerCase();
    }

    private getRequiredConfig(): {
        merchantId: string;
        securedKey: string;
        merchantName: string;
        currencyCode: string;
        version: string;
        transactionType: string;
        procCode: string;
        storeId: string;
        signature: string;
        accessTokenUrl: string;
        checkoutPostUrl: string;
        transactionStatusUrl: string;
        transactionStatusByBasketUrl: string;
    } {
        if (!CONFIG.payfast.merchantId || !CONFIG.payfast.securedKey) {
            throw new AppError(
                "PayFast merchant credentials are not configured.",
                500,
                ErrorCodes.INTERNAL_SERVER_ERROR,
            );
        }

        return {
            merchantId: CONFIG.payfast.merchantId,
            securedKey: CONFIG.payfast.securedKey,
            merchantName: CONFIG.payfast.merchantName,
            currencyCode: CONFIG.payfast.currencyCode,
            version: CONFIG.payfast.version,
            transactionType: CONFIG.payfast.transactionType,
            procCode: CONFIG.payfast.procCode,
            storeId: CONFIG.payfast.storeId,
            signature: CONFIG.payfast.signature,
            accessTokenUrl: CONFIG.payfast.accessTokenUrl,
            checkoutPostUrl: CONFIG.payfast.checkoutPostUrl,
            transactionStatusUrl: CONFIG.payfast.transactionStatusUrl.replace(/\/+$/, ""),
            transactionStatusByBasketUrl: CONFIG.payfast.transactionStatusByBasketUrl.replace(/\/+$/, ""),
        };
    }

    private async postForm(
        url: string,
        body: URLSearchParams,
    ): Promise<Record<string, unknown>> {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
        });

        const text = await response.text();
        if (!response.ok) {
            throw new AppError(
                `PayFast request failed with status ${response.status}.`,
                502,
                ErrorCodes.INTERNAL_SERVER_ERROR,
            );
        }

        try {
            return JSON.parse(text) as Record<string, unknown>;
        } catch {
            throw new AppError(
                "PayFast returned an unexpected response format.",
                502,
                ErrorCodes.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async getJson(
        url: string,
        headers: Record<string, string> = {},
    ): Promise<Record<string, unknown>> {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                ...headers,
            },
        });
        const text = await response.text();
        if (!response.ok) {
            throw new AppError(
                `PayFast status lookup failed with status ${response.status}.`,
                502,
                ErrorCodes.INTERNAL_SERVER_ERROR,
            );
        }

        try {
            return JSON.parse(text) as Record<string, unknown>;
        } catch {
            throw new AppError(
                "PayFast returned an unexpected status response.",
                502,
                ErrorCodes.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private buildDynamicSignature(
        merchantId: string,
        storeId: string,
        basketId: string,
        amount: string,
        currencyCode: string,
        securedKey: string,
    ): string {
        return this.sha256HexLower(
            `${merchantId}|${storeId}|${basketId}|${amount}|${currencyCode}|${securedKey}`,
        );
    }

    validateReturnHash(params: {
        basketId?: string | null;
        errCode?: string | null;
        validationHash?: string | null;
    }): boolean {
        const config = this.getRequiredConfig();
        const basketId = String(params.basketId ?? "").trim();
        const errCode = String(params.errCode ?? "").trim();
        const validationHash = String(params.validationHash ?? "").trim();

        if (!basketId || !errCode || !validationHash) {
            return false;
        }

        const expected = this.sha256HexLower(
            `${basketId}|${config.securedKey}|${config.merchantId}|${errCode}`,
        );

        return expected === validationHash.toLowerCase();
    }

    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{
        checkoutUrl: string;
        formFields: Record<string, string>;
        accessToken: string;
    }> {
        const config = this.getRequiredConfig();
        const amount = input.amount.toFixed(2);

        const tokenRequest = new URLSearchParams({
            MERCHANT_ID: config.merchantId,
            SECURED_KEY: config.securedKey,
            BASKET_ID: input.basketId,
            TXNAMT: amount,
            CURRENCY_CODE: config.currencyCode,
        });

        const tokenPayload = await this.postForm(config.accessTokenUrl, tokenRequest);
        const accessToken = String(tokenPayload.ACCESS_TOKEN ?? "").trim();

        if (!accessToken) {
            throw new AppError(
                "PayFast did not return an access token.",
                502,
                ErrorCodes.INTERNAL_SERVER_ERROR,
            );
        }

        const signature = this.buildDynamicSignature(
            config.merchantId,
            config.storeId,
            input.basketId,
            amount,
            config.currencyCode,
            config.securedKey,
        );

        return {
            checkoutUrl: config.checkoutPostUrl,
            accessToken,
            formFields: {
                CURRENCY_CODE: config.currencyCode,
                MERCHANT_ID: config.merchantId,
                MERCHANT_NAME: config.merchantName,
                TOKEN: accessToken,
                BASKET_ID: input.basketId,
                TXNAMT: amount,
                ORDER_DATE: new Date().toISOString().slice(0, 19).replace("T", " "),
                SUCCESS_URL: input.successUrl,
                FAILURE_URL: input.failureUrl,
                CHECKOUT_URL: input.checkoutUrl,
                CUSTOMER_EMAIL_ADDRESS: input.customerEmail,
                CUSTOMER_MOBILE_NO: input.customerMobile,
                SIGNATURE: signature,
                VERSION: config.version,
                TXNDESC: input.description,
                PROCCODE: config.procCode,
                TRAN_TYPE: config.transactionType,
                STORE_ID: config.storeId,
            },
        };
    }

    private extractResultPayload(payload: Record<string, unknown>): Record<string, unknown> {
        const data = payload.data;
        if (data && typeof data === "object" && !Array.isArray(data)) {
            return data as Record<string, unknown>;
        }
        return payload;
    }

    private evaluateState(payload: Record<string, unknown>): TransactionState {
        const values = [
            payload.code,
            payload.status_code,
            payload.status,
            payload.transaction_status,
            payload.status_msg,
            payload.message,
            payload.payment_status,
        ]
            .filter((value) => value !== undefined && value !== null)
            .map((value) => String(value).trim().toLowerCase());

        if (values.some((value) => value === "00" || value === "000" || value.includes("success") || value.includes("approved") || value.includes("paid") || value.includes("completed"))) {
            return "paid";
        }
        if (values.some((value) => value.includes("cancel"))) {
            return "cancelled";
        }
        if (values.some((value) => value.includes("fail") || value.includes("declin") || value.includes("reject") || value.includes("error") || value.includes("invalid"))) {
            return "failed";
        }
        return "pending";
    }

    async getTransactionStatus(params: {
        transactionId?: string | null;
        basketId?: string | null;
    }): Promise<PayFastTransactionResult> {
        const config = this.getRequiredConfig();
        let payload: Record<string, unknown> | null = null;

        if (params.transactionId) {
            payload = await this.getJson(`${config.transactionStatusUrl}/${encodeURIComponent(params.transactionId)}`);
        } else if (params.basketId) {
            const basicAuth = Buffer.from(`${config.merchantId}:${config.securedKey}`, "utf8").toString("base64");
            const basketBase = config.transactionStatusByBasketUrl
                || "https://partner-api.apps.net.pk:8445/api/transaction/view/basket/id";
            const basketUrl = basketBase.includes("?")
                ? `${basketBase}${basketBase.endsWith("=") ? "" : "&"}basket_id=${encodeURIComponent(params.basketId)}`
                : `${basketBase.replace(/\/+$/, "")}/${encodeURIComponent(params.basketId)}`;
            payload = await this.getJson(basketUrl, {
                Authorization: `Basic ${basicAuth}`,
            });
        } else {
            throw new AppError(
                "PayFast status check requires a transaction or basket identifier.",
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }

        const normalized = this.extractResultPayload(payload);
        const transactionId = normalized.transaction_id ?? payload.transaction_id ?? null;
        const message = normalized.status_msg ?? normalized.message ?? payload.status_msg ?? payload.message ?? null;

        return {
            state: this.evaluateState({ ...payload, ...normalized }),
            transactionId: transactionId ? String(transactionId) : null,
            message: message ? String(message) : null,
            raw: payload,
        };
    }
}
