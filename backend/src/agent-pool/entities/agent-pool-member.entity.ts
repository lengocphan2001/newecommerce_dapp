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
import { AgentPool } from './agent-pool.entity';
import { User } from '../../user/entities/user.entity';

@Entity('agent_pool_members')
export class AgentPoolMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  poolId: string;

  @ManyToOne(() => AgentPool, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poolId' })
  pool: AgentPool;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

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
