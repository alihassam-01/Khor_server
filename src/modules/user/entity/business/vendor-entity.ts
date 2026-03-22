import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";
import { User } from "@modules/user/entity/user";

/**
 * Minimal Vendor entity for Phase 1
 * Used only for authentication and user management
 * Full vendor features will be implemented in Phase 2
 */
@Entity("vendors")
export class Vendor {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @OneToOne(() => User, (user) => user.vendor, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Column({ type: "text", nullable: true })
    username?: string;

    @Column({ type: "text", nullable: true })
    profile_picture?: string;

    @Column({ type: "text", nullable: true })
    phone_number?: string;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
