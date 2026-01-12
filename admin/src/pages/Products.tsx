import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Image,
  Upload,
  Typography,
  message,
  Popconfirm,
  Select,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { productService, Product } from '../services/productService';
import type { UploadFile } from 'antd/es/upload/interface';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();
  const [thumbnailFileList, setThumbnailFileList] = useState<UploadFile[]>([]);
  const [detailFileList, setDetailFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await productService.getAll();
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingProduct(null);
    form.resetFields();
    setThumbnailFileList([]);
    setDetailFileList([]);
    setIsModalVisible(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    form.setFieldsValue({
      ...product,
      // Keep URLs in form values for submit; Upload UI is for new uploads only
      detailImageUrls: product.detailImageUrls || [],
    });
    setThumbnailFileList([]);
    setDetailFileList([]);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await productService.delete(id);
      message.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      message.error('Failed to delete product');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      // Don't trust hidden/previous form values for these fields; always derive from current product + uploads.
      // Upload thumbnail (if user selected a file)
      let thumbnailUrl: string | undefined = editingProduct?.thumbnailUrl;
      if (thumbnailFileList[0]?.originFileObj) {
        const fd = new FormData();
        fd.append('file', thumbnailFileList[0].originFileObj as File);
        const uploadRes = await (await import('../services/api')).default.post('/uploads/image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        thumbnailUrl = uploadRes.data?.url;
      }

      // Upload detail images (if any selected)
      let detailImageUrls: string[] = editingProduct?.detailImageUrls ? [...editingProduct.detailImageUrls] : [];
      const newDetailFiles = detailFileList.filter((f) => f.originFileObj).map((f) => f.originFileObj as File);
      if (newDetailFiles.length) {
        const fd = new FormData();
        newDetailFiles.forEach((f) => fd.append('files', f));
        const uploadRes = await (await import('../services/api')).default.post('/uploads/images', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const urls = uploadRes.data?.urls;
        if (Array.isArray(urls)) {
          detailImageUrls = [...detailImageUrls, ...urls];
        }
      }

      // Ensure only string URLs are sent
      detailImageUrls = detailImageUrls.filter((u) => typeof u === 'string' && u.startsWith('http'));
      if (thumbnailUrl && !(typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('http'))) {
        thumbnailUrl = undefined;
      }

      // Only include image fields if they have valid values
      const payload: any = {
        ...values,
      };
      if (thumbnailUrl && typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('http')) {
        payload.thumbnailUrl = thumbnailUrl;
      }
      if (Array.isArray(detailImageUrls) && detailImageUrls.length > 0) {
        payload.detailImageUrls = detailImageUrls;
      }

      if (editingProduct) {
        await productService.update(editingProduct.id, payload);
        message.success('Product updated successfully');
      } else {
        await productService.create(payload);
        message.success('Product created successfully');
      }
      setIsModalVisible(false);
      fetchProducts();
    } catch (error) {
      message.error('Failed to save product');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      responsive: ['md'] as any, // Hide on mobile
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Thumbnail',
      dataIndex: 'thumbnailUrl',
      key: 'thumbnailUrl',
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
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      responsive: ['lg'] as any, // Hide on mobile/tablet
      render: (text?: string) => {
        if (!text) return '-';
        const maxLength = 100;
        if (text.length <= maxLength) return text;
        return `${text.substring(0, maxLength)}...`;
      },
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (price: number) => `$${price?.toFixed(2)}`,
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      key: 'stock',
      width: 80,
      responsive: ['md'] as any, // Hide on mobile
    },
    {
      title: 'Detail Images',
      dataIndex: 'detailImageUrls',
      key: 'detailImageUrls',
      width: 120,
      render: (urls?: string[]) => (urls?.length ? `${urls.length} image(s)` : '-'),
      responsive: ['lg'] as any, // Hide on mobile/tablet
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right' as any,
      render: (_: any, record: Product) => (
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
            title="Are you sure to delete this product?"
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
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 24px)' }}>Products Management</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Add Product
        </Button>
      </div>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <Table
          columns={columns}
          dataSource={products}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </div>
      <Modal
        title={editingProduct ? 'Edit Product' : 'Create Product'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width="90%"
        style={{ maxWidth: 600 }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="Thumbnail">
            <Upload
              accept="image/*"
              listType="picture"
              maxCount={1}
              fileList={thumbnailFileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setThumbnailFileList(fileList)}
            >
              <Button>Choose thumbnail</Button>
            </Upload>
            {editingProduct?.thumbnailUrl ? (
              <Typography.Text type="secondary">
                Current: {editingProduct.thumbnailUrl}
              </Typography.Text>
            ) : null}
          </Form.Item>

          <Form.Item label="Detail Images">
            <Upload
              accept="image/*"
              listType="picture"
              multiple
              fileList={detailFileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setDetailFileList(fileList)}
            >
              <Button>Choose detail images</Button>
            </Upload>
            {editingProduct?.detailImageUrls?.length ? (
              <Typography.Text type="secondary">
                Current: {editingProduct.detailImageUrls.length} image(s)
              </Typography.Text>
            ) : null}
          </Form.Item>
          <Form.Item
            name="price"
            label="Price"
            rules={[{ required: true, type: 'number', min: 0 }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item
            name="stock"
            label="Stock"
            rules={[{ type: 'number', min: 0 }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item
            name="countries"
            label="Countries"
            rules={[{ required: true, message: 'Please select at least one country' }]}
            initialValue={['VIETNAM']}
          >
            <Select mode="multiple" style={{ width: '100%' }} placeholder="Select countries">
              <Select.Option value="VIETNAM">Vietnam</Select.Option>
              <Select.Option value="USA">USA</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Products;

