type BookingRealtimeEvent = {
    type: "inventory_changed" | "booking_changed" | "hold_changed";
    action: string;
    listing_id: string;
    room_type_id?: string | null;
    vendor_id?: string | null;
    customer_user_id?: string | null;
    booking_source?: string | null;
    booking_id?: string | null;
    hold_id?: string | null;
    occurred_at: string;
};

export type PublicBookingRealtimeEvent = {
    type: "inventory_changed";
    occurred_at: string;
};

export const toPublicBookingRealtimeEvent = (
    event: BookingRealtimeEvent,
): PublicBookingRealtimeEvent => ({
    type: "inventory_changed",
    occurred_at: event.occurred_at,
});

type Subscriber =
    | {
        id: string;
        scope: "hotel";
        hotelId: string;
        send: (event: BookingRealtimeEvent) => void;
    }
    | {
        id: string;
        scope: "vendor";
        userId: string;
        send: (event: BookingRealtimeEvent) => void;
    }
    | {
        id: string;
        scope: "customer";
        userId: string;
        send: (event: BookingRealtimeEvent) => void;
    }
    | {
        id: string;
        scope: "admin";
        userId: string;
        send: (event: BookingRealtimeEvent) => void;
    };

export class BookingRealtimeService {
    private static instance: BookingRealtimeService | null = null;
    private readonly subscribers = new Map<string, Subscriber>();

    static getInstance(): BookingRealtimeService {
        if (!this.instance) {
            this.instance = new BookingRealtimeService();
        }
        return this.instance;
    }

    subscribe(subscriber: Subscriber): () => void {
        this.subscribers.set(subscriber.id, subscriber);
        return () => {
            this.subscribers.delete(subscriber.id);
        };
    }

    publish(event: BookingRealtimeEvent): void {
        this.subscribers.forEach((subscriber) => {
            if (!this.matches(subscriber, event)) return;
            try {
                subscriber.send(event);
            } catch {
                this.subscribers.delete(subscriber.id);
            }
        });
    }

    private matches(subscriber: Subscriber, event: BookingRealtimeEvent): boolean {
        if (subscriber.scope === "hotel") {
            return subscriber.hotelId === event.listing_id;
        }

        if (subscriber.scope === "vendor") {
            return !!event.vendor_id && subscriber.userId === event.vendor_id;
        }

        if (subscriber.scope === "admin") {
            return event.booking_source !== "partner_manual";
        }

        return !!event.customer_user_id && subscriber.userId === event.customer_user_id;
    }
}

export const bookingRealtimeService = BookingRealtimeService.getInstance();
export type { BookingRealtimeEvent };
