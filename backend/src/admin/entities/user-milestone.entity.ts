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
  milestoneCount: number; // 2, 4, 6, 8, 10, 12...

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  rewardAmount: number;

  @Column({ type: 'enum', enum: ['X', 'Y', 'Z'] })
  rewardType: 'X' | 'Y' | 'Z';

  @Column({ default: 'PENDING' })
  status: 'PENDING' | 'PAID';

  @CreateDateColumn()
  createdAt: Date;
}
