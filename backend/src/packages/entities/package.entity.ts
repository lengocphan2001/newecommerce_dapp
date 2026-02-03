import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('packages')
export class Package {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string; // e.g., "Cộng Tác Viên"

    @Column({ unique: true })
    code: string; // e.g., "CTV", "NPP"

    @Column({ type: 'text', nullable: true })
    description: string;

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
    price: number; // Value to buy directly or accumulated

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
    directCommissionRate: number; // e.g., 0.20

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
    groupCommissionRate: number; // e.g., 0.10

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
    managementRateF1: number;

    @Column({
        type: 'decimal',
        precision: 5,
        scale: 4,
        default: 0,
        nullable: true,
        transformer: {
            to: (value: number | null) => value,
            from: (value: string | null) => (value === null ? null : parseFloat(value)),
        },
    })
    managementRateF2: number | null;

    @Column({
        type: 'decimal',
        precision: 5,
        scale: 4,
        default: 0,
        nullable: true,
        transformer: {
            to: (value: number | null) => value,
            from: (value: string | null) => (value === null ? null : parseFloat(value)),
        },
    })
    managementRateF3: number | null;

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

    @Column({ default: 0 })
    level: number; // For hierarchy sorting (e.g., CTV=1, NPP=2)

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
