import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('password_reset_tokens')
@Index('idx_password_reset_user_id', ['userId'])
@Index('idx_password_reset_expires_at', ['expiresAt'])
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ length: 128 })
  @Index('idx_password_reset_token_hash', { unique: true })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt?: Date | null;

  @Column({ type: 'varchar', nullable: true, length: 64 })
  requestIp?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 512 })
  requestUa?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
