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
  Switch,
  Tabs,
  Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, UpCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { Editor } from '@tinymce/tinymce-react';
import { productService, Product } from '../services/productService';
import { categoryService, Category } from '../services/categoryService';
import { packagesService, Package } from '../services/packagesService';
import type { UploadFile } from 'antd/es/upload/interface';

const availableTags = ['SALE', 'COMING_SOON', 'HOT', 'NEW', 'SOLD_OUT'];

const PACKAGE_CODES = ['TV', 'CTV', 'NPP'] as const;
const PACKAGE_LABELS: Record<string, string> = { TV: 'Thành Viên', CTV: 'Cộng tác viên', NPP: 'Nhà phân phối' };

/** Form state for editing a package (rates stored as % 0-100 for display) */
interface PackageEditForm {
  id: string;
  name: string;
  code: string;
  description: string;
  price: number;
  level: number;
  isActive: boolean;
  directCommissionRate: number;
  groupCommissionRate: number;
  groupCommissionMinSales: number;
  managementRateF1: number;
  managementRateF2: number | null;
  managementRateF3: number | null;
  reconsumptionThreshold: number;
  reconsumptionRequired: number;
}

function packageToEditForm(pkg: Package): PackageEditForm {
  return {
    id: pkg.id,
    name: pkg.name,
    code: pkg.code,
    description: pkg.description ?? '',
    price: Number(pkg.price),
    level: pkg.level,
    isActive: pkg.isActive,
    directCommissionRate: Number(pkg.directCommissionRate) * 100,
    groupCommissionRate: Number(pkg.groupCommissionRate) * 100,
    groupCommissionMinSales: Number(pkg.groupCommissionMinSales ?? 2000),
    managementRateF1: Number(pkg.managementRateF1) * 100,
    managementRateF2: pkg.managementRateF2 != null ? Number(pkg.managementRateF2) * 100 : null,
    managementRateF3: pkg.managementRateF3 != null ? Number(pkg.managementRateF3) * 100 : null,
    reconsumptionThreshold: Number(pkg.reconsumptionThreshold ?? 0),
    reconsumptionRequired: Number(pkg.reconsumptionRequired ?? 0),
  };
}

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [packageEdits, setPackageEdits] = useState<Record<string, PackageEditForm>>({});
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
    fetchPackages();
  }, []);

  useEffect(() => {
    const next: Record<string, PackageEditForm> = {};
    PACKAGE_CODES.forEach((code) => {
      const pkg = packages.find((p) => p.code === code);
      if (pkg) next[code] = packageToEditForm(pkg);
    });
    setPackageEdits((prev) => ({ ...prev, ...next }));
  }, [packages]);

  const fetchPackages = async () => {
    try {
      const data = await packagesService.getAll();
      setPackages(Array.isArray(data) ? data : []);
    } catch {
      setPackages([]);
    }
  };

  const updatePackageField = (code: string, field: keyof PackageEditForm, value: any) => {
    setPackageEdits((prev) => {
      const cur = prev[code];
      if (!cur) return prev;
      return { ...prev, [code]: { ...cur, [field]: value } };
    });
  };

  const handleSavePackage = async (code: string) => {
    const edit = packageEdits[code];
    if (!edit) return;
    try {
      await packagesService.update(edit.id, {
        name: edit.name,
        description: edit.description || undefined,
        price: edit.price,
        level: edit.level,
        isActive: edit.isActive,
        directCommissionRate: edit.directCommissionRate / 100,
        groupCommissionRate: edit.groupCommissionRate / 100,
        groupCommissionMinSales: edit.groupCommissionMinSales,
        managementRateF1: edit.managementRateF1 / 100,
        managementRateF2: edit.managementRateF2 != null ? edit.managementRateF2 / 100 : null,
        managementRateF3: edit.managementRateF3 != null ? edit.managementRateF3 / 100 : null,
        reconsumptionThreshold: edit.reconsumptionThreshold,
        reconsumptionRequired: edit.reconsumptionRequired,
      });
      message.success(`Đã cập nhật gói ${code}`);
      fetchPackages();
    } catch (e: any) {
      message.error(e?.message || 'Cập nhật gói thất bại');
    }
  };

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

  const handleExport = async () => {
    try {
      const response = await productService.export();

      // Create a blob from the response data
      const blob = new Blob([response.data as any], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'products.csv');
      document.body.appendChild(link);
      link.click();

      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('Products exported successfully');
    } catch (error) {
      console.error(error);
      message.error('Failed to export products');
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
      detailImageUrls: product.detailImageUrls || [],
      tags: product.tags || [],
      properties: product.properties || [],
      combos: product.combos || [],
      categoryId: product.categoryId || undefined,
      commissionPercentTV: product.commissionPercentTV ?? undefined,
      commissionPercentCTV: product.commissionPercentCTV ?? undefined,
      commissionPercentNPP: product.commissionPercentNPP ?? undefined,
      featuredOnHome: product.featuredOnHome ?? false,
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

  const handleTogglePush = async (id: string) => {
    try {
      await productService.togglePush(id);
      message.success('Product push status updated');
      fetchProducts();
    } catch (error) {
      message.error('Failed to update product push status');
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
      render: (price: number) => `$${price?.toFixed(4)}`,
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
      render: (fee: number) => fee ? `$${fee?.toFixed(4)}` : '-',
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
      width: 200,
      fixed: 'right' as any,
      render: (_: any, record: Product) => (
        <Space size="small">
          <Button
            type="link"
            icon={<UpCircleOutlined />}
            onClick={() => handleTogglePush(record.id)}
            size="small"
            style={{ color: record.pushedAt ? '#1890ff' : 'gray' }}
            title={record.pushedAt ? "Unpush product" : "Push product to top"}
          >
            {record.pushedAt ? "Pushed" : "Push"}
          </Button>
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
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Export Products
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Add Product
          </Button>
        </Space>
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
                        <Input placeholder="VD: Shopii" />
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
                  key: 'commission',
                  label: 'Hoa hồng',
                  children: (
                    <>
                      <Typography.Title level={5} style={{ marginTop: 0 }}>Cấu hình đầy đủ từng gói (TV, CTV, NPP)</Typography.Title>
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                        Chỉnh toàn bộ thông tin gói giống trang Packages. Phần « Hoa hồng sản phẩm » dùng khi khách mua sản phẩm này theo gói. Bấm « Cập nhật gói » để lưu thông tin gói.
                      </Typography.Text>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {PACKAGE_CODES.map((code) => {
                          const edit = packageEdits[code];
                          const fieldName = code === 'TV' ? 'commissionPercentTV' : code === 'CTV' ? 'commissionPercentCTV' : 'commissionPercentNPP';
                          if (!edit) return <Card key={code} size="small"><Typography.Text type="secondary">Đang tải gói {code}...</Typography.Text></Card>;
                          return (
                            <Card key={code} size="small" title={<><Typography.Text strong>{edit.name}</Typography.Text><Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{edit.code} · Level {edit.level}</Typography.Text></>} extra={<Button type="primary" size="small" onClick={() => handleSavePackage(code)}>Cập nhật gói</Button>}>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <Form.Item label="Tên gói" style={{ flex: 1, minWidth: 160, marginBottom: 8 }}>
                                  <Input value={edit.name} onChange={(e) => updatePackageField(code, 'name', e.target.value)} placeholder="Tên gói" />
                                </Form.Item>
                                <Form.Item label="Code" style={{ width: 100, marginBottom: 8 }}>
                                  <Input value={edit.code} disabled />
                                </Form.Item>
                                <Form.Item label="Mô tả" style={{ width: '100%', marginBottom: 8 }}>
                                  <Input.TextArea value={edit.description} onChange={(e) => updatePackageField(code, 'description', e.target.value)} rows={2} placeholder="Mô tả" />
                                </Form.Item>
                              </div>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <Form.Item label="Price ($)" style={{ width: 120, marginBottom: 8 }}>
                                  <InputNumber style={{ width: '100%' }} min={0} step={0.0001} value={edit.price} onChange={(v) => updatePackageField(code, 'price', v ?? 0)} />
                                </Form.Item>
                                <Form.Item label="Level" style={{ width: 80, marginBottom: 8 }}>
                                  <InputNumber style={{ width: '100%' }} min={1} value={edit.level} onChange={(v) => updatePackageField(code, 'level', v ?? 1)} />
                                </Form.Item>
                                <Form.Item label="Kích hoạt" valuePropName="checked" style={{ marginBottom: 8 }}>
                                  <Switch checked={edit.isActive} onChange={(v) => updatePackageField(code, 'isActive', v)} />
                                </Form.Item>
                              </div>
                              <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>Commission Rates (%)</Typography.Title>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <Form.Item label="Direct (%)" style={{ width: 120, marginBottom: 8 }}>
                                  <InputNumber style={{ width: '100%' }} min={0} max={100} value={edit.directCommissionRate} onChange={(v) => updatePackageField(code, 'directCommissionRate', v ?? 0)} />
                                </Form.Item>
                                <Form.Item label="Group (%)" style={{ width: 120, marginBottom: 8 }}>
                                  <InputNumber style={{ width: '100%' }} min={0} max={100} value={edit.groupCommissionRate} onChange={(v) => updatePackageField(code, 'groupCommissionRate', v ?? 0)} />
                                </Form.Item>
                                <Form.Item label="Min Branch Sales ($)" tooltip="Doanh thu tối thiểu mỗi nhánh để nhận hoa hồng nhóm" style={{ width: 160, marginBottom: 8 }}>
                                  <InputNumber style={{ width: '100%' }} min={0} value={edit.groupCommissionMinSales} onChange={(v) => updatePackageField(code, 'groupCommissionMinSales', v ?? 0)} />
                                </Form.Item>
                              </div>
                              <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>Management Commission (%)</Typography.Title>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <Form.Item label="F1 (%)" style={{ width: 100, marginBottom: 8 }}>
                                  <InputNumber style={{ width: '100%' }} min={0} max={100} value={edit.managementRateF1} onChange={(v) => updatePackageField(code, 'managementRateF1', v ?? 0)} />
                                </Form.Item>
                                <Form.Item label="F2 (%)" style={{ width: 100, marginBottom: 8 }}>
                                  <InputNumber style={{ width: '100%' }} min={0} max={100} value={edit.managementRateF2 ?? undefined} onChange={(v) => updatePackageField(code, 'managementRateF2', v ?? null)} />
                                </Form.Item>
                                <Form.Item label="F3 (%)" style={{ width: 100, marginBottom: 8 }}>
                                  <InputNumber style={{ width: '100%' }} min={0} max={100} value={edit.managementRateF3 ?? undefined} onChange={(v) => updatePackageField(code, 'managementRateF3', v ?? null)} />
                                </Form.Item>
                              </div>
                              <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>Reconsumption</Typography.Title>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <Form.Item label="Threshold ($)" tooltip="Tổng hoa hồng tối đa trước khi reset" style={{ width: 140, marginBottom: 8 }}>
                                  <InputNumber style={{ width: '100%' }} min={0} value={edit.reconsumptionThreshold} onChange={(v) => updatePackageField(code, 'reconsumptionThreshold', v ?? 0)} />
                                </Form.Item>
                                <Form.Item label="Required ($)" tooltip="Số tiền cần mua lại để kích hoạt lại gói" style={{ width: 140, marginBottom: 8 }}>
                                  <InputNumber style={{ width: '100%' }} min={0} value={edit.reconsumptionRequired} onChange={(v) => updatePackageField(code, 'reconsumptionRequired', v ?? 0)} />
                                </Form.Item>
                              </div>
                              <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>Hoa hồng sản phẩm (%)</Typography.Title>
                              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                                % hoa hồng cho người giới thiệu khi khách có gói {code} mua sản phẩm này. (Lưu cùng form sản phẩm.)
                              </Typography.Text>
                              <Form.Item name={fieldName} label={`${code} (%)`} rules={[{ type: 'number', min: 0, max: 100 }]} style={{ marginBottom: 0, maxWidth: 120 }}>
                                <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.5} placeholder="0" />
                              </Form.Item>
                            </Card>
                          );
                        })}
                      </div>
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
                        <Input placeholder="e.g. Shopii" />
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
              name="featuredOnHome"
              label="Featured on home"
              valuePropName="checked"
              tooltip="Show this product in the home page image strip (under the title)"
            >
              <Switch checkedChildren="Yes" unCheckedChildren="No" />
            </Form.Item>
            <Form.Item
              name="salePercentage"
              label="Sale Percentage (%)"
              rules={[{ type: 'number', min: 0, max: 100 }]}
              tooltip="Optional discount percentage (0-100) to apply. E.g., 20 means 20% off."
            >
              <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="e.g. 20" />
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

            <Typography.Title level={5} style={{ marginTop: 16 }}>Product Combos</Typography.Title>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Define bundle options users can choose (e.g. buy 3 for $25). Leave empty if not applicable.
            </Typography.Text>
            <Form.List name="combos">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8, flexWrap: 'wrap' }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'quantity']}
                        label="Qty"
                        rules={[{ required: true, message: 'Required' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber min={2} placeholder="e.g. 3" style={{ width: 80 }} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'price']}
                        label="Combo Price"
                        rules={[{ required: true, message: 'Required' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber min={0} step={0.01} precision={4} placeholder="e.g. 25.00" style={{ width: 130 }} />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'label']}
                        label="Label (optional)"
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="e.g. Mua 3 giảm còn $25" style={{ width: 220 }} />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Add Combo
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

