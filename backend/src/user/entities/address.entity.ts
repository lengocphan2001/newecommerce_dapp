import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('addresses')
export class Address {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    phone: string;

    @Column({ type: 'text' })
    address: string;

    @Column({ default: false })
    isDefault: boolean;

    @ManyToOne(() => User, (user) => user.addresses)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    userId: string;
}
