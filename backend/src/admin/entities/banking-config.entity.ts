import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
} from 'typeorm';

@Entity('banking_config')
export class BankingConfig {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ default: '' })
    bankName: string;

    @Column({ default: '' })
    accountNumber: string;

    @Column({ default: '' })
    accountName: string;

    /** URL to the QR image uploaded by admin */
    @Column({ nullable: true })
    qrImageUrl?: string;

    @Column({ default: true })
    isEnabled: boolean;

    @UpdateDateColumn()
    updatedAt: Date;
}
