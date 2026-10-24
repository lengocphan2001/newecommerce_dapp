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

/**
 * One monthly salary paid to a user whose reward sales (weak binary branch
 * sales) for the month reached a salary tier. The amount is the month's reward
 * sales times the tier rate, computed on the server.
 *
 * A user is paid at most once per month, enforced by the unique key.
 */
@Entity('salary_payments')
@Index('UQ_salary_payments_month_userId', ['month', 'userId'], { unique: true })
export class SalaryPayment {
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

  /** The user's reward sales (weak branch sales) for `month` when paid, USD. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: decimalTransformer,
  })
  rewardSales: number;

  /** Lower bound (inclusive) of the salary tier, USD at `vndRate`. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: decimalTransformer,
  })
  tierMin: number;

  /** Upper bound (exclusive) of the salary tier, USD, null when open-ended. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
    transformer: decimalTransformer,
  })
  tierMax: number | null;

  /** Salary tier code (T1..T4); null for payments made before automatic tiers. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  tierCode: string | null;

  /** Tier rate applied to `rewardSales`, e.g. 0.04; null for older payments. */
  @Column({
    type: 'decimal',
    precision: 6,
    scale: 4,
    nullable: true,
    transformer: decimalTransformer,
  })
  rate: number | null;

  /** USDT/VND rate used to pick the tier; null for older payments. */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  vndRate: number | null;

  /** Gross salary in USDT, before the wallet split and tax. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: decimalTransformer,
  })
  amount: number;

  /** Part credited to `users.withdrawWalletBalance`. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: decimalTransformer,
  })
  withdrawAmount: number;

  /** Part credited to `users.reconsumptionWalletBalance`. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: decimalTransformer,
  })
  reconsumptionAmount: number;

  /** Tax deducted, credited to no wallet. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: decimalTransformer,
  })
  taxAmount: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  /** Admin who paid it (username, email or id, whichever the token carries). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  paidBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
