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

/** Who put this member in the pool. */
export enum AgentPoolMemberSource {
  /** Added by hand from the admin panel; the auto sync never touches it. */
  MANUAL = 'MANUAL',
  /** Added by the rank sync when an approved order made the user qualify. */
  AUTO = 'AUTO',
}

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

  /**
   * Rows added by hand stay under admin control: the rank sync only ever
   * activates or deactivates rows it created itself, so a member the admin
   * deliberately disabled is not silently switched back on.
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: AgentPoolMemberSource.MANUAL,
  })
  source: AgentPoolMemberSource;

  /** Rank the sync last saw for this user, for auditing why they are in. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  syncedRank: string | null;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
