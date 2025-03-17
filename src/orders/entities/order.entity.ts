import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Door } from '../../parsers/farniture/entities/door.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  phone: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  comment?: string;

  @Column('jsonb')
  items: Door[];

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column({
    type: 'enum',
    enum: ['new', 'processing', 'completed', 'cancelled'],
    default: 'new'
  })
  status: 'new' | 'processing' | 'completed' | 'cancelled';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
} 