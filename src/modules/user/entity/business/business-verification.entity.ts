import { Entity, Column, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { Vendor } from './vendor-entity';

@Entity()
export class BusinessVerification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.verifications)
  vendor!: Vendor;

  @Column()
  documentType!: string;

  @Column()
  documentUrl!: string;

  @Column({ default: "pending" })
  status!: "pending" | "approved" | "rejected";

  @Column({ nullable: true })
  reviewerNotes!: string;

  @CreateDateColumn()
  submittedAt!: Date;

  @Column({ nullable: true })
  reviewedAt!: Date;
}
