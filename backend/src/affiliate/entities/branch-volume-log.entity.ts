import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('branch_volume_logs')
export class BranchVolumeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string; // User nhận doanh số

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  orderId: string | null; // ID của đơn hàng phát sinh

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
  amount: number; // Số PV doanh số được cộng

  @Column({ type: 'varchar', length: 10 })
  side: 'left' | 'right'; // Nhánh được cộng

  @CreateDateColumn()
  createdAt: Date;
}
