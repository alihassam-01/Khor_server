import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from "typeorm";
import { AuditLogStatus } from "@modules/user/constant/audit.constant";

@Entity("audit_logs")
export class AuditLog {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column("varchar", { length: 100 })
    @Index()
    event_type!: string;

    @Column("varchar", { length: 255 })
    @Index()
    recipient!: string;

    @Column({
        type: "enum",
        enum: AuditLogStatus,
        default: AuditLogStatus.SUCCESS,
    })
    status!: AuditLogStatus;

    @Column("text", { nullable: true })
    error_message?: string;

    @Column("jsonb", { nullable: true })
    metadata?: Record<string, unknown>;

    @CreateDateColumn({ type: "timestamptz" })
    @Index()
    created_at!: Date;
}
