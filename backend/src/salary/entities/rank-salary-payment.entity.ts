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

const decimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) =>
    value === null ? null : parseFloat(value) || 0,
};

const decimalColumn = {
  type: 'decimal' as const,
  precision: 36,
  scale: 18,
  default: 0,
  transformer: decimalTransformer,
};

/**
 * One monthly rank salary paid to a C1 or C2 agent: an equal share of the C1
 * pool (4% of the C1 + C2 agents' reward sales) and, for C2, of the C2 pool
 * (2% of the C2 agents' reward sales). The pool figures at payment time are
 * kept for reference.
 *
 * An agent is paid at most once per month, enforced by the unique key.
 */
@Entity('rank_salary_payments')
@Index('UQ_rank_salary_payments_month_userId', ['month', 'userId'], {
  unique: true,
})
export class RankSalaryPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Sales month the salary is for, YYYY-MM. */
  @Column({ type: 'varchar', length: 7 })
  month: string;

  /** Agent rank when paid (C1 or C2). */
  @Column({ type: 'varchar', length: 16 })
  rank: string;

  /** The agent's own reward sales for `month`, USD. */
  @Column({ ...decimalColumn })
  rewardSales: number;

  /** Total of the C1 pool (4% of the C1 + C2 reward sales), USD. */
  @Column({ ...decimalColumn })
  c1PoolAmount: number;

  @Column({ type: 'int', default: 0 })
  c1MemberCount: number;

  /** Total of the C2 pool (2% of the C2 reward sales), USD. */
  @Column({ ...decimalColumn })
  c2PoolAmount: number;

  @Column({ type: 'int', default: 0 })
  c2MemberCount: number;

  /** Share of the C1 pool paid to this agent. */
  @Column({ ...decimalColumn })
  c1Share: number;

  /** Share of the C2 pool paid to this agent, 0 for C1. */
  @Column({ ...decimalColumn })
  c2Share: number;

  /** Gross salary in USDT (c1Share + c2Share), before the wallet split and tax. */
  @Column({ ...decimalColumn })
  amount: number;

  @Column({ ...decimalColumn })
  withdrawAmount: number;

  @Column({ ...decimalColumn })
  reconsumptionAmount: number;

  /** Tax deducted, credited to no wallet. */
  @Column({ ...decimalColumn })
  taxAmount: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paidBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
