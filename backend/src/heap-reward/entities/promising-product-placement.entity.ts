import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Order } from '../../order/entities/order.entity';

@Entity('promising_product_placements')
export class PromisingProductPlacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: {
    to: (v: number) => v,
    from: (v: string) => parseFloat(v) || 0,
  }})
  totalRewarded: number;

  @Column({ type: 'int', default: 0 })
  timesEntered: number;

  @Index()
  @Column({ default: true })
  isActive: boolean;

  @Index()
  @Column({ type: 'int' })
  poolLevel: number; // 3000 hoặc 5000

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  triggerOrderId: string;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'triggerOrderId' })
  triggerOrder: Order;
}
