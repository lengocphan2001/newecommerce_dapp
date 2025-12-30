import React, { useState } from 'react';
import { Table, Input, Button, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { affiliateService, Affiliate } from '../services/affiliateService';

const AffiliatePage: React.FC = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');

  const fetchAffiliate = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await affiliateService.getStats(userId);
      // Giả sử API trả về data
      setAffiliates([response.data] || []);
    } catch (error) {
      console.error('Failed to fetch affiliate data');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'User ID',
      dataIndex: 'userId',
      key: 'userId',
    },
    {
      title: 'Referral Code',
      dataIndex: 'referralCode',
      key: 'referralCode',
    },
    {
      title: 'Total Commissions',
      dataIndex: 'totalCommissions',
      key: 'totalCommissions',
      render: (amount: number) => `$${amount?.toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Affiliate Management</h1>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Enter User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          style={{ width: 200 }}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={fetchAffiliate}>
          Search
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={affiliates}
        loading={loading}
        rowKey="userId"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default AffiliatePage;

