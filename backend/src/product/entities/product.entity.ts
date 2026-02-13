import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Category } from '../../category/entities/category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  nameEn?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  descriptionEn?: string;

  // Use decimal for currency-like values (USDT supports up to 8 decimal places)
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  price: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  // Shipping fee for USA market (in USDT)
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => value ? parseFloat(value) : 0,
    },
  })
  shippingFee?: number;

  @Column({ nullable: true })
  thumbnailUrl?: string;

  // Store array of URLs as JSON (works across mysql/postgres via typeorm)
  @Column({ type: 'simple-json', nullable: true })
  detailImageUrls?: string[];

  // Store array of countries as JSON (product can be available in multiple countries)
  @Column({ type: 'simple-json', nullable: true })
  countries?: string[]; // Array of 'VIETNAM' | 'USA'

  // Product tags/status e.g. 'SALE', 'COMING_SOON', 'new', 'hot'
  @Column({ type: 'simple-json', nullable: true })
  tags?: string[];

  // Dynamic properties like Color, Size
  // Structure: [{ name: 'Color', values: ['Red', 'Blue'] }, { name: 'Size', values: ['S', 'M'] }]
  @Column({ type: 'simple-json', nullable: true })
  properties?: { name: string; values: string[] }[];

  @Column({ nullable: true })
  categoryId?: string;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  /** Brand – only show in details if set */
  @Column({ nullable: true })
  brand?: string;

  @Column({ nullable: true })
  brandEn?: string;

  /** Xuất xứ (origin) – only show in details if set */
  @Column({ nullable: true })
  origin?: string;

  @Column({ nullable: true })
  originEn?: string;

  /** Loại trang phục (clothing type) – only show in details if set */
  @Column({ nullable: true })
  clothingType?: string;

  @Column({ nullable: true })
  clothingTypeEn?: string;

  /** Fake sold count - displayed instead of real sold count when set */
  @Column({ type: 'int', nullable: true, default: 0 })
  fakeSold?: number;

  @Column({ type: 'timestamp', nullable: true })
  pushedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


