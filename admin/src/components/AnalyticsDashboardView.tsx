import React from 'react';
import { Card, Col, Row, Statistic, Select, Table, Typography } from 'antd';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import {
  UserOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  DollarOutlined,
} from '@ant-design/icons';

const { Title } = Typography;
const { Option } = Select;

export interface AnalyticsDashboardViewProps {
  title: string;
  extra?: React.ReactNode;
  loading?: boolean;
  overview: {
    totalRevenue?: number;
    totalOrders?: number;
    totalUsers?: number;
    totalProducts?: number;
  };
  revenueData: { date: string; revenue: number }[];
  orderData: { date: string; count: number }[];
  userData: { date: string; count: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  days: number;
  onDaysChange: (days: number) => void;
  showDaysFilter?: boolean;
}

const topProductsColumns = [
  {
    title: 'Product Name',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: 'Quantity Sold',
    dataIndex: 'quantity',
    key: 'quantity',
    sorter: (a: { quantity: number }, b: { quantity: number }) => a.quantity - b.quantity,
  },
  {
    title: 'Revenue Generated',
    dataIndex: 'revenue',
    key: 'revenue',
    render: (val: number) => `$${Number(val).toLocaleString()}`,
    sorter: (a: { revenue: number }, b: { revenue: number }) => a.revenue - b.revenue,
  },
];

const AnalyticsDashboardView: React.FC<AnalyticsDashboardViewProps> = ({
  title,
  extra,
  loading = false,
  overview,
  revenueData,
  orderData,
  userData,
  topProducts,
  days,
  onDaysChange,
  showDaysFilter = true,
}) => {
  return (
    <div style={{ padding: '0px' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          {title}
        </Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {extra}
          {showDaysFilter && (
            <Select value={days} style={{ width: '100%', maxWidth: 140 }} onChange={onDaysChange}>
              <Option value={7}>Last 7 Days</Option>
              <Option value={14}>Last 14 Days</Option>
              <Option value={30}>Last 30 Days</Option>
            </Select>
          )}
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={overview.totalRevenue ?? 0}
              precision={2}
              valueStyle={{ color: '#3f8600' }}
              prefix={<DollarOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Orders"
              value={overview.totalOrders ?? 0}
              prefix={<FileTextOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={overview.totalUsers ?? 0}
              prefix={<UserOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Products"
              value={overview.totalProducts ?? 0}
              prefix={<ShoppingOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Revenue Trend" loading={loading}>
            <div className="admin-chart" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number | string | undefined) => [`$${value}`, 'Revenue']}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#82ca9d"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Order Trend" loading={loading}>
            <div className="admin-chart" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Orders" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="User Growth" loading={loading}>
            <div className="admin-chart" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" name="New Users" stroke="#ff7300" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Top Selling Products" loading={loading}>
            <Table
              dataSource={topProducts}
              columns={topProductsColumns}
              pagination={false}
              size="small"
              rowKey={(r) => r.name}
              scroll={{ y: 240 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnalyticsDashboardView;
