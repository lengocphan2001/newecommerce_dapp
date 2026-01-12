import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Descriptions,
  Tabs,
  Card,
  Typography,
  Divider,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { userService, User } from '../services/userService';
import { adminService } from '../services/adminService';

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userService.getAll();
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
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

  const handleViewDetail = async (userId: string) => {
    try {
      setDetailLoading(true);
      const response = await adminService.getUserDetail(userId);
      setUserDetail(response.data);
      setIsDetailModalVisible(true);
    } catch (error: any) {
      message.error('Failed to load user details: ' + (error.message || 'Unknown error'));
    } finally {
      setDetailLoading(false);
    }
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h1>Users Management</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Add User
        </Button>
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
                  ${userDetail.user.totalPurchaseAmount} USDT
                </Descriptions.Item>
                <Descriptions.Item label="Total Commission Received">
                  ${userDetail.user.totalCommissionReceived} USDT
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
                  { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (amount: any) => `$${typeof amount === 'string' ? amount : amount.toFixed(4)}` },
                  { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={status === 'PAID' ? 'green' : 'orange'}>{status}</Tag> },
                  { title: 'Order ID', dataIndex: 'orderId', key: 'orderId' },
                  { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleString() },
                ]}
              />
            </TabPane>

            <TabPane tab="Orders" key="orders">
              <Table
                dataSource={userDetail.orders || []}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Order ID', dataIndex: 'id', key: 'id' },
                  { title: 'Total Amount', dataIndex: 'totalAmount', key: 'totalAmount', render: (amount: number) => `$${amount.toFixed(4)} USDT` },
                  { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Tag>{status}</Tag> },
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
    </div>
  );
};

export default Users;

