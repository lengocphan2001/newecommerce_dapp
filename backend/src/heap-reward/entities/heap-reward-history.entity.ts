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

  @Column({ type: 'date', nullable: true })
  rewardDate: Date; // e.g., '2026-04-20'

  @CreateDateColumn()
  createdAt: Date;
}
