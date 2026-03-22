import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { MatrixRewardTree } from './matrix-reward-tree.entity';
import { User } from '../../user/entities/user.entity';

export enum MatrixNodeSide {
  LEFT = 'left',
  RIGHT = 'right',
}

@Entity('matrix_reward_nodes')
@Unique(['treeId', 'userId'])
@Index(['treeId', 'parentNodeId'])
export class MatrixRewardNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  treeId: string;

  @ManyToOne(() => MatrixRewardTree, (t) => t.nodes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treeId' })
  tree: MatrixRewardTree;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  parentNodeId: string | null;

  /** null = root */
  @Column({ type: 'varchar', length: 8, nullable: true })
  side: MatrixNodeSide | null;

  @CreateDateColumn()
  createdAt: Date;

  /** Đơn hàng kích hoạt vị trí này — idempotent, mỗi đơn tối đa 1 node. */
  @Column({ type: 'uuid', nullable: true, unique: true })
  placementOrderId: string | null;
}
