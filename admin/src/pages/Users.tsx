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
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined, KeyOutlined } from '@ant-design/icons';
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
  const [deductWithdrawAmount, setDeductWithdrawAmount] = useState<number | null>(null);
  const [deductWithdrawReason, setDeductWithdrawReason] = useState('');
  const [deductWithdrawLoading, setDeductWithdrawLoading] = useState(false);
  const [generatingCredentials, setGeneratingCredentials] = useState(false);
  const [generatingPasswordForUser, setGeneratingPasswordForUser] = useState<string | null>(null);
  const [packagesByCode, setPackagesByCode] = useState<Record<string, Package>>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [packagesForEdit, setPackagesForEdit] = useState<Package[]>([]);
  const [editWalletReconciliation, setEditWalletReconciliation] = useState<{
    paidCommissionToWithdrawWallet: number;
    matrixPoolNetAmount: number;
    approvedWithdrawnAmount: number;
    expectedWithdrawWalletBalance: number;
  } | null>(null);

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
    setEditWalletReconciliation(null);
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
        adminService.getUserDetail(row.id),
        packagesService.getAll().catch(() => []),
      ]);
      const detail = (userRes as any)?.data ?? userRes;
      const u = (detail?.user || {}) as Record<string, unknown>;
      setEditingUser(detail?.user as User);
      const pkgs = Array.isArray(pkgRes) ? pkgRes : [];
      setPackagesForEdit(pkgs);
      setEditWalletReconciliation({
        paidCommissionToWithdrawWallet: toNum(
          (detail as any)?.walletReconciliation?.paidCommissionToWithdrawWallet,
        ),
        matrixPoolNetAmount: toNum(
          (detail as any)?.walletReconciliation?.matrixPoolNetAmount,
        ),
        approvedWithdrawnAmount: toNum(
          (detail as any)?.walletReconciliation?.approvedWithdrawnAmount,
        ),
        expectedWithdrawWalletBalance: toNum(
          (detail as any)?.walletReconciliation?.expectedWithdrawWalletBalance,
        ),
      });
      form.setFieldsValue(buildEditFormValues(u));
    } catch {
      message.error('Failed to load user for edit');
      setIsModalVisible(false);
      setEditingUser(null);
      setEditWalletReconciliation(null);
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

  const applyExpectedWithdrawWalletBalance = () => {
    if (!editWalletReconciliation) {
      message.warning('Chưa có dữ liệu đối soát ví rút tiền');
      return;
    }
    const expected = toNum(editWalletReconciliation.expectedWithdrawWalletBalance);
    form.setFieldValue('withdrawWalletBalance', expected);
    message.success(
      `Đã set Withdraw wallet balance = ${expected.toFixed(8)} USDT`,
    );
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
      title: 'Generate & gửi thông tin đăng nhập cho tất cả user?',
      content: (
        <div>
          <p>Hành động này sẽ:</p>
          <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
            <li>Tạo mật khẩu ngẫu nhiên mới cho <strong>toàn bộ</strong> user</li>
            <li>Gửi email thông tin đăng nhập tới tất cả user có email hợp lệ</li>
            <li>Tải file CSV chứa danh sách tên đăng nhập & mật khẩu</li>
          </ul>
          <p style={{ color: '#ef4444', marginTop: 8 }}>⚠️ Thao tác này không thể hoàn tác!</p>
        </div>
      ),
      okText: 'Xác nhận Generate & Send Email',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        setGeneratingCredentials(true);
        try {
          const response = await adminService.exportLoginCredentials();
          const { csvContent, stats } = response.data;

          // Download CSV
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `user-login-credentials-${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          link.parentNode?.removeChild(link);
          window.URL.revokeObjectURL(url);

          // Show email stats
          Modal.info({
            title: 'Kết quả Generate & Gửi Email',
            content: (
              <div>
                <p>Tổng số user: <strong>{stats.total}</strong></p>
                {stats.emailEnabled ? (
                  <>
                    <p style={{ color: '#16a34a' }}>📬 Email đã được xếp hàng gửi: <strong>{stats.emailQueued}</strong></p>
                    {stats.emailSkipped > 0 && (
                      <p style={{ color: '#d97706' }}>⏭️ Bỏ qua (email không phải @gmail.com): <strong>{stats.emailSkipped}</strong></p>
                    )}
                    <p style={{ color: '#6b7280', fontSize: 12 }}>Email sẽ được gửi trong nền — CSV đã tải xuống ngay lập tức.</p>
                  </>
                ) : (
                  <p style={{ color: '#d97706' }}>⚠️ SMTP chưa được cấu hình — không gửi được email. File CSV đã được tải xuống.</p>
                )}
              </div>
            ),
            okText: 'Đóng',
          });
        } catch (error) {
          console.error(error);
          message.error('Failed to generate credentials');
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
      setDeductWithdrawAmount(null);
      setDeductWithdrawReason('');
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

  const handleDeductWithdrawWallet = async () => {
    if (!userDetail?.user?.id) return;
    const amt = Number(deductWithdrawAmount ?? 0);
    const bal = Number(userDetail.user.withdrawWalletBalance ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      message.warning('Nhập số USDT cần trừ (> 0)');
      return;
    }
    if (amt > bal + 1e-10) {
      message.warning(`Số trừ vượt quá số dư hiện tại (${bal.toFixed(2)} USDT)`);
      return;
    }
    try {
      setDeductWithdrawLoading(true);
      const response = await adminService.deductUserWithdrawWallet(userDetail.user.id, {
        amount: amt,
        reason: deductWithdrawReason.trim() || undefined,
      });
      setUserDetail(response.data);
      setDeductWithdrawAmount(null);
      setDeductWithdrawReason('');
      message.success('Đã trừ số dư ví rút tiền');
      fetchUsers(searchText || undefined);
    } catch (error: any) {
      const msg = error.response?.data?.message;
      message.error(
        typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : 'Không thể trừ số dư',
      );
    } finally {
      setDeductWithdrawLoading(false);
    }
  };

  const handleGeneratePasswordForUser = (userId: string, userEmail: string) => {
    Modal.confirm({
      title: 'Generate & gửi mật khẩu cho user?',
      content: (
        <div>
          <p>Hệ thống sẽ tạo mật khẩu ngẫu nhiên và cập nhật vào tài khoản của user.</p>
          <p>Email: <strong>{userEmail || '(không có email)'}</strong></p>
          <p>Nếu email hợp lệ và SMTP được cấu hình, thông tin đăng nhập sẽ được gửi tới email trên.</p>
        </div>
      ),
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      onOk: async () => {
        setGeneratingPasswordForUser(userId);
        try {
          const res = await adminService.generatePasswordForUser(userId);
          const { username, email, emailSent, emailEnabled, emailValid } = res.data as {
            username: string;
            email: string;
            emailSent: boolean;
            emailEnabled: boolean;
            emailValid: boolean;
          };
          if (emailSent) {
            message.success(`Đã tạo mật khẩu và gửi email thành công tới ${email}`);
          } else if (!emailEnabled) {
            message.warning(`Đã tạo mật khẩu cho "${username}" nhưng SMTP chưa được cấu hình — không gửi được email.`);
          } else if (!emailValid) {
            message.warning(`Đã tạo mật khẩu cho "${username}" nhưng email "${email}" không hợp lệ — không gửi email.`);
          } else {
            message.error(`Đã tạo mật khẩu cho "${username}" nhưng gửi email thất bại.`);
          }
        } catch (error: any) {
          message.error(error?.response?.data?.message || 'Tạo mật khẩu thất bại');
        } finally {
          setGeneratingPasswordForUser(null);
        }
      },
    });
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
      title: 'Ví nạp tiền',
      dataIndex: 'walletBalance',
      key: 'walletBalance',
      render: (val: number) => <span style={{ color: '#52c41a', fontWeight: 600 }}>${Number(val || 0).toFixed(2)}</span>,
    },
    {
      title: 'Ví rút tiền',
      dataIndex: 'withdrawWalletBalance',
      key: 'withdrawWalletBalance',
      render: (val: number) => <span style={{ color: '#1890ff', fontWeight: 600 }}>${Number(val || 0).toFixed(2)}</span>,
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
      title: 'KYC',
      dataIndex: 'kycStatus',
      key: 'kycStatus',
      render: (kycStatus: string, record: User) => {
        const status = kycStatus || 'UNVERIFIED';
        const colorMap: Record<string, string> = {
          APPROVED: 'green',
          PENDING: 'orange',
          REJECTED: 'red',
          UNVERIFIED: 'default',
        };
        const timeText = record.kycSubmittedAt
          ? new Date(record.kycSubmittedAt).toLocaleDateString()
          : null;
        return (
          <Space direction="vertical" size={2}>
            <Tag color={colorMap[status] || 'default'}>{status}</Tag>
            {timeText ? <Text type="secondary" style={{ fontSize: 12 }}>{timeText}</Text> : null}
          </Space>
        );
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
          <Button
            type="link"
            icon={<KeyOutlined />}
            loading={generatingPasswordForUser === record.id}
            onClick={() => handleGeneratePasswordForUser(record.id, record.email)}
          >
            Gen Password
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
        message="Generate Login Credentials sẽ tạo lại username + mật khẩu cho TẤT CẢ user và gửi email đồng loạt tới các địa chỉ email hợp lệ."
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
          setEditWalletReconciliation(null);
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
              <>
              <Tabs defaultActiveKey="account" destroyInactiveTabPane={false}>
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
                  <Card
                    size="small"
                    style={{ marginBottom: 16, borderColor: '#ffe58f' }}
                    title="Wallet reconciliation (withdraw wallet)"
                  >
                    <Space
                      direction="vertical"
                      size={10}
                      style={{ width: '100%' }}
                    >
                      <Text type="secondary">
                        Chỉ tính commission đã phân bổ vào ví rút (không tính payout USDT tx), cộng matrix ròng, trừ số đã rút được duyệt.
                      </Text>
                      <Descriptions size="small" bordered column={1}>
                        <Descriptions.Item label="Commission PAID vào ví rút">
                          <span style={{ color: '#389e0d', fontWeight: 600 }}>
                            ${toNum(editWalletReconciliation?.paidCommissionToWithdrawWallet).toFixed(8)} USDT
                          </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Matrix pool (net)">
                          <span style={{ color: '#722ed1', fontWeight: 600 }}>
                            ${toNum(editWalletReconciliation?.matrixPoolNetAmount).toFixed(8)} USDT
                          </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Đã rút (APPROVED)">
                          <span style={{ color: '#cf1322', fontWeight: 600 }}>
                            ${toNum(editWalletReconciliation?.approvedWithdrawnAmount).toFixed(8)} USDT
                          </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Số dư ví rút đề xuất">
                          <span style={{ color: '#1677ff', fontWeight: 700 }}>
                            ${toNum(editWalletReconciliation?.expectedWithdrawWalletBalance).toFixed(8)} USDT
                          </span>
                        </Descriptions.Item>
                      </Descriptions>
                      <Button
                        type="primary"
                        onClick={applyExpectedWithdrawWalletBalance}
                        disabled={!editWalletReconciliation}
                      >
                        Set Withdraw wallet balance = số dư đề xuất
                      </Button>
                    </Space>
                  </Card>
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
              <Divider />
              <Title level={5} style={{ marginTop: 0 }}>
                Mật khẩu đăng nhập Web2
              </Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                Luôn hiển thị phía dưới — để trống nếu không đổi. Tối thiểu 6 ký tự nếu nhập mật khẩu mới.
              </Text>
              <Form.Item
                name="password"
                label="Mật khẩu mới"
                rules={[
                  {
                    validator: (_, v) => {
                      const s = String(v || '').trim();
                      if (!s) return Promise.resolve();
                      if (s.length < 6) {
                        return Promise.reject(new Error('Tối thiểu 6 ký tự'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  placeholder="Chỉ điền khi muốn đổi mật khẩu"
                />
              </Form.Item>
              </>
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
          setDeductWithdrawAmount(null);
          setDeductWithdrawReason('');
        }}
        footer={[
          <Button key="close" onClick={() => {
            setIsDetailModalVisible(false);
            setUserDetail(null);
            setDeductWithdrawAmount(null);
            setDeductWithdrawReason('');
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
                <Descriptions.Item label="Ví nạp tiền (Deposit Wallet)">
                  <span style={{ color: '#52c41a', fontWeight: 600 }}>${userDetail.user.walletBalance ?? 0} USDT</span>
                </Descriptions.Item>
                <Descriptions.Item label="Ví rút tiền (Withdraw Wallet)">
                  <span style={{ color: '#1890ff', fontWeight: 600 }}>${userDetail.user.withdrawWalletBalance ?? 0} USDT</span>
                </Descriptions.Item>
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

              <Card
                type="inner"
                size="small"
                title={
                  <span style={{ color: '#d4380d', fontWeight: 600 }}>
                    Trừ số dư ví rút tiền (admin)
                  </span>
                }
                style={{ marginTop: 16, borderColor: '#ffccc7' }}
              >
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Trừ trực tiếp USDT trong ví rút của user"
                  description="Không tạo yêu cầu rút tiền. Chỉ dùng khi điều chỉnh sai sót / thu hồi. Hành động được ghi log server."
                />
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                      Số USDT cần trừ (tối đa {Number(userDetail.user.withdrawWalletBalance ?? 0).toFixed(8)})
                    </Text>
                    <InputNumber
                      min={0.00000001}
                      step={0.01}
                      style={{ width: '100%', maxWidth: 280 }}
                      placeholder="VD: 10.5"
                      value={deductWithdrawAmount ?? undefined}
                      onChange={(v) => setDeductWithdrawAmount(v ?? null)}
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                      Lý do (ghi log, tùy chọn)
                    </Text>
                    <Input.TextArea
                      rows={2}
                      maxLength={500}
                      showCount
                      value={deductWithdrawReason}
                      onChange={(e) => setDeductWithdrawReason(e.target.value)}
                      placeholder="VD: điều chỉnh cộng nhầm matrix / hoàn tiền nội bộ"
                    />
                  </div>
                  <Popconfirm
                    title="Xác nhận trừ số dư ví rút?"
                    description={`Trừ ${Number(deductWithdrawAmount ?? 0) || '…'} USDT khỏi ví rút của user này.`}
                    okText="Trừ"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={handleDeductWithdrawWallet}
                  >
                    <Button danger loading={deductWithdrawLoading} disabled={!userDetail.user.id}>
                      Trừ số dư ví rút
                    </Button>
                  </Popconfirm>
                </Space>
              </Card>

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

