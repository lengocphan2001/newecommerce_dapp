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
import { PromisingProductPlacement } from './promising-product-placement.entity';

@Entity('promising_product_histories')
export class PromisingProductHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  placementId: string;

  @ManyToOne(() => PromisingProductPlacement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'placementId' })
  placement: PromisingProductPlacement;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: {
    to: (v: number) => v,
    from: (v: string) => parseFloat(v) || 0,
  }})
  amount: number;

  @Column({ type: 'int' })
  poolLevel: number; // 1000 hoặc 3000

  @Column({ type: 'date', nullable: true })
  rewardDate: Date;

  @CreateDateColumn()
  createdAt: Date;
}
