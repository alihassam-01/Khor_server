import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("refresh_token")
export class RefreshToken {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "user_id", type: "uuid" })
    userId!: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user?: User;

    @Column({ name: "family_id", type: "uuid" })
    familyId!: string;

    @Column({ name: "token_hash", type: "varchar", length: 64 })
    tokenHash!: string;

    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date;

    @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
    revokedAt?: Date | null;

    @Column({ name: "replaced_by_token_id", type: "uuid", nullable: true })
    replacedByTokenId?: string | null;

    @Column({ name: "last_used_at", type: "timestamptz", nullable: true })
    lastUsedAt?: Date | null;

    @Column({ name: "created_by_ip", type: "varchar", length: 64, nullable: true })
    createdByIp?: string | null;

    @Column({ name: "user_agent", type: "varchar", length: 512, nullable: true })
    userAgent?: string | null;

    @CreateDateColumn({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;
}
