'use client';

import React, { useEffect, useState } from 'react';
import { Table, Card, Spin, message, Typography, Tag, Button, Modal, Tabs, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function UserAdminAffiliate() {
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);

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

  const handleViewDetails = async (record: any) => {
    setSelectedUser(record);
    setIsModalOpen(true);
    setDetailsLoading(true);
    setUserDetails(null);
    
    try {
      const token = localStorage.getItem('user_admin_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/referral/f1/${record.id}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }

      const data = await response.json();
      setUserDetails(data);
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setDetailsLoading(false);
    }
  };

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
      title: 'Package',
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
      title: 'Full Name',
      dataIndex: 'fullName',
      key: 'fullName',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || '-'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'ACTIVE' ? 'green' : 'red'}>{s || 'N/A'}</Tag>
    },
    {
      title: 'Purchases',
      dataIndex: 'totalPurchaseAmount',
      key: 'totalPurchaseAmount',
      render: (val: any) => val ? `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'
    },
    {
      title: 'Position',
      dataIndex: 'position',
      key: 'position',
      render: (pos: string) => pos ? <Tag color={pos === 'left' ? 'blue' : 'green'}>{pos.toUpperCase()}</Tag> : '-'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button 
          type="primary" 
          size="small" 
          icon={<EyeOutlined />} 
          onClick={() => handleViewDetails(record)}
        >
          Details
        </Button>
      )
    }
  ];

  const orderColumns = [
    { title: 'Order ID', dataIndex: 'id', key: 'id', render: (id: string) => id.substring(0,8) + '...' },
    { title: 'Total', dataIndex: 'totalAmount', key: 'totalAmount', render: (val: any) => val ? `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'COMPLETED' ? 'green' : 'orange'}>{s}</Tag> },
    { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => new Date(d).toLocaleString() },
  ];

  const commissionColumns = [
    { title: 'Type', dataIndex: 'type', key: 'type', render: (s: string) => <Tag color="blue">{s}</Tag> },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (val: any) => <span style={{ color: '#52c41a' }}>+{val ? `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'PAID' ? 'green' : 'orange'}>{s}</Tag> },
    { title: 'From User', key: 'fromUser', render: (_:any, record: any) => record.fromUser ? record.fromUser.username : 'System' },
    { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => new Date(d).toLocaleString() },
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

      <Modal
        title={`Details: ${selectedUser?.username || selectedUser?.email || ''}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {detailsLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
        ) : userDetails ? (
          <Tabs
            defaultActiveKey="1"
            items={[
              {
                key: '1',
                label: 'Orders',
                children: (
                  <Table 
                    columns={orderColumns} 
                    dataSource={userDetails.orders || []} 
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                ),
              },
              {
                key: '2',
                label: 'Commissions',
                children: (
                  <Table 
                    columns={commissionColumns} 
                    dataSource={userDetails.commissions || []} 
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                ),
              },
            ]}
          />
        ) : (
          <div style={{ textAlign: 'center', color: '#999' }}>Could not load details</div>
        )}
      </Modal>
    </div>
  );
}
