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

  @Column({ nullable: true })
  priceUnit?: string;

  @Column()
  category: string;

  @Column('text', { array: true, nullable: true })
  imageUrls: string[];

  @Column('text', { array: true, nullable: true })
  thumbnailUrls?: string[];

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

  @Column({ type: 'jsonb', nullable: true })
  sale?: {
    endDate: string;
    remainingQuantity: number;
  };

  @Column({ type: 'int', nullable: true })
  lockCount?: number;

  @Column({ type: 'float', nullable: true })
  metalThickness?: number;

  @Column({ type: 'int', nullable: true })
  doorThickness?: number;

  @Column({ nullable: true })
  exteriorFinish?: string;

  @Column({ nullable: true })
  interiorFinish?: string;

  @Column({ nullable: true })
  exteriorColor?: string;

  @Column({ nullable: true })
  interiorColor?: string;

  @Column('text', { array: true, nullable: true })
  sizes?: string[];

  @Column({ nullable: true })
  country?: string;

  @Column({ type: 'jsonb', nullable: true })
  brand?: {
    name: string;
    logo: string;
    url: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  rating?: {
    value: number;
    count: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 