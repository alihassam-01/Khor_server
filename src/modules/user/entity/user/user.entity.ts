import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { UserRole } from "@common/enums/user.enums";
import { Address } from "@modules/user/entity/address";
import { UserProfile } from "./user-profile.entity";

/**
 * Authentication-side user record. The actual display fields (username,
 * phone, profile picture) live on `user_profiles` (1:1).
 */
@Entity("user")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ unique: true })
    email!: string;

    @Column({ nullable: true })
    password?: string;

    @Column({ nullable: true })
    googleId?: string;

    @Column({ default: "local" })
    authProvider: string = "local";

    @Column({ type: "enum", enum: UserRole })
    userType!: UserRole;

    @Column({ nullable: true })
    verificationToken?: string;

    @Column({ nullable: true, type: "timestamptz" })
    otpExpiresAt?: Date;

    @Column({ default: false })
    isVerified: boolean = false;

    @Column({ name: "address_id", nullable: true })
    addressId?: number;

    @OneToOne(() => Address, { nullable: true })
    @JoinColumn({ name: "address_id" })
    address?: Address;

    @OneToOne(() => UserProfile, (profile) => profile.user, { nullable: true, cascade: true })
    profile?: UserProfile;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt!: Date;

    @Column({ default: true })
    isActive!: boolean;
}
