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

/**
 * One monthly salary credit paid by an admin to an agent (C1..C9).
 *
 * The admin can pay the same user more than once for a month (e.g. a top-up),
 * so there is no unique key on (userId, month): every row is one credit and
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

  /** Closed sales month the salary is for, YYYY-MM. */
  @Column({ type: 'varchar', length: 7 })
  month: string;

  /** Rank from `user_monthly_stats.calculatedRank` when the salary was paid. */
  @Column({ type: 'varchar', length: 16 })
  rank: string;

  /** Gross salary in USDT, before the wallet split and tax. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  amount: number;

  /** Part credited to `users.withdrawWalletBalance` (70%). */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  withdrawAmount: number;

  /** Part credited to `users.reconsumptionWalletBalance` (20%). */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  reconsumptionAmount: number;

  /** Tax deducted (10%), credited to no wallet. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
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
