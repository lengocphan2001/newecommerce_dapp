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

  const formatPrice = (amount: number | string) => {
    // Handle null/undefined/zero
    if (amount === 0 || amount === null || amount === undefined || amount === '0') {
      return '0.00';
    }
    
    // If already a string, use it directly to preserve precision
    let amountStr: string;
    if (typeof amount === 'string') {
      amountStr = amount;
    } else {
      // Convert number to string, but use toFixed with high precision to avoid scientific notation
      // Use 18 decimal places (matching database precision)
      amountStr = amount.toFixed(18);
    }
    
    // Handle scientific notation (e.g., 1e-8)
    if (amountStr.includes('e') || amountStr.includes('E')) {
      // Convert from scientific notation to fixed decimal with full precision (18 digits)
      const num = typeof amount === 'number' ? amount : parseFloat(amountStr);
      amountStr = num.toFixed(18);
    }
    
    // Remove trailing zeros but keep at least 2 decimal places
    // Split into integer and decimal parts
    let [integerPart, decimalPart = ''] = amountStr.split('.');
    
    // Remove trailing zeros from decimal part
    decimalPart = decimalPart.replace(/0+$/, '');
    
    // If no decimal part or all zeros, use .00
    if (!decimalPart) {
      decimalPart = '00';
    } else if (decimalPart.length < 2) {
      // Ensure at least 2 decimal places for display
      decimalPart = decimalPart.padEnd(2, '0');
    }
    
    // Format integer part with thousand separators
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return `${formattedInteger}.${decimalPart}`;
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
      width: 140,
      render: (amount: number) => (
        <span style={{ fontWeight: 500 }}>${formatPrice(amount || 0)}</span>
      ),
    },
    {
      title: 'Total Commission',
      dataIndex: 'totalCommissionReceived',
      key: 'totalCommissionReceived',
      width: 160,
      render: (amount: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff', fontSize: '14px' }}>
          ${formatPrice(amount || 0)}
        </span>
      ),
    },
    {
      title: 'Commissions Breakdown',
      key: 'commissions',
      width: 220,
      render: (_: any, record: Affiliate) => (
        <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 500, color: '#595959' }}>Direct:</span>{' '}
            <span style={{ color: '#52c41a' }}>${formatPrice(record.commissions?.direct || 0)}</span>
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 500, color: '#595959' }}>Group:</span>{' '}
            <span style={{ color: '#1890ff' }}>${formatPrice(record.commissions?.group || 0)}</span>
          </div>
          <div>
            <span style={{ fontWeight: 500, color: '#595959' }}>Management:</span>{' '}
            <span style={{ color: '#722ed1' }}>${formatPrice(record.commissions?.management || 0)}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 140,
      render: (_: any, record: Affiliate) => (
        <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 500, color: '#595959' }}>Pending:</span>{' '}
            <span style={{ color: '#faad14' }}>${formatPrice(record.pending || 0)}</span>
          </div>
          <div>
            <span style={{ fontWeight: 500, color: '#595959' }}>Paid:</span>{' '}
            <span style={{ color: '#52c41a' }}>${formatPrice(record.paid || 0)}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Reconsumption',
      dataIndex: 'totalReconsumptionAmount',
      key: 'totalReconsumptionAmount',
      width: 140,
      render: (amount: number) => (
        <span style={{ fontWeight: 500, color: '#722ed1' }}>
          ${formatPrice(amount || 0)}
        </span>
      ),
    },
    {
      title: 'Branch Totals',
      key: 'branchTotals',
      width: 160,
      render: (_: any, record: Affiliate) => (
        <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 500, color: '#595959' }}>Left:</span>{' '}
            <span style={{ color: '#1890ff' }}>${formatPrice(record.leftBranchTotal || 0)}</span>
          </div>
          <div>
            <span style={{ fontWeight: 500, color: '#595959' }}>Right:</span>{' '}
            <span style={{ color: '#52c41a' }}>${formatPrice(record.rightBranchTotal || 0)}</span>
          </div>
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

