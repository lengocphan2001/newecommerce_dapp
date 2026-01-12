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

  // Reward for milestone 2, 8, 14, 20... (pattern: 2 + 6n)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  rewardX: number; // e.g., 10.00

  // Reward for milestone 4, 10, 16, 22... (pattern: 4 + 6n)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  rewardY: number; // e.g., 20.00

  // Reward for milestone 6, 12, 18, 24... (pattern: 6 + 6n)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  rewardZ: number; // e.g., 30.00

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
