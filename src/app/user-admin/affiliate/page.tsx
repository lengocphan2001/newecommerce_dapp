'use client';

import React, { useEffect, useState } from 'react';
import { Table, Card, Spin, message, Typography, Tag } from 'antd';

const { Title } = Typography;

export default function UserAdminAffiliate() {
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<any[]>([]);

  useEffect(() => {
    const fetchAffiliates = async () => {
      try {
        const token = localStorage.getItem('user_admin_token');
        if (!token) return;
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/referral/f1`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch affiliates');
        }

        const data = await response.json();
        setAffiliates(data);
      } catch (error: any) {
        message.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAffiliates();
  }, []);

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Package Type',
      dataIndex: 'packageType',
      key: 'packageType',
      render: (type: string) => {
        let color = 'default';
        if (type === 'NPP') color = 'blue';
        else if (type === 'CTV') color = 'green';
        return <Tag color={color}>{type || 'NONE'}</Tag>;
      }
    },
    {
      title: 'Total Purchase',
      dataIndex: 'totalPurchaseAmount',
      key: 'totalPurchaseAmount',
      render: (val: number) => `$${Number(val).toFixed(2)}`
    },
    {
      title: 'Position',
      dataIndex: 'position',
      key: 'position',
      render: (pos: string) => pos ? <Tag color={pos === 'left' ? 'blue' : 'green'}>{pos.toUpperCase()}</Tag> : '-'
    },
    {
      title: 'Joined Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString()
    }
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>My Affiliates (F1)</Title>
      <Card bordered={false}>
        <Table 
          columns={columns} 
          dataSource={affiliates} 
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
