import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Typography,
  Form,
  InputNumber,
  Button,
  notification,
  Space,
  Modal,
  Popconfirm,
  Tabs,
  Select,
  Row,
  Col,
  Tag,
  DatePicker,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { Title } = Typography;
const { Option } = Select;

const HeapReward: React.FC = () => {
  const { user } = useAuth();
  const isAdminAccount = Boolean(
    user?.isSuperAdmin || (user?.type === 'user' && user?.isAdmin)
  );

  const [loading, setLoading] = useState(false);
  const [promisingLoading, setPromisingLoading] = useState(false);
  const [placements, setPlacements] = useState<any[]>([]);
  const [promisingPlacements, setPromisingPlacements] = useState<any[]>([]);
  const [selectedPoolLevel, setSelectedPoolLevel] = useState<number | undefined>(undefined);
  const [selectedPromisingPoolLevel, setSelectedPromisingPoolLevel] = useState<number | undefined>(undefined);
  
  const [form] = Form.useForm();
  
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedPlacement, setSelectedPlacement] = useState<any>(null);
  const [isDetailPromising, setIsDetailPromising] = useState(false);
  const [placementHistories, setPlacementHistories] = useState<any[]>([]);
  const [syncDate, setSyncDate] = useState<Dayjs | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [rollbackPool, setRollbackPool] = useState<string>('all');
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const fetchPlacements = async (poolLevel?: number) => {
    try {
      setLoading(true);
      const url = `/admin/heap-reward/placements${poolLevel ? `?poolLevel=${poolLevel}` : ''}`;
      const res = await api.get(url);
      setPlacements(res.data);
    } catch (e) {
      notification.error({ message: 'Lỗi khi tải danh sách đồng chia' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPromisingPlacements = async (poolLevel?: number) => {
    try {
      setPromisingLoading(true);
      const url = `/admin/heap-reward/promising-placements${poolLevel ? `?poolLevel=${poolLevel}` : ''}`;
      const res = await api.get(url);
      setPromisingPlacements(res.data);
    } catch (e) {
      notification.error({ message: 'Lỗi khi tải hàng đợi sản phẩm triển vọng' });
    } finally {
      setPromisingLoading(false);
    }
  };

  const deletePlacement = async (id: string) => {
    try {
      setLoading(true);
      await api.delete(`/admin/heap-reward/placements/${id}`);
      notification.success({ message: 'Đã xoá vị trí đồng chia thành công' });
      fetchPlacements(selectedPoolLevel);
    } catch (e) {
      notification.error({ message: 'Lỗi khi xoá vị trí đồng chia' });
      setLoading(false);
    }
  };

  const deletePromisingPlacement = async (id: string) => {
    try {
      setPromisingLoading(true);
      await api.delete(`/admin/heap-reward/promising-placements/${id}`);
      notification.success({ message: 'Đã xoá vị trí hàng đợi thành công' });
      fetchPromisingPlacements(selectedPromisingPoolLevel);
    } catch (e) {
      notification.error({ message: 'Lỗi khi xoá vị trí hàng đợi' });
      setPromisingLoading(false);
    }
  };

  const showDetails = async (record: any, isPromising: boolean) => {
    setSelectedPlacement(record);
    setIsDetailPromising(isPromising);
    setDetailsModalVisible(true);
    try {
      setHistoryLoading(true);
      const path = isPromising ? 'promising-histories' : 'histories';
      const res = await api.get(`/admin/heap-reward/${path}?placementId=${record.id}`);
      setPlacementHistories(res.data);
    } catch (e) {
      notification.error({ message: 'Lỗi khi tải lịch sử chi trả' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/admin/system-config/all');
      const configArray = res.data;
      const getVal = (key: string, def: number) => {
        const item = configArray.find((c: any) => c.key === key);
        return item && item.value !== undefined ? Number(item.value) : def;
      };
      form.setFieldsValue({
        HEAP_POOL_PERCENT_100: getVal('HEAP_POOL_PERCENT_100', 5),
        HEAP_POOL_PERCENT_500: getVal('HEAP_POOL_PERCENT_500', 10),
        HEAP_POOL_PERCENT_3000: getVal('HEAP_POOL_PERCENT_3000', 10),
        HEAP_POOL_PERCENT_5000: getVal('HEAP_POOL_PERCENT_5000', 10),
        HEAP_MAX_PAYOUT_100: getVal('HEAP_MAX_PAYOUT_100', 200),
        HEAP_MAX_PAYOUT_500: getVal('HEAP_MAX_PAYOUT_500', 1000),
        HEAP_MAX_PAYOUT_3000: getVal('HEAP_MAX_PAYOUT_3000', 6000),
        HEAP_MAX_PAYOUT_5000: getVal('HEAP_MAX_PAYOUT_5000', 10000),
        PROMISING_POOL_PERCENT_3000: getVal('PROMISING_POOL_PERCENT_3000', 5),
        PROMISING_POOL_PERCENT_5000: getVal('PROMISING_POOL_PERCENT_5000', 10),
        PROMISING_MAX_PAYOUT_3000: getVal('PROMISING_MAX_PAYOUT_3000', 4000),
        PROMISING_MAX_PAYOUT_5000: getVal('PROMISING_MAX_PAYOUT_5000', 8000),
      });
    } catch (e) {
      notification.error({ message: 'Lỗi khi tải cấu hình hệ thống' });
    }
  };

  useEffect(() => {
    fetchPlacements(selectedPoolLevel);
    fetchPromisingPlacements(selectedPromisingPoolLevel);
    if (isAdminAccount) {
      fetchConfigs();
    }
  }, [isAdminAccount, selectedPoolLevel, selectedPromisingPoolLevel]);

  const onFinishConfig = async (values: any) => {
    try {
      setLoading(true);
      for (const [key, value] of Object.entries(values)) {
        await api.patch('/admin/system-config/single', { key, value: String(value) });
      }
      notification.success({ message: 'Cập nhật cấu hình thành công' });
      fetchConfigs();
    } catch (e) {
      notification.error({ message: 'Lỗi khi lưu cấu hình' });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOrders = async () => {
    if (!syncDate) {
      notification.warning({ message: 'Vui lòng chọn ngày bắt đầu để đồng bộ' });
      return;
    }

    Modal.confirm({
      title: 'Xác nhận đồng bộ đơn hàng cũ vào Bể đồng chia?',
      content: (
        <div>
          <p>Hệ thống sẽ quét tất cả các đơn hàng thành công từ ngày <b>{syncDate.format('DD/MM/YYYY')}</b> đến nay.</p>
          <p>Các đơn hàng hợp lệ chưa được xử lý sẽ được tính toán chia thưởng và đưa vào bể đồng chia tương ứng.</p>
          <p style={{ color: '#ff4d4f', marginTop: 16 }}>
            ⚠️ Thao tác này có thể cộng ví trực tiếp cho các thành viên và xếp hàng đợi mới!
          </p>
        </div>
      ),
      okText: 'Bắt đầu đồng bộ',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          setSyncLoading(true);
          const res = await api.post('/admin/heap-reward/sync', {
            fromDate: syncDate.toISOString(),
          });
          const data = res.data;
          
          notification.success({
            message: 'Đồng bộ hoàn tất',
            description: (
              <div>
                <p>Tổng số đơn quét thấy: <b>{data.scanned}</b></p>
                <p>Đã xử lý thành công: <b>{data.processed}</b></p>
                <p>Đơn hàng đã vào (bỏ qua): <b>{data.skipped}</b></p>
                {data.failed > 0 && (
                  <p style={{ color: '#ff4d4f' }}>
                    Số đơn lỗi: <b>{data.failed}</b> (IDs: {data.failedOrderIds.join(', ')})
                  </p>
                )}
              </div>
            ),
            duration: 10,
          });

          // Tải lại danh sách
          fetchPlacements(selectedPoolLevel);
          fetchPromisingPlacements(selectedPromisingPoolLevel);
        } catch (e: any) {
          const errMsg = e?.response?.data?.message || e?.message || 'Đồng bộ thất bại';
          notification.error({
            message: 'Lỗi đồng bộ',
            description: errMsg,
          });
        } finally {
          setSyncLoading(false);
        }
      },
    });
  };

  const handleRollbackSync = async () => {
    if (!syncDate) {
      notification.warning({ message: 'Vui lòng chọn ngày bắt đầu để hoàn tác' });
      return;
    }

    // Phân tích rollbackPool thành poolType và poolLevel
    let poolType = 'all';
    let poolLevel: number | undefined = undefined;
    let poolLabel = 'Tất cả các bể';

    if (rollbackPool.startsWith('heap-')) {
      poolType = 'heap';
      poolLevel = Number(rollbackPool.split('-')[1]);
      poolLabel = `Bể Heap ${poolLevel} PV`;
    } else if (rollbackPool.startsWith('promising-')) {
      poolType = 'promising';
      poolLevel = Number(rollbackPool.split('-')[1]);
      poolLabel = `Bể Triển vọng ${poolLevel} PV`;
    }

    Modal.confirm({
      title: `Xác nhận hoàn tác đồng bộ ${poolLabel}?`,
      content: (
        <div>
          <p>Hệ thống sẽ quét tất cả các đơn hàng thành công từ ngày <b>{syncDate.format('DD/MM/YYYY')}</b> đến nay.</p>
          <p>Tất cả vị trí xếp bể tương ứng của <b>{poolLabel}</b> đã tạo trong khoảng thời gian này sẽ bị xóa bỏ.</p>
          <p>Lịch sử chi thưởng tương ứng sẽ bị xóa và số dư ví hoa hồng của người nhận sẽ bị khấu trừ lại.</p>
          <p style={{ color: '#ff4d4f', marginTop: 16, fontWeight: 'bold' }}>
            ⚠️ Hành động này trực tiếp trừ tiền ví của người dùng và không thể hoàn tác!
          </p>
        </div>
      ),
      okText: 'Bắt đầu hoàn tác',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          setRollbackLoading(true);
          const res = await api.post('/admin/heap-reward/rollback', {
            fromDate: syncDate.toISOString(),
            poolType,
            poolLevel,
          });
          const data = res.data;

          notification.success({
            message: 'Hoàn tác thành công',
            description: (
              <div>
                <p>Số đơn quét thấy: <b>{data.scanned}</b></p>
                <p>Vị trí Heap đã xóa: <b>{data.placementsDeleted}</b></p>
                <p>Vị trí hàng đợi đã xóa: <b>{data.promisingPlacementsDeleted}</b></p>
                <p>Tổng số tiền khấu trừ ví: <b>${Number(data.balanceDeducted).toLocaleString()}</b></p>
              </div>
            ),
            duration: 10,
          });

          // Tải lại danh sách
          fetchPlacements(selectedPoolLevel);
          fetchPromisingPlacements(selectedPromisingPoolLevel);
        } catch (e: any) {
          const errMsg = e?.response?.data?.message || e?.message || 'Hoàn tác thất bại';
          notification.error({
            message: 'Lỗi hoàn tác',
            description: errMsg,
          });
        } finally {
          setRollbackLoading(false);
        }
      },
    });
  };

  const columns = [
    {
      title: 'Tên tài khoản',
      dataIndex: ['user', 'username'],
      key: 'username',
      render: (text: string, record: any) => text || record.user?.email,
    },
    {
      title: 'Bể đồng chia',
      dataIndex: 'poolLevel',
      key: 'poolLevel',
      render: (level: number) => <Tag color="blue">{level} PV</Tag>,
    },
    {
      title: 'Trạng thái hoạt động',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (isActive ? <Tag color="green">Active</Tag> : <Tag color="red">Pushed Out</Tag>),
    },
    {
      title: 'Số lần vào',
      dataIndex: 'timesEntered',
      key: 'timesEntered',
    },
    {
      title: 'Lũy kế đã nhận',
      dataIndex: 'totalRewarded',
      key: 'totalRewarded',
      render: (val: any) => `$${Number(val).toLocaleString()}`,
    },
    {
      title: 'Thời gian tham gia',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: 'Đơn hàng kích hoạt',
      key: 'triggerOrder',
      render: (_: any, record: any) => record.triggerOrder?.id ? record.triggerOrder.id.substring(0, 8) : '—',
    },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" type="primary" onClick={() => showDetails(record, false)}>Chi tiết</Button>
          <Popconfirm title="Chắc chắn xóa vị trí này (kéo theo xóa lịch sử nhận)?" onConfirm={() => deletePlacement(record.id)}>
            <Button size="small" danger>Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    }
  ];

  const promisingColumns = [
    {
      title: 'Tên tài khoản',
      dataIndex: ['user', 'username'],
      key: 'username',
      render: (text: string, record: any) => text || record.user?.email,
    },
    {
      title: 'Hạn mức bể',
      dataIndex: 'poolLevel',
      key: 'poolLevel',
      render: (level: number) => <Tag color="purple">{level} PV</Tag>,
    },
    {
      title: 'Trạng thái hàng đợi',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (isActive ? <Tag color="green">Đang nhận (Top 10)</Tag> : <Tag color="orange">Đang xếp hàng chờ</Tag>),
    },
    {
      title: 'Số lần vào',
      dataIndex: 'timesEntered',
      key: 'timesEntered',
    },
    {
      title: 'Lũy kế đã nhận',
      dataIndex: 'totalRewarded',
      key: 'totalRewarded',
      render: (val: any) => `$${Number(val).toLocaleString()}`,
    },
    {
      title: 'Thời gian tham gia',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: 'Đơn hàng kích hoạt',
      key: 'triggerOrder',
      render: (_: any, record: any) => record.triggerOrder?.id ? record.triggerOrder.id.substring(0, 8) : '—',
    },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" type="primary" onClick={() => showDetails(record, true)}>Chi tiết</Button>
          <Popconfirm title="Xoá ID khỏi hàng đợi này?" onConfirm={() => deletePromisingPlacement(record.id)}>
            <Button size="small" danger>Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    }
  ];

  const historyColumns = [
    {
      title: 'Số tiền nhận',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: any) => `$${Number(val).toFixed(2)}`
    },
    {
      title: 'Bể trích',
      dataIndex: 'poolLevel',
      key: 'poolLevel',
      render: (level: number) => <Tag color="blue">{level} PV</Tag>
    },
    {
      title: 'Ngày chia thưởng',
      dataIndex: 'rewardDate',
      key: 'rewardDate',
      render: (text: string, rec: any) => text || new Date(rec.createdAt).toLocaleDateString()
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Quản lý Bể Đồng Chia & Sản Phẩm Triển Vọng</Title>

      <Tabs defaultActiveKey="1" style={{ marginTop: 16 }}>
        {/* TAB 1: DANH SÁCH BỂ ĐỒNG CHIA */}
        <Tabs.TabPane tab="Danh sách Bể Đồng Chia (Heap Placements)" key="1">
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Lọc theo bể:</span>
            <Select 
              defaultValue="" 
              style={{ width: 150 }} 
              onChange={(val) => setSelectedPoolLevel(val ? Number(val) : undefined)}
            >
              <Option value="">Tất cả các bể</Option>
              <Option value="100">Bể 100 PV</Option>
              <Option value="500">Bể 500 PV</Option>
              <Option value="3000">Bể 3000 PV</Option>
              <Option value="5000">Bể 5000 PV</Option>
            </Select>
          </div>
          <Card title="Danh sách thành viên trong các bể đồng chia">
            <Table 
              dataSource={placements} 
              columns={columns} 
              rowKey="id" 
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </Card>
        </Tabs.TabPane>

        {/* TAB 2: HÀNG ĐỢI SẢN PHẨM TRIỂN VỌNG */}
        <Tabs.TabPane tab="Hàng đợi Doanh Số Triển Vọng (Promising Product Queue)" key="2">
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Lọc theo hạn mức bể:</span>
            <Select 
              defaultValue="" 
              style={{ width: 150 }} 
              onChange={(val) => setSelectedPromisingPoolLevel(val ? Number(val) : undefined)}
            >
              <Option value="">Tất cả</Option>
              <Option value="3000">Bể 3000 PV</Option>
              <Option value="5000">Bể 5000 PV</Option>
            </Select>
          </div>
          <Card title="Hàng đợi chia thưởng sản phẩm triển vọng (Tối đa 10 ID hoạt động đồng thời)">
            <Table 
              dataSource={promisingPlacements} 
              columns={promisingColumns} 
              rowKey="id" 
              loading={promisingLoading}
              pagination={{ pageSize: 20 }}
            />
          </Card>
        </Tabs.TabPane>

        {/* TAB 3: CẤU HÌNH HỆ THỐNG */}
        {isAdminAccount && (
          <Tabs.TabPane tab="Cấu hình hệ thống Bể & Quỹ" key="3">
            <Card title="Thiết lập tỷ lệ trích quỹ theo bể và hạn mức Max Payout">
              <Form form={form} layout="vertical" onFinish={onFinishConfig}>
                <Row gutter={24}>
                  {/* BÊN TRÁI: CẤU HÌNH ĐỒNG CHIA */}
                  <Col xs={24} md={12}>
                    <Title level={4} style={{ marginBottom: 16 }}>Cấu hình Bể Đồng Chia (Heap Pool)</Title>
                    
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Bể 100 PV: Tỷ lệ trích quỹ (%)" name="HEAP_POOL_PERCENT_100" tooltip="% từ giá trị đơn được trích vào bể này và chia đều cho danh sách active (bao gồm user mới vào)">
                          <InputNumber min={0} max={100} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Bể 100 PV: Max Payout ($)" name="HEAP_MAX_PAYOUT_100">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Bể 500 PV: Tỷ lệ trích quỹ (%)" name="HEAP_POOL_PERCENT_500" tooltip="% từ giá trị đơn được trích vào bể này và chia đều cho danh sách active (bao gồm user mới vào)">
                          <InputNumber min={0} max={100} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Bể 500 PV: Max Payout ($)" name="HEAP_MAX_PAYOUT_500">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Bể 3000 PV: Tỷ lệ trích quỹ (%)" name="HEAP_POOL_PERCENT_3000" tooltip="% từ giá trị đơn được trích vào bể này và chia đều cho danh sách active (bao gồm user mới vào)">
                          <InputNumber min={0} max={100} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Bể 3000 PV: Max Payout ($)" name="HEAP_MAX_PAYOUT_3000">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Bể 5000 PV: Tỷ lệ trích quỹ (%)" name="HEAP_POOL_PERCENT_5000" tooltip="% từ giá trị đơn được trích vào bể này và chia đều cho danh sách active (bao gồm user mới vào)">
                          <InputNumber min={0} max={100} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Bể 5000 PV: Max Payout ($)" name="HEAP_MAX_PAYOUT_5000">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Col>

                  {/* BÊN PHẢI: CẤU HÌNH SẢN PHẨM TRIỂN VỌNG */}
                  <Col xs={24} md={12}>
                    <Title level={4} style={{ marginBottom: 16 }}>Cấu hình Quỹ Sản Phẩm Triển Vọng</Title>
                    
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Bể 3000 PV: Tỷ lệ trích (%)" name="PROMISING_POOL_PERCENT_3000">
                          <InputNumber min={0} max={100} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Bể 3000 PV: Max Payout ($)" name="PROMISING_MAX_PAYOUT_3000">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Bể 5000 PV: Tỷ lệ trích (%)" name="PROMISING_POOL_PERCENT_5000">
                          <InputNumber min={0} max={100} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Bể 5000 PV: Max Payout ($)" name="PROMISING_MAX_PAYOUT_5000">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Col>
                </Row>
                
                <Button type="primary" htmlType="submit" loading={loading} style={{ marginTop: 24 }}>
                  Lưu cấu hình hệ thống
                </Button>
              </Form>
            </Card>

            <Card title="Đồng bộ đơn hàng cũ vào Bể đồng chia (Heap Reward)" style={{ marginTop: 24 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Chức năng này cho phép bạn quét và xử lý lại các đơn hàng cũ (từ ngày được chọn đến hiện tại). 
                    Hệ thống sẽ tự động lọc các đơn hàng hợp lệ có trạng thái thành công nhưng chưa được vào Heap Reward, 
                    sau đó chạy tính toán phân chia và cộng ví trực tiếp cho người dùng.
                  </Typography.Text>
                </div>
                <Space size="large" align="center" wrap>
                  <div>
                    <span style={{ marginRight: 8, fontWeight: 'bold' }}>Chọn ngày bắt đầu:</span>
                    <DatePicker 
                      value={syncDate} 
                      onChange={(date) => setSyncDate(date)} 
                      format="DD/MM/YYYY"
                      placeholder="Chọn ngày bắt đầu"
                      disabledDate={(current) => current && current > dayjs().endOf('day')}
                    />
                  </div>
                  <Button 
                    type="primary" 
                    danger 
                    loading={syncLoading} 
                    onClick={handleSyncOrders}
                  >
                    Bắt đầu đồng bộ
                  </Button>
                </Space>

                <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 16 }}>
                  <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12, fontWeight: 'bold' }}>
                    Khu vực Hoàn tác (Rollback / Fallback)
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Dùng khi cần rút lại vị trí xếp bể đã đồng bộ sai. Hệ thống sẽ xóa các vị trí đã xếp trong bể chỉ định 
                    (từ ngày được chọn đến hiện tại) và tự động trừ lại tiền hoa hồng đã cộng vào ví của người dùng.
                  </Typography.Text>
                  <Space size="large" align="center" wrap>
                    <div>
                      <span style={{ marginRight: 8, fontWeight: 'bold' }}>Chọn bể hoàn tác:</span>
                      <Select
                        value={rollbackPool}
                        style={{ width: 220 }}
                        onChange={setRollbackPool}
                      >
                        <Option value="all">Tất cả các bể</Option>
                        <Option value="heap-100">Bể Heap 100 PV</Option>
                        <Option value="heap-500">Bể Heap 500 PV</Option>
                        <Option value="heap-3000">Bể Heap 3000 PV</Option>
                        <Option value="heap-5000">Bể Heap 5000 PV</Option>
                        <Option value="promising-3000">Bể Triển vọng 3000 PV</Option>
                        <Option value="promising-5000">Bể Triển vọng 5000 PV</Option>
                      </Select>
                    </div>
                    <Button 
                      type="primary" 
                      danger
                      ghost
                      loading={rollbackLoading} 
                      onClick={handleRollbackSync}
                    >
                      Hoàn tác đồng bộ
                    </Button>
                  </Space>
                </div>
              </Space>
            </Card>
          </Tabs.TabPane>
        )}
      </Tabs>

      <Modal
        title={`Chi tiết lịch sử nhận thưởng - ${selectedPlacement?.user?.username || ''}`}
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedPlacement && (
          <div style={{ marginBottom: 16 }}>
            <p><b>Đơn hàng kích hoạt:</b> {selectedPlacement.triggerOrder ? `${selectedPlacement.triggerOrder.id.substring(0, 8)} ($${Number(selectedPlacement.triggerOrder.totalAmount).toLocaleString()})` : 'Không lưu / Hệ thống cũ'}</p>
            <p><b>Bể tham gia:</b> <Tag color={isDetailPromising ? 'purple' : 'blue'}>{selectedPlacement.poolLevel} PV</Tag></p>
            <p><b>Lũy kế đã nhận:</b> ${Number(selectedPlacement.totalRewarded).toLocaleString()}</p>
            <p><b>Trạng thái:</b> {selectedPlacement.isActive ? <Tag color="green">Đang nhận</Tag> : <Tag color="red">Đã out / Đang đợi</Tag>}</p>
          </div>
        )}
        <Table 
          dataSource={placementHistories}
          columns={historyColumns}
          rowKey="id"
          loading={historyLoading}
          size="small"
          pagination={false}
        />
      </Modal>
    </div>
  );
};

export default HeapReward;
