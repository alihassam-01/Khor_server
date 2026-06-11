import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from "typeorm";
import { BusinessCapabilityStatus, BusinessCapabilityType } from "@common/enums/business.enums";
import { BusinessProfile } from "./business-profile.entity";

@Entity("business_capabilities")
@Unique("uq_business_capabilities_profile_type", ["business_profile_id", "type"])
export class BusinessCapability {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index("idx_business_capabilities_profile")
    @Column({ type: "uuid" })
    business_profile_id!: string;

    @ManyToOne(() => BusinessProfile, (profile) => profile.capabilities, { onDelete: "CASCADE" })
    @JoinColumn({ name: "business_profile_id" })
    business_profile!: BusinessProfile;

    @Column({ type: "enum", enum: BusinessCapabilityType })
    type!: BusinessCapabilityType;

    @Index("idx_business_capabilities_status")
    @Column({
        type: "enum",
        enum: BusinessCapabilityStatus,
        default: BusinessCapabilityStatus.DRAFT,
    })
    status!: BusinessCapabilityStatus;

    @Column({ type: "text", nullable: true })
    review_note?: string | null;

    @Column({ type: "uuid", nullable: true })
    approved_by?: string | null;

    @Column({ type: "timestamptz", nullable: true })
    approved_at?: Date | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
