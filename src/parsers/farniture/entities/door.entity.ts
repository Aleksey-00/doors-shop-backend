import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Category } from '../../../categories/entities/category.entity';

@Entity('doors')
export class Door {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'old_price' })
  oldPrice?: number;

  @Column({ default: '₽', name: 'price_unit' })
  priceUnit?: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'category_id' })
  categoryId: number;

  @Column({ name: 'category_name' })
  category_name: string;

  @Column('text', { array: true, default: '{}', name: 'image_urls' })
  imageUrls: string[];

  @Column('text', { array: true, default: '{}', name: 'thumbnail_urls' })
  thumbnailUrls: string[];

  @Column({ default: true, name: 'in_stock' })
  inStock: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  specifications?: Record<string, string>;

  @Column()
  url: string;

  @Column({ nullable: true, name: 'external_id' })
  externalId?: string;

  @Column({ type: 'jsonb', nullable: true })
  dimensions?: object;

  @Column({ type: 'jsonb', nullable: true })
  materials?: object;

  @Column({ type: 'jsonb', nullable: true })
  equipment?: object;

  @Column({ type: 'jsonb', nullable: true })
  features?: object;

  @Column({ nullable: true })
  manufacturer?: string;

  @Column({ nullable: true })
  warranty?: string;

  @Column({ nullable: true })
  installation?: string;

  @Column({ default: false })
  sale?: boolean;

  @Column({ nullable: true, name: 'lock_count' })
  lockCount?: number;

  @Column({ nullable: true, name: 'metal_thickness' })
  metalThickness?: string;

  @Column({ nullable: true, name: 'door_thickness' })
  doorThickness?: string;

  @Column({ nullable: true, name: 'exterior_finish' })
  exteriorFinish?: string;

  @Column({ nullable: true, name: 'interior_finish' })
  interiorFinish?: string;

  @Column({ nullable: true, name: 'exterior_color' })
  exteriorColor?: string;

  @Column({ nullable: true, name: 'interior_color' })
  interiorColor?: string;

  @Column({ type: 'jsonb', nullable: true })
  sizes?: object;

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  brand?: string;

  @Column({ nullable: true, type: 'decimal', precision: 2, scale: 1 })
  rating?: number;

  @Column({ default: 0 })
  views: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
} 