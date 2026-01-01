import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto';
export declare class ProductController {
    private readonly productService;
    constructor(productService: ProductService);
    findAll(query: any): Promise<import("./entities/product.entity").Product[]>;
    findOne(id: string): Promise<import("./entities/product.entity").Product>;
    create(createProductDto: CreateProductDto): Promise<import("./entities/product.entity").Product>;
    update(id: string, updateProductDto: UpdateProductDto): Promise<import("./entities/product.entity").Product>;
    remove(id: string): Promise<{
        deleted: boolean;
    }>;
}
