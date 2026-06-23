import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Order } from '../../order/entities/order.entity';

export enum CommissionType {
  DIRECT = 'direct', // Hoa hồng trực tiếp
  INDIRECT = 'indirect', // Hoa hồng gián tiếp (F2)
  GROUP = 'group', // Hoa hồng nhóm
  MANAGEMENT = 'management', // Hoa hồng quản lý
  MILESTONE = 'milestone', // Thưởng milestone (2, 4, 6 người...)
  PRODUCT = 'product', // Hoa hồng theo từng sản phẩm (% theo gói TV/CTV/NPP)
}

export enum CommissionStatus {
  PENDING = 'pending',
  PAID = 'paid',
  BLOCKED = 'blocked', // Bị chặn do chưa tái tiêu dùng
  CANCELLED = 'cancelled', // Admin hủy, không chi trả
}

@Entity('commissions')
export class Commission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string; // User nhận hoa hồng

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  orderId: string | null; // Đơn hàng phát sinh hoa hồng (null cho milestone)

  @ManyToOne(() => Order, (order) => order.commissions, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'varchar', length: 64, nullable: true })
  milestoneRef: string; // e.g. 'milestone-{id}' để singlePayout tìm commission milestone

  @Column({ nullable: true })
  fromUserId: string; // User tạo ra đơn hàng (cho hoa hồng trực tiếp/quản lý)

  @ManyToOne(() => User)
  @JoinColumn({ name: 'fromUserId' })
  fromUser: User;

  @Column({ type: 'varchar', length: 32 })
  type: CommissionType; // Stored as string to avoid ALTER enum truncating existing rows (e.g. legacy 'binary' etc.)

  @Column({
    type: 'enum',
    enum: CommissionStatus,
    default: CommissionStatus.PENDING,
  })
  status: CommissionStatus;

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
  amount: number; // Số tiền hoa hồng

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
  orderAmount: number; // Giá trị đơn hàng

  @Column({ nullable: true })
  level: number; // Cấp độ (F1, F2, F3) cho hoa hồng quản lý

  @Column({ nullable: true })
  side: 'left' | 'right'; // Nhánh trong binary tree

  @Column({ type: 'text', nullable: true })
  notes: string; // Ghi chú

  @Column({ nullable: true })
  payoutBatchId: string; // Batch ID from smart contract

  @Column({ nullable: true })
  payoutTxHash: string; // Transaction hash from blockchain

  @Column({ nullable: true })
  payoutBlockNumber: number; // Block number when payout was executed

  @Column({ type: 'timestamp', nullable: true })
  payoutDate: Date; // Date when payout was executed

  @CreateDateColumn()
  createdAt: Date;
}
