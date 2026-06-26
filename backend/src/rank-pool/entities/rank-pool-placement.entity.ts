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

export enum UserRank {
  LEADER   = 'LEADER',
  MANAGER  = 'MANAGER',
  DIRECTOR = 'DIRECTOR',
  DIAMOND  = 'DIAMOND',
}

@Entity('rank_pool_placements')
export class RankPoolPlacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'enum', enum: UserRank })
  rank: UserRank;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => parseFloat(v) || 0 } })
  totalRewarded: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
