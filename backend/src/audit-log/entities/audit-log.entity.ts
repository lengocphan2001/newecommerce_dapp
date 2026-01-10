import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditLogAction {
  // Commission Payout Actions
  PAYOUT_CREATED = 'payout_created',
  PAYOUT_EXECUTED = 'payout_executed',
  PAYOUT_FAILED = 'payout_failed',
  PAYOUT_CANCELLED = 'payout_cancelled',
  
  // Admin Actions
  ADMIN_LOGIN = 'admin_login',
  ADMIN_LOGOUT = 'admin_logout',
  ADMIN_ACTION = 'admin_action',
  
  // User Actions
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  
  // Order Actions
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_CANCELLED = 'order_cancelled',
}

export enum AuditLogEntityType {
  COMMISSION_PAYOUT = 'commission_payout',
  USER = 'user',
  ORDER = 'order',
  PRODUCT = 'product',
  ADMIN = 'admin',
}

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['action'])
@Index(['createdAt'])
@Index(['userId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditLogAction,
  })
  action: AuditLogAction;

  @Column({
    type: 'enum',
    enum: AuditLogEntityType,
  })
  entityType: AuditLogEntityType;

  @Column({ nullable: true })
  entityId: string; // ID of the entity (e.g., batchId, userId, orderId)

  @Column({ nullable: true })
  userId: string; // User who performed the action (admin/user)

  @Column({ nullable: true })
  username: string; // Username for easier querying

  @Column({ type: 'text', nullable: true })
  description: string; // Human-readable description

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // Additional data (request body, response, etc.)

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string; // IP address of the requester

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string; // User agent string

  @CreateDateColumn()
  createdAt: Date;
}
