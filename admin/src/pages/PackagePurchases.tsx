import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Tag, Space, message, Typography, Select, Popconfirm } from 'antd';
import { ReloadOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { packagePurchaseService, PackagePurchase } from '../services/packagePurchaseService';

const { Title, Text } = Typography;

const PackagePurchasesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState<PackagePurchase[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await packagePurchaseService.getAll(
        statusFilter ? (statusFilter as 'pending' | 'paid' | 'cancelled') : undefined,
      );
      setPurchases(Array.isArray(list) ? list : []);
    } catch (e: any) {
      message.error('Failed to load package purchases: ' + (e?.message || 'Unknown error'));
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async (id: string) => {
    try {
      setLoading(true);
      await packagePurchaseService.confirm(id);
      message.success('Payment confirmed. User package has been activated.');
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Failed to confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setLoading(true);
      await packagePurchaseService.reject(id);
      message.success('Purchase rejected.');
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Failed to reject');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: 'User',
      key: 'user',
      render: (_: any, r: PackagePurchase) =>
        r.user ? (
          <div>
            <div style={{ fontWeight: 500 }}>{r.user.fullName || r.user.username || r.user.email}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>{r.user.email}</Text>
          </div>
        ) : (
          r.userId
        ),
    },
    {
      title: 'Package',
      key: 'package',
      render: (_: any, r: PackagePurchase) =>
        r.package ? (
          <span>{r.package.name} <Text type="secondary">({r.package.code})</Text></span>
        ) : (
          r.packageId
        ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: number) => (v != null ? `$${Number(v).toLocaleString()}` : '-'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const color = s === 'paid' ? 'green' : s === 'pending' ? 'orange' : s === 'cancelled' ? 'red' : 'default';
        return <Tag color={color}>{s}</Tag>;
      },
    },
    {
      title: 'Paid At',
      dataIndex: 'paidAt',
      key: 'paidAt',
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: any, r: PackagePurchase) =>
        r.status === 'pending' ? (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleConfirm(r.id)}
            >
              Approve
            </Button>
            <Popconfirm
              title="Reject this purchase?"
              description="The purchase will be marked as cancelled. User will not get the package."
              onConfirm={() => handleReject(r.id)}
              okText="Reject"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<CloseOutlined />}>
                Reject
              </Button>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={2}>Package Purchases</Title>
          <Text type="secondary">Confirm user package payments to activate their package (CTV, NPP, TV).</Text>
        </div>
        <Space>
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: 140 }}
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        </Space>
      </div>
      <Card>
        <Table
          dataSource={purchases}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
};

export default PackagePurchasesPage;
