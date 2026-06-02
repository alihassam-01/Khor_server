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
import { User } from "./user.entity";

@Entity("user_notifications")
@Index("idx_user_notifications_recipient_created", ["recipient_user_id", "created_at"])
export class UserNotification {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    recipient_user_id!: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "recipient_user_id" })
    recipient?: User;

    @Column({ type: "varchar", length: 50 })
    category!: string;

    @Column({ type: "varchar", length: 120 })
    title!: string;

    @Column({ type: "text" })
    message!: string;

    @Column({ type: "varchar", length: 120 })
    action!: string;

    @Column({ type: "uuid", nullable: true })
    booking_id?: string | null;

    @Column({ type: "uuid", nullable: true })
    hold_id?: string | null;

    @Column({ type: "uuid", nullable: true })
    listing_id?: string | null;

    @Column({ type: "uuid", nullable: true })
    room_type_id?: string | null;

    @Column({ type: "jsonb", nullable: true })
    metadata?: Record<string, unknown> | null;

    @Column({ type: "timestamptz", nullable: true })
    read_at?: Date | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
