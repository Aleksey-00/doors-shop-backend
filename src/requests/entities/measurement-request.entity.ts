import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('measurement_requests')
export class MeasurementRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  doorId: string;

  @Column()
  name: string;

  @Column()
  phone: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  comments: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'completed' | 'cancelled';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 