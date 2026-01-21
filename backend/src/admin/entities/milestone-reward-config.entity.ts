import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('milestone_reward_config')
export class MilestoneRewardConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Percentage reward for milestone 2, 16, 128... (pattern: powers of 2, position 1, 4, 7...)
  // Reward = referrer's totalPurchaseAmount * percentX / 100
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentX: number; // e.g., 1.00 = 1%

  // Percentage reward for milestone 4, 32, 256... (pattern: powers of 2, position 2, 5, 8...)
  // Reward = referrer's totalPurchaseAmount * percentY / 100
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentY: number; // e.g., 2.00 = 2%

  // Percentage reward for milestone 8, 64, 512... (pattern: powers of 2, position 3, 6, 9...)
  // Reward = referrer's totalPurchaseAmount * percentZ / 100
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentZ: number; // e.g., 3.00 = 3%

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
