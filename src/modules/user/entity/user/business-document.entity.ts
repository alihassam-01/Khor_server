import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { BusinessDocumentStatus, BusinessDocumentType } from "@common/enums/business.enums";
import { BusinessProfile } from "./business-profile.entity";

@Entity("business_documents")
export class BusinessDocument {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index("idx_business_documents_profile")
    @Column({ type: "uuid" })
    business_profile_id!: string;

    @ManyToOne(() => BusinessProfile, (profile) => profile.documents, { onDelete: "CASCADE" })
    @JoinColumn({ name: "business_profile_id" })
    business_profile!: BusinessProfile;

    @Column({ type: "enum", enum: BusinessDocumentType })
    document_type!: BusinessDocumentType;

    @Column({ type: "varchar", length: 255 })
    original_file_name!: string;

    @Column({ type: "varchar", length: 255 })
    storage_key!: string;

    @Column({ type: "text" })
    public_url!: string;

    @Column({ type: "varchar", length: 120 })
    mime_type!: string;

    @Column({ type: "bigint" })
    size_bytes!: string;

    @Index("idx_business_documents_status")
    @Column({
        type: "enum",
        enum: BusinessDocumentStatus,
        default: BusinessDocumentStatus.PENDING_UPLOAD,
    })
    status!: BusinessDocumentStatus;

    @Column({ type: "text", nullable: true })
    review_note?: string | null;

    @Column({ type: "uuid", nullable: true })
    reviewed_by?: string | null;

    @Column({ type: "timestamptz", nullable: true })
    reviewed_at?: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    uploaded_at?: Date | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
