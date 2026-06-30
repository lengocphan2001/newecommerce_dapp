import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Address } from './address.entity';
import { Kyc } from '../../kyc/entities/kyc.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  avatar: string;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @OneToMany(() => Kyc, (kyc) => kyc.user)
  kycRequests: Kyc[];

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  // Indexado para búsquedas rápidas durante inicio de sesión y validación de referencias
  @Index()
  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  country: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true, unique: true })
  walletAddress: string;

  @Column({ nullable: true })
  taxId: string;

  @Column({ nullable: true })
  chainId: string;

  @Column({ nullable: true })
  referralUser: string; // Username of referrer (for display)

  // Indexado para cálculos eficientes de comisiones directas
  @Index()
  @Column({ nullable: true })
  referralUserId: string; // ID of referrer (for direct commission calculation)

  // Indexado para optimizar recorridos del árbol binario y cálculos de descendientes
  @Index()
  @Column({ nullable: true })
  parentId: string; // ID of direct parent (for tree structure)

  // Indexado para filtrar ramas eficientemente en memoria o base de datos
  @Index()
  @Column({ type: 'enum', enum: ['left', 'right'], nullable: true })
  position: 'left' | 'right'; // Position in binary tree

  @Column({ default: 'NONE' })
  packageType: string; // Loại gói user (dynamic code)

  /** Rank lãnh đạo do admin thiết lập hàng tháng dựa trên doanh số */
  @Column({
    type: 'enum',
    enum: ['NONE', 'LEADER', 'MANAGER', 'DIRECTOR', 'DIAMOND'],
    default: 'NONE',
  })
  rank: 'NONE' | 'LEADER' | 'MANAGER' | 'DIRECTOR' | 'DIAMOND';

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalPurchaseAmount: number; // Tổng giá trị đã mua (để tính lên gói)

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalCommissionReceived: number; // Tổng hoa hồng đã nhận

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    name: 'fake_received_commission',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  fakeReceivedCommission: number; // Hoa hồng “ảo” do admin thêm, hiển thị = totalCommissionReceived + fakeReceivedCommission

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalReconsumptionAmount: number; // Tổng doanh số tái tiêu dùng

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  leftBranchTotal: number; // Tổng doanh số nhánh trái (cho binary tree)

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  rightBranchTotal: number; // Tổng doanh số nhánh phải (cho binary tree)

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ default: false })
  isAdmin: boolean;

  /** Số dư ví nạp tiền (banking) - admin duyệt nạp rồi cộng vào đây */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  walletBalance: number;

  /** Balance del monedero en PV para los usuarios que depositaron USDT, donde 1 PV equivale a 1.08 USDT. */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  pvWalletBalance: number;

  /** Số dư ví rút tiền (nhận hoa hồng để user rút). */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  withdrawWalletBalance: number;

  /** Số dư ví tích lũy (ví tiêu dùng). */
  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  reconsumptionWalletBalance: number;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpiresAt?: Date;

  /** Mã OTP đăng nhập Web2 (6 chữ số), tạm thời cho đến khi hết hạn. */
  @Column({ nullable: true })
  loginOtpCode?: string;

  @Column({ type: 'timestamp', nullable: true })
  loginOtpExpiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  passwordChangedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
