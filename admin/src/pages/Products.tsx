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
  Tabs,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { Editor } from '@tinymce/tinymce-react';
import { productService, Product } from '../services/productService';
import { categoryService, Category } from '../services/categoryService';
import type { UploadFile } from 'antd/es/upload/interface';

const availableTags = ['SALE', 'COMING_SOON', 'HOT', 'NEW', 'SOLD_OUT'];

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();
  const [thumbnailFileList, setThumbnailFileList] = useState<UploadFile[]>([]);
  const [detailFileList, setDetailFileList] = useState<UploadFile[]>([]);
  const [currentDetailImageUrls, setCurrentDetailImageUrls] = useState<string[]>([]);
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await categoryService.getAll();
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch categories');
    }
  };

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
    form.setFieldsValue({ description: '', descriptionEn: '' });
    setThumbnailFileList([]);
    setThumbnailFileList([]);
    setDetailFileList([]);
    setCurrentDetailImageUrls([]);
    setCurrentThumbnailUrl(undefined);
    setIsModalVisible(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    form.setFieldsValue({
      ...product,
      description: product.description || '',
      descriptionEn: product['descriptionEn' as keyof Product] || '',
      // Keep URLs in form values for submit; Upload UI is for new uploads only
      detailImageUrls: product.detailImageUrls || [],
      tags: product.tags || [],
      properties: product.properties || [],
      categoryId: product.categoryId || undefined,
    });
    setThumbnailFileList([]);
    setDetailFileList([]);
    setCurrentDetailImageUrls(product.detailImageUrls || []);
    setCurrentThumbnailUrl(product.thumbnailUrl);
    setIsModalVisible(true);
  };

  const handleRemoveThumbnail = () => {
    setCurrentThumbnailUrl(undefined);
  };

  const handleRemoveDetailImage = (urlToRemove: string) => {
    setCurrentDetailImageUrls((prev) => prev.filter((url) => url !== urlToRemove));
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
      let thumbnailUrl: string | undefined = currentThumbnailUrl;
      if (thumbnailFileList[0]?.originFileObj) {
        const fd = new FormData();
        fd.append('file', thumbnailFileList[0].originFileObj as File);
        const uploadRes = await (await import('../services/api')).default.post('/uploads/image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        thumbnailUrl = uploadRes.data?.url;
      }

      // Upload detail images (if any selected)
      let detailImageUrls: string[] = [...currentDetailImageUrls];
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
        thumbnailUrl: thumbnailUrl || null, // Allow explicit removal in backend if null is handled, or just don't send if empty
        detailImageUrls: detailImageUrls,
      };

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
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (category?: { name: string }) => category?.name || '-',
      responsive: ['md'] as any,
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
      title: 'Shipping Fee (USA)',
      dataIndex: 'shippingFee',
      key: 'shippingFee',
      width: 120,
      render: (fee: number) => fee ? `$${fee?.toFixed(2)}` : '-',
      responsive: ['lg'] as any, // Hide on mobile/tablet
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
        style={{ maxWidth: 1000 }}
        destroyOnHidden
      >
        {isModalVisible && (
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Tabs
              defaultActiveKey="vi"
              items={[
                {
                  key: 'vi',
                  label: 'Tiếng Việt',
                  children: (
                    <>
                      <Form.Item
                        name="name"
                        label="Tên sản phẩm"
                        rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm' }]}
                      >
                        <Input placeholder="Nhập tên sản phẩm" />
                      </Form.Item>
                      <Form.Item
                        name="description"
                        label="Mô tả"
                        trigger="onEditorChange"
                        validateTrigger="onEditorChange"
                      >
                        <Editor
                          apiKey='xhvi99zf95ueinybzalp9vwc7yaolsr1rxibrza2dzwb9c8e'
                          init={{
                            height: 400,
                            menubar: true,
                            plugins: [
                              'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                              'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                              'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                            ],
                            toolbar: 'undo redo | blocks | ' +
                              'bold italic forecolor | alignleft aligncenter ' +
                              'alignright alignjustify | bullist numlist outdent indent | ' +
                              'removeformat | image | help',
                            content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                            images_upload_handler: async (blobInfo: any) => {
                              return new Promise(async (resolve, reject) => {
                                try {
                                  const fd = new FormData();
                                  fd.append('file', blobInfo.blob(), blobInfo.filename());
                                  const api = (await import('../services/api')).default;
                                  const uploadRes = await api.post('/uploads/image', fd, {
                                    headers: { 'Content-Type': 'multipart/form-data' },
                                  });
                                  if (uploadRes.data?.url) {
                                    resolve(uploadRes.data.url);
                                  } else {
                                    reject('Upload failed');
                                  }
                                } catch (error) {
                                  reject('Upload error');
                                }
                              });
                            }
                          }}
                        />
                      </Form.Item>
                      <Form.Item name="brand" label="Thương hiệu (Tùy chọn)">
                        <Input placeholder="VD: BinanMall" />
                      </Form.Item>
                      <Form.Item name="origin" label="Xuất xứ (Tùy chọn)">
                        <Input placeholder="VD: Việt Nam" />
                      </Form.Item>
                      <Form.Item name="clothingType" label="Loại trang phục (Tùy chọn)">
                        <Input placeholder="VD: Đồ lẻ, Bộ" />
                      </Form.Item>
                    </>
                  ),
                },
                {
                  key: 'en',
                  label: 'English',
                  children: (
                    <>
                      <Form.Item
                        name="nameEn"
                        label="Product Name (English)"
                      >
                        <Input placeholder="Enter product name in English" />
                      </Form.Item>
                      <Form.Item
                        name="descriptionEn"
                        label="Description (English)"
                        trigger="onEditorChange"
                        validateTrigger="onEditorChange"
                      >
                        <Editor
                          apiKey='xhvi99zf95ueinybzalp9vwc7yaolsr1rxibrza2dzwb9c8e'
                          init={{
                            height: 400,
                            menubar: true,
                            plugins: [
                              'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                              'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                              'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                            ],
                            toolbar: 'undo redo | blocks | ' +
                              'bold italic forecolor | alignleft aligncenter ' +
                              'alignright alignjustify | bullist numlist outdent indent | ' +
                              'removeformat | image | help',
                            content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                            images_upload_handler: async (blobInfo: any) => {
                              return new Promise(async (resolve, reject) => {
                                try {
                                  const fd = new FormData();
                                  fd.append('file', blobInfo.blob(), blobInfo.filename());
                                  const api = (await import('../services/api')).default;
                                  const uploadRes = await api.post('/uploads/image', fd, {
                                    headers: { 'Content-Type': 'multipart/form-data' },
                                  });
                                  if (uploadRes.data?.url) {
                                    resolve(uploadRes.data.url);
                                  } else {
                                    reject('Upload failed');
                                  }
                                } catch (error) {
                                  reject('Upload error');
                                }
                              });
                            }
                          }}
                        />
                      </Form.Item>
                      <Form.Item name="brandEn" label="Brand (Optional)">
                        <Input placeholder="e.g. BinanMall" />
                      </Form.Item>
                      <Form.Item name="originEn" label="Origin (Optional)">
                        <Input placeholder="e.g. Vietnam" />
                      </Form.Item>
                      <Form.Item name="clothingTypeEn" label="Clothing Type (Optional)">
                        <Input placeholder="e.g. Single item, Set" />
                      </Form.Item>
                    </>
                  ),
                },
              ]}
            />

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
              {currentThumbnailUrl && (
                <div style={{ marginTop: 16 }}>
                  <Typography.Text strong>Current Thumbnail:</Typography.Text>
                  <div style={{ position: 'relative', border: '1px solid #d9d9d9', borderRadius: 4, padding: 4, width: 'fit-content', marginTop: 8 }}>
                    <Image
                      src={currentThumbnailUrl}
                      width={60}
                      height={60}
                      style={{ objectFit: 'cover' }}
                    />
                    <Button
                      type="primary"
                      danger
                      shape="circle"
                      icon={<DeleteOutlined />}
                      size="small"
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        fontSize: 10,
                        width: 20,
                        height: 20,
                        minWidth: 20
                      }}
                      onClick={handleRemoveThumbnail}
                    />
                  </div>
                </div>
              )}
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

              {currentDetailImageUrls.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Typography.Text strong>Existing Detail Images:</Typography.Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {currentDetailImageUrls.map((url, index) => (
                      <div key={index} style={{ position: 'relative', border: '1px solid #d9d9d9', borderRadius: 4, padding: 4 }}>
                        <Image
                          src={url}
                          width={60}
                          height={60}
                          style={{ objectFit: 'cover' }}
                        />
                        <Button
                          type="primary"
                          danger
                          shape="circle"
                          icon={<DeleteOutlined />}
                          size="small"
                          style={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            fontSize: 10,
                            width: 20,
                            height: 20,
                            minWidth: 20
                          }}
                          onClick={() => handleRemoveDetailImage(url)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              name="shippingFee"
              label="Shipping Fee (USDT)"
              rules={[{ type: 'number', min: 0 }]}
              tooltip="Shipping fee for product in USDT"
            >
              <InputNumber style={{ width: '100%' }} min={0} step={0.000001} precision={6} />
            </Form.Item>
            <Form.Item
              name="fakeSold"
              label="Fake Sold Count"
              rules={[{ type: 'number', min: 0 }]}
              tooltip="Display this sold count instead of real sold count (leave empty to show real count)"
            >
              <InputNumber style={{ width: '100%' }} min={0} placeholder="Optional" />
            </Form.Item>
            <Form.Item
              name="categoryId"
              label="Category"
              rules={[]}
            >
              <Select style={{ width: '100%' }} placeholder="Select category" allowClear>
                {categories.map((cat) => (
                  <Select.Option key={cat.id} value={cat.id}>
                    {cat.parent ? `${cat.parent.name} › ${cat.name}` : cat.name}
                  </Select.Option>
                ))}
              </Select>
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
            <Form.Item
              name="tags"
              label="Tags"
              rules={[]}
              initialValue={[]}
            >
              <Select
                mode="tags"
                style={{ width: '100%' }}
                placeholder="Select or enter tags (e.g. SALE, COMING_SOON, HOT)"
                tokenSeparators={[',']}
              >
                {availableTags.map((tag) => (
                  <Select.Option key={tag} value={tag}>
                    {tag}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Typography.Title level={5}>Product Properties</Typography.Title>
            <Form.List name="properties">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'name']}
                        rules={[{ required: true, message: 'Missing property name' }]}
                      >
                        <Input placeholder="Property Name (e.g. Color)" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'values']}
                        rules={[{ required: true, message: 'Missing property values' }]}
                      >
                        <Select
                          mode="tags"
                          style={{ width: '200px' }}
                          placeholder="Values (e.g. Red, Blue)"
                          tokenSeparators={[',']}
                          open={false}
                        />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Add Property
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Products;

