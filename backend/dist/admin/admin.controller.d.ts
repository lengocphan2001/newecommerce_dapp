import { AdminService } from './admin.service';
import { UpdateUserStatusDto } from './dto';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getDashboard(): Promise<{
        message: string;
    }>;
    getUsers(query: any): Promise<{
        message: string;
    }>;
    getOrders(query: any): Promise<{
        message: string;
    }>;
    updateUserStatus(id: string, statusDto: UpdateUserStatusDto): Promise<{
        message: string;
    }>;
}
