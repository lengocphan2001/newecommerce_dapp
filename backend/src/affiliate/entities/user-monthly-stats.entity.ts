import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('user_monthly_stats')
@Index(['userId', 'month'], { unique: true })
export class UserMonthlyStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 7 }) // YYYY-MM e.g. '2026-08'
  month: string;

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
  personalSales: number;

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
  groupSales: number;

  @Column({ type: 'varchar', length: 16, default: 'C0' })
  calculatedRank: string; // e.g. C0, C1, C2, C3, C4, C5, C6, C7, C8, C9

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  groupRewardRate: number; // e.g. 0.04 (4%), 0.06 (6%), 0.08 (8%), 0.10 (10%)

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
  groupRewardAmount: number;

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
  globalShareAmount: number;

  @Column({ default: false })
  isProcessed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
