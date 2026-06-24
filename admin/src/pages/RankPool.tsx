import React, { useState, useEffect } from 'react';
import {
  Tabs, Table, Card, Button, Form, InputNumber, Input, Select,
  Tag, Space, Modal, Popconfirm, notification, Typography, Row, Col,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ReloadOutlined, DollarOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const RANKS = ['LEADER', 'MANAGER', 'DIRECTOR', 'DIAMOND'] as const;
type Rank = typeof RANKS[number];

const RANK_COLOR: Record<Rank, string> = {
  LEADER:   'blue',
  MANAGER:  'green',
  DIRECTOR: 'gold',
  DIAMOND:  'purple',
};

const RankPool: React.FC = () => {
  const [placements, setPlacements] = useState<any[]>([]);
  const [histories, setHistories]   = useState<any[]>([]);
  const [config, setConfig]         = useState<Record<string, number>>({});
  const [loading, setLoading]       = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [filterRank, setFilterRank] = useState<Rank | ''>('');

  const [addForm]    = Form.useForm();
  const [configForm] = Form.useForm();
  const [distForm]   = Form.useForm();
  const [rankForm]   = Form.useForm();

  const [addModal,  setAddModal]  = useState(false);
  const [distModal, setDistModal] = useState(false);
  const [rankModal, setRankModal] = useState(false);

  // ── fetch ─────────────────────────────────────────────────────────────────

  const fetchPlacements = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterRank) params.rank = filterRank;
      const res = await api.get('/admin/rank-pool/placements', { params });
      setPlacements(res.data);
    } catch (e: any) {
      notification.error({ message: 'Lỗi tải placements', description: e?.response?.data?.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistories = async () => {
    setHistLoading(true);
    try {
      const params: any = {};
      if (filterRank) params.rank = filterRank;
      const res = await api.get('/admin/rank-pool/histories', { params });
      setHistories(res.data);
    } catch { }
    finally { setHistLoading(false); }
  };

  const fetchConfig = async () => {
    try {
      const res = await api.get('/admin/rank-pool/config');
      setConfig(res.data);
      configForm.setFieldsValue(res.data);
    } catch { }
  };

  useEffect(() => { fetchPlacements(); fetchHistories(); fetchConfig(); }, [filterRank]);

  // ── actions ───────────────────────────────────────────────────────────────

  const handleAdd = async (values: any) => {
    try {
      await api.post('/admin/rank-pool/placements', values);
      notification.success({ message: 'Đã thêm user vào bể' });
      setAddModal(false);
      addForm.resetFields();
      fetchPlacements();
    } catch (e: any) {
      notification.error({ message: e?.response?.data?.message || 'Lỗi thêm user' });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await api.delete(`/admin/rank-pool/placements/${id}`);
      notification.success({ message: 'Đã xoá' });
      fetchPlacements();
    } catch (e: any) {
      notification.error({ message: e?.response?.data?.message || 'Lỗi xoá' });
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/admin/rank-pool/placements/${id}/toggle`);
      fetchPlacements();
    } catch (e: any) {
      notification.error({ message: e?.response?.data?.message || 'Lỗi toggle' });
    }
  };

  const handleSaveConfig = async (values: any) => {
    try {
      await api.patch('/admin/rank-pool/config', values);
      notification.success({ message: 'Lưu cấu hình thành công' });
      fetchConfig();
    } catch (e: any) {
      notification.error({ message: e?.response?.data?.message || 'Lỗi lưu config' });
    }
  };

  const handleDistribute = async (values: any) => {
    try {
      const res = await api.post('/admin/rank-pool/distribute', values);
      const d = res.data;
      notification.success({
        message: 'Chia thưởng thành công',
        description: `${d.recipients} thành viên nhận ${Number(d.perUser).toFixed(4)} PV / người. Tổng: ${Number(d.distributed).toFixed(4)} PV`,
        duration: 8,
      });
      setDistModal(false);
      distForm.resetFields();
      fetchHistories();
      fetchPlacements();
    } catch (e: any) {
      notification.error({ message: e?.response?.data?.message || 'Lỗi chia thưởng' });
    }
  };

  const handleSetRank = async (values: any) => {
    try {
      await api.patch(`/admin/rank-pool/users/${values.userId}/rank`, { rank: values.rank });
      notification.success({ message: `Đã set rank ${values.rank} cho user` });
      setRankModal(false);
      rankForm.resetFields();
    } catch (e: any) {
      notification.error({ message: e?.response?.data?.message || 'Lỗi set rank' });
    }
  };

  // ── columns ───────────────────────────────────────────────────────────────

  const placementColumns = [
    { title: 'Username', dataIndex: ['user', 'username'], key: 'username',
      render: (v: string, r: any) => <b>{v || r.user?.email || '—'}</b> },
    { title: 'Họ tên', dataIndex: ['user', 'fullName'], key: 'fullName' },
    { title: 'Rank', dataIndex: 'rank', key: 'rank',
      render: (v: Rank) => <Tag color={RANK_COLOR[v]}>{v}</Tag> },
    { title: 'Trạng thái', dataIndex: 'isActive', key: 'isActive',
      render: (v: boolean) => v ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag> },
    { title: 'Lũy kế nhận (PV)', dataIndex: 'totalRewarded', key: 'totalRewarded',
      render: (v: number) => Number(v).toFixed(4) },
    { title: 'Ghi chú', dataIndex: 'note', key: 'note',
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'Ngày thêm', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleDateString('vi-VN') },
    { title: 'Hành động', key: 'actions',
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" onClick={() => handleToggle(r.id)}>
            {r.isActive ? 'Tắt' : 'Bật'}
          </Button>
          <Popconfirm title="Xoá khỏi bể?" onConfirm={() => handleRemove(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ) },
  ];

  const historyColumns = [
    { title: 'Username', dataIndex: ['user', 'username'], key: 'username',
      render: (v: string, r: any) => v || r.user?.email || '—' },
    { title: 'Rank', dataIndex: 'rank', key: 'rank',
      render: (v: Rank) => <Tag color={RANK_COLOR[v]}>{v}</Tag> },
    { title: 'Số tiền (PV)', dataIndex: 'amount', key: 'amount',
      render: (v: number) => <b style={{ color: '#2563EB' }}>{Number(v).toFixed(4)}</b> },
    { title: 'Ghi chú', dataIndex: 'note', key: 'note',
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'Thời gian', dataIndex: 'createdAt', key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString('vi-VN') },
  ];

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Bể Rank (Leader / Manager / Director / Diamond)</Title>

      {/* Filter + actions */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            value={filterRank}
            onChange={setFilterRank}
            style={{ width: 180 }}
            allowClear
            placeholder="Lọc theo rank"
          >
            {RANKS.map(r => <Option key={r} value={r}>{r}</Option>)}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchPlacements(); fetchHistories(); }}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModal(true)}>
            Thêm user vào bể
          </Button>
          <Button icon={<DollarOutlined />} onClick={() => setDistModal(true)}>
            Chia thưởng
          </Button>
          <Button icon={<SettingOutlined />} onClick={() => setRankModal(true)}>
            Set Rank cho user
          </Button>
        </Space>
      </Card>

      <Tabs defaultActiveKey="placements">
        {/* ── Tab 1: Danh sách bể ─────────────────────────────────── */}
        <Tabs.TabPane tab="Thành viên trong bể" key="placements">
          <Card title={`${placements.length} thành viên${filterRank ? ` — ${filterRank}` : ''}`}>
            <Table
              dataSource={placements}
              columns={placementColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              scroll={{ x: 900 }}
              size="middle"
            />
          </Card>
        </Tabs.TabPane>

        {/* ── Tab 2: Lịch sử chia thưởng ─────────────────────────── */}
        <Tabs.TabPane tab="Lịch sử chia thưởng" key="histories">
          <Card>
            <Table
              dataSource={histories}
              columns={historyColumns}
              rowKey="id"
              loading={histLoading}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              scroll={{ x: 700 }}
              size="middle"
            />
          </Card>
        </Tabs.TabPane>

        {/* ── Tab 3: Cấu hình tỷ lệ chia ─────────────────────────── */}
        <Tabs.TabPane tab="Cấu hình tỷ lệ chia (%)" key="config">
          <Card title="Tỷ lệ % chia thưởng tự động (khi chạy phân phối)">
            <Form form={configForm} layout="vertical" onFinish={handleSaveConfig} style={{ maxWidth: 480 }}>
              {RANKS.map(r => (
                <Form.Item
                  key={r}
                  name={`RANK_POOL_PERCENT_${r}`}
                  label={<Tag color={RANK_COLOR[r]}>{r}</Tag>}
                  tooltip="% tỷ lệ chia — chỉ dùng làm gợi ý, phân phối thủ công nhập số tiền cụ thể"
                >
                  <InputNumber min={0} max={100} step={0.5} precision={2} addonAfter="%" style={{ width: 180 }} />
                </Form.Item>
              ))}
              <Button type="primary" htmlType="submit">Lưu cấu hình</Button>
            </Form>
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* ── Modal: Thêm user ──────────────────────────────────────── */}
      <Modal
        title="Thêm user vào bể Rank"
        open={addModal}
        onCancel={() => { setAddModal(false); addForm.resetFields(); }}
        footer={null}
      >
        <Form form={addForm} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="userId" label="User ID" rules={[{ required: true }]}>
            <Input placeholder="UUID của user" />
          </Form.Item>
          <Form.Item name="rank" label="Rank" rules={[{ required: true }]}>
            <Select placeholder="Chọn rank">
              {RANKS.map(r => <Option key={r} value={r}><Tag color={RANK_COLOR[r]}>{r}</Tag></Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="note" label="Ghi chú (tuỳ chọn)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Thêm vào bể</Button>
        </Form>
      </Modal>

      {/* ── Modal: Chia thưởng ───────────────────────────────────── */}
      <Modal
        title="Chia thưởng bể Rank"
        open={distModal}
        onCancel={() => { setDistModal(false); distForm.resetFields(); }}
        footer={null}
      >
        <Form form={distForm} layout="vertical" onFinish={handleDistribute}>
          <Form.Item name="rank" label="Bể Rank" rules={[{ required: true }]}>
            <Select placeholder="Chọn rank">
              {RANKS.map(r => <Option key={r} value={r}><Tag color={RANK_COLOR[r]}>{r}</Tag></Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="totalAmount" label="Tổng số tiền chia (PV)" rules={[{ required: true }]}>
            <InputNumber min={0.0001} precision={4} style={{ width: '100%' }} addonAfter="PV" />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input placeholder="VD: Chia thưởng tháng 6/2026" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block icon={<DollarOutlined />}>
            Xác nhận chia thưởng
          </Button>
        </Form>
      </Modal>

      {/* ── Modal: Set rank ────────────────────────────────────────── */}
      <Modal
        title="Set Rank cho User"
        open={rankModal}
        onCancel={() => { setRankModal(false); rankForm.resetFields(); }}
        footer={null}
      >
        <Form form={rankForm} layout="vertical" onFinish={handleSetRank}>
          <Form.Item name="userId" label="User ID" rules={[{ required: true }]}>
            <Input placeholder="UUID của user" />
          </Form.Item>
          <Form.Item name="rank" label="Rank" rules={[{ required: true }]}>
            <Select placeholder="Chọn rank">
              <Option value="NONE"><Tag>NONE</Tag></Option>
              {RANKS.map(r => <Option key={r} value={r}><Tag color={RANK_COLOR[r]}>{r}</Tag></Option>)}
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Lưu Rank</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default RankPool;
