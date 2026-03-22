import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MatrixRewardTree } from './matrix-reward-tree.entity';
import { User } from '../../user/entities/user.entity';

@Entity('matrix_reward_ledger')
@Index(['beneficiaryUserId', 'treeId'])
export class MatrixRewardLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  treeId: string;

  @ManyToOne(() => MatrixRewardTree, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treeId' })
  tree: MatrixRewardTree;

  @Column()
  beneficiaryUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'beneficiaryUserId' })
  beneficiary: User;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseFloat(v),
    },
  })
  amount: number;

  @Column({ type: 'uuid' })
  sourceNodeId: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @CreateDateColumn()
  createdAt: Date;
}
