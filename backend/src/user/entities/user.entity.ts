import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
  parentId: string; // ID of direct parent (for tree structure)

  @Column({ type: 'enum', enum: ['left', 'right'], nullable: true })
  position: 'left' | 'right'; // Position in binary tree

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ default: false })
  isAdmin: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

