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
 * One monthly salary paid by an admin to a user whose reward sales (weak
 * binary branch sales) for the month reached the salary tier the admin
 * filtered on.
 *
 * The admin can pay the same user more than once for a month (e.g. a top-up),
 * so there is no unique key on (userId, month): every row is one payment and
 * the user's wallet history lists them individually.
 */
@Entity('salary_payments')
@Index(['month', 'userId'])
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

  /** Lower bound (inclusive) of the salary tier the admin paid, USD. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: decimalTransformer,
  })
  tierMin: number;

  /** Upper bound (exclusive) of the salary tier, null when open-ended. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
    transformer: decimalTransformer,
  })
  tierMax: number | null;

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
