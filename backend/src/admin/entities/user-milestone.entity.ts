import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('user_milestones')
@Unique(['userId', 'milestoneCount'])
export class UserMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  milestoneCount: number; // 2, 4, 8, 16, 32, 64... (powers of 2)

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  rewardAmount: number;

  @Column({ type: 'enum', enum: ['X', 'Y', 'Z'] })
  rewardType: 'X' | 'Y' | 'Z';

  // Store the referrer's totalPurchaseAmount at the time of milestone award
  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  referrerPurchaseAmount: number;

  // Store the percentage used for this milestone
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentUsed: number;

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'PAID';

  @CreateDateColumn()
  createdAt: Date;
}
