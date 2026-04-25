import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { PaymentMethod } from "@common/enums/payment.enums";

/**
 * Admin-curated catalog of bank accounts and gateways available for vendors
 * to pay into. One row per `method`.
 */
@Entity("payment_settings")
export class PaymentSetting {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "enum", enum: PaymentMethod, unique: true })
    method!: PaymentMethod;

    @Column({ type: "varchar", length: 255 })
    account_name!: string;

    @Column({ type: "varchar", length: 255 })
    account_number!: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    bank_name?: string;

    @Column({ type: "varchar", length: 50, nullable: true })
    branch_code?: string;

    @Column({ type: "boolean", default: true })
    is_active!: boolean;

    @Column({ type: "text", nullable: true })
    notes?: string;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
