import { Entity, PrimaryGeneratedColumn, Column, ManyToOne} from "typeorm";
import { Transactions } from "./transactions.entity";
@Entity("payments")
export class Payment {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Transactions, { onDelete: "CASCADE" })
    transaction!: Transactions;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;
    
    @Column({ type: "varchar", length: 50 })
    card_brand!: string;
    
    @Column({ type: "varchar", length: 4 })
    last4_digits!: string;
    
    @Column({ type: "varchar", length: 50 })
    payment_processor_id!: string;
    
    @Column({ type: "text" })
    status!: "pending" | "succeeded" | "failed";
    }
