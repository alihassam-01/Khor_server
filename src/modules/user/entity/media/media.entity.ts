import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { PropertyType } from "@common/enums/property.enums";

@Entity("media")
export class Media {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  url!: string;

  @Column({ type: "enum", enum: PropertyType })
  related_type!: PropertyType;

  @Column()
  related_id!: number;
}
