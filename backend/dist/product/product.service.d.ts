export declare class ProductService {
    findAll(query: any): Promise<{
        message: string;
    }>;
    findOne(id: string): Promise<{
        message: string;
    }>;
    create(createProductDto: any): Promise<{
        message: string;
    }>;
    update(id: string, updateProductDto: any): Promise<{
        message: string;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
