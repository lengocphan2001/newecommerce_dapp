import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { MatrixRewardNode } from './matrix-reward-node.entity';

/** Một instance cây nhị phân theo tầng (cây 1, cây 2, …) — dùng chung toàn hệ thống. */
@Entity('matrix_reward_trees')
export class MatrixRewardTree {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  treeLevel: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => MatrixRewardNode, (n) => n.tree)
  nodes: MatrixRewardNode[];
}
