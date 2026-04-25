import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from "typeorm";
import { ReviewStatus, ReviewTargetType } from "@common/enums/review.enums";
import { User } from "@modules/user/entity/user/user.entity";
import { ReviewVote } from "./review-vote.entity";

/**
 * The single, polymorphic reviews table. Replaces `hotel_reviews` and
 * `restaurant_reviews`. Targets any reviewable entity via
 * `(target_type, target_id)`.
 *
 * `target_id` is `text` so it can hold both UUIDs (listings, room types) and
 * numeric IDs (articles, locations) without forcing a join table per target.
 *
 * Cached counters (`helpful_count`, `not_helpful_count`) are kept consistent
 * by ReviewService inside the same transaction as the underlying
 * `review_votes` write.
 */
@Entity("reviews")
@Index("idx_reviews_target_status", ["target_type", "target_id", "status", "created_at"])
@Index("idx_reviews_user", ["user_id"])
@Unique("uq_reviews_user_target", ["user_id", "target_type", "target_id"])
export class Review {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    user_id!: string;

    @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Column({ type: "enum", enum: ReviewTargetType })
    target_type!: ReviewTargetType;

    @Column({ type: "varchar", length: 64 })
    target_id!: string;

    @Column({ type: "smallint" })
    rating!: number;

    @Column({ type: "varchar", length: 255, nullable: true })
    title?: string | null;

    @Column({ type: "text" })
    content!: string;

    @Column({ type: "enum", enum: ReviewStatus, default: ReviewStatus.PENDING })
    status!: ReviewStatus;

    /**
     * True if this reviewer has a confirmed booking/payment for the target
     * (currently always false; reserved for when bookings are introduced).
     */
    @Column({ type: "boolean", default: false })
    is_verified_booking!: boolean;

    @Column({ type: "int", default: 0 })
    helpful_count!: number;

    @Column({ type: "int", default: 0 })
    not_helpful_count!: number;

    @OneToMany(() => ReviewVote, (vote) => vote.review)
    votes!: ReviewVote[];

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
