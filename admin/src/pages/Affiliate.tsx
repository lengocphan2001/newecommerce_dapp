import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Input, Button, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { affiliateService, Affiliate } from '../services/affiliateService';

const AffiliatePage: React.FC = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [filteredAffiliates, setFilteredAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchAllAffiliates();
  }, []);

  useEffect(() => {
    if (searchText.trim()) {
      const filtered = affiliates.filter(
        (aff) =>
          aff.email?.toLowerCase().includes(searchText.toLowerCase()) ||
          aff.fullName?.toLowerCase().includes(searchText.toLowerCase()) ||
          aff.username?.toLowerCase().includes(searchText.toLowerCase()) ||
          aff.userId?.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredAffiliates(filtered);
    } else {
      setFilteredAffiliates(affiliates);
    }
  }, [searchText, affiliates]);

  const fetchAllAffiliates = async () => {
    setLoading(true);
    try {
      const response = await affiliateService.getAllStats();
      const data = response?.data || [];
      setAffiliates(data);
      setFilteredAffiliates(data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to fetch affiliate data');
      console.error('Failed to fetch affiliate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number) => {
    return amount?.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const getPackageTypeColor = (type: string) => {
    switch (type) {
      case 'NPP':
        return 'blue';
      case 'CTV':
        return 'green';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      title: 'User ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 100,
      ellipsis: true,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Full Name',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Package Type',
      dataIndex: 'packageType',
      key: 'packageType',
      width: 100,
      render: (type: string) => (
        <Tag color={getPackageTypeColor(type)}>{type || 'NONE'}</Tag>
      ),
    },
    {
      title: 'Total Purchase',
      dataIndex: 'totalPurchaseAmount',
      key: 'totalPurchaseAmount',
      width: 120,
      render: (amount: number) => `$${formatPrice(amount || 0)}`,
    },
    {
      title: 'Total Commission',
      dataIndex: 'totalCommissionReceived',
      key: 'totalCommissionReceived',
      width: 140,
      render: (amount: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
          ${formatPrice(amount || 0)}
        </span>
      ),
    },
    {
      title: 'Commissions Breakdown',
      key: 'commissions',
      width: 200,
      render: (_: any, record: Affiliate) => (
        <div style={{ fontSize: '12px' }}>
          <div>Direct: ${formatPrice(record.commissions?.direct || 0)}</div>
          <div>Group: ${formatPrice(record.commissions?.group || 0)}</div>
          <div>Management: ${formatPrice(record.commissions?.management || 0)}</div>
        </div>
      ),
    },
    {
      title: 'Reconsumption',
      dataIndex: 'totalReconsumptionAmount',
      key: 'totalReconsumptionAmount',
      width: 120,
      render: (amount: number) => `$${formatPrice(amount || 0)}`,
    },
    {
      title: 'Branch Totals',
      key: 'branchTotals',
      width: 150,
      render: (_: any, record: Affiliate) => (
        <div style={{ fontSize: '12px' }}>
          <div>Left: ${formatPrice(record.leftBranchTotal || 0)}</div>
          <div>Right: ${formatPrice(record.rightBranchTotal || 0)}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: any, record: Affiliate) => (
        <div style={{ fontSize: '12px' }}>
          <div>Pending: ${formatPrice(record.pending || 0)}</div>
          <div>Paid: ${formatPrice(record.paid || 0)}</div>
        </div>
      ),
    },
    {
      title: 'Referrer',
      dataIndex: 'referralUser',
      key: 'referralUser',
      width: 120,
      ellipsis: true,
      render: (referralUser: string) => referralUser || '-',
    },
    {
      title: 'Position',
      dataIndex: 'position',
      key: 'position',
      width: 80,
      render: (position: string) => position ? (
        <Tag color={position === 'left' ? 'blue' : 'green'}>{position.toUpperCase()}</Tag>
      ) : '-',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Affiliate Management</h1>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by email, name, username, or user ID"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          prefix={<SearchOutlined />}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={fetchAllAffiliates} loading={loading}>
          Refresh
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={filteredAffiliates}
        loading={loading}
        rowKey="userId"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
};

export default AffiliatePage;

