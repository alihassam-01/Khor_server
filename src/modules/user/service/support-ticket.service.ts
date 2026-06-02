import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import {
    SupportTicketStatus,
    SupportTicketType,
    UserRole,
} from "@common/enums";
import { AppDataSource } from "@config/ormconfig";
import {
    IAddSupportTicketMessageDTO,
    ICreateSupportTicketDTO,
    IEscalateSupportTicketDTO,
    ISupportTicketDTO,
    ISupportTicketMessageDTO,
    IUpdateSupportTicketStatusDTO,
} from "@modules/user/dtos";
import { HotelBooking, SupportTicket, SupportTicketMessage } from "@modules/user/entity/booking";
import { User } from "@modules/user/entity/user";
import { NotificationService } from "./notification.service";
import { SendEmail } from "./email/sendEmail";
import { ticketRealtimeService } from "./ticket-realtime.service";

type TicketActor = {
    userId: string;
    userType: UserRole;
};

export class SupportTicketService {
    private readonly ticketRepo = AppDataSource.getRepository(SupportTicket);
    private readonly messageRepo = AppDataSource.getRepository(SupportTicketMessage);
    private readonly bookingRepo = AppDataSource.getRepository(HotelBooking);
    private readonly userRepo = AppDataSource.getRepository(User);
    private readonly notificationService = new NotificationService();
    private readonly emailService = new SendEmail();

    private publishTicketEvent(
        ticket: SupportTicket,
        action: "ticket_created" | "ticket_message_added" | "ticket_status_changed" | "ticket_escalated",
    ): void {
        ticketRealtimeService.publish({
            type: "ticket_changed",
            action,
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number,
            ticket_status: ticket.status,
            customer_user_id: ticket.customer_user_id,
            vendor_user_id: ticket.vendor_user_id ?? null,
            booking_id: ticket.booking_id ?? null,
            occurred_at: new Date().toISOString(),
        });
    }

    private ticketRelations = [
        "customer",
        "customer.profile",
        "vendor",
        "vendor.profile",
        "booking",
        "booking.listing",
        "booking.room_type",
        "messages",
        "messages.author",
        "messages.author.profile",
    ] as const;

    private getUserDisplayName(user?: User | null): string {
        if (user?.userType === UserRole.ADMIN) {
            return "Admin";
        }
        return user?.profile?.business_name
            || user?.profile?.username
            || user?.email
            || "Khor User";
    }

    private mapMessage(message: SupportTicketMessage): ISupportTicketMessageDTO {
        return {
            id: message.id,
            message: message.message,
            created_at: message.created_at,
            updated_at: message.updated_at,
            author: {
                user_id: message.author.id,
                email: message.author.email,
                role: message.author.userType,
                name: this.getUserDisplayName(message.author),
            },
        };
    }

