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
import { UserRank } from './rank-pool-placement.entity';

@Entity('rank_pool_histories')
export class RankPoolHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: UserRank })
  rank: UserRank;

  @Column({ type: 'decimal', precision: 14, scale: 4,
    transformer: { to: (v: number) => v, from: (v: string) => parseFloat(v) || 0 } })
  amount: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
