import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { HeapRewardPlacement } from './heap-reward-placement.entity';

@Entity('heap_reward_histories')
export class HeapRewardHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  placementId: string;

  @ManyToOne(() => HeapRewardPlacement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'placementId' })
  placement: HeapRewardPlacement;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'int', default: 500 })
  poolLevel: number;

  @Column({ type: 'date', nullable: true })
  rewardDate: Date; // e.g., '2026-04-20'

  /** Đơn hàng đã sinh ra phần thưởng này. Null với lịch sử cũ. */
  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  orderId: string | null;

  /** Phần thưởng này làm vị trí chạm max payout và bị đẩy khỏi bể. */
  @Column({ default: false })
  pushedOut: boolean;

  /** False khi chạy đồng bộ mô phỏng (skipWalletUpdate): không cộng tiền vào ví. */
  @Column({ default: true })
  walletCredited: boolean;

  @Index('IDX_heap_reward_histories_createdAt')
  @CreateDateColumn()
  createdAt: Date;
}
