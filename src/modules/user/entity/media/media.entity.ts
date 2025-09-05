import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { RelatedType } from "../ENUM/enum";

@Entity("media")
export class Media {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  url!: string;

  @Column({ type: "enum", enum: RelatedType })
  related_type!: RelatedType;

  @Column()
  related_id!: number;
}
