import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Location } from "@modules/user/entity/location";
import { BusinessOnboardingStatus } from "@common/enums/business.enums";
import { BusinessCapability } from "./business-capability.entity";
import { BusinessDocument } from "./business-document.entity";

@Entity("business_profiles")
export class BusinessProfile {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index("idx_business_profiles_user_id", { unique: true })
    @Column({ type: "uuid" })
    user_id!: string;

    @OneToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Column({ type: "varchar", length: 150, nullable: true })
    owner_legal_name?: string | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    business_name?: string | null;

    @Index("idx_business_profiles_phone")
    @Column({ type: "varchar", length: 50, nullable: true })
    phone_number?: string | null;

    @Column({ type: "varchar", length: 50, nullable: true })
    whatsapp_number?: string | null;

    @Column({ type: "int", nullable: true })
    city_id?: number | null;

    @ManyToOne(() => Location, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "city_id", referencedColumnName: "location_id" })
    city?: Location | null;

    @Column({ type: "text", nullable: true })
    business_address?: string | null;

    @Column({ type: "text", nullable: true })
    google_maps_url?: string | null;

    @Column({ type: "varchar", length: 100, nullable: true })
    dts_license_number?: string | null;

    @Column({ type: "varchar", length: 150, nullable: true })
    bank_name?: string | null;

    @Column({ type: "varchar", length: 50, nullable: true })
    bank_account_iban?: string | null;

    @Column({ type: "varchar", length: 150, nullable: true })
    bank_account_title?: string | null;

    @Column({ type: "boolean", default: false })
    whatsapp_booking_enabled!: boolean;

    @Index("idx_business_profiles_status")
    @Column({
        type: "enum",
        enum: BusinessOnboardingStatus,
        default: BusinessOnboardingStatus.DRAFT,
    })
    onboarding_status!: BusinessOnboardingStatus;

    @Column({ type: "timestamptz", nullable: true })
    submitted_at?: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    reviewed_at?: Date | null;

    @Column({ type: "uuid", nullable: true })
    reviewed_by?: string | null;

    @Column({ type: "text", nullable: true })
    review_note?: string | null;

    @OneToMany(() => BusinessCapability, (capability) => capability.business_profile, {
        cascade: true,
    })
    capabilities?: BusinessCapability[];

    @OneToMany(() => BusinessDocument, (document) => document.business_profile)
    documents?: BusinessDocument[];

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
