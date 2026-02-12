import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";
import { SubscriptionType } from "./ENUM/ad-payment.enum";

@Entity("subscription_plans")
export class SubscriptionPlan {
    @PrimaryGeneratedColumn("uuid")
    plan_id!: string;

    @Column({
        type: "enum",
        enum: SubscriptionType,
        unique: true,
    })
    type!: SubscriptionType;

    @Column("varchar", { length: 100 })
    name!: string;

    @Column("int")
    duration_days!: number;

    @Column("decimal", { precision: 10, scale: 2 })
    price!: number;

    @Column("text", { nullable: true })
    description?: string;

    @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
    features!: string[];

    @Column("boolean", { default: false })
    is_popular!: boolean;

    @Column("boolean", { default: true })
    is_active!: boolean;

    @Column("int", { default: 0 })
    display_order!: number;

    @CreateDateColumn({ type: "timestamp" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updated_at!: Date;
}
