import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Descriptions,
  Tabs,
  Card,
  Typography,
  Divider,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import { userService, User } from '../services/userService';
import { adminService } from '../services/adminService';
import { packagesService, Package } from '../services/packagesService';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [fakeCommissionValue, setFakeCommissionValue] = useState<number>(0);
  const [savingFakeCommission, setSavingFakeCommission] = useState(false);
  const [f1PurchaseModalVisible, setF1PurchaseModalVisible] = useState(false);
  const [selectedF1ForPurchases, setSelectedF1ForPurchases] = useState<any>(null);
  const [packagesByCode, setPackagesByCode] = useState<Record<string, Package>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (search?: string) => {
    setLoading(true);
    try {
      const response = await userService.getAll(search);
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const onSearch = (value: string) => {
    setSearchText(value);
    fetchUsers(value);
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await userService.delete(id);
      message.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      message.error('Failed to delete user');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await adminService.updateUserStatus(id, status);
      message.success('User status updated');
      fetchUsers();
    } catch (error) {
      message.error('Failed to update user status');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingUser) {
        await userService.update(editingUser.id, values);
        message.success('User updated successfully');
      } else {
        await userService.create(values);
        message.success('User created successfully');
      }
      setIsModalVisible(false);
      fetchUsers();
    } catch (error) {
      message.error('Failed to save user');
    }
  };

  const handleExport = async () => {
    try {
      const response = await adminService.exportUsers();

      const blob = new Blob([response.data as any], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'users.csv');
      document.body.appendChild(link);
      link.click();

      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('Users exported successfully');
    } catch (error) {
      console.error(error);
      message.error('Failed to export users');
    }
  };

  const handleViewDetail = async (userId: string) => {
    try {
      setDetailLoading(true);
      const [detailResp, packagesResp] = await Promise.all([
        adminService.getUserDetail(userId),
        packagesService.getAll(),
      ]);
      const data = detailResp.data;
      setUserDetail(data);
      const raw = data?.user?.fakeReceivedCommission;
      setFakeCommissionValue(typeof raw === 'number' ? raw : parseFloat(raw || '0') || 0);
      const list = Array.isArray(packagesResp) ? packagesResp : [];
      const map: Record<string, Package> = {};
      for (const p of list) {
        if (!p?.code) continue;
        map[String(p.code).toUpperCase()] = p;
      }
      setPackagesByCode(map);
      setIsDetailModalVisible(true);
    } catch (error: any) {
      message.error('Failed to load user details: ' + (error.message || 'Unknown error'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveFakeCommission = async () => {
    if (!userDetail?.user?.id) return;
    try {
      setSavingFakeCommission(true);
      const response = await adminService.updateUserFakeCommission(userDetail.user.id, fakeCommissionValue);
      setUserDetail(response.data);
      message.success('Fake commission updated');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to update fake commission');
    } finally {
      setSavingFakeCommission(false);
    }
  };

  const formatUSDT = (amount: any): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (!isFinite(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  };

  const calcEffectiveMaxCommission = (totalPurchaseAmount: any, pkg?: Package | null): number | null => {
    if (!pkg) return null;
    const total = typeof totalPurchaseAmount === 'string' ? parseFloat(totalPurchaseAmount) : Number(totalPurchaseAmount);
    const maxThreshold = Number((pkg as any).reconsumptionThreshold ?? 0);
    const required = Number((pkg as any).price ?? 0);
    if (!isFinite(total) || !isFinite(maxThreshold) || !isFinite(required) || required <= 0) return null;
    return total * (maxThreshold / required);
  };

  const getCommissionStatusColor = (status: string) => {
    if (status === 'paid') return 'green';
    if (status === 'pending') return 'orange';
    if (status === 'blocked') return 'red';
    return 'default';
  };

  const getCommissionTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      direct: 'Direct',
      group: 'Group',
      management: 'Management',
      product: 'Product',
      milestone: 'Milestone',
    };
    return map[type] || type || '-';
  };

  const handleViewF1Purchases = (f1: any) => {
    setSelectedF1ForPurchases(f1);
    setF1PurchaseModalVisible(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
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
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          ACTIVE: 'green',
          INACTIVE: 'default',
          SUSPENDED: 'orange',
          BANNED: 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status || 'ACTIVE'}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}
          >
            View Details
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Select
            defaultValue={record.status || 'ACTIVE'}
            style={{ width: 120 }}
            onChange={(value) => handleUpdateStatus(record.id, value)}
          >
            <Select.Option value="ACTIVE">Active</Select.Option>
            <Select.Option value="INACTIVE">Inactive</Select.Option>
            <Select.Option value="SUSPENDED">Suspended</Select.Option>
            <Select.Option value="BANNED">Banned</Select.Option>
          </Select>
          <Popconfirm
            title="Are you sure to delete this user?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <Title level={2}>Users Management</Title>
        <Space>
          <Input.Search
            placeholder="Search by email, name, username, ID or address"
            onSearch={onSearch}
            onChange={(e) => setSearchText(e.target.value)}
            value={searchText}
            style={{ width: 300 }}
            allowClear
          />
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Export Users
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Add User
          </Button>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={users}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title={editingUser ? 'Edit User' : 'Create User'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="fullName"
            label="Full Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* User Detail Modal */}
      <Modal
        title="User Details"
        open={isDetailModalVisible}
        onCancel={() => {
          setIsDetailModalVisible(false);
          setUserDetail(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setIsDetailModalVisible(false);
            setUserDetail(null);
          }}>
            Close
          </Button>,
        ]}
        width={1000}
        loading={detailLoading}
      >
        {userDetail && (
          <Tabs defaultActiveKey="basic">
            <TabPane tab="Basic Info" key="basic">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="ID">{userDetail.user.id}</Descriptions.Item>
                <Descriptions.Item label="Email">{userDetail.user.email}</Descriptions.Item>
                <Descriptions.Item label="Full Name">{userDetail.user.fullName}</Descriptions.Item>
                <Descriptions.Item label="Username">{userDetail.user.username || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Phone">{userDetail.user.phone || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Country">{userDetail.user.country || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Wallet Address" span={2}>
                  {userDetail.user.walletAddress || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Chain ID">{userDetail.user.chainId || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Package Type">
                  <Tag color={userDetail.user.packageType === 'NPP' ? 'blue' : userDetail.user.packageType === 'CTV' ? 'green' : 'default'}>
                    {userDetail.user.packageType}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={userDetail.user.status === 'ACTIVE' ? 'green' : 'red'}>
                    {userDetail.user.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Position">
                  {userDetail.user.position ? (
                    <Tag color={userDetail.user.position === 'left' ? 'blue' : 'green'}>
                      {userDetail.user.position.toUpperCase()}
                    </Tag>
                  ) : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                  {new Date(userDetail.user.createdAt).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Updated At">
                  {new Date(userDetail.user.updatedAt).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>

              <Divider />

              <Title level={5}>Financial Information</Title>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Total Purchase Amount">
                  ${formatUSDT(userDetail.user.totalPurchaseAmount)} USDT
                </Descriptions.Item>
                <Descriptions.Item label="Total Commission Received">
                  ${formatUSDT(userDetail.user.totalCommissionReceived)} USDT
                </Descriptions.Item>
                <Descriptions.Item label="Max Commission Allowed (Effective Threshold)">
                  {(() => {
                    const code = String(userDetail.user.packageType || '').toUpperCase();
                    const pkg = packagesByCode[code];
                    const max = calcEffectiveMaxCommission(userDetail.user.totalPurchaseAmount, pkg);
                    if (!pkg || !code || code === 'NONE') return 'N/A';
                    if (max == null) return 'N/A';
                    return `$${formatUSDT(max)} USDT`;
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="Fake Received Commission (admin)">
                  <Space>
                    <InputNumber
                      min={0}
                      step={0.01}
                      value={fakeCommissionValue}
                      onChange={(v) => setFakeCommissionValue(v ?? 0)}
                      style={{ width: 140 }}
                    />
                    <Button type="primary" size="small" loading={savingFakeCommission} onClick={handleSaveFakeCommission}>
                      Save
                    </Button>
                  </Space>
                  <span style={{ marginLeft: 8 }}>USDT (displayed as + this on user affiliate page)</span>
                </Descriptions.Item>
                <Descriptions.Item label="Total Reconsumption Amount">
                  ${userDetail.user.totalReconsumptionAmount} USDT
                </Descriptions.Item>
                <Descriptions.Item label="Left Branch Total">
                  ${userDetail.user.leftBranchTotal} USDT
                </Descriptions.Item>
                <Descriptions.Item label="Right Branch Total">
                  ${userDetail.user.rightBranchTotal} USDT
                </Descriptions.Item>
              </Descriptions>

              <Divider />

              <Title level={5}>Referral Information</Title>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Referral User (Username)">
                  {userDetail.user.referralUser || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Referrer ID">
                  {userDetail.referrerInfo ? (
                    <span>
                      {userDetail.referrerInfo.username} ({userDetail.referrerInfo.email})
                    </span>
                  ) : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Parent ID">
                  {userDetail.parentInfo ? (
                    <span>
                      {userDetail.parentInfo.username} ({userDetail.parentInfo.email})
                    </span>
                  ) : 'N/A'}
                </Descriptions.Item>
              </Descriptions>
            </TabPane>

            <TabPane tab="Addresses" key="addresses">
              <Table
                dataSource={userDetail.addresses || []}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: 'Name', dataIndex: 'name', key: 'name' },
                  { title: 'Phone', dataIndex: 'phone', key: 'phone' },
                  { title: 'Address', dataIndex: 'address', key: 'address' },
                  {
                    title: 'Default',
                    dataIndex: 'isDefault',
                    key: 'isDefault',
                    render: (isDefault: boolean) => (
                      <Tag color={isDefault ? 'green' : 'default'}>
                        {isDefault ? 'Yes' : 'No'}
                      </Tag>
                    ),
                  },
                ]}
              />
            </TabPane>

            <TabPane tab="Commissions" key="commissions">
              <Card title="Commission Statistics" style={{ marginBottom: 16 }}>
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="Direct Commission">
                    ${userDetail.commissionStats?.direct || '0.00'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Group Commission">
                    ${userDetail.commissionStats?.group || '0.00'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Management Commission">
                    ${userDetail.commissionStats?.management || '0.00'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Total Commission">
                    ${userDetail.commissionStats?.total || '0.00'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Pending Commission">
                    ${userDetail.commissionStats?.pending || '0.00'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
              <Table
                dataSource={userDetail.commissions || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Type', dataIndex: 'type', key: 'type' },
                  {
                    title: 'Amount',
                    dataIndex: 'amount',
                    key: 'amount',
                    render: (amount: any) => {
                      if (amount === 0 || amount === null || amount === undefined) return '$0.00';
                      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
                      if (isNaN(num)) return '$0.00';
                      let str = num.toFixed(8).replace(/\.?0+$/, '');
                      if (!str.includes('.')) str += '.00';
                      else {
                        const [int, dec] = str.split('.');
                        if (dec.length < 2) str = `${int}.${dec.padEnd(2, '0')}`;
                      }
                      return `$${str}`;
                    }
                  },
                  { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={status === 'PAID' ? 'green' : 'orange'}>{status}</Tag> },
                  { title: 'Order ID', dataIndex: 'orderId', key: 'orderId' },
                  { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleString() },
                ]}
              />
            </TabPane>

            <TabPane tab="Orders" key="orders">
              <Descriptions bordered column={1} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Total Purchase">
                  {(() => {
                    const amount = userDetail.user?.totalPurchaseAmount ?? 0;
                    if (amount === 0 || amount === null || amount === undefined) return '$0.00 USDT';
                    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
                    if (isNaN(num)) return '$0.00 USDT';
                    let str = num.toFixed(8).replace(/\.?0+$/, '');
                    if (!str.includes('.')) str += '.00';
                    else {
                      const [int, dec] = str.split('.');
                      if (dec.length < 2) str = `${int}.${dec.padEnd(2, '0')}`;
                    }
                    return `$${str} USDT`;
                  })()}
                </Descriptions.Item>
              </Descriptions>
              <Table
                dataSource={userDetail.orders || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Order ID', dataIndex: 'id', key: 'id' },
                  {
                    title: 'Total Amount',
                    dataIndex: 'totalAmount',
                    key: 'totalAmount',
                    render: (amount: number) => {
                      if (amount === 0 || amount === null || amount === undefined) return '$0.00 USDT';
                      if (isNaN(amount)) return '$0.00 USDT';
                      let str = amount.toFixed(8).replace(/\.?0+$/, '');
                      if (!str.includes('.')) str += '.00';
                      else {
                        const [int, dec] = str.split('.');
                        if (dec.length < 2) str = `${int}.${dec.padEnd(2, '0')}`;
                      }
                      return `$${str} USDT`;
                    }
                  },
                  { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Tag>{status}</Tag> },
                  { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleString() },
                ]}
              />
            </TabPane>

            <TabPane tab="Referral Levels" key="referrals">
              <Title level={5}>F1 Members (Direct) ({userDetail.f1?.length || 0})</Title>
              <Table
                dataSource={userDetail.f1 || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Username', dataIndex: 'username', key: 'username' },
                  { title: 'Full Name', dataIndex: 'fullName', key: 'fullName' },
                  { title: 'Email', dataIndex: 'email', key: 'email' },
                  { title: 'Package Type', dataIndex: 'packageType', key: 'packageType' },
                  {
                    title: 'Mua bao lần',
                    dataIndex: 'purchaseCount',
                    key: 'purchaseCount',
                    render: (count: number) => count || 0,
                  },
                  {
                    title: 'Actions',
                    key: 'actions',
                    width: 160,
                    render: (_: any, f1: any) => (
                      <Button type="link" onClick={() => handleViewF1Purchases(f1)}>
                        Xem lịch mua
                      </Button>
                    ),
                  },
                  { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleString() },
                ]}
                style={{ marginBottom: 24 }}
              />

              <Title level={5}>F2 Members ({userDetail.f2?.length || 0})</Title>
              <Table
                dataSource={userDetail.f2 || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Username', dataIndex: 'username', key: 'username' },
                  { title: 'Full Name', dataIndex: 'fullName', key: 'fullName' },
                  { title: 'Email', dataIndex: 'email', key: 'email' },
                  { title: 'Package Type', dataIndex: 'packageType', key: 'packageType' },
                  { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleString() },
                ]}
                style={{ marginBottom: 24 }}
              />

              <Title level={5}>F3 Members ({userDetail.f3?.length || 0})</Title>
              <Table
                dataSource={userDetail.f3 || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Username', dataIndex: 'username', key: 'username' },
                  { title: 'Full Name', dataIndex: 'fullName', key: 'fullName' },
                  { title: 'Email', dataIndex: 'email', key: 'email' },
                  { title: 'Package Type', dataIndex: 'packageType', key: 'packageType' },
                  { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleString() },
                ]}
              />
            </TabPane>

            <TabPane tab="Binary Tree" key="tree">
              <Card title="Tree Statistics" style={{ marginBottom: 16 }}>
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="Left Branch Count">
                    {userDetail.treeStats?.left?.count || 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="Left Branch Volume">
                    ${userDetail.treeStats?.left?.volume || '0.00'} USDT
                  </Descriptions.Item>
                  <Descriptions.Item label="Right Branch Count">
                    {userDetail.treeStats?.right?.count || 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="Right Branch Volume">
                    ${userDetail.treeStats?.right?.volume || '0.00'} USDT
                  </Descriptions.Item>
                  <Descriptions.Item label="Total Members">
                    {userDetail.treeStats?.total || 0}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Title level={5}>Left Branch Members ({userDetail.treeStats?.left?.members?.length || 0})</Title>
              <Table
                dataSource={userDetail.treeStats?.left?.members || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Username', dataIndex: 'username', key: 'username' },
                  { title: 'Full Name', dataIndex: 'fullName', key: 'fullName' },
                  { title: 'Package Type', dataIndex: 'packageType', key: 'packageType' },
                  { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleString() },
                ]}
                style={{ marginBottom: 24 }}
              />

              <Title level={5}>Right Branch Members ({userDetail.treeStats?.right?.members?.length || 0})</Title>
              <Table
                dataSource={userDetail.treeStats?.right?.members || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Username', dataIndex: 'username', key: 'username' },
                  { title: 'Full Name', dataIndex: 'fullName', key: 'fullName' },
                  { title: 'Package Type', dataIndex: 'packageType', key: 'packageType' },
                  { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleString() },
                ]}
              />
            </TabPane>
          </Tabs>
        )}
      </Modal>
      {/* F1 purchase history & commissions for userId in question */}
      <Modal
        title={
          selectedF1ForPurchases
            ? `F1: ${selectedF1ForPurchases.fullName || selectedF1ForPurchases.username || selectedF1ForPurchases.id} - Purchases & Commissions`
            : 'F1 Purchases & Commissions'
        }
        open={f1PurchaseModalVisible}
        onCancel={() => {
          setF1PurchaseModalVisible(false);
          setSelectedF1ForPurchases(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setF1PurchaseModalVisible(false);
              setSelectedF1ForPurchases(null);
            }}
          >
            Close
          </Button>,
        ]}
        width={950}
      >
        <Table
          rowKey="orderId"
          pagination={false}
          dataSource={selectedF1ForPurchases?.purchases || []}
          columns={[
            {
              title: 'Order ID',
              dataIndex: 'orderId',
              key: 'orderId',
              render: (id: string) => (
                <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {id}
                </span>
              ),
            },
            {
              title: 'Thời gian mua hàng',
              dataIndex: 'purchasedAt',
              key: 'purchasedAt',
              render: (date: string | Date) => new Date(date).toLocaleString(),
            },
            {
              title: 'Hoa hồng của user đang xem',
              dataIndex: 'commissions',
              key: 'commissions',
              render: (commissions: any[]) => {
                const list = Array.isArray(commissions) ? commissions : [];
                if (list.length === 0) return '-';
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {list.map((c) => (
                      <Tag key={c.id} color={getCommissionStatusColor(c.status)}>
                        {getCommissionTypeLabel(c.type)}: ${formatUSDT(c.amount)}
                      </Tag>
                    ))}
                  </div>
                );
              },
            },
          ]}
        />
      </Modal>
    </div >
  );
};

export default Users;

