import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Address } from './address.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;



  @Column({ type: 'text', nullable: true })
  avatar: string;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  country: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true, unique: true })
  walletAddress: string;

  @Column({ nullable: true })
  chainId: string;

  @Column({ nullable: true })
  referralUser: string; // Username of referrer (for display)

  @Column({ nullable: true })
  referralUserId: string; // ID of referrer (for direct commission calculation)

  @Column({ nullable: true })
  parentId: string; // ID of direct parent (for tree structure)

  @Column({ type: 'enum', enum: ['left', 'right'], nullable: true })
  position: 'left' | 'right'; // Position in binary tree

  @Column({ default: 'NONE' })
  packageType: string; // Loại gói user (dynamic code)

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

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpiresAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

