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
 * A user moving balance from the reward wallet (withdrawWalletBalance) to the
 * consumption wallet (reconsumptionWalletBalance). Applied at once, no admin
 * approval; each row is the history of one swap.
 */
@Entity('wallet_swaps')
export class WalletSwap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Amount moved, in USDT. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  /** USDT/VND withdraw rate at swap time, so the VND shown never shifts. */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) =>
        value === null || value === undefined ? null : parseFloat(value),
    },
  })
  rate: number | null;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) =>
        value === null || value === undefined ? null : parseFloat(value),
    },
  })
  amountVnd: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
