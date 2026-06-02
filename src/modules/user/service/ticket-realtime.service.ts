import { UserRole } from "@common/enums";

export type TicketRealtimeEvent = {
    type: "ticket_changed";
    action:
        | "ticket_created"
        | "ticket_message_added"
        | "ticket_status_changed"
        | "ticket_escalated";
    ticket_id: string;
    ticket_number: string;
    ticket_status: string;
    customer_user_id: string;
    vendor_user_id?: string | null;
    booking_id?: string | null;
    occurred_at: string;
};

type Subscriber =
    | {
        id: string;
        scope: "customer";
        userId: string;
        send: (event: TicketRealtimeEvent) => void;
    }
    | {
        id: string;
        scope: "vendor";
        userId: string;
        send: (event: TicketRealtimeEvent) => void;
    }
    | {
        id: string;
        scope: "admin";
        userId: string;
        send: (event: TicketRealtimeEvent) => void;
    };

export class TicketRealtimeService {
    private static instance: TicketRealtimeService | null = null;
    private readonly subscribers = new Map<string, Subscriber>();

    static getInstance(): TicketRealtimeService {
        if (!this.instance) {
            this.instance = new TicketRealtimeService();
        }
        return this.instance;
    }

    subscribe(subscriber: Subscriber): () => void {
        this.subscribers.set(subscriber.id, subscriber);
        return () => {
            this.subscribers.delete(subscriber.id);
        };
    }

    publish(event: TicketRealtimeEvent): void {
        this.subscribers.forEach((subscriber) => {
            if (!this.matches(subscriber, event)) return;
            try {
                subscriber.send(event);
            } catch {
                this.subscribers.delete(subscriber.id);
            }
        });
    }

    private matches(subscriber: Subscriber, event: TicketRealtimeEvent): boolean {
        if (subscriber.scope === "admin") {
            return true;
        }

        if (subscriber.scope === "vendor") {
            return !!event.vendor_user_id && subscriber.userId === event.vendor_user_id;
        }

        return subscriber.userId === event.customer_user_id;
    }
}

export const ticketRealtimeService = TicketRealtimeService.getInstance();
export const isTicketStreamRole = (role?: UserRole): role is UserRole.CUSTOMER | UserRole.VENDOR | UserRole.ADMIN => (
    role === UserRole.CUSTOMER || role === UserRole.VENDOR || role === UserRole.ADMIN
);
