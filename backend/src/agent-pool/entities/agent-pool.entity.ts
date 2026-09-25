import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('agent_pools')
export class AgentPool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code: string; // e.g. 'C1', 'C2', 'C3'

  @Column({ type: 'varchar', length: 255 })
  name: string; // e.g. 'Bể Đại lý Cấp 1'

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value) || 0,
    },
  })
  percent: number; // e.g. 5.00 (%)

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
