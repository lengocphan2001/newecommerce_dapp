import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto } from './dto';
export declare class ProductService {
    private readonly productRepository;
    constructor(productRepository: Repository<Product>);
    findAll(_query: any): Promise<Product[]>;
    findOne(id: string): Promise<Product>;
    create(createProductDto: CreateProductDto): Promise<Product>;
    update(id: string, updateProductDto: UpdateProductDto): Promise<Product>;
    remove(id: string): Promise<{
        deleted: boolean;
    }>;
}
