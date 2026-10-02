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

export type RankSalaryOverrideAction = 'add' | 'remove';

/**
 * A change an admin made by hand to the month's C1 / C2 rank salary list:
 *
 * - `add`: the user is paid as `rank` (C1 or C2) although the monthly closing
 *   did not give them that rank.
 * - `remove`: the user is left out although the closing made them C1 / C2.
 *
 * The pools are shared among the list after these changes, so adding or
 * removing someone changes every member's share. A user has at most one
 * change per month, enforced by the unique key.
 */
@Entity('rank_salary_overrides')
@Index('UQ_rank_salary_overrides_month_userId', ['month', 'userId'], {
  unique: true,
})
export class RankSalaryOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Sales month the change is for, YYYY-MM. */
  @Column({ type: 'varchar', length: 7 })
  month: string;

  @Column({ type: 'varchar', length: 16 })
  action: RankSalaryOverrideAction;

  /** Rank the user is paid as (C1 or C2) for `add`, null for `remove`. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  rank: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
