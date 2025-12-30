export declare class ResponseUtil {
    static success<T>(data: T, message?: string): {
        success: boolean;
        message: string;
        data: T;
    };
    static error(message: string, errors?: any): {
        success: boolean;
        message: string;
        errors: any;
    };
}
