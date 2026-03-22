import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

/** User đã đạt trần 1500$ trên một cây (theo treeLevel) — không được vào lại cây đó. */
@Entity('matrix_tree_exclusions')
@Unique(['userId', 'treeLevel'])
export class MatrixTreeExclusion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  treeLevel: number;

  @CreateDateColumn()
  createdAt: Date;
}
