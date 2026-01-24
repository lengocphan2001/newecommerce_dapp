import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, message } from 'antd';
import {
  UserOutlined,
  ShoppingOutlined,
  DollarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { adminService } from '../services/adminService';
import type { ColumnsType } from 'antd/es/table';

interface RecentOrder {
  id: string;
  userId: string;
  totalAmount: number;
  status: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await adminService.getDashboard();
      const data = response.data || response;
      setStats({
        totalUsers: data.totalUsers || 0,
        totalProducts: data.totalProducts || 0,
        totalOrders: data.totalOrders || 0,
        totalRevenue: data.totalRevenue || 0,
      });
      setRecentOrders(data.recentOrders || []);
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      message.error(error.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<RecentOrder> = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => id.substring(0, 8) + '...',
      width: 120,
    },
    {
      title: 'User ID',
      dataIndex: 'userId',
      key: 'userId',
      render: (userId: string) => userId.substring(0, 8) + '...',
      width: 120,
    },
    {
      title: 'Items',
      key: 'items',
      render: (_, record) => {
        const itemCount = record.items?.length || 0;
        const totalQuantity = record.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        return `${itemCount} item(s) (${totalQuantity} total)`;
      },
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => `${amount.toFixed(2)} USDT`,
      align: 'right',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'orange',
          confirmed: 'blue',
          processing: 'blue',
          shipped: 'cyan',
          delivered: 'green',
          cancelled: 'red',
        };
        const statusUpper = status.toUpperCase();
        return <Tag color={colorMap[status] || 'default'}>{statusUpper}</Tag>;
      },
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Dashboard</h1>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Products"
              value={stats.totalProducts}
              prefix={<ShoppingOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Orders"
              value={stats.totalOrders}
              prefix={<FileTextOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={stats.totalRevenue}
              prefix={<DollarOutlined />}
              precision={2}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={24}>
          <Card title="Recent Orders">
            <Table
              columns={columns}
              dataSource={recentOrders}
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="small"
              rowKey="id"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Quick Actions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p>• View all users</p>
              <p>• Manage products</p>
              <p>• Process orders</p>
              <p>• Review KYC requests</p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;

