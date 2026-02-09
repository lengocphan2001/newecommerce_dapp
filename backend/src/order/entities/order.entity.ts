import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Commission } from '../../affiliate/entities/commission.entity';
import { User } from '../../user/entities/user.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string; // User đặt hàng

  @Column({ type: 'simple-json' })
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    properties?: { [key: string]: string }; // Selected properties (e.g., { "Color": "Red", "Size": "M" })
  }>;

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
  totalAmount: number;

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

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: 'text', nullable: true })
  shippingAddress: string;

  @Column({ nullable: true })
  transactionHash: string; // Hash giao dịch blockchain

  @Column({ default: false })
  isReconsumption: boolean; // Đánh dấu đơn hàng tái tiêu dùng

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Commission, (commission) => commission.order)
  commissions: Commission[];

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
