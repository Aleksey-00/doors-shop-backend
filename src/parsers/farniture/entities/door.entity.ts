import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('doors')
export class Door {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  price: number;

  @Column({ nullable: true })
  oldPrice?: number;

  @Column()
  category: string;

  @Column('text', { array: true, nullable: true })
  imageUrls: string[];

  @Column()
  inStock: boolean;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  specifications?: Record<string, string>;

  @Column()
  url: string;

  @Column({ unique: true })
  externalId: string;

  @Column({ type: 'jsonb', nullable: true })
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  materials?: {
    frame?: string;
    coating?: string;
    insulation?: string;
  };

  @Column('text', { array: true, nullable: true })
  equipment?: string[];

  @Column('text', { array: true, nullable: true })
  features?: string[];

  @Column({ nullable: true })
  manufacturer?: string;

  @Column({ nullable: true })
  warranty?: string;

  @Column({ type: 'jsonb', nullable: true })
  installation?: {
    opening?: 'left' | 'right' | 'universal';
    type?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 