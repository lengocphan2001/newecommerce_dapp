import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AgentPool } from './agent-pool.entity';
import { AgentPoolMember } from './agent-pool-member.entity';
import { User } from '../../user/entities/user.entity';
import { Order } from '../../order/entities/order.entity';

@Entity('agent_pool_histories')
export class AgentPoolHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  poolId: string;

  @ManyToOne(() => AgentPool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poolId' })
  pool: AgentPool;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  memberId: string | null;

  @ManyToOne(() => AgentPoolMember, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'memberId' })
  member: AgentPoolMember;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  orderTotalAmount: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  orderNetAmount: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  poolPercent: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  poolTotalAmount: number;

  @Column({ type: 'int', default: 1 })
  memberCount: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  rewardAmount: number;

  /** Phần thưởng cộng vào ví rút tiền (users.withdrawWalletBalance). */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  withdrawAmount: number;

  /** Phần thưởng cộng vào ví tiêu dùng (users.reconsumptionWalletBalance). */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  reconsumptionAmount: number;

  /** Phần bị trừ thẳng (VAT/thuế), không vào ví nào. */
  @Column({
    type: 'decimal',
    precision: 18,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  taxAmount: number;

  @CreateDateColumn()
  createdAt: Date;
}
