import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PackageType {
  CTV = 'CTV',
  NPP = 'NPP',
}

@Entity('commission_config')
export class CommissionConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PackageType,
    unique: true,
  })
  packageType: PackageType;

  // Direct Commission Rate
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  directRate: number; // e.g., 0.20 = 20%

  // Group Commission Rate
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  groupRate: number; // e.g., 0.10 = 10%

  // Management Commission Rates
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 })
  managementRateF1: number; // e.g., 0.15 = 15%

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0, nullable: true })
  managementRateF2: number | null; // Only for NPP

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0, nullable: true })
  managementRateF3: number | null; // Only for NPP

  // Package Value (minimum purchase to become this package type)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  packageValue: number;

  // Reconsumption Threshold (commission amount threshold to require reconsumption)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  reconsumptionThreshold: number;

  // Reconsumption Required (amount needed per cycle)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  reconsumptionRequired: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
