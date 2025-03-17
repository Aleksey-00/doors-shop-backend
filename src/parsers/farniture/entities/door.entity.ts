import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('doors')
export class Door {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  price: number;

  @Column({ name: 'old_price', nullable: true })
  oldPrice?: number;

  @Column({ name: 'price_unit', nullable: true })
  priceUnit?: string;

  @Column()
  category: string;

  @Column('text', { name: 'image_urls', array: true, nullable: true })
  imageUrls: string[];

  @Column('text', { name: 'thumbnail_urls', array: true, nullable: true })
  thumbnailUrls?: string[];

  @Column({ name: 'in_stock' })
  inStock: boolean;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  specifications?: Record<string, string>;

  @Column()
  url: string;

  @Column({ name: 'external_id', unique: true })
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

  @Column({ name: 'lock_count', type: 'int', nullable: true })
  lockCount?: number;

  @Column({ name: 'metal_thickness', type: 'float', nullable: true })
  metalThickness?: number;

  @Column({ name: 'door_thickness', type: 'int', nullable: true })
  doorThickness?: number;

  @Column({ name: 'exterior_finish', nullable: true })
  exteriorFinish?: string;

  @Column({ name: 'interior_finish', nullable: true })
  interiorFinish?: string;

  @Column({ name: 'exterior_color', nullable: true })
  exteriorColor?: string;

  @Column({ name: 'interior_color', nullable: true })
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
} 