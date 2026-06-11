import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";
import { User } from "./user.entity";
import { BusinessProfile } from "./business-profile.entity";

@Entity("policy_acceptances")
@Unique("uq_policy_acceptance_profile_version", ["business_profile_id", "policy_type", "policy_version"])
export class PolicyAcceptance {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index("idx_policy_acceptances_user")
    @Column({ type: "uuid" })
    user_id!: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Index("idx_policy_acceptances_profile")
    @Column({ type: "uuid" })
    business_profile_id!: string;

    @ManyToOne(() => BusinessProfile, { onDelete: "CASCADE" })
    @JoinColumn({ name: "business_profile_id" })
    business_profile!: BusinessProfile;

    @Column({ type: "varchar", length: 80 })
    policy_type!: string;

    @Column({ type: "varchar", length: 80 })
    policy_version!: string;

    @Column({ type: "varchar", length: 128 })
    content_hash!: string;

    @Column({ type: "timestamptz" })
    accepted_at!: Date;

    @Column({ type: "varchar", length: 100, nullable: true })
    ip_address?: string | null;

    @Column({ type: "text", nullable: true })
    user_agent?: string | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;
}
