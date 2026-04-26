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
import { Review } from "./review.entity";
import { User } from "@modules/user/entity/user/user.entity";

/**
 * One row per (review, voter). Source of truth for `helpful_count` and
 * `not_helpful_count` on Review; those are denormalized counters for read
 * speed.
 */
@Entity("review_votes")
@Unique("uq_review_votes_review_user", ["review_id", "user_id"])
@Index(["user_id"])
export class ReviewVote {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    review_id!: string;

    @ManyToOne(() => Review, (review) => review.votes, { onDelete: "CASCADE" })
    @JoinColumn({ name: "review_id" })
    review!: Review;

    @Column({ type: "uuid" })
    user_id!: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user!: User;

    @Column({ type: "boolean" })
    is_helpful!: boolean;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;
}
