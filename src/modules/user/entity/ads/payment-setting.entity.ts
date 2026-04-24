import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";
import { PaymentMethod } from "@common/enums/payment.enums";

@Entity("payment_settings")
export class PaymentSetting {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({
        type: "enum",
        enum: PaymentMethod,
        unique: true,
    })
    method!: PaymentMethod;

    @Column("varchar", { length: 255 })
    account_name!: string;

    @Column("varchar", { length: 255 })
    account_number!: string;

    @Column("varchar", { length: 255, nullable: true })
    bank_name?: string;

    @Column("varchar", { length: 50, nullable: true })
    branch_code?: string;

    @Column("boolean", { default: true })
    is_active!: boolean;

    @Column("text", { nullable: true })
    notes?: string;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
