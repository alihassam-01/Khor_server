import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Hotel } from "./hotel.entity";

@Entity("hotel_reviews")
export class HotelReview {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("varchar", { length: 255 })
    user_name!: string;

    @Column("decimal", { precision: 2, scale: 1 })
    rating!: number;

    @Column("text")
    comment!: string;

    @Column("timestamp")
    date!: Date;

    @ManyToOne(() => Hotel, (hotel) => hotel.detailed_reviews, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "hotel_id" })
    hotel!: Hotel;

    @Column("varchar")
    hotel_id!: string;
}
