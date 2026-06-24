import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Form, Input, Space, Popconfirm,
  notification, Typography, Modal,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;

interface ProductType {
  code: string;
  name: string;
  nameEn: string;
}

const ProductTypes: React.FC = () => {
  const [types, setTypes]     = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form]                = Form.useForm();
  const [editModal, setEditModal] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/product-types');
      setTypes(res.data);
    } catch (e: any) {
      notification.error({ message: 'Lỗi tải danh sách', description: e?.response?.data?.message });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const save = async (list: ProductType[]) => {
    setSaving(true);
    try {
      const res = await api.put('/admin/product-types', list);
      setTypes(res.data);
      notification.success({ message: 'Lưu thành công' });
    } catch (e: any) {
      notification.error({ message: 'Lưu thất bại', description: e?.response?.data?.message });
    } finally { setSaving(false); }
  };

  const openAdd = () => { form.resetFields(); setEditIdx(null); setEditModal(true); };
  const openEdit = (idx: number) => {
    form.setFieldsValue(types[idx]);
    setEditIdx(idx);
    setEditModal(true);
  };

  const handleSubmit = async (values: ProductType) => {
    const code = values.code.toUpperCase().replace(/\s+/g, '_');
    const updated = [...types];
    if (editIdx !== null) {
      updated[editIdx] = { ...values, code };
    } else {
      if (updated.some(t => t.code === code)) {
        notification.error({ message: `Mã "${code}" đã tồn tại` });
        return;
      }
      updated.push({ ...values, code });
    }
    await save(updated);
    setEditModal(false);
  };

  const handleDelete = async (idx: number) => {
    const updated = types.filter((_, i) => i !== idx);
    await save(updated);
  };

  const columns = [
    {
      title: 'Mã (CODE)',
      dataIndex: 'code',
      key: 'code',
      render: (v: string) => <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{v}</code>,
    },
    { title: 'Tên (Tiếng Việt)', dataIndex: 'name',   key: 'name'   },
    { title: 'Tên (English)',    dataIndex: 'nameEn', key: 'nameEn' },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_: any, __: any, idx: number) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(idx)}>Sửa</Button>
          <Popconfirm title="Xoá loại sản phẩm này?" onConfirm={() => handleDelete(idx)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Phân loại sản phẩm</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
        Quản lý các loại sản phẩm dùng trong lọc tìm kiếm ở màn hình chính.
        Mã CODE sẽ được dùng làm giá trị filter (ví dụ: STRATEGIC, COMMON, HEALTH, BEAUTY…).
      </Text>

      <Card
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Thêm loại mới
          </Button>
        }
      >
        <Table
          dataSource={types}
          columns={columns}
          rowKey="code"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>

      <Modal
        title={editIdx !== null ? 'Sửa loại sản phẩm' : 'Thêm loại sản phẩm'}
        open={editModal}
        onCancel={() => setEditModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 8 }}>
          <Form.Item
            name="code"
            label="Mã CODE"
            rules={[{ required: true, message: 'Bắt buộc' }, { pattern: /^[A-Za-z0-9_]+$/, message: 'Chỉ dùng chữ, số, gạch dưới' }]}
            tooltip="Sẽ tự động chuyển thành IN HOA. Ví dụ: STRATEGIC, HEALTH, BEAUTY"
          >
            <Input placeholder="VD: HEALTH" disabled={editIdx !== null} />
          </Form.Item>
          <Form.Item name="name"   label="Tên (Tiếng Việt)" rules={[{ required: true }]}>
            <Input placeholder="VD: Sức khoẻ" />
          </Form.Item>
          <Form.Item name="nameEn" label="Tên (English)"    rules={[{ required: true }]}>
            <Input placeholder="VD: Health" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} block>
            {editIdx !== null ? 'Lưu thay đổi' : 'Thêm'}
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductTypes;
