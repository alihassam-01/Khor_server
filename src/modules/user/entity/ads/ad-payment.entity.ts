import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { User } from "../user";
import { PaymentStatus, PaymentMethod, AdType } from "../ENUM/ad-payment.enum";

@Entity("ad_payments")
export class AdPayment {
    @PrimaryGeneratedColumn("uuid")
    payment_id!: string;

    @Column("uuid")
    ad_id!: string;

    @Column({
        type: "enum",
        enum: AdType,
    })
    ad_type!: AdType;

    @Column("uuid")
    vendor_id!: string;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: "vendor_id" })
    vendor!: User;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    @Column({
        type: "enum",
        enum: PaymentStatus,
        default: PaymentStatus.PENDING,
    })
    payment_status!: PaymentStatus;

    @Column({
        type: "enum",
        enum: PaymentMethod,
        nullable: true,
    })
    payment_method?: PaymentMethod;

    @Column("varchar", { length: 255, nullable: true })
    transaction_id?: string;

    @Column("text", { nullable: true })
    notes?: string;

    @Column("varchar", { length: 255, nullable: true })
    receipt_url?: string;

    @CreateDateColumn({ type: "timestamp" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updated_at!: Date;
}
