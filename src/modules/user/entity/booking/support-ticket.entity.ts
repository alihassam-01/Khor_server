import { randomBytes } from "crypto";
import {
    BeforeInsert,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { SupportTicketStatus, SupportTicketType } from "@common/enums/ticket.enums";
import { User } from "@modules/user/entity/user/user.entity";
import { HotelBooking } from "./hotel-booking.entity";
import { SupportTicketMessage } from "./support-ticket-message.entity";

@Entity("support_tickets")
@Index("idx_support_tickets_customer_created", ["customer_user_id", "created_at"])
@Index("idx_support_tickets_vendor_status", ["vendor_user_id", "status"])
@Index("idx_support_tickets_status_activity", ["status", "last_activity_at"])
export class SupportTicket {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 40, unique: true })
    ticket_number!: string;

    @Column({ type: "uuid" })
    customer_user_id!: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "customer_user_id" })
    customer!: User;

    @Column({ type: "uuid", nullable: true })
    vendor_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "vendor_user_id" })
    vendor?: User | null;

    @Column({ type: "uuid", nullable: true })
    booking_id?: string | null;

    @ManyToOne(() => HotelBooking, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "booking_id" })
    booking?: HotelBooking | null;

    @Column({ type: "enum", enum: SupportTicketType, default: SupportTicketType.GENERAL })
    type!: SupportTicketType;

    @Column({ type: "varchar", length: 180 })
    subject!: string;

    @Column({ type: "enum", enum: SupportTicketStatus, default: SupportTicketStatus.OPEN })
    status!: SupportTicketStatus;

    @Column({ type: "timestamptz", nullable: true })
    escalated_at?: Date | null;

    @Column({ type: "uuid", nullable: true })
    escalated_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "escalated_by_user_id" })
    escalated_by?: User | null;

    @Column({ type: "timestamptz", nullable: true })
    resolved_at?: Date | null;

    @Column({ type: "uuid", nullable: true })
    resolved_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "resolved_by_user_id" })
    resolved_by?: User | null;

    @Column({ type: "timestamptz" })
    last_activity_at!: Date;

    @OneToMany(() => SupportTicketMessage, (message) => message.ticket)
    messages!: SupportTicketMessage[];

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;

    @BeforeInsert()
    assignTicketNumber(): void {
        if (!this.ticket_number) {
            const seed = randomBytes(3).toString("hex").toUpperCase();
            this.ticket_number = `TKT-${Date.now().toString(36).toUpperCase()}-${seed}`;
        }
        if (!this.last_activity_at) {
            this.last_activity_at = new Date();
        }
    }
}
