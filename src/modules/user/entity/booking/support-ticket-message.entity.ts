import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { User } from "@modules/user/entity/user/user.entity";
import { SupportTicket } from "./support-ticket.entity";

@Entity("support_ticket_messages")
@Index("idx_support_ticket_messages_ticket_created", ["ticket_id", "created_at"])
export class SupportTicketMessage {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    ticket_id!: string;

    @ManyToOne(() => SupportTicket, { onDelete: "CASCADE" })
    @JoinColumn({ name: "ticket_id" })
    ticket!: SupportTicket;

    @Column({ type: "uuid" })
    author_user_id!: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "author_user_id" })
    author!: User;

    @Column({ type: "text" })
    message!: string;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
