import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum KycStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

@Entity('kyc_requests')
export class Kyc {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, (user) => user.kycRequests)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    documentType: string;

    @Column()
    documentNumber: string;

    @Column({ type: 'text', nullable: true })
    frontImage: string;

    @Column({ type: 'text', nullable: true })
    backImage: string;

    @Column({
        type: 'enum',
        enum: KycStatus,
        default: KycStatus.PENDING,
    })
    status: string;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
