import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Image,
  Upload,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { categoryService, Category } from '../services/categoryService';
import type { UploadFile } from 'antd/es/upload/interface';

const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form] = Form.useForm();
  const [imageFileList, setImageFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await categoryService.getAll();
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCategory(null);
    form.resetFields();
    setImageFileList([]);
    setIsModalVisible(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    form.setFieldsValue({
      ...category,
    });
    setImageFileList([]);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await categoryService.delete(id);
      message.success('Category deleted successfully');
      fetchCategories();
    } catch (error) {
      message.error('Failed to delete category');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      // Upload image (if user selected a file)
      let imageUrl: string | undefined = editingCategory?.imageUrl;
      if (imageFileList[0]?.originFileObj) {
        const fd = new FormData();
        fd.append('file', imageFileList[0].originFileObj as File);
        const uploadRes = await (await import('../services/api')).default.post('/uploads/image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        imageUrl = uploadRes.data?.url;
      }

      // Ensure only string URLs are sent
      if (imageUrl && !(typeof imageUrl === 'string' && imageUrl.startsWith('http'))) {
        imageUrl = undefined;
      }

      const payload: any = {
        ...values,
      };
      if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
        payload.imageUrl = imageUrl;
      }

      if (editingCategory) {
        await categoryService.update(editingCategory.id, payload);
        message.success('Category updated successfully');
      } else {
        await categoryService.create(payload);
        message.success('Category created successfully');
      }
      setIsModalVisible(false);
      fetchCategories();
    } catch (error) {
      message.error('Failed to save category');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      responsive: ['md'] as any,
    },
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 80,
      render: (url?: string) =>
        url ? (
          <Image
            src={url}
            width={48}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 6 }}
            preview={false}
            fallback="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
          />
        ) : (
          '-'
        ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      ellipsis: true,
      responsive: ['lg'] as any,
      render: (text?: string) => {
        if (!text) return '-';
        const maxLength = 100;
        if (text.length <= maxLength) return text;
        return `${text.substring(0, maxLength)}...`;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right' as any,
      render: (_: any, record: Category) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure to delete this category?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 24px)' }}>Categories Management</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Add Category
        </Button>
      </div>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <Table
          columns={columns}
          dataSource={categories}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </div>
      <Modal
        title={editingCategory ? 'Edit Category' : 'Create Category'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width="90%"
        style={{ maxWidth: 600 }}
        destroyOnHidden
      >
        {isModalVisible && (
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Please enter category name' }]}
            >
              <Input placeholder="Category name" />
            </Form.Item>
            <Form.Item
              name="description"
              label="Description"
              rules={[]}
            >
              <Input.TextArea rows={4} placeholder="Category description" />
            </Form.Item>
            <Form.Item label="Image">
              <Upload
                accept="image/*"
                listType="picture"
                maxCount={1}
                fileList={imageFileList}
                beforeUpload={() => false}
                onChange={({ fileList }) => setImageFileList(fileList)}
              >
                <Button>Choose image</Button>
              </Upload>
              {editingCategory?.imageUrl ? (
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  Current: {editingCategory.imageUrl}
                </Typography.Text>
              ) : null}
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Categories;
