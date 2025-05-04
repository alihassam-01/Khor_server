// import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
// import { User } from './user.entity';

// @Entity()
// export class TravelAgencyProfile {
//   @Column({ primary: true })
//   userId!: string;

//   @OneToOne(() => User, (user) => user.agencyProfile)
//   @JoinColumn({ name: 'userId' })
//   user!: User;

//   @Column()
//   companyName!: string; // For agencies

//   @Column({ nullable: true })
//   businessRegistrationNumber!: string;

//   @Column({ nullable: true })
//   phoneNumber?: string;
// }