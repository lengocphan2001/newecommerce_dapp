import { Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

/** Idempotency: mỗi đơn chỉ xử lý matrix reward một lần. */
@Entity('matrix_reward_order_processed')
export class MatrixRewardOrderProcessed {
  @PrimaryColumn('uuid')
  orderId: string;

  @CreateDateColumn()
  processedAt: Date;
}
