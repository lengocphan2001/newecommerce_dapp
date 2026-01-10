import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag } from 'antd';
import {
  UserOutlined,
  ShoppingOutlined,
  DollarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { adminService } from '../services/adminService';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await adminService.getDashboard();
      // Giả sử API trả về data như này
      setStats({
        totalUsers: response.data?.totalUsers || 0,
        totalProducts: response.data?.totalProducts || 0,
        totalOrders: response.data?.totalOrders || 0,
        totalRevenue: response.data?.totalRevenue || 0,
      });
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Recent Orders',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          PENDING: 'orange',
          PROCESSING: 'blue',
          SHIPPED: 'cyan',
          DELIVERED: 'green',
          CANCELLED: 'red',
        };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
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
        <Col xs={24} lg={12}>
          <Card title="Recent Orders">
            <Table
              columns={columns}
              dataSource={[]}
              loading={loading}
              pagination={false}
              size="small"
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

