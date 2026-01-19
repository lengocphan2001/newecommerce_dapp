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
  Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { staffService, Staff } from '../services/staffService';
import { roleService, Role } from '../services/roleService';

const Staffs: React.FC = () => {
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchStaffs();
    fetchRoles();
  }, []);

  const fetchStaffs = async () => {
    setLoading(true);
    try {
      const response = await staffService.getAll();
      setStaffs(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch staffs');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await roleService.getAll();
      setRoles(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch roles');
    }
  };

  const handleCreate = () => {
    setEditingStaff(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (staff: Staff) => {
    setEditingStaff(staff);
    form.setFieldsValue({
      ...staff,
      roleIds: staff.roles?.map((r) => r.id) || [],
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await staffService.delete(id);
      message.success('Staff deleted successfully');
      fetchStaffs();
    } catch (error) {
      message.error('Failed to delete staff');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingStaff) {
        await staffService.update(editingStaff.id, values);
        message.success('Staff updated successfully');
      } else {
        await staffService.create(values);
        message.success('Staff created successfully');
      }
      setIsModalVisible(false);
      fetchStaffs();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to save staff');
    }
  };

  const columns = [
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
          SUSPENDED: 'red',
        };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: 'Super Admin',
      dataIndex: 'isSuperAdmin',
      key: 'isSuperAdmin',
      render: (isSuperAdmin: boolean) => (
        <Tag color={isSuperAdmin ? 'red' : 'default'}>
          {isSuperAdmin ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Roles',
      key: 'roles',
      render: (_: any, record: Staff) => (
        <Space>
          {record.roles?.map((role) => (
            <Tag key={role.id}>{role.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Staff) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this staff?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
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
        <h2>Staff Management</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Create Staff
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={staffs}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingStaff ? 'Edit Staff' : 'Create Staff'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnHidden
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: !editingStaff },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password />
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

          <Form.Item
            name="roleIds"
            label="Roles"
            rules={[]}
          >
            <Select mode="multiple" placeholder="Select roles">
              {roles.map((role) => (
                <Select.Option key={role.id} value={role.id}>
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            initialValue="ACTIVE"
            rules={[]}
          >
            <Select>
              <Select.Option value="ACTIVE">Active</Select.Option>
              <Select.Option value="INACTIVE">Inactive</Select.Option>
              <Select.Option value="SUSPENDED">Suspended</Select.Option>
            </Select>
          </Form.Item>

          {editingStaff && (
            <Form.Item
              name="isSuperAdmin"
              label="Super Admin"
              valuePropName="checked"
              rules={[]}
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default Staffs;
