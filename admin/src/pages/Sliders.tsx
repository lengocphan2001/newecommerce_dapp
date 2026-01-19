import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Image,
  Upload,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { sliderService, Slider } from '../services/sliderService';
import type { UploadFile } from 'antd/es/upload/interface';

const Sliders: React.FC = () => {
  const [sliders, setSliders] = useState<Slider[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSlider, setEditingSlider] = useState<Slider | null>(null);
  const [form] = Form.useForm();
  const [imageFileList, setImageFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    fetchSliders();
  }, []);

  const fetchSliders = async () => {
    setLoading(true);
    try {
      const response = await sliderService.getAll();
      setSliders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch sliders');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSlider(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, order: 0 });
    setImageFileList([]);
    setIsModalVisible(true);
  };

  const handleEdit = (slider: Slider) => {
    setEditingSlider(slider);
    form.setFieldsValue({
      ...slider,
    });
    setImageFileList([]);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await sliderService.delete(id);
      message.success('Slider deleted successfully');
      fetchSliders();
    } catch (error) {
      message.error('Failed to delete slider');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      // Upload image (if user selected a file)
      let imageUrl: string | undefined = editingSlider?.imageUrl;
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
      } else if (!editingSlider) {
        message.error('Please upload an image');
        return;
      }

      if (editingSlider) {
        await sliderService.update(editingSlider.id, payload);
        message.success('Slider updated successfully');
      } else {
        await sliderService.create(payload);
        message.success('Slider created successfully');
      }
      setIsModalVisible(false);
      fetchSliders();
    } catch (error) {
      message.error('Failed to save slider');
    }
  };

  const columns = [
    {
      title: 'Order',
      dataIndex: 'order',
      key: 'order',
      width: 80,
      sorter: (a: Slider, b: Slider) => a.order - b.order,
    },
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 120,
      render: (url: string) =>
        url ? (
          <Image
            src={url}
            width={80}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 6 }}
            preview={false}
            fallback="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
          />
        ) : (
          '-'
        ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
      responsive: ['lg'] as any,
      render: (text?: string) => {
        if (!text) return '-';
        const maxLength = 50;
        if (text.length <= maxLength) return text;
        return `${text.substring(0, maxLength)}...`;
      },
    },
    {
      title: 'Link URL',
      dataIndex: 'linkUrl',
      key: 'linkUrl',
      width: 200,
      ellipsis: true,
      responsive: ['lg'] as any,
      render: (url?: string) => url || '-',
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) => (isActive ? 'Yes' : 'No'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right' as any,
      render: (_: any, record: Slider) => (
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
            title="Are you sure to delete this slider?"
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
        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 24px)' }}>Sliders Management</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Add Slider
        </Button>
      </div>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <Table
          columns={columns}
          dataSource={sliders}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </div>
      <Modal
        title={editingSlider ? 'Edit Slider' : 'Create Slider'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width="90%"
        style={{ maxWidth: 700 }}
        destroyOnHidden
      >
        {isModalVisible && (
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="imageUrl"
              label="Image"
              rules={[{ required: !editingSlider, message: 'Please upload an image' }]}
            >
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
              {editingSlider?.imageUrl ? (
                <div style={{ marginTop: 8 }}>
                  <Image
                    src={editingSlider.imageUrl}
                    width={200}
                    height={120}
                    style={{ objectFit: 'cover', borderRadius: 6 }}
                    preview={false}
                  />
                  <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                    Current image
                  </Typography.Text>
                </div>
              ) : null}
            </Form.Item>
            <Form.Item
              name="title"
              label="Title"
              rules={[]}
            >
              <Input placeholder="Slider title (optional)" />
            </Form.Item>
            <Form.Item
              name="description"
              label="Description"
              rules={[]}
            >
              <Input.TextArea rows={3} placeholder="Slider description (optional)" />
            </Form.Item>
            <Form.Item
              name="linkUrl"
              label="Link URL"
              rules={[]}
            >
              <Input placeholder="https://example.com (optional)" />
            </Form.Item>
            <Form.Item
              name="order"
              label="Order"
              rules={[{ type: 'number', min: 0 }]}
              initialValue={0}
            >
              <InputNumber style={{ width: '100%' }} min={0} placeholder="Display order" />
            </Form.Item>
            <Form.Item
              name="isActive"
              label="Active"
              valuePropName="checked"
              initialValue={true}
            >
              <Switch />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Sliders;
