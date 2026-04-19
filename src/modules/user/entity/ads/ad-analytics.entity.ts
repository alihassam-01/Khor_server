import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from "typeorm";
import { AnalyticsEventType } from "../ENUM/enum";
import { AdType } from "../ENUM/ad.enum";

@Entity("ad_analytics")
export class AdAnalytics {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column("varchar", { length: 255 })
    @Index()
    ad_id!: string;

    @Column({
        type: "enum",
        enum: AdType,
    })
    ad_type!: AdType;

    @Column({
        type: "enum",
        enum: AnalyticsEventType,
    })
    event_type!: AnalyticsEventType;

    @Column("varchar", { length: 255, nullable: true })
    ip_hash?: string;

    @CreateDateColumn({ type: "timestamp" })
    @Index()
    created_at!: Date;
}
