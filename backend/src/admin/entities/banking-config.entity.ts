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

    /** VietQR Bank ID (6 digits, e.g. 970436). When set, checkout generates dynamic QR with amount and transfer content. */
    @Column({ length: 10, default: '', nullable: true })
    bankId?: string;

    /** URL to the QR image uploaded by admin (fallback when bankId not set) */
    @Column({ nullable: true })
    qrImageUrl?: string;

    @Column({ default: true })
    isEnabled: boolean;

    /** Admin-set USDT price in VND (e.g. 25000). When set, checkout uses this for banking instead of fetching from CoinGecko. */
    @Column({
      type: 'decimal',
      precision: 14,
      scale: 2,
      nullable: true,
      default: null,
      transformer: {
        to: (v: number | null) => v,
        from: (v: string | null) => (v != null && v !== '' ? parseFloat(v) : null),
      },
    })
    usdtPriceVnd?: number | null;

    @UpdateDateColumn()
    updatedAt: Date;
}
