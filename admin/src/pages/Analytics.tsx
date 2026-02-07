import React, { useEffect, useState } from 'react';
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
    RiseOutlined,
} from '@ant-design/icons';
import { adminService } from '../services/adminService';

const { Title } = Typography;
const { Option } = Select;

const Analytics: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<any>({});
    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [orderData, setOrderData] = useState<any[]>([]);
    const [userData, setUserData] = useState<any[]>([]);
    const [topProducts, setTopProducts] = useState<any[]>([]);
    const [days, setDays] = useState(7);

    useEffect(() => {
        fetchData();
    }, [days]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [overviewRes, revenueRes, orderRes, userRes, productsRes] = await Promise.all([
                adminService.getAnalyticsOverview(),
                adminService.getRevenueChart(days),
                adminService.getOrderChart(days),
                adminService.getUserGrowth(days),
                adminService.getTopProducts(5),
            ]);

            setOverview(overviewRes.data);
            setRevenueData(revenueRes.data);
            setOrderData(orderRes.data);
            setUserData(userRes.data);
            setTopProducts(productsRes.data);
        } catch (error) {
            console.error('Failed to fetch analytics data:', error);
        } finally {
            setLoading(false);
        }
    };

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
            sorter: (a: any, b: any) => a.quantity - b.quantity,
        },
        {
            title: 'Revenue Generated',
            dataIndex: 'revenue',
            key: 'revenue',
            render: (val: number) => `$${val.toLocaleString()}`,
            sorter: (a: any, b: any) => a.revenue - b.revenue,
        },
    ];

    return (
        <div style={{ padding: '0px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>Analytics Dashboard</Title>
                <Select defaultValue={7} style={{ width: 120 }} onChange={(val) => setDays(val)}>
                    <Option value={7}>Last 7 Days</Option>
                    <Option value={14}>Last 14 Days</Option>
                    <Option value={30}>Last 30 Days</Option>
                </Select>
            </div>

            {/* Overview Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Total Revenue"
                            value={overview.totalRevenue}
                            precision={2}
                            valueStyle={{ color: '#3f8600' }}
                            prefix={<DollarOutlined />}
                            suffix=""
                            loading={loading}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Total Orders"
                            value={overview.totalOrders}
                            prefix={<FileTextOutlined />}
                            loading={loading}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Total Users"
                            value={overview.totalUsers}
                            prefix={<UserOutlined />}
                            loading={loading}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Total Products"
                            value={overview.totalProducts}
                            prefix={<ShoppingOutlined />}
                            loading={loading}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Charts Row 1 */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={12}>
                    <Card title="Revenue Trend" loading={loading}>
                        <div style={{ height: 300 }}>
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
                                    <Tooltip formatter={(value: number | string | undefined) => [`$${value}`, 'Revenue']} />
                                    <Legend />
                                    <Area type="monotone" dataKey="revenue" stroke="#82ca9d" fillOpacity={1} fill="url(#colorRevenue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title="Order Trend" loading={loading}>
                        <div style={{ height: 300 }}>
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

            {/* Charts Row 2 */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                    <Card title="User Growth" loading={loading}>
                        <div style={{ height: 300 }}>
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
                            rowKey="name"
                            scroll={{ y: 240 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default Analytics;
