import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ReviewStatus } from "../ENUM/enum";
import { User } from "../user";

@Entity()
export class Review {
  @PrimaryGeneratedColumn()
  review_id!: number;

  //customer link to user table
  @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  // Polymorphic Relation
  @Column({ type: "uuid", nullable: true })
  target_id!: string | null;

  @Column({ type: "text", nullable: true })
  target_type!: "property" | "room_type" | "tour_package" | null;

  @Column({ type: "text", nullable: true })
  review_text!: string;

  @Column({ type: "int", nullable: true })
  rating!: number;

  @Column({ type: "date", default: () => "CURRENT_DATE" })
  review_date!: string;

  @Column({
    type: "enum",
    enum: ReviewStatus,
    default: ReviewStatus.NOT_REVIEWED,
  })
  review_status!: ReviewStatus;

  @Column({ default: 0 })
  helpful_count!: number;

  @Column({ default: 0 })
  not_helpful_count!: number;

  @Column({ default: false })
  is_deleted!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
