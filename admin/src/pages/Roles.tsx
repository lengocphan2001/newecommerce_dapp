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
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { roleService, Role, Permission } from '../services/roleService';
import { permissionService } from '../services/roleService';

const Roles: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await roleService.getAll();
      setRoles(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await permissionService.getAll();
      setPermissions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch permissions');
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({
      ...role,
      permissionIds: role.permissions?.map((p) => p.id) || [],
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await roleService.delete(id);
      message.success('Role deleted successfully');
      fetchRoles();
    } catch (error) {
      message.error('Failed to delete role');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingRole) {
        await roleService.update(editingRole.id, values);
        message.success('Role updated successfully');
      } else {
        await roleService.create(values);
        message.success('Role created successfully');
      }
      setIsModalVisible(false);
      fetchRoles();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to save role');
    }
  };


  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (_: any, record: Role) => (
        <Space wrap>
          {record.permissions?.map((perm) => (
            <Tag key={perm.id}>{perm.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Staff Count',
      key: 'staffCount',
      render: (_: any, record: Role) => record.staffs?.length || 0,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Role) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this role?"
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
        <h2>Role Management</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Create Role
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={roles}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingRole ? 'Edit Role' : 'Create Role'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnHidden
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Role Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item
            name="permissionIds"
            label="Permissions"
            rules={[]}
          >
            <Select mode="multiple" placeholder="Select permissions" style={{ width: '100%' }}>
              {permissions.map((perm) => (
                <Select.Option key={perm.id} value={perm.id}>
                  [{perm.module}] {perm.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Roles;
