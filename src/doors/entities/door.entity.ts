import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('doors')
export class Door {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'integer' })
  price: number;

  @Column({ type: 'integer', nullable: true, name: 'old_price' })
  oldPrice: number;

  @Column({ type: 'varchar', nullable: true, name: 'image_url' })
  imageUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  specifications: Record<string, string>;

  @Column({ nullable: true })
  category: string;

  @Column({ name: 'in_stock' })
  inStock: boolean;

  @Column()
  url: string;

  @Column({ unique: true, name: 'external_id' })
  externalId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
} 