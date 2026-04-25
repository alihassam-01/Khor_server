import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    OneToOne,
    PrimaryColumn,
    UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * Unified profile for any user, regardless of role. Replaces the previous
 * `Vendor` and `CustomerProfile` tables, which were structurally identical.
 *
 * Distinguishing vendor-only fields:
 *  - `business_name`: trading/display name shown on listings
 *  - `is_business_verified`: admin-toggled trust flag
 *
 * Distinguish "vendor vs customer" via `User.userType`, not via the presence
 * of a profile row.
 */
@Entity("user_profiles")
export class UserProfile {
    @PrimaryColumn("uuid")
    user_id!: string;

    @OneToOne(() => User, (user) => user.profile, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Column({ type: "varchar", length: 120 })
    username!: string;

    @Column({ type: "varchar", length: 50, nullable: true })
    phone_number?: string | null;

    @Column({ type: "text", nullable: true })
    profile_picture?: string | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    business_name?: string | null;

    @Column({ type: "boolean", default: false })
    is_business_verified!: boolean;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
