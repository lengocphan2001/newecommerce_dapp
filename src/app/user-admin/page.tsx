'use client';

import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, message, Typography } from 'antd';
import { DollarOutlined, TeamOutlined, ShoppingCartOutlined, GiftOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function UserAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('user_admin_token');
        const userStr = localStorage.getItem('user_admin_user');
        
        if (!token || !userStr) return;
        
        // Use the me endpoint which now acts as the user (since they are a proxy)
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/referral/info`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (error: any) {
        message.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;
  }

  if (!stats) return null;

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>Dashboard</Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Total Commission"
              value={stats.bonusCommission}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#1890ff' }} />}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Accumulated Purchases"
              value={stats.accumulatedPurchases}
              precision={2}
              prefix={<ShoppingCartOutlined style={{ color: '#52c41a' }} />}
              suffix="USDT"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Current Package"
              value={stats.packageType || 'NONE'}
              prefix={<GiftOutlined style={{ color: '#eb2f96' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="F1 Count (Direct)"
              value={stats.treeStats?.left?.count + stats.treeStats?.right?.count || 0}
              prefix={<TeamOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col xs={24} md={12}>
          <Card title="Left Branch" bordered={false}>
            <Statistic title="Total Sales" value={stats.treeStats?.left?.sales || 0} suffix="USDT" precision={2} />
            <div style={{ marginTop: 16 }}>
              <Statistic title="Total Members" value={stats.treeStats?.left?.count || 0} />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Right Branch" bordered={false}>
            <Statistic title="Total Sales" value={stats.treeStats?.right?.sales || 0} suffix="USDT" precision={2} />
            <div style={{ marginTop: 16 }}>
              <Statistic title="Total Members" value={stats.treeStats?.right?.count || 0} />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
