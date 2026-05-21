import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum WalletDepositStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('wallet_deposit_requests')
export class WalletDepositRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Số tiền đã chuyển (VND) – user nhập, admin dùng tỉ giá Banking Settings để quy đổi USDT */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) =>
        value != null ? parseFloat(value) : null,
    },
  })
  amountVnd: number | null;

  /** Số USDT đã cộng vào ví (tính từ amountVnd / tỉ giá khi admin duyệt) */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) =>
        value != null ? parseFloat(value) : null,
    },
  })
  amount: number | null;

  @Column({ type: 'varchar', length: 20, default: 'BANKING' })
  method: 'BANKING' | 'USDT';

  /** Số dư USDT user yêu cầu nạp (nếu nạp qua USDT) */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) =>
        value != null ? parseFloat(value) : null,
    },
  })
  requestedUsdt: number | null;

  /** TxHash giao dịch nạp USDT */
  @Column({ type: 'varchar', length: 255, nullable: true })
  txHash: string | null;

  /** Địa chỉ ví gửi tiền USDT của user */
  @Column({ type: 'varchar', length: 255, nullable: true })
  senderAddress: string | null;

  @Column({ type: 'varchar', length: 20, default: WalletDepositStatus.PENDING })
  status: WalletDepositStatus;

  /** URL ảnh chứng từ chuyển khoản (sau khi user upload) */
  @Column({ nullable: true })
  proofImageUrl: string;

  /** Ghi chú của user: mã giao dịch, ngân hàng, nội dung chuyển... */
  @Column({ type: 'text', nullable: true })
  transferNote: string;

  /** Ghi chú của admin khi duyệt/từ chối */
  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @Column({ nullable: true })
  processedAt: Date;

  /** Staff/Admin id đã xử lý */
  @Column({ nullable: true })
  processedBy: string;

  @CreateDateColumn()
  createdAt: Date;
}
