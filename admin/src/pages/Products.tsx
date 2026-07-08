import React, { useEffect, useState, useCallback } from 'react';
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
  Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, UpCircleOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Editor } from '@tinymce/tinymce-react';
import { productService, Product } from '../services/productService';
import { categoryService, Category } from '../services/categoryService';
import { packagesService, Package } from '../services/packagesService';
import type { UploadFile } from 'antd/es/upload/interface';

import api from '../services/api';

const availableTags = ['SALE', 'COMING_SOON', 'HOT', 'NEW', 'SOLD_OUT'];
const { Title } = Typography;

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchText, setSearchText] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [productTypeOptions, setProductTypeOptions] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();
  const [thumbnailFileList, setThumbnailFileList] = useState<UploadFile[]>([]);
  const [detailFileList, setDetailFileList] = useState<UploadFile[]>([]);
  const [currentDetailImageUrls, setCurrentDetailImageUrls] = useState<string[]>([]);
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState<string | undefined>(undefined);
  const [packages, setPackages] = useState<Package[]>([]);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    api.get('/admin/product-types').then(res => {
      setProductTypeOptions(Array.isArray(res.data) ? res.data : []);
    }).catch(() => {
      setProductTypeOptions([
        { code: 'STRATEGIC', name: 'Chiến lược' },
        { code: 'COMMON',    name: 'Tiêu dùng'  },
      ]);
    });
  }, []);

  const fetchPackages = useCallback(async () => {
    try {
      const data = await packagesService.getAll();
      setPackages(data || []);
    } catch {
      setPackages([]);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

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
      const data = Array.isArray(response.data) ? response.data : [];
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      message.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredProducts(products);
    } else {
      const q = searchText.trim().toLowerCase();
      const filtered = products.filter((p) => {
        return (
          p.name?.toLowerCase().includes(q) ||
          p.id?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q)) ||
          p.categoryId?.toLowerCase().includes(q)
        );
      });
      setFilteredProducts(filtered);
    }
  }, [products, searchText]);

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

  const handleImportCsv = async (file: File) => {
    try {
      const res = await productService.importCsv(file);
      const data = res.data as any;
      const failed = Array.isArray(data?.failed) ? data.failed : [];
      const summary = `Imported: total=${data?.total ?? 0}, created=${data?.created ?? 0}, updated=${data?.updated ?? 0}, failed=${failed.length}`;

      if (failed.length) {
        Modal.info({
          title: 'Import finished with errors',
          width: 800,
          content: (
            <div>
              <div style={{ marginBottom: 12 }}>{summary}</div>
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {failed
                    .slice(0, 200)
                    .map((f: any) => `Row ${f.rowNumber}: ${f.name ?? ''} ${f.id ? `(${f.id})` : ''} -> ${f.error}`)
                    .join('\n')}
                  {failed.length > 200 ? `\n...and ${failed.length - 200} more` : ''}
                </pre>
              </div>
            </div>
          ),
        });
        message.warning(summary);
      } else {
        message.success(summary);
      }

      await fetchProducts();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to import CSV';
      message.error(msg);
    }
  };

  const handleCreate = () => {
    setEditingProduct(null);
    form.resetFields();
    const defaultCommissionByPackage: Record<string, Record<string, number | null>> = {};
    packages.forEach((p) => {
      defaultCommissionByPackage[p.code] = {
        directCommissionRate: (p.directCommissionRate ?? 0) * 100,
        groupCommissionRate: (p.groupCommissionRate ?? 0) * 100,
        groupCommissionMinSales: p.groupCommissionMinSales ?? 0,
        managementRateF1: (p.managementRateF1 ?? 0) * 100,
        managementRateF2: p.managementRateF2 != null ? p.managementRateF2 * 100 : null,
        managementRateF3: p.managementRateF3 != null ? p.managementRateF3 * 100 : null,
        managementMinSales: p.managementMinSales ?? 0,
        reconsumptionThreshold: p.reconsumptionThreshold ?? 0,
        reconsumptionRequired: p.reconsumptionRequired ?? 0,
      };
    });
    form.setFieldsValue({
      description: '',
      descriptionEn: '',
      useProductCommission: false,
      indirectCommissionRateF2: 0,
      isPromisingProduct: false,
      ...(Object.keys(defaultCommissionByPackage).length ? { commissionConfigByPackage: defaultCommissionByPackage } : {}),
    });
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
      commissionPercentGroupTV: product.commissionPercentGroupTV ?? undefined,
      commissionPercentGroupCTV: product.commissionPercentGroupCTV ?? undefined,
      commissionPercentGroupNPP: product.commissionPercentGroupNPP ?? undefined,
      commissionPercentManagementTV: product.commissionPercentManagementTV ?? undefined,
      commissionPercentManagementCTV: product.commissionPercentManagementCTV ?? undefined,
      commissionPercentManagementNPP: product.commissionPercentManagementNPP ?? undefined,
      useProductCommission: product.useProductCommission === true,
      indirectCommissionRateF2: product.indirectCommissionRateF2 ?? 0,
      isPromisingProduct: (product as any).isPromisingProduct === true,
      featuredOnHome: product.featuredOnHome ?? false,
      groupCommissionMinSales: product.groupCommissionMinSales ?? undefined,
      managementRateF1: product.managementRateF1 ?? undefined,
      managementRateF2: product.managementRateF2 ?? undefined,
      managementRateF3: product.managementRateF3 ?? undefined,
      managementMinSales: product.managementMinSales ?? undefined,
      reconsumptionThreshold: product.reconsumptionThreshold ?? undefined,
      reconsumptionRequired: product.reconsumptionRequired ?? undefined,
      commissionConfigByPackage: (() => {
        const raw = product.commissionConfigByPackage;
        const out: Record<string, Record<string, number | null>> = {};
        const push = (code: string, c: any) => {
          out[code] = {
            directCommissionRate: c?.directCommissionRate != null ? Number(c.directCommissionRate) * 100 : 0,
            groupCommissionRate: c?.groupCommissionRate != null ? Number(c.groupCommissionRate) * 100 : 0,
            groupCommissionMinSales: c?.groupCommissionMinSales ?? 0,
            managementRateF1: c?.managementRateF1 != null ? Number(c.managementRateF1) * 100 : 0,
            managementRateF2: c?.managementRateF2 != null ? Number(c.managementRateF2) * 100 : null,
            managementRateF3: c?.managementRateF3 != null ? Number(c.managementRateF3) * 100 : null,
            managementMinSales: c?.managementMinSales ?? 0,
            reconsumptionThreshold: c?.reconsumptionThreshold ?? 0,
            reconsumptionRequired: c?.reconsumptionRequired ?? 0,
          };
        };
        if (raw && typeof raw === 'object') {
          for (const [code, c] of Object.entries(raw)) {
            if (c && typeof c === 'object') push(code, c);
          }
        }
        packages.forEach((p) => {
          if (!out[p.code]) {
            out[p.code] = {
              directCommissionRate: (p.directCommissionRate ?? 0) * 100,
              groupCommissionRate: (p.groupCommissionRate ?? 0) * 100,
              groupCommissionMinSales: p.groupCommissionMinSales ?? 0,
              managementRateF1: (p.managementRateF1 ?? 0) * 100,
              managementRateF2: p.managementRateF2 != null ? p.managementRateF2 * 100 : null,
              managementRateF3: p.managementRateF3 != null ? p.managementRateF3 * 100 : null,
              managementMinSales: p.managementMinSales ?? 0,
              reconsumptionThreshold: p.reconsumptionThreshold ?? 0,
              reconsumptionRequired: p.reconsumptionRequired ?? 0,
            };
          }
        });
        return Object.keys(out).length ? out : undefined;
      })(),
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

      // Convert commissionConfigByPackage: form stores rates 0–100, API expects 0–1 (giống package)
      let commissionConfigByPackage = values.commissionConfigByPackage;
      if (commissionConfigByPackage && typeof commissionConfigByPackage === 'object') {
        const converted: Record<string, any> = {};
        type ConfigEntry = {
          directCommissionRate?: number;
          groupCommissionRate?: number;
          groupCommissionMinSales?: number;
          managementRateF1?: number;
          managementRateF2?: number | null;
          managementRateF3?: number | null;
          managementMinSales?: number;
          reconsumptionThreshold?: number;
          reconsumptionRequired?: number;
        };
        for (const [code, c] of Object.entries(commissionConfigByPackage) as [string, ConfigEntry][]) {
          if (!c || typeof c !== 'object') continue;
          converted[code] = {
            directCommissionRate: c.directCommissionRate != null ? Number(c.directCommissionRate) / 100 : 0,
            groupCommissionRate: c.groupCommissionRate != null ? Number(c.groupCommissionRate) / 100 : 0,
            groupCommissionMinSales: c.groupCommissionMinSales ?? 0,
            managementRateF1: c.managementRateF1 != null ? Number(c.managementRateF1) / 100 : 0,
            managementRateF2: c.managementRateF2 != null ? Number(c.managementRateF2) / 100 : null,
            managementRateF3: c.managementRateF3 != null ? Number(c.managementRateF3) / 100 : null,
            managementMinSales: c.managementMinSales ?? 0,
            reconsumptionThreshold: c.reconsumptionThreshold ?? 0,
            reconsumptionRequired: c.reconsumptionRequired ?? 0,
          };
        }
        commissionConfigByPackage = Object.keys(converted).length ? converted : undefined;
      }

      const payload: any = {
        ...values,
        thumbnailUrl: thumbnailUrl || null,
        detailImageUrls: detailImageUrls,
        ...(commissionConfigByPackage !== undefined ? { commissionConfigByPackage } : {}),
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
      render: (text: string, record: Product) => (
        <Space>
          <span>{text}</span>
          {(record as any).isPromisingProduct && <Tag color="purple">Triển vọng</Tag>}
        </Space>
      ),
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
        <Space wrap>
          <Input.Search
            placeholder="Search products..."
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
          <Upload
            accept=".csv,text/csv"
            showUploadList={false}
            beforeUpload={(file) => {
              handleImportCsv(file as any);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>Import CSV</Button>
          </Upload>
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
          dataSource={filteredProducts}
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
            {editingProduct && (
              <Form.Item label="Đường dẫn chia sẻ (Copy gửi cho khách mua không cần đăng nhập)">
                <Input
                  value={`${process.env.REACT_APP_FRONTEND_URL || window.location.origin.replace(':3001', ':3000')}/home/products/detail?id=${editingProduct.id}`}
                  readOnly
                  addonAfter={
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        const link = `${process.env.REACT_APP_FRONTEND_URL || window.location.origin.replace(':3001', ':3000')}/home/products/detail?id=${editingProduct.id}`;
                        navigator.clipboard.writeText(link);
                        message.success('Đã copy đường dẫn chia sẻ thành công!');
                      }}
                      style={{ padding: 0, height: 'auto' }}
                    >
                      Copy
                    </Button>
                  }
                />
              </Form.Item>
            )}
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
                          apiKey='edoe8bnux7xs8gkefbmty7k5fg2sgpl1207v0tpnc2vl6qzh'
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
                        <Input placeholder="VD: Shoplife" />
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
                  key: 'general',
                  label: 'Thông tin chung',
                  children: (
                    <>
                      <Form.Item label="Thumbnail">
                        <Upload
                          accept="image/*"
                          listType="picture"
                          maxCount={1}
                          fileList={thumbnailFileList}
                          beforeUpload={() => false}
                          onChange={({ fileList }) => setThumbnailFileList(fileList)}
                        >
                          <Button>Chọn ảnh đại diện</Button>
                        </Upload>
                        {currentThumbnailUrl && (
                          <div style={{ marginTop: 16 }}>
                            <Typography.Text strong>Ảnh hiện tại:</Typography.Text>
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
                                style={{ position: 'absolute', top: -8, right: -8, fontSize: 10, width: 20, height: 20, minWidth: 20 }}
                                onClick={handleRemoveThumbnail}
                              />
                            </div>
                          </div>
                        )}
                      </Form.Item>
                      <Form.Item label="Ảnh chi tiết">
                        <Upload
                          accept="image/*"
                          listType="picture"
                          multiple
                          fileList={detailFileList}
                          beforeUpload={() => false}
                          onChange={({ fileList }) => setDetailFileList(fileList)}
                        >
                          <Button>Chọn ảnh chi tiết</Button>
                        </Upload>
                        {currentDetailImageUrls.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <Typography.Text strong>Ảnh hiện có:</Typography.Text>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                              {currentDetailImageUrls.map((url, index) => (
                                <div key={index} style={{ position: 'relative', border: '1px solid #d9d9d9', borderRadius: 4, padding: 4 }}>
                                  <Image src={url} width={60} height={60} style={{ objectFit: 'cover' }} />
                                  <Button
                                    type="primary"
                                    danger
                                    shape="circle"
                                    icon={<DeleteOutlined />}
                                    size="small"
                                    style={{ position: 'absolute', top: -8, right: -8, fontSize: 10, width: 20, height: 20, minWidth: 20 }}
                                    onClick={() => handleRemoveDetailImage(url)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Form.Item>
                      <Form.Item name="price" label="Giá" rules={[{ required: true, type: 'number', min: 0 }]}>
                        <InputNumber style={{ width: '100%' }} min={0} />
                      </Form.Item>
                      <Form.Item name="stock" label="Tồn kho" rules={[{ type: 'number', min: 0 }]}>
                        <InputNumber style={{ width: '100%' }} min={0} />
                      </Form.Item>
                      <Form.Item name="shippingFee" label="Phí ship (USDT)" rules={[{ type: 'number', min: 0 }]} tooltip="Phí vận chuyển sản phẩm (USDT)">
                        <InputNumber style={{ width: '100%' }} min={0} step={0.000001} precision={6} />
                      </Form.Item>
                      <Form.Item name="fakeSold" label="Số lượng bán hiển thị (giả)" rules={[{ type: 'number', min: 0 }]} tooltip="Hiển thị số này thay cho số bán thật (để trống = hiển thị thật)">
                        <InputNumber style={{ width: '100%' }} min={0} placeholder="Tùy chọn" />
                      </Form.Item>
                       <Form.Item name="featuredOnHome" label="Nổi bật trang chủ" valuePropName="checked" tooltip="Hiển thị trong dải ảnh trang chủ">
                        <Switch checkedChildren="Có" unCheckedChildren="Không" />
                      </Form.Item>
                      <Form.Item name="isPromisingProduct" label="Sản phẩm triển vọng" valuePropName="checked" tooltip="Bật = Sản phẩm triển vọng được áp dụng cơ chế đồng chia và hàng đợi quỹ đặc biệt">
                        <Switch checkedChildren="Có" unCheckedChildren="Không" />
                      </Form.Item>
                      <Form.Item name="salePercentage" label="Giảm giá (%)" rules={[{ type: 'number', min: 0, max: 100 }]} tooltip="VD: 20 = giảm 20%">
                        <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="VD: 20" />
                      </Form.Item>
                      <Form.Item name="categoryId" label="Danh mục" rules={[]}>
                        <Select style={{ width: '100%' }} placeholder="Chọn danh mục" allowClear>
                          {categories.map((cat) => (
                            <Select.Option key={cat.id} value={cat.id}>
                              {cat.parent ? `${cat.parent.name} › ${cat.name}` : cat.name}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item name="countries" label="Quốc gia" rules={[{ required: true, message: 'Chọn ít nhất một quốc gia' }]} initialValue={['VIETNAM']}>
                        <Select mode="multiple" style={{ width: '100%' }} placeholder="Chọn quốc gia">
                          <Select.Option value="VIETNAM">Vietnam</Select.Option>
                          <Select.Option value="USA">USA</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item name="productTypes" label="Phân loại sản phẩm (Tùy chọn)" rules={[]} initialValue={[]}>
                        <Select mode="multiple" style={{ width: '100%' }} placeholder="Chọn loại sản phẩm">
                          {productTypeOptions.map(pt => (
                            <Select.Option key={pt.code} value={pt.code}>{pt.name}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item name="tags" label="Tags" rules={[]} initialValue={[]}>
                        <Select mode="tags" style={{ width: '100%' }} placeholder="VD: SALE, HOT, NEW" tokenSeparators={[',']}>
                          {availableTags.map((tag) => (
                            <Select.Option key={tag} value={tag}>{tag}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Typography.Title level={5}>Thuộc tính (Color, Size...)</Typography.Title>
                      <Form.List name="properties">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(({ key, name, ...restField }) => (
                              <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                <Form.Item {...restField} name={[name, 'name']} rules={[{ required: true, message: 'Nhập tên thuộc tính' }]}>
                                  <Input placeholder="VD: Màu sắc" />
                                </Form.Item>
                                <Form.Item {...restField} name={[name, 'values']} rules={[{ required: true, message: 'Nhập giá trị' }]}>
                                  <Select mode="tags" style={{ width: 200 }} placeholder="VD: Đỏ, Xanh" tokenSeparators={[',']} open={false} />
                                </Form.Item>
                                <MinusCircleOutlined onClick={() => remove(name)} />
                              </Space>
                            ))}
                            <Form.Item>
                              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Thêm thuộc tính</Button>
                            </Form.Item>
                          </>
                        )}
                      </Form.List>
                      <Typography.Title level={5} style={{ marginTop: 16 }}>Combo (gói giá)</Typography.Title>
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        VD: mua 3 còn 25$. Để trống nếu không dùng.
                      </Typography.Text>
                      <Form.List name="combos">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(({ key, name, ...restField }) => (
                              <Space key={key} style={{ display: 'flex', marginBottom: 8, flexWrap: 'wrap' }} align="baseline">
                                <Form.Item {...restField} name={[name, 'quantity']} label="SL" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                  <InputNumber min={2} placeholder="3" style={{ width: 80 }} />
                                </Form.Item>
                                <Form.Item {...restField} name={[name, 'price']} label="Giá combo" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                  <InputNumber min={0} step={0.01} precision={4} placeholder="25" style={{ width: 130 }} />
                                </Form.Item>
                                <Form.Item {...restField} name={[name, 'label']} label="Nhãn (tùy chọn)" style={{ marginBottom: 0 }}>
                                  <Input placeholder="Mua 3 giảm còn $25" style={{ width: 220 }} />
                                </Form.Item>
                                <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
                              </Space>
                            ))}
                            <Form.Item>
                              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Thêm combo</Button>
                            </Form.Item>
                          </>
                        )}
                      </Form.List>
                    </>
                  ),
                },
                {
                  key: 'commission',
                  label: 'Hoa hồng sản phẩm',
                  children: (
                    <>
                      <Form.Item
                        name="useProductCommission"
                        label="Loại hoa hồng"
                        valuePropName="checked"
                        tooltip="Bật = hoa hồng theo cấu hình từng gói bên dưới (form giống Edit Package). Tắt = dùng hoa hồng theo gói của đơn hàng."
                        style={{ marginBottom: 16 }}
                      >
                        <Switch
                          checkedChildren="Hoa hồng sản phẩm"
                          unCheckedChildren="Hoa hồng gói (package)"
                        />
                      </Form.Item>
                      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.useProductCommission !== cur.useProductCommission}>
                        {({ getFieldValue }) =>
                          getFieldValue('useProductCommission') === false ? (
                            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                              Sản phẩm này dùng hoa hồng theo gói (package): direct/group/management tính theo đơn hàng và gói của người mua. Các cấu hình bên dưới không áp dụng.
                            </Typography.Text>
                          ) : (
                            <>
                              <Form.Item
                                name="indirectCommissionRateF2"
                                label="Tỉ lệ hoa hồng gián tiếp F2 cho sản phẩm (%)"
                                tooltip="Khi khách mua sản phẩm này và bật Hoa hồng sản phẩm, người giới thiệu F2 sẽ nhận tỉ lệ phần trăm này từ giá trị đơn (dưới dạng hoa hồng gián tiếp). Nếu không nhập hoặc bằng 0, F2 sẽ không nhận hoa hồng cho sản phẩm này."
                                style={{ marginBottom: 16 }}
                              >
                                <InputNumber style={{ width: '240px' }} min={0} max={100} placeholder="0" suffix="%" />
                              </Form.Item>
                              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                                Cấu hình hoa hồng theo từng gói – cùng form như trang Package. Chỉ chỉnh các gói có trong hệ thống.
                              </Typography.Text>
                              {packages.length === 0 ? (
                                <Typography.Text type="secondary">Chưa có gói nào. Vào trang Package để tạo gói (TV, CTV, NPP...).</Typography.Text>
                              ) : (
                                packages.map((pkg) => (
                                  <Card key={pkg.id} title={`${pkg.name} (${pkg.code})`} size="small" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ marginTop: 0 }}>Commission Rates (%)</Title>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                      <Form.Item name={['commissionConfigByPackage', pkg.code, 'directCommissionRate']} label="Direct (%)" style={{ flex: 1, minWidth: 120 }}>
                                        <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="0" />
                                      </Form.Item>
                                      <Form.Item name={['commissionConfigByPackage', pkg.code, 'groupCommissionRate']} label="Group (%)" style={{ flex: 1, minWidth: 120 }}>
                                        <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="0" />
                                      </Form.Item>
                                      <Form.Item name={['commissionConfigByPackage', pkg.code, 'groupCommissionMinSales']} label="Min Branch Sales ($)" tooltip="Minimum cumulative sales required on EACH branch before group commission is paid" style={{ flex: 1, minWidth: 160 }}>
                                        <InputNumber style={{ width: '100%' }} min={0} step={100} precision={2} placeholder="0" />
                                      </Form.Item>
                                    </div>
                                    <Title level={5} style={{ marginTop: 16 }}>Management Commission (%)</Title>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                      <Form.Item name={['commissionConfigByPackage', pkg.code, 'managementRateF1']} label="F1 (%)" style={{ flex: 1, minWidth: 100 }}>
                                        <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="0" />
                                      </Form.Item>
                                      <Form.Item name={['commissionConfigByPackage', pkg.code, 'managementRateF2']} label="F2 (%)" style={{ flex: 1, minWidth: 100 }}>
                                        <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="0" />
                                      </Form.Item>
                                      <Form.Item name={['commissionConfigByPackage', pkg.code, 'managementRateF3']} label="F3 (%)" style={{ flex: 1, minWidth: 100 }}>
                                        <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="0" />
                                      </Form.Item>
                                    </div>
                                    <Form.Item name={['commissionConfigByPackage', pkg.code, 'managementMinSales']} label="Management Min Sales ($)" tooltip="Mỗi nhánh (trái và phải) của F1/F2/F3 phải đạt doanh số tối thiểu này. 0 = không yêu cầu." style={{ maxWidth: 280 }}>
                                      <InputNumber style={{ width: '100%' }} min={0} step={100} precision={2} placeholder="0" />
                                    </Form.Item>
                                    <Title level={5} style={{ marginTop: 16 }}>Reconsumption</Title>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                      <Form.Item name={['commissionConfigByPackage', pkg.code, 'reconsumptionThreshold']} label="Threshold ($)" tooltip="Max commission before reset/re-purchase" style={{ flex: 1, minWidth: 140 }}>
                                        <InputNumber style={{ width: '100%' }} min={0} step={0.01} precision={2} placeholder="0" />
                                      </Form.Item>
                                      <Form.Item name={['commissionConfigByPackage', pkg.code, 'reconsumptionRequired']} label="Required Amount ($)" tooltip="Amount needed to purchase to restore package" style={{ flex: 1, minWidth: 140 }}>
                                        <InputNumber style={{ width: '100%' }} min={0} step={0.01} precision={2} placeholder="0" />
                                      </Form.Item>
                                    </div>
                                  </Card>
                                ))
                              )}
                            </>
                          )
                        }
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
                          apiKey='edoe8bnux7xs8gkefbmty7k5fg2sgpl1207v0tpnc2vl6qzh'
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
                        <Input placeholder="e.g. Shoplife" />
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
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Products;

