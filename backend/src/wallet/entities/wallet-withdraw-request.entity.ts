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

export enum WalletWithdrawMethod {
  USDT = 'USDT',
  BANKING = 'BANKING',
}

export enum WalletWithdrawStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('wallet_withdraw_requests')
export class WalletWithdrawRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

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

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) =>
        value === null || value === undefined ? null : parseFloat(value),
    },
  })
  actualAmount: number | null;

  /** Tasa de cambio USDT/VND al momento de realizar la solicitud de retiro para evitar que cambie si el administrador actualiza la tasa global */
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

  /** Cantidad equivalente en VND al momento de la solicitud para congelar el valor histórico independientemente de futuros cambios en la tasa */
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

  @Column({ type: 'varchar', length: 16 })
  method: WalletWithdrawMethod;

  @Column({ type: 'varchar', length: 128, nullable: true })
  usdtWalletAddress: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  bankAccountNumber: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bankAccountName: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bankQrImageUrl: string | null;

  @Column({ type: 'varchar', length: 20, default: WalletWithdrawStatus.PENDING })
  status: WalletWithdrawStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  processedBy: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  txHash: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