    private mapTicket(ticket: SupportTicket, includeMessages = false): ISupportTicketDTO {
        const sortedMessages = [...(ticket.messages ?? [])].sort(
            (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
        );
        const latestMessage = sortedMessages.length > 0
            ? this.mapMessage(sortedMessages[sortedMessages.length - 1])
            : null;

        return {
            id: ticket.id,
            ticket_number: ticket.ticket_number,
            type: ticket.type,
            status: ticket.status,
            subject: ticket.subject,
            customer_user_id: ticket.customer_user_id,
            vendor_user_id: ticket.vendor_user_id ?? null,
            booking_id: ticket.booking_id ?? null,
            escalated_at: ticket.escalated_at ?? null,
            resolved_at: ticket.resolved_at ?? null,
            last_activity_at: ticket.last_activity_at,
            created_at: ticket.created_at,
            updated_at: ticket.updated_at,
            customer: {
                user_id: ticket.customer.id,
                email: ticket.customer.email,
                name: this.getUserDisplayName(ticket.customer),
            },
            vendor: ticket.vendor ? {
                user_id: ticket.vendor.id,
                email: ticket.vendor.email,
                name: this.getUserDisplayName(ticket.vendor),
            } : null,
            booking: ticket.booking ? {
                id: ticket.booking.id,
                booking_number: ticket.booking.booking_number,
                listing_id: ticket.booking.listing_id,
                listing_name: ticket.booking.listing?.name ?? "Hotel",
                room_name: ticket.booking.room_type?.name ?? "Room",
                check_in_date: ticket.booking.check_in_date,
                check_out_date: ticket.booking.check_out_date,
                total_amount: Number(ticket.booking.total_amount ?? 0),
                source: ticket.booking.source,
            } : null,
            message_count: sortedMessages.length,
            latest_message: latestMessage,
            messages: includeMessages ? sortedMessages.map((message) => this.mapMessage(message)) : undefined,
        };
    }

    private async getAdmins(): Promise<User[]> {
        return this.userRepo.find({
            where: { userType: UserRole.ADMIN, isActive: true },
            relations: ["profile"],
        });
    }

    private async getTicketOrThrow(id: string): Promise<SupportTicket> {
        const ticket = await this.ticketRepo.findOne({
            where: { id },
            relations: [...this.ticketRelations],
        });
        if (!ticket) {
            throw new AppError("Ticket not found", 404, ErrorCodes.NOT_FOUND);
        }
        return ticket;
    }

    private async getBookingForCustomer(bookingId: string, customerUserId: string): Promise<HotelBooking> {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId, customer_user_id: customerUserId },
            relations: ["listing", "room_type"],
        });
        if (!booking) {
            throw new AppError("Booking not found for this customer", 404, ErrorCodes.NOT_FOUND);
        }
        return booking;
    }

    private ensureTicketOpen(ticket: SupportTicket): void {
        if (ticket.status === SupportTicketStatus.RESOLVED) {
            throw new AppError(
                "This ticket is closed and can no longer accept replies.",
                400,
                ErrorCodes.BAD_REQUEST,
            );
        }
    }

    private ensureVendorAccess(ticket: SupportTicket, vendorUserId: string): void {
        if (!ticket.vendor_user_id || ticket.vendor_user_id !== vendorUserId || !ticket.escalated_at) {
            throw new AppError("Ticket not found", 404, ErrorCodes.NOT_FOUND);
        }
    }

    private async createMessage(ticket: SupportTicket, actor: TicketActor, body: string): Promise<void> {
        const text = body.trim();
        if (!text) {
            throw new AppError("Message is required", 400, ErrorCodes.BAD_REQUEST);
        }
        if (!ticket.id) {
            throw new AppError("Ticket not found", 404, ErrorCodes.NOT_FOUND);
        }
        await this.messageRepo.insert({
            ticket_id: ticket.id,
            author_user_id: actor.userId,
            message: text,
        });
        await this.ticketRepo.update(
            { id: ticket.id },
            { last_activity_at: new Date() },
        );
    }

    private async notifyTicketActivity(input: {
        ticket: SupportTicket;
        title: string;
        message: string;
        action: string;
        actorLabel: string;
        sendEmail?: boolean;
    }): Promise<void> {
        const admins = await this.getAdmins();
        const recipients = new Map<string, User>();

        recipients.set(input.ticket.customer.id, input.ticket.customer);
        admins.forEach((admin) => recipients.set(admin.id, admin));
        if (input.ticket.vendor && input.ticket.escalated_at) {
            recipients.set(input.ticket.vendor.id, input.ticket.vendor);
        }

        const notifications = Array.from(recipients.values()).map((recipient) => ({
            recipient_user_id: recipient.id,
            category: "ticket" as const,
            title: input.title,
            message: input.message,
            action: input.action,
            booking_id: input.ticket.booking_id ?? null,
            listing_id: input.ticket.booking?.listing_id ?? null,
            metadata: {
                ticket_id: input.ticket.id,
                ticket_number: input.ticket.ticket_number,
                ticket_status: input.ticket.status,
                actor: input.actorLabel,
            },
        }));

        await this.notificationService.createMany(notifications);

        if (input.sendEmail !== false) {
            const emailRecipients = Array.from(recipients.values()).filter((recipient) => !!recipient.email);
            await Promise.allSettled(
                emailRecipients.map((recipient) => this.emailService.sendTicketActivityEmail({
                    to: recipient.email,
                    recipientName: this.getUserDisplayName(recipient),
                    subject: input.title,
                    heading: input.title,
                    intro: input.message,
                    ticketNumber: input.ticket.ticket_number,
                    ticketSubject: input.ticket.subject,
                    ticketStatus: input.ticket.status,
                    bookingNumber: input.ticket.booking?.booking_number ?? null,
                    hotelName: input.ticket.booking?.listing?.name ?? null,
                    actorName: input.actorLabel,
                    metadata: {
                        ticketId: input.ticket.id,
                        recipientUserId: recipient.id,
                    },
                })),
            );
        }
    }

    private async notifyTicketActivitySafely(input: {
        ticket: SupportTicket;
        title: string;
        message: string;
        action: string;
        actorLabel: string;
        sendEmail?: boolean;
    }): Promise<void> {
        try {
            await this.notifyTicketActivity(input);
        } catch (error) {
            console.error("Ticket activity notification failed", {
                ticketId: input.ticket.id,
                action: input.action,
                error,
            });
        }
    }

    async createCustomerTicket(actor: TicketActor, input: ICreateSupportTicketDTO): Promise<ISupportTicketDTO> {
        const subject = input.subject.trim();
        const message = input.message.trim();
        if (!subject) {
            throw new AppError("Subject is required", 400, ErrorCodes.BAD_REQUEST);
        }
        if (!message) {
            throw new AppError("Message is required", 400, ErrorCodes.BAD_REQUEST);
        }

        let booking: HotelBooking | null = null;
        if (input.booking_id) {
            booking = await this.getBookingForCustomer(input.booking_id, actor.userId);
        }

        const customer = await this.userRepo.findOne({
            where: { id: actor.userId },
            relations: ["profile"],
        });
        if (!customer) {
            throw new AppError("Customer not found", 404, ErrorCodes.NOT_FOUND);
        }

        const ticket = this.ticketRepo.create({
            customer_user_id: actor.userId,
            vendor_user_id: booking?.listing?.vendor_id ?? null,
            booking_id: booking?.id ?? null,
            type: booking ? SupportTicketType.BOOKING : SupportTicketType.GENERAL,
            subject,
            status: SupportTicketStatus.OPEN,
            last_activity_at: new Date(),
        });

        const savedTicket = await this.ticketRepo.save(ticket);
        await this.messageRepo.insert({
            ticket_id: savedTicket.id,
            author_user_id: actor.userId,
            message,
        });

        const hydrated = await this.getTicketOrThrow(savedTicket.id);
        this.publishTicketEvent(hydrated, "ticket_created");
        await this.notifyTicketActivitySafely({
            ticket: hydrated,
            title: `Ticket ${hydrated.ticket_number} created`,
            message: `${this.getUserDisplayName(customer)} opened a new support ticket.`,
            action: "ticket_created",
            actorLabel: this.getUserDisplayName(customer),
        });

        return this.mapTicket(hydrated, true);
    }

    async listCustomerTickets(customerUserId: string): Promise<ISupportTicketDTO[]> {
        const tickets = await this.ticketRepo.find({
            where: { customer_user_id: customerUserId },
            relations: [...this.ticketRelations],
            order: { last_activity_at: "DESC", created_at: "DESC" },
        });
        return tickets.map((ticket) => this.mapTicket(ticket));
    }

    async getCustomerTicket(customerUserId: string, ticketId: string): Promise<ISupportTicketDTO> {
        const ticket = await this.getTicketOrThrow(ticketId);
        if (ticket.customer_user_id !== customerUserId) {
            throw new AppError("Ticket not found", 404, ErrorCodes.NOT_FOUND);
        }
        return this.mapTicket(ticket, true);
    }

    async addCustomerMessage(
        actor: TicketActor,
        ticketId: string,
        input: IAddSupportTicketMessageDTO,
    ): Promise<ISupportTicketDTO> {
        const ticket = await this.getTicketOrThrow(ticketId);
        if (ticket.customer_user_id !== actor.userId) {
            throw new AppError("Ticket not found", 404, ErrorCodes.NOT_FOUND);
        }
        this.ensureTicketOpen(ticket);
        await this.createMessage(ticket, actor, input.message);
        const refreshed = await this.getTicketOrThrow(ticketId);
        this.publishTicketEvent(refreshed, "ticket_message_added");
        await this.notifyTicketActivitySafely({
            ticket: refreshed,
            title: `New reply on ticket ${refreshed.ticket_number}`,
            message: `${this.getUserDisplayName(refreshed.customer)} added a new message.`,
            action: "ticket_message",
            actorLabel: this.getUserDisplayName(refreshed.customer),
            sendEmail: false,
        });
        return this.mapTicket(refreshed, true);
    }

    async listAdminTickets(): Promise<ISupportTicketDTO[]> {
        const tickets = await this.ticketRepo.find({
            relations: [...this.ticketRelations],
            order: { last_activity_at: "DESC", created_at: "DESC" },
        });
        return tickets.map((ticket) => this.mapTicket(ticket));
    }

    async getAdminTicket(ticketId: string): Promise<ISupportTicketDTO> {
        return this.mapTicket(await this.getTicketOrThrow(ticketId), true);
    }

    async addAdminMessage(
        actor: TicketActor,
        ticketId: string,
        input: IAddSupportTicketMessageDTO,
    ): Promise<ISupportTicketDTO> {
        const ticket = await this.getTicketOrThrow(ticketId);
        this.ensureTicketOpen(ticket);
        const admin = await this.userRepo.findOne({ where: { id: actor.userId }, relations: ["profile"] });
        await this.createMessage(ticket, actor, input.message);
        const refreshed = await this.getTicketOrThrow(ticketId);
        this.publishTicketEvent(refreshed, "ticket_message_added");
        await this.notifyTicketActivitySafely({
            ticket: refreshed,
            title: `Admin replied on ticket ${refreshed.ticket_number}`,
            message: `${this.getUserDisplayName(admin)} replied to the support ticket.`,
            action: "ticket_message",
            actorLabel: this.getUserDisplayName(admin),
            sendEmail: false,
        });
        return this.mapTicket(refreshed, true);
    }

    async updateAdminStatus(
        actor: TicketActor,
        ticketId: string,
        input: IUpdateSupportTicketStatusDTO,
    ): Promise<ISupportTicketDTO> {
        const ticket = await this.getTicketOrThrow(ticketId);
        const admin = await this.userRepo.findOne({ where: { id: actor.userId }, relations: ["profile"] });

        if (input.status === SupportTicketStatus.RESOLVED) {
            ticket.status = SupportTicketStatus.RESOLVED;
            ticket.resolved_at = new Date();
            ticket.resolved_by_user_id = actor.userId;
        } else {
            ticket.status = ticket.escalated_at ? SupportTicketStatus.ESCALATED : SupportTicketStatus.OPEN;
            ticket.resolved_at = null;
            ticket.resolved_by_user_id = null;
        }
        await this.ticketRepo.update(
            { id: ticket.id },
            {
                status: ticket.status,
                resolved_at: ticket.resolved_at ?? null,
                resolved_by_user_id: ticket.resolved_by_user_id ?? null,
                last_activity_at: new Date(),
            },
        );

        const refreshed = await this.getTicketOrThrow(ticketId);
        this.publishTicketEvent(refreshed, "ticket_status_changed");
        await this.notifyTicketActivitySafely({
            ticket: refreshed,
            title: `Ticket ${refreshed.ticket_number} ${input.status === SupportTicketStatus.RESOLVED ? "resolved" : "reopened"}`,
            message: `${this.getUserDisplayName(admin)} changed the ticket status to ${refreshed.status}.`,
            action: "ticket_status_changed",
            actorLabel: this.getUserDisplayName(admin),
        });
        return this.mapTicket(refreshed, true);
    }

    async escalateAdminTicket(
        actor: TicketActor,
        ticketId: string,
        input: IEscalateSupportTicketDTO,
    ): Promise<ISupportTicketDTO> {
        const ticket = await this.getTicketOrThrow(ticketId);
        this.ensureTicketOpen(ticket);
        if (!ticket.booking_id || !ticket.vendor_user_id) {
            throw new AppError(
                "Only booking-specific tickets can be escalated to the owner.",
                400,
                ErrorCodes.BAD_REQUEST,
            );
        }

        ticket.status = SupportTicketStatus.ESCALATED;
        ticket.escalated_at = new Date();
        ticket.escalated_by_user_id = actor.userId;
        await this.ticketRepo.update(
            { id: ticket.id },
            {
                status: ticket.status,
                escalated_at: ticket.escalated_at,
                escalated_by_user_id: ticket.escalated_by_user_id,
                last_activity_at: new Date(),
            },
        );

        if (input.message?.trim()) {
            await this.createMessage(ticket, actor, input.message.trim());
        }

        const admin = await this.userRepo.findOne({ where: { id: actor.userId }, relations: ["profile"] });
        const refreshed = await this.getTicketOrThrow(ticketId);
        this.publishTicketEvent(refreshed, "ticket_escalated");
        await this.notifyTicketActivitySafely({
            ticket: refreshed,
            title: `Ticket ${refreshed.ticket_number} escalated to owner`,
            message: `${this.getUserDisplayName(admin)} escalated this booking issue to the hotel owner.`,
            action: "ticket_escalated",
            actorLabel: this.getUserDisplayName(admin),
        });
        return this.mapTicket(refreshed, true);
    }

    async listVendorTickets(vendorUserId: string): Promise<ISupportTicketDTO[]> {
        const tickets = await this.ticketRepo.find({
            where: { vendor_user_id: vendorUserId },
            relations: [...this.ticketRelations],
            order: { last_activity_at: "DESC", created_at: "DESC" },
        });
        return tickets
            .filter((ticket) => !!ticket.escalated_at)
            .map((ticket) => this.mapTicket(ticket));
    }

    async getVendorTicket(vendorUserId: string, ticketId: string): Promise<ISupportTicketDTO> {
        const ticket = await this.getTicketOrThrow(ticketId);
        this.ensureVendorAccess(ticket, vendorUserId);
        return this.mapTicket(ticket, true);
    }

    async addVendorMessage(
        actor: TicketActor,
        ticketId: string,
        input: IAddSupportTicketMessageDTO,
    ): Promise<ISupportTicketDTO> {
        const ticket = await this.getTicketOrThrow(ticketId);
        this.ensureVendorAccess(ticket, actor.userId);
        this.ensureTicketOpen(ticket);
        const vendor = await this.userRepo.findOne({ where: { id: actor.userId }, relations: ["profile"] });
        await this.createMessage(ticket, actor, input.message);
        const refreshed = await this.getTicketOrThrow(ticketId);
        this.publishTicketEvent(refreshed, "ticket_message_added");
        await this.notifyTicketActivitySafely({
            ticket: refreshed,
            title: `Owner replied on ticket ${refreshed.ticket_number}`,
            message: `${this.getUserDisplayName(vendor)} replied to the escalated ticket.`,
            action: "ticket_message",
            actorLabel: this.getUserDisplayName(vendor),
            sendEmail: false,
        });
        return this.mapTicket(refreshed, true);
    }
}
