import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

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

  @Column({ nullable: true })
  thumbnailUrl?: string;

  // Store array of URLs as JSON (works across mysql/postgres via typeorm)
  @Column({ type: 'simple-json', nullable: true })
  detailImageUrls?: string[];

  // Store array of countries as JSON (product can be available in multiple countries)
  @Column({ type: 'simple-json', nullable: true })
  countries?: string[]; // Array of 'VIETNAM' | 'USA'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


