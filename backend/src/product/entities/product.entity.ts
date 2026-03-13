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

  // Product combos — preset quantity bundles with a special price
  // Structure: [{ quantity: 3, price: 25.00, label: 'Mua 3 giảm còn $25' }]
  @Column({ type: 'simple-json', nullable: true })
  combos?: { quantity: number; price: number; label?: string }[];

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

  /** When true, show this product in the home page image strip (under the title). */
  @Column({ default: false })
  featuredOnHome: boolean;

  @Column({ type: 'int', nullable: true, default: 0 })
  salePercentage?: number;

  /** true = dùng hoa hồng sản phẩm (%), false = chỉ dùng hoa hồng theo gói (package) cho đơn hàng. Default false. */
  @Column({ type: 'boolean', default: false })
  useProductCommission: boolean;

  /** Direct: commission % for buyer package TV (0–100). Referrer gets this % of (price × qty). */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  commissionPercentTV?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  commissionPercentCTV?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  commissionPercentNPP?: number;

  /** Group: % hoa hồng nhóm (ancestors cân nhánh) khi khách có gói TV/CTV/NPP mua sản phẩm này. */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  commissionPercentGroupTV?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  commissionPercentGroupCTV?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  commissionPercentGroupNPP?: number;

  /** Management: % hoa hồng quản lý (F1/F2/F3 của người nhận product group) khi khách có gói TV/CTV/NPP mua. */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  commissionPercentManagementTV?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  commissionPercentManagementCTV?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  commissionPercentManagementNPP?: number;

  /** Giống package: Min doanh số mỗi nhánh ($) để được nhận hoa hồng nhóm. 0 = không yêu cầu. */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  groupCommissionMinSales?: number;

  /** Giống package: % hoa hồng quản lý F1 (0–100). Nếu set thì dùng thay cho commissionPercentManagement* theo gói. */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  managementRateF1?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  managementRateF2?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  managementRateF3?: number;

  /** Giống package: doanh số tối thiểu mỗi nhánh ($) để F1/F2/F3 nhận hoa hồng quản lý. 0 = không yêu cầu. */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  managementMinSales?: number;

  /** Giống package: ngưỡng hoa hồng tối đa ($) trước khi yêu cầu tái tiêu dùng. */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  reconsumptionThreshold?: number;

  /** Giống package: số tiền mua thêm ($) để khôi phục sau khi đạt ngưỡng. */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: { to: (v: number) => v, from: (v: string) => (v != null ? parseFloat(v) : 0) },
  })
  reconsumptionRequired?: number;

  /**
   * Cấu hình hoa hồng theo từng gói (code) – cùng cấu trúc form như Package.
   * Key = package code (TV, CTV, NPP). Value = { directCommissionRate (0–1), groupCommissionRate, groupCommissionMinSales, managementRateF1/F2/F3, managementMinSales, reconsumptionThreshold, reconsumptionRequired }.
   */
  @Column({ type: 'simple-json', nullable: true })
  commissionConfigByPackage?: Record<string, {
    directCommissionRate?: number;
    groupCommissionRate?: number;
    groupCommissionMinSales?: number;
    managementRateF1?: number;
    managementRateF2?: number | null;
    managementRateF3?: number | null;
    managementMinSales?: number;
    reconsumptionThreshold?: number;
    reconsumptionRequired?: number;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


