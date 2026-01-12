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
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  directRate: number; // e.g., 0.20 = 20%

  // Group Commission Rate
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  groupRate: number; // e.g., 0.10 = 10%

  // Management Commission Rates
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  managementRateF1: number; // e.g., 0.15 = 15%

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => value === null ? null : parseFloat(value),
    },
  })
  managementRateF2: number | null; // Only for NPP

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => value === null ? null : parseFloat(value),
    },
  })
  managementRateF3: number | null; // Only for NPP

  // Package Value (minimum purchase to become this package type)
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  packageValue: number;

  // Reconsumption Threshold (commission amount threshold to require reconsumption)
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  reconsumptionThreshold: number;

  // Reconsumption Required (amount needed per cycle)
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  reconsumptionRequired: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
