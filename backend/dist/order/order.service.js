"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const order_entity_1 = require("./entities/order.entity");
const product_entity_1 = require("../product/entities/product.entity");
const user_entity_1 = require("../user/entities/user.entity");
const commission_service_1 = require("../affiliate/commission.service");
let OrderService = class OrderService {
    orderRepository;
    productRepository;
    userRepository;
    commissionService;
    constructor(orderRepository, productRepository, userRepository, commissionService) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.commissionService = commissionService;
    }
    async findAll(query) {
        const where = {};
        if (query.userId) {
            where.userId = query.userId;
        }
        if (query.status) {
            where.status = query.status;
        }
        return this.orderRepository.find({
            where,
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id) {
        const order = await this.orderRepository.findOne({ where: { id } });
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        return order;
    }
    async create(createOrderDto, userId) {
        const items = [];
        let totalAmount = 0;
        for (const item of createOrderDto.items) {
            const product = await this.productRepository.findOne({
                where: { id: item.productId },
            });
            if (!product) {
                throw new common_1.NotFoundException(`Product ${item.productId} not found`);
            }
            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for product ${product.name}`);
            }
            const itemTotal = product.price * item.quantity;
            totalAmount += itemTotal;
            items.push({
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
                price: product.price,
            });
            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
            }
        }
        const order = this.orderRepository.create({
            userId,
            items,
            totalAmount,
            status: order_entity_1.OrderStatus.PENDING,
            transactionHash: createOrderDto.transactionHash,
            shippingAddress: createOrderDto.shippingAddress,
        });
        const savedOrder = await this.orderRepository.save(order);
        return savedOrder;
    }
    async updateStatus(id, updateStatusDto) {
        const order = await this.findOne(id);
        const oldStatus = order.status;
        const newStatus = updateStatusDto.status;
        if (oldStatus === order_entity_1.OrderStatus.PENDING && newStatus === order_entity_1.OrderStatus.CONFIRMED) {
            for (const item of order.items) {
                const product = await this.productRepository.findOne({
                    where: { id: item.productId },
                });
                if (!product) {
                    throw new Error(`Product ${item.productId} not found`);
                }
                if (product.stock < item.quantity) {
                    throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
                }
            }
            for (const item of order.items) {
                const product = await this.productRepository.findOne({
                    where: { id: item.productId },
                });
                if (product) {
                    await this.productRepository.update(product.id, {
                        stock: product.stock - item.quantity,
                    });
                }
            }
            const user = await this.userRepository.findOne({ where: { id: order.userId } });
            const isReconsumption = await this.checkIfReconsumption(user, order.totalAmount);
            order.status = newStatus;
            order.isReconsumption = isReconsumption;
            const savedOrder = await this.orderRepository.save(order);
            if (isReconsumption && user) {
                await this.userRepository.update(order.userId, {
                    totalReconsumptionAmount: user.totalReconsumptionAmount + order.totalAmount,
                });
            }
            this.commissionService
                .calculateCommissions(savedOrder.id)
                .catch((error) => {
                console.error('Error calculating commissions:', error);
            });
            return savedOrder;
        }
        if (newStatus === order_entity_1.OrderStatus.CANCELLED && oldStatus !== order_entity_1.OrderStatus.CANCELLED) {
            for (const item of order.items) {
                const product = await this.productRepository.findOne({
                    where: { id: item.productId },
                });
                if (product) {
                    await this.productRepository.update(product.id, {
                        stock: product.stock + item.quantity,
                    });
                }
            }
        }
        order.status = newStatus;
        return this.orderRepository.save(order);
    }
    async cancelOrder(id) {
        const order = await this.findOne(id);
        if (order.status === order_entity_1.OrderStatus.DELIVERED) {
            throw new Error('Cannot cancel delivered order');
        }
        for (const item of order.items) {
            const product = await this.productRepository.findOne({
                where: { id: item.productId },
            });
            if (product) {
                await this.productRepository.update(product.id, {
                    stock: product.stock + item.quantity,
                });
            }
        }
        order.status = order_entity_1.OrderStatus.CANCELLED;
        return this.orderRepository.save(order);
    }
    async checkIfReconsumption(user, orderAmount) {
        if (!user || user.packageType === 'NONE') {
            return false;
        }
        const config = user.packageType === 'NPP'
            ? {
                RECONSUMPTION_THRESHOLD: 0.01,
                RECONSUMPTION_REQUIRED: 0.001,
            }
            : {
                RECONSUMPTION_THRESHOLD: 0.001,
                RECONSUMPTION_REQUIRED: 0.0001,
            };
        if (user.totalCommissionReceived >= config.RECONSUMPTION_THRESHOLD) {
            const cycles = Math.floor(user.totalCommissionReceived / config.RECONSUMPTION_THRESHOLD);
            const requiredReconsumption = cycles * config.RECONSUMPTION_REQUIRED;
            if (user.totalReconsumptionAmount < requiredReconsumption) {
                return true;
            }
        }
        return false;
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => commission_service_1.CommissionService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        commission_service_1.CommissionService])
], OrderService);
//# sourceMappingURL=order.service.js.map