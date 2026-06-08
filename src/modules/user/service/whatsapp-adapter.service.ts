import { CONFIG } from "@config/config";

export type WhatsAppSendResult = {
    providerMessageId?: string | null;
};

export class WhatsAppAdapterError extends Error {
    constructor(
        message: string,
        readonly retryable: boolean,
        readonly outcomeUnknown = false,
    ) {
        super(message);
        this.name = "WhatsAppAdapterError";
    }
}

export class WhatsAppAdapterService {
    async send(input: {
        idempotencyKey: string;
        number: string;
        message: string;
    }): Promise<WhatsAppSendResult> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Idempotency-Key": input.idempotencyKey,
        };
        if (CONFIG.notifications.whatsappAdapterToken) {
            headers.Authorization = `Bearer ${CONFIG.notifications.whatsappAdapterToken}`;
        }

        let response: Response;
        try {
            response = await fetch(`${CONFIG.notifications.whatsappAdapterUrl.replace(/\/$/, "")}/v1/messages`, {
                method: "POST",
                headers,
                signal: AbortSignal.timeout(CONFIG.notifications.whatsappTimeoutMs),
                body: JSON.stringify({
                    idempotencyKey: input.idempotencyKey,
                    number: input.number,
                    message: input.message,
                }),
            });
        } catch (error) {
            const isTimeout = error instanceof Error
                && (error.name === "TimeoutError" || error.name === "AbortError");
            throw new WhatsAppAdapterError(
                isTimeout ? "WhatsApp adapter request timed out" : "WhatsApp adapter is unavailable",
                !isTimeout,
                isTimeout,
            );
        }

        const raw = await response.text();
        let body: Record<string, unknown> = {};
        try {
            body = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        } catch {
            body = {};
        }

        if (!response.ok) {
            const detail = typeof body.error === "string"
                ? body.error
                : `WhatsApp adapter returned ${response.status}`;
            throw new WhatsAppAdapterError(
                detail,
                response.status === 429 || response.status >= 500,
            );
        }

        const result = body.result as Record<string, unknown> | undefined;
        return {
            providerMessageId: String(
                result?.messageId
                ?? result?.id
                ?? body.messageId
                ?? "",
            ) || null,
        };
    }
}
