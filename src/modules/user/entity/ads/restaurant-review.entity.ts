import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Restaurant } from "./restaurant.entity";

@Entity("restaurant_reviews")
export class RestaurantReview {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("varchar", { length: 255 })
    user_name!: string;

    @Column("decimal", { precision: 2, scale: 1 })
    rating!: number;

    @Column("text")
    comment!: string;

    @Column("timestamptz")
    date!: Date;

    @ManyToOne(() => Restaurant, (restaurant) => restaurant.detailed_reviews, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "restaurant_id" })
    restaurant!: Restaurant;

    @Column("varchar")
    restaurant_id!: string;
}
