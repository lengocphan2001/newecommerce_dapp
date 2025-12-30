import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto';
export declare class ProductController {
    private readonly productService;
    constructor(productService: ProductService);
    findAll(query: any): Promise<{
        message: string;
    }>;
    findOne(id: string): Promise<{
        message: string;
    }>;
    create(createProductDto: CreateProductDto): Promise<{
        message: string;
    }>;
    update(id: string, updateProductDto: UpdateProductDto): Promise<{
        message: string;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
