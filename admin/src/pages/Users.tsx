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
  Alert,
  Spin,
  Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import { userService, User } from '../services/userService';
import { adminService } from '../services/adminService';
import { packagesService, Package } from '../services/packagesService';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function buildEditFormValues(u: Record<string, unknown>) {
  return {
    email: u.email,
    fullName: u.fullName,
    phone: u.phone ?? '',
    username: u.username ?? '',
    country: u.country ?? '',
    address: u.address ?? '',
    walletAddress: u.walletAddress ?? '',
    chainId: u.chainId ?? '',
    avatar: u.avatar ?? '',
    referralUser: u.referralUser ?? '',
    referralUserId: u.referralUserId ?? '',
    parentId: u.parentId ?? '',
    position: u.position ?? undefined,
    packageType: u.packageType ?? 'NONE',
    status: u.status ?? 'ACTIVE',
    isAdmin: !!u.isAdmin,
    emailVerified: !!u.emailVerified,
    password: '',
    totalPurchaseAmount: toNum(u.totalPurchaseAmount),
    totalCommissionReceived: toNum(u.totalCommissionReceived),
    fakeReceivedCommission: toNum(u.fakeReceivedCommission),
    totalReconsumptionAmount: toNum(u.totalReconsumptionAmount),
    leftBranchTotal: toNum(u.leftBranchTotal),
    rightBranchTotal: toNum(u.rightBranchTotal),
    walletBalance: toNum(u.walletBalance),
    withdrawWalletBalance: toNum(u.withdrawWalletBalance),
  };
}

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
  const [generatingCredentials, setGeneratingCredentials] = useState(false);
  const [packagesByCode, setPackagesByCode] = useState<Record<string, Package>>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [packagesForEdit, setPackagesForEdit] = useState<Package[]>([]);

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
    setPackagesForEdit([]);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = async (row: User) => {
    setEditingUser(row);
    form.resetFields();
    setIsModalVisible(true);
    setEditLoading(true);
    try {
      const [userRes, pkgRes] = await Promise.all([
        userService.getById(row.id),
        packagesService.getAll().catch(() => []),
      ]);
      const u = userRes.data as Record<string, unknown>;
      setEditingUser(userRes.data as User);
      const pkgs = Array.isArray(pkgRes) ? pkgRes : [];
      setPackagesForEdit(pkgs);
      form.setFieldsValue(buildEditFormValues(u));
    } catch {
      message.error('Failed to load user for edit');
      setIsModalVisible(false);
      setEditingUser(null);
    } finally {
      setEditLoading(false);
    }
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

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitLoading(true);
    try {
      if (editingUser) {
        const rid = String(values.referralUserId ?? '').trim();
        const pid = String(values.parentId ?? '').trim();
        const pw = String(values.password ?? '').trim();
        const payload: Record<string, unknown> = {
          email: values.email,
          fullName: values.fullName,
          phone: values.phone || undefined,
          username: values.username || undefined,
          country: values.country || undefined,
          address: values.address || undefined,
          walletAddress: values.walletAddress || undefined,
          chainId: values.chainId || undefined,
          avatar: values.avatar || undefined,
          referralUser: values.referralUser || undefined,
          referralUserId: rid.length ? rid : null,
          parentId: pid.length ? pid : null,
          position: values.position ?? null,
          packageType: values.packageType,
          status: values.status,
          isAdmin: values.isAdmin,
          emailVerified: values.emailVerified,
          totalPurchaseAmount: values.totalPurchaseAmount,
          totalCommissionReceived: values.totalCommissionReceived,
          fakeReceivedCommission: values.fakeReceivedCommission,
          totalReconsumptionAmount: values.totalReconsumptionAmount,
          leftBranchTotal: values.leftBranchTotal,
          rightBranchTotal: values.rightBranchTotal,
          walletBalance: values.walletBalance,
          withdrawWalletBalance: values.withdrawWalletBalance,
        };
        if (pw.length >= 6) {
          payload.password = pw;
        }
        await userService.update(editingUser.id, payload as any);
        message.success('User updated successfully');
      } else {
        await userService.create({
          email: values.email as string,
          fullName: values.fullName as string,
          phone: values.phone as string | undefined,
        });
        message.success('User created successfully');
      }
      setIsModalVisible(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        (Array.isArray(error?.response?.data?.message)
          ? error.response.data.message.join(', ')
          : null) ||
        'Failed to save user';
      message.error(typeof msg === 'string' ? msg : 'Failed to save user');
    } finally {
      setSubmitLoading(false);
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

  const handleGenerateLoginCredentials = async () => {
    Modal.confirm({
      title: 'Generate user login credentials?',
      content:
        'This will reset/generate username + password for users and download a CSV file. Share it securely with users.',
      okText: 'Generate & Download',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setGeneratingCredentials(true);
        try {
          const response = await adminService.exportLoginCredentials();
          const blob = new Blob([response.data as any], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `user-login-credentials-${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          link.parentNode?.removeChild(link);
          window.URL.revokeObjectURL(url);
          message.success('Credentials file generated and downloaded');
        } catch (error) {
          console.error(error);
          message.error('Failed to generate credentials file');
        } finally {
          setGeneratingCredentials(false);
        }
      },
    });
  };

  const handleViewDetail = async (userId: string) => {
    try {
      setDetailLoading(true);
      const [response, packages] = await Promise.all([
        adminService.getUserDetail(userId),
        packagesService.getAll(),
      ]);
      const data = response.data;
      setUserDetail(data);
      const raw = data?.user?.fakeReceivedCommission;
      setFakeCommissionValue(typeof raw === 'number' ? raw : parseFloat(raw || '0') || 0);
      const map: Record<string, Package> = {};
      for (const p of Array.isArray(packages) ? packages : []) {
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

  const calcEffectiveMaxCommission = (
    totalPurchaseAmount: any,
    pkg?: Package | null,
  ): string => {
    if (!pkg) return 'N/A';
    const total =
      typeof totalPurchaseAmount === 'string'
        ? parseFloat(totalPurchaseAmount)
        : Number(totalPurchaseAmount);
    const maxThreshold = Number((pkg as any).reconsumptionThreshold ?? 0);
    const required = Number((pkg as any).price ?? 0);
    if (!isFinite(total) || !isFinite(maxThreshold) || !isFinite(required) || required <= 0) return 'N/A';
    const max = total * (maxThreshold / required);
    return `$${max.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} USDT`;
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
          <Button
            danger
            loading={generatingCredentials}
            onClick={handleGenerateLoginCredentials}
          >
            Generate Login Credentials
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Add User
          </Button>
        </Space>
      </div>
      <Alert
        style={{ marginBottom: 12 }}
        type="warning"
        showIcon
        message="Generate Login Credentials will reset/generate username + password for users."
      />
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
        width={920}
        style={{ top: 24 }}
        destroyOnClose
        confirmLoading={submitLoading}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText={editingUser ? 'Save changes' : 'Create'}
        bodyStyle={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}
      >
        {editLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            {!editingUser ? (
              <>
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
              </>
            ) : (
              <Tabs defaultActiveKey="account">
                <TabPane tab="Account" key="account">
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
                  <Form.Item name="username" label="Username">
                    <Input />
                  </Form.Item>
                  <Form.Item name="country" label="Country">
                    <Input />
                  </Form.Item>
                  <Form.Item name="address" label="Address (text)">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Form.Item name="status" label="Status">
                    <Select>
                      <Select.Option value="ACTIVE">ACTIVE</Select.Option>
                      <Select.Option value="INACTIVE">INACTIVE</Select.Option>
                      <Select.Option value="SUSPENDED">SUSPENDED</Select.Option>
                      <Select.Option value="BANNED">BANNED</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="isAdmin" label="Admin" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name="emailVerified" label="Email verified" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Divider plain>Password</Divider>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    Leave empty to keep current password. Min 6 characters if set.
                  </Text>
                  <Form.Item
                    name="password"
                    label="New password"
                    rules={[
                      {
                        validator: (_, v) => {
                          const s = String(v || '').trim();
                          if (!s) return Promise.resolve();
                          if (s.length < 6) {
                            return Promise.reject(new Error('At least 6 characters'));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                </TabPane>

                <TabPane tab="Wallet" key="wallet">
                  <Form.Item name="walletAddress" label="Wallet address">
                    <Input placeholder="0x..." />
                  </Form.Item>
                  <Form.Item name="chainId" label="Chain ID">
                    <Input placeholder="e.g. 56" />
                  </Form.Item>
                  <Form.Item name="avatar" label="Avatar (URL or data)">
                    <Input.TextArea rows={2} placeholder="URL or base64 — can be long" />
                  </Form.Item>
                </TabPane>

                <TabPane tab="Tree & referral" key="tree">
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="parentId / referralUserId must be valid user UUIDs. Clear field + save to set null."
                  />
                  <Form.Item name="referralUser" label="Referral username (display)">
                    <Input />
                  </Form.Item>
                  <Form.Item name="referralUserId" label="Referral user ID (UUID)">
                    <Input placeholder="UUID of referrer" allowClear />
                  </Form.Item>
                  <Form.Item name="parentId" label="Parent ID (binary tree)">
                    <Input placeholder="UUID of parent in tree" allowClear />
                  </Form.Item>
                  <Form.Item name="position" label="Position under parent">
                    <Select allowClear placeholder="Clear to remove">
                      <Select.Option value="left">Left</Select.Option>
                      <Select.Option value="right">Right</Select.Option>
                    </Select>
                  </Form.Item>
                </TabPane>

                <TabPane tab="Package & volumes" key="finance">
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="These fields affect commissions and binary volume. Change only when you understand the impact."
                  />
                  <Form.Item name="packageType" label="Package type">
                    <Select showSearch optionFilterProp="children" allowClear placeholder="NONE">
                      <Select.Option value="NONE">NONE</Select.Option>
                      {packagesForEdit
                        .filter((p) => p?.code)
                        .map((p) => (
                          <Select.Option key={p.code} value={p.code}>
                            {p.code}
                          </Select.Option>
                        ))}
                    </Select>
                  </Form.Item>
                  <Divider plain>Amounts (USDT)</Divider>
                  <Form.Item name="totalPurchaseAmount" label="Total purchase amount">
                    <InputNumber min={0} style={{ width: '100%' }} step={0.01} />
                  </Form.Item>
                  <Form.Item name="totalCommissionReceived" label="Total commission received">
                    <InputNumber min={0} style={{ width: '100%' }} step={0.01} />
                  </Form.Item>
                  <Form.Item name="fakeReceivedCommission" label="Fake received commission">
                    <InputNumber min={0} style={{ width: '100%' }} step={0.01} />
                  </Form.Item>
                  <Form.Item name="totalReconsumptionAmount" label="Total reconsumption">
                    <InputNumber min={0} style={{ width: '100%' }} step={0.01} />
                  </Form.Item>
                  <Form.Item name="leftBranchTotal" label="Left branch total">
                    <InputNumber min={0} style={{ width: '100%' }} step={0.01} />
                  </Form.Item>
                  <Form.Item name="rightBranchTotal" label="Right branch total">
                    <InputNumber min={0} style={{ width: '100%' }} step={0.01} />
                  </Form.Item>
                  <Form.Item name="walletBalance" label="Wallet balance (deposit)">
                    <InputNumber min={0} style={{ width: '100%' }} step={0.01} />
                  </Form.Item>
                  <Form.Item name="withdrawWalletBalance" label="Withdraw wallet balance">
                    <InputNumber min={0} style={{ width: '100%' }} step={0.01} />
                  </Form.Item>
                </TabPane>
              </Tabs>
            )}
          </Form>
        )}
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
                  ${userDetail.user.totalPurchaseAmount} USDT
                </Descriptions.Item>
                <Descriptions.Item label="Total Commission Received">
                  ${userDetail.user.totalCommissionReceived} USDT
                </Descriptions.Item>
                <Descriptions.Item label="Tối đa được nhận (Effective Threshold)">
                  {(() => {
                    const code = String(userDetail?.user?.packageType || '').toUpperCase();
                    if (!code || code === 'NONE') return 'N/A';
                    const pkg = packagesByCode[code];
                    return calcEffectiveMaxCommission(userDetail.user.totalPurchaseAmount, pkg);
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
                rowKey={(row: any) => row.id || row.userId}
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
                dataSource={userDetail.f1PurchaseDetails || userDetail.f1 || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Username', dataIndex: 'username', key: 'username' },
                  { title: 'Full Name', dataIndex: 'fullName', key: 'fullName' },
                  { title: 'Email', dataIndex: 'email', key: 'email' },
                  { title: 'Package Type', dataIndex: 'packageType', key: 'packageType' },
                  {
                    title: 'Total Purchases',
                    dataIndex: 'totalPurchases',
                    key: 'totalPurchases',
                    render: (v: number) => (typeof v === 'number' ? v : 0),
                  },
                  {
                    title: 'Total Commission From F1',
                    dataIndex: 'totalCommissionFromF1',
                    key: 'totalCommissionFromF1',
                    render: (v: number) =>
                      `$${(typeof v === 'number' ? v : 0).toLocaleString('en-US', {
                        maximumFractionDigits: 4,
                      })}`,
                  },
                ]}
                expandable={{
                  expandedRowRender: (record: any) => (
                    <Table
                      dataSource={record.purchases || []}
                      rowKey={(row: any) => row.orderId}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: 'Order ID', dataIndex: 'orderId', key: 'orderId' },
                        {
                          title: 'Purchase Time',
                          dataIndex: 'purchasedAt',
                          key: 'purchasedAt',
                          render: (date: string) => (date ? new Date(date).toLocaleString() : '-'),
                        },
                        {
                          title: 'Order Amount',
                          dataIndex: 'orderAmount',
                          key: 'orderAmount',
                          render: (amount: number) =>
                            `$${(Number(amount) || 0).toLocaleString('en-US', {
                              maximumFractionDigits: 4,
                            })}`,
                        },
                        {
                          title: 'Commission Received',
                          dataIndex: 'totalCommissionFromOrder',
                          key: 'totalCommissionFromOrder',
                          render: (amount: number) =>
                            `$${(Number(amount) || 0).toLocaleString('en-US', {
                              maximumFractionDigits: 4,
                            })}`,
                        },
                        {
                          title: 'Commission Types',
                          key: 'commissionTypes',
                          render: (_: any, row: any) =>
                            (row.commissions || []).length > 0 ? (
                              <Space wrap>
                                {(row.commissions || []).map((cm: any) => (
                                  <Tag key={cm.id} color={cm.status === 'paid' ? 'green' : cm.status === 'blocked' ? 'red' : 'orange'}>
                                    {`${String(cm.type).toUpperCase()}: $${(Number(cm.amount) || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })}`}
                                  </Tag>
                                ))}
                              </Space>
                            ) : (
                              <Text type="secondary">No commission from this order</Text>
                            ),
                        },
                      ]}
                    />
                  ),
                  rowExpandable: (record: any) =>
                    Array.isArray(record?.purchases) && record.purchases.length > 0,
                }}
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
    </div >
  );
};

export default Users;

