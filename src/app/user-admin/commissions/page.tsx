'use client';

import React, { useEffect, useState } from 'react';
import { Table, Card, Spin, message, Typography, Tag } from 'antd';

const { Title } = Typography;

export default function UserAdminCommissions() {
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<any[]>([]);

  useEffect(() => {
    const fetchCommissions = async () => {
      try {
        const token = localStorage.getItem('user_admin_token');
        const userStr = localStorage.getItem('user_admin_user');
        if (!token || !userStr) return;
        
        const user = JSON.parse(userStr);
        const targetUserId = user.linkedUserId || user.id;

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/affiliate/commissions/${targetUserId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch commissions');
        }

        const data = await response.json();
        setCommissions(data);
      } catch (error: any) {
        message.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCommissions();
  }, []);

  const columns = [
    {
      title: 'From User',
      key: 'fromUser',
      render: (_: any, record: any) => record.fromUser ? `${record.fromUser.username || ''} (${record.fromUser.email || ''})` : 'System'
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type}</Tag>
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => <span style={{ fontWeight: 'bold', color: '#52c41a' }}>+${Number(val).toFixed(2)}</span>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: any = { PENDING: 'orange', PAID: 'green', CANCELLED: 'red' };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString()
    }
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>Commissions History</Title>
      <Card bordered={false}>
        <Table 
          columns={columns} 
          dataSource={commissions} 
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
