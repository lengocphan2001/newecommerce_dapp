import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { User } from '../user/entities/user.entity';
import { Product } from '../product/entities/product.entity';

@Injectable()
export class AnalyticsService {
    constructor(
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
    ) { }

    async getOverview() {
        const totalUsers = await this.userRepository.count();
        const totalProducts = await this.productRepository.count();
        const totalOrders = await this.orderRepository.count();

        // Calculate total revenue from confirmed/delivered orders
        const revenueResult = await this.orderRepository
            .createQueryBuilder('order')
            .select('SUM(order.totalAmount)', 'total')
            .where('order.status IN (:...statuses)', {
                statuses: [OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.PROCESSING],
            })
            .getRawOne();

        const totalRevenue = revenueResult?.total ? parseFloat(revenueResult.total) : 0;

        return {
            totalUsers,
            totalProducts,
            totalOrders,
            totalRevenue,
        };
    }

    async getRevenueChart(days: number = 7) {
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - days);

        const data = await this.orderRepository
            .createQueryBuilder('order')
            .select("DATE(order.createdAt)", "date")
            .addSelect("SUM(order.totalAmount)", "revenue")
            .where("order.createdAt >= :startDate", { startDate })
            .andWhere("order.status IN (:...statuses)", {
                statuses: [OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.PROCESSING],
            })
            .groupBy("DATE(order.createdAt)")
            .orderBy("date", "ASC")
            .getRawMany();

        return data.map(item => ({
            date: new Date(item.date).toISOString().split('T')[0],
            revenue: parseFloat(item.revenue),
        }));
    }

    async getOrderChart(days: number = 7) {
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - days);

        const data = await this.orderRepository
            .createQueryBuilder('order')
            .select("DATE(order.createdAt)", "date")
            .addSelect("COUNT(order.id)", "count")
            .where("order.createdAt >= :startDate", { startDate })
            .groupBy("DATE(order.createdAt)")
            .orderBy("date", "ASC")
            .getRawMany();

        return data.map(item => ({
            date: new Date(item.date).toISOString().split('T')[0],
            count: parseInt(item.count, 10),
        }));
    }

    async getUserGrowth(days: number = 7) {
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - days);

        const data = await this.userRepository
            .createQueryBuilder('user')
            .select("DATE(user.createdAt)", "date")
            .addSelect("COUNT(user.id)", "count")
            .where("user.createdAt >= :startDate", { startDate })
            .groupBy("DATE(user.createdAt)")
            .orderBy("date", "ASC")
            .getRawMany();

        return data.map(item => ({
            date: new Date(item.date).toISOString().split('T')[0],
            count: parseInt(item.count, 10),
        }));
    }

    async getTopProducts(limit: number = 5) {
        // This is a bit complex with JSON items, for now we will just count based on order items if possible.
        // Since items are stored as JSON, doing a direct SQL aggregation is hard without native JSON support queries which vary by DB.
        // A simple approach for MVP:
        // Fetch all orders from last 30 days and aggregarte in memory (if not too many).
        // OR, better: detailed analytics might need a separate table for order_items if we want scale.
        // But let's try to see if we can use a simple approximation or fetch all confirmed orders (assume not millions yet).

        const orders = await this.orderRepository.find({
            where: [
                { status: OrderStatus.CONFIRMED },
                { status: OrderStatus.SHIPPED },
                { status: OrderStatus.DELIVERED },
                { status: OrderStatus.PROCESSING }
            ],
            take: 1000,
            order: { createdAt: 'DESC' }
        });

        const productSales: Record<string, { name: string, quantity: number, revenue: number }> = {};

        for (const order of orders) {
            for (const item of order.items) {
                if (!productSales[item.productId]) {
                    productSales[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
                }
                productSales[item.productId].quantity += item.quantity;
                productSales[item.productId].revenue += item.quantity * item.price;
            }
        }

        return Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, limit);
    }
}
