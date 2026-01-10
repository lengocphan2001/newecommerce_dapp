import React, { useState } from 'react';
import { Table, Input, Button, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { walletService, Transaction } from '../services/walletService';

const Wallet: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');

  const fetchTransactions = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await walletService.getTransactions(userId);
      setTransactions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Transaction ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `$${amount?.toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Wallet Management</h1>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Enter User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          style={{ width: 200 }}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={fetchTransactions}>
          Search
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={transactions}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default Wallet;

