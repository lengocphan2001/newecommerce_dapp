import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
export declare class UserService {
    private userRepository;
    constructor(userRepository: Repository<User>);
    findAll(): Promise<User[]>;
    findOne(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    create(createUserDto: any): Promise<{
        id: string;
        email: string;
        fullName: string;
        phone: string;
        status: string;
        isAdmin: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, updateUserDto: any): Promise<User | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
