export declare class AdminService {
    getDashboard(): Promise<{
        message: string;
    }>;
    getUsers(query: any): Promise<{
        message: string;
    }>;
    getOrders(query: any): Promise<{
        message: string;
    }>;
    updateUserStatus(id: string, statusDto: any): Promise<{
        message: string;
    }>;
}
