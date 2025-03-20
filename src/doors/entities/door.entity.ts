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

  @Column({ type: 'integer', nullable: true })
  oldPrice: number;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  specifications: Record<string, string>;

  @Column({ nullable: true })
  category: string;

  @Column()
  inStock: boolean;

  @Column()
  url: string;

  @Column({ unique: true })
  externalId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 