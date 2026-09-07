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
  Input,
  Select,
  Tag,
  Switch,
  Row,
  Col,
  Statistic,
  Tooltip,
  Alert,
  DatePicker,
  Descriptions,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
  SafetyCertificateOutlined,
  HistoryOutlined,
  TeamOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

const AgentPool: React.FC = () => {
  const { user } = useAuth();
  const isAdminAccount = Boolean(
    user?.isSuperAdmin || (user?.type === 'user' && user?.isAdmin),
  );

  const [activeTab, setActiveTab] = useState<string>('pools');

  // Pools state
  const [pools, setPools] = useState<any[]>([]);
  const [loadingPools, setLoadingPools] = useState<boolean>(false);
  const [isAddPoolModalVisible, setIsAddPoolModalVisible] = useState<boolean>(false);
  const [isEditPoolModalVisible, setIsEditPoolModalVisible] = useState<boolean>(false);
  const [editingPool, setEditingPool] = useState<any>(null);

  // Members state
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(false);
  const [selectedPoolId, setSelectedPoolId] = useState<string | undefined>(undefined);
  const [searchMember, setSearchMember] = useState<string>('');
  const [isAddMemberModalVisible, setIsAddMemberModalVisible] = useState<boolean>(false);

  // Histories state
  const [histories, setHistories] = useState<any[]>([]);
  const [loadingHistories, setLoadingHistories] = useState<boolean>(false);
  const [historyPoolId, setHistoryPoolId] = useState<string | undefined>(undefined);

  // Đồng bộ thành viên theo cấp bậc (C1..C9)
  const [syncingMembers, setSyncingMembers] = useState<boolean>(false);

  // Backfill state (bù các bể bị hụt do lỗi khi duyệt đơn)
  const [backfillSince, setBackfillSince] = useState<any>(null);
  const [backfillData, setBackfillData] = useState<any>(null);
  const [loadingBackfill, setLoadingBackfill] = useState<boolean>(false);
  const [selectedBackfillOrderIds, setSelectedBackfillOrderIds] = useState<string[]>([]);
  const [isBackfillConfirmVisible, setIsBackfillConfirmVisible] = useState<boolean>(false);
  const [backfillConfirmText, setBackfillConfirmText] = useState<string>('');
  const [runningBackfill, setRunningBackfill] = useState<boolean>(false);
  const [backfillResult, setBackfillResult] = useState<any>(null);

  // Forms
  const [addPoolForm] = Form.useForm();
  const [editPoolForm] = Form.useForm();
  const [addMemberForm] = Form.useForm();

  // ── Fetch Functions ───────────────────────────────────────────────────────

  const fetchPools = async () => {
    try {
      setLoadingPools(true);
      const res = await api.get('/admin/agent-pool/pools');
      setPools(res.data || []);
    } catch (e: any) {
      notification.error({
        message: 'Lỗi tải danh sách Bể Đại lý',
        description: e?.response?.data?.message,
      });
    } finally {
      setLoadingPools(false);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const params: any = {};
      if (selectedPoolId) params.poolId = selectedPoolId;
      if (searchMember) params.search = searchMember;

      const res = await api.get('/admin/agent-pool/members', { params });
      setMembers(res.data || []);
    } catch (e: any) {
      notification.error({
        message: 'Lỗi tải danh sách Thành viên',
        description: e?.response?.data?.message,
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchHistories = async () => {
    try {
      setLoadingHistories(true);
      const params: any = {};
      if (historyPoolId) params.poolId = historyPoolId;

      const res = await api.get('/admin/agent-pool/histories', { params });
      setHistories(res.data || []);
    } catch (e: any) {
      notification.error({
        message: 'Lỗi tải Lịch sử chia thưởng',
        description: e?.response?.data?.message,
      });
    } finally {
      setLoadingHistories(false);
    }
  };

  useEffect(() => {
    fetchPools();
  }, []);

  useEffect(() => {
    if (activeTab === 'members') fetchMembers();
    if (activeTab === 'histories') fetchHistories();
  }, [activeTab, selectedPoolId, historyPoolId]);

  const fetchBackfillPreview = async () => {
    try {
      setLoadingBackfill(true);
      const params: any = { limit: 500 };
      if (backfillSince) params.since = backfillSince.startOf('day').toISOString();

      const res = await api.get('/admin/agent-pool/backfill/preview', { params });
      setBackfillData(res.data || null);
      // Mặc định chọn hết các đơn quét được, admin có thể bỏ chọn từng đơn.
      setSelectedBackfillOrderIds((res.data?.orders || []).map((o: any) => o.orderId));
    } catch (e: any) {
      notification.error({
        message: 'Lỗi quét đơn thiếu bể',
        description: e?.response?.data?.message,
      });
    } finally {
      setLoadingBackfill(false);
    }
  };

  const formatVndFromUsd = (val: number | string | null | undefined) => {
    const safeVal = Number(val || 0);
    const normalizedUsd = safeVal > 10000 ? safeVal / 25000 : safeVal;
    return `${(normalizedUsd * 25000).toLocaleString('vi-VN')} VNĐ`;
  };

  // ── Backfill Handlers ─────────────────────────────────────────────────────

  const BACKFILL_CONFIRM_PHRASE = 'BU THUONG';

  const selectedBackfillOrders = (backfillData?.orders || []).filter((o: any) =>
    selectedBackfillOrderIds.includes(o.orderId),
  );

  // Gom theo mã bể để admin thấy tiền sẽ vào bể nào trước khi bấm chạy.
  const backfillSummaryByPool = (() => {
    const map = new Map<string, { poolCode: string; orderCount: number; memberCount: number; payoutUsd: number }>();
    for (const order of selectedBackfillOrders) {
      for (const pool of order.missingPools || []) {
        const current = map.get(pool.poolCode) || {
          poolCode: pool.poolCode,
          orderCount: 0,
          memberCount: pool.memberCount,
          payoutUsd: 0,
        };
        current.orderCount += 1;
        current.memberCount = pool.memberCount;
        current.payoutUsd += Number(pool.payoutUsd) || 0;
        map.set(pool.poolCode, current);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.poolCode.localeCompare(b.poolCode));
  })();

  const backfillSelectedTotalUsd = selectedBackfillOrders.reduce(
    (acc: number, o: any) => acc + (Number(o.estimatedPayoutUsd) || 0),
    0,
  );

  const openBackfillConfirm = () => {
    if (selectedBackfillOrderIds.length === 0) {
      notification.warning({ message: 'Chưa chọn đơn hàng nào để bù' });
      return;
    }
    setBackfillConfirmText('');
    setIsBackfillConfirmVisible(true);
  };

  const handleRunBackfill = async () => {
    try {
      setRunningBackfill(true);
      const res = await api.post('/admin/agent-pool/backfill/run', {
        orderIds: selectedBackfillOrderIds,
      });
      setBackfillResult(res.data);
      setIsBackfillConfirmVisible(false);
      setBackfillConfirmText('');
      notification.success({
        message: 'Chạy bù thưởng xong',
        description: `Đã bù ${res.data?.doneCount || 0} đơn, tổng ${formatVndFromUsd(
          res.data?.totalPayoutUsd,
        )}.`,
      });
      await fetchBackfillPreview();
    } catch (e: any) {
      notification.error({
        message: 'Lỗi khi chạy bù thưởng',
        description: e?.response?.data?.message,
      });
    } finally {
      setRunningBackfill(false);
    }
  };

  // ── Pool Handlers ─────────────────────────────────────────────────────────

  const handleCreatePool = async (values: any) => {
    try {
      await api.post('/admin/agent-pool/pools', values);
      notification.success({ message: 'Tạo bể đồng chia thành công!' });
      setIsAddPoolModalVisible(false);
      addPoolForm.resetFields();
      fetchPools();
    } catch (e: any) {
      notification.error({
        message: 'Lỗi khi tạo bể',
        description: e?.response?.data?.message,
      });
    }
  };

  const handleUpdatePool = async (values: any) => {
    if (!editingPool) return;
    try {
      await api.patch(`/admin/agent-pool/pools/${editingPool.id}`, values);
      notification.success({ message: 'Cập nhật bể thành công!' });
      setIsEditPoolModalVisible(false);
      setEditingPool(null);
      editPoolForm.resetFields();
      fetchPools();
    } catch (e: any) {
      notification.error({
        message: 'Lỗi khi cập nhật bể',
        description: e?.response?.data?.message,
      });
    }
  };

  const handleDeletePool = async (id: string) => {
    try {
      await api.delete(`/admin/agent-pool/pools/${id}`);
      notification.success({ message: 'Đã xóa bể thành công!' });
      fetchPools();
      if (selectedPoolId === id) setSelectedPoolId(undefined);
    } catch (e: any) {
      notification.error({
        message: 'Lỗi khi xóa bể',
        description: e?.response?.data?.message,
      });
    }
  };

  // ── Member Handlers ───────────────────────────────────────────────────────

  const handleAddMember = async (values: any) => {
    try {
      await api.post('/admin/agent-pool/members', values);
      notification.success({ message: 'Thêm thành viên vào bể thành công!' });
      setIsAddMemberModalVisible(false);
      addMemberForm.resetFields();
      fetchMembers();
      fetchPools();
    } catch (e: any) {
      notification.error({
        message: 'Lỗi khi thêm thành viên',
        description: e?.response?.data?.message,
      });
    }
  };

  const handleSyncMembers = async () => {
    setSyncingMembers(true);
    try {
      const res = await api.post('/admin/agent-pool/members/sync-all');
      const data = res.data || {};
      notification.success({
        message: 'Đã đồng bộ thành viên theo cấp bậc',
        description: `Quét ${data.scannedUserCount || 0} người: thêm mới ${
          data.added?.length || 0
        }, bật lại ${data.activated?.length || 0}, tắt ${
          data.deactivated?.length || 0
        }.`,
      });
      fetchMembers();
      fetchPools();
    } catch (e: any) {
      notification.error({
        message: 'Lỗi khi đồng bộ thành viên',
        description: e?.response?.data?.message,
      });
    } finally {
      setSyncingMembers(false);
    }
  };

  const handleToggleMemberStatus = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/admin/agent-pool/members/${id}/status`, {
        isActive: !currentStatus,
      });
      notification.success({ message: 'Đã cập nhật trạng thái thành viên!' });
      fetchMembers();
    } catch (e: any) {
      notification.error({
        message: 'Lỗi cập nhật trạng thái',
        description: e?.response?.data?.message,
      });
    }
  };

  const handleRemoveMember = async (id: string) => {
    try {
      await api.delete(`/admin/agent-pool/members/${id}`);
      notification.success({ message: 'Đã xóa thành viên khỏi bể!' });
      fetchMembers();
      fetchPools();
    } catch (e: any) {
      notification.error({
        message: 'Lỗi xóa thành viên',
        description: e?.response?.data?.message,
      });
    }
  };

  // ── Table Columns ─────────────────────────────────────────────────────────

  const poolColumns = [
    {
      title: 'Mã Bể (Code)',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Tag color="blue" style={{ fontSize: 14, fontWeight: 'bold' }}>{code}</Tag>,
    },
    {
      title: 'Tên Bể',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Phần Trăm (%)',
      dataIndex: 'percent',
      key: 'percent',
      render: (val: number) => <Tag color="gold" style={{ fontSize: 14 }}>{val}%</Tag>,
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'error'}>
          {isActive ? 'Hoạt động' : 'Tạm dừng'}
        </Tag>
      ),
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'note',
      key: 'note',
      render: (note: string) => note || '-',
    },
    {
      title: 'Ngày Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Thao Tác',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingPool(record);
              editPoolForm.setFieldsValue({
                name: record.name,
                percent: record.percent,
                isActive: record.isActive,
                note: record.note,
              });
              setIsEditPoolModalVisible(true);
            }}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xóa Bể Đồng Chia?"
            description="Tất cả thành viên trong bể này cũng sẽ bị xóa. Bạn chắc chắn chứ?"
            onConfirm={() => handleDeletePool(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const memberColumns = [
    {
      title: 'Bể Đại Lý',
      dataIndex: ['pool', 'code'],
      key: 'poolCode',
      render: (_: any, record: any) => (
        <Tag color="cyan" style={{ fontWeight: 'bold' }}>
          {record.pool?.code || 'N/A'} - {record.pool?.name} ({record.pool?.percent}%)
        </Tag>
      ),
    },
    {
      title: 'Người Dùng',
      dataIndex: 'user',
      key: 'user',
      render: (userObj: any) => (
        <div>
          <div><Text strong>{userObj?.username || 'N/A'}</Text></div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{userObj?.email || userObj?.id}</div>
        </div>
      ),
    },
    {
      title: 'Tổng Hoa Hồng Đã Nhận',
      dataIndex: 'totalRewarded',
      key: 'totalRewarded',
      render: (val: number) => (
        <Text type="success" strong>
          {Number(val || 0).toLocaleString('vi-VN')} VNĐ
        </Text>
      ),
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean, record: any) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleMemberStatus(record.id, isActive)}
          checkedChildren="Active"
          unCheckedChildren="Disabled"
        />
      ),
    },
    {
      title: 'Nguồn',
      dataIndex: 'source',
      key: 'source',
      render: (source: string, record: any) =>
        source === 'AUTO' ? (
          <Tooltip title="Do hệ thống thêm khi user đạt cấp đại lý, sẽ tự tắt nếu tụt cấp">
            <Tag color="green">
              Tự động{record.syncedRank ? ` (${record.syncedRank})` : ''}
            </Tag>
          </Tooltip>
        ) : (
          <Tooltip title="Admin thêm tay, đồng bộ cấp bậc không đụng tới">
            <Tag color="default">Thủ công</Tag>
          </Tooltip>
        ),
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'note',
      key: 'note',
      render: (note: string) => note || '-',
    },
    {
      title: 'Ngày Tham Gia',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Thao Tác',
      key: 'action',
      render: (_: any, record: any) => (
        <Popconfirm
          title="Rút thành viên khỏi bể?"
          onConfirm={() => handleRemoveMember(record.id)}
          okText="Đồng ý"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            Xóa khỏi Bể
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const historyColumns = [
    {
      title: 'Thời Gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm:ss'),
    },
    {
      title: 'Đơn Hàng Kích Hoạt',
      dataIndex: 'orderId',
      key: 'orderId',
      render: (orderId: string) => (
        <Tooltip title={orderId}>
          <Tag color="purple">Đơn: #{orderId?.substring(0, 8)}...</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Bể Đại Lý',
      dataIndex: ['pool', 'code'],
      key: 'poolCode',
      render: (_: any, record: any) => (
        <Tag color="blue">{record.pool?.code} ({record.poolPercent}%)</Tag>
      ),
    },
    {
      title: 'Giá Trị Đơn (Trừ VAT)',
      dataIndex: 'orderNetAmount',
      key: 'orderNetAmount',
      render: (val: number) => formatVndFromUsd(val),
    },
    {
      title: 'Quỹ Bể Trích Được',
      dataIndex: 'poolTotalAmount',
      key: 'poolTotalAmount',
      render: (val: number) => formatVndFromUsd(val),
    },
    {
      title: 'Số TV Chia',
      dataIndex: 'memberCount',
      key: 'memberCount',
      render: (cnt: number) => <Tag color="geekblue">{cnt} người</Tag>,
    },
    {
      title: 'Người Nhận',
      dataIndex: 'user',
      key: 'user',
      render: (u: any) => u?.username || u?.email || u?.id,
    },
    {
      title: 'Thưởng Gộp',
      dataIndex: 'rewardAmount',
      key: 'rewardAmount',
      render: (val: number) => (
        <Text type="success" strong style={{ fontSize: 14 }}>
          +{formatVndFromUsd(val)}
        </Text>
      ),
    },
    {
      title: 'Vào Ví Rút',
      dataIndex: 'withdrawAmount',
      key: 'withdrawAmount',
      render: (val: number) => (
        <Text type="success">+{formatVndFromUsd(val || 0)}</Text>
      ),
    },
    {
      title: 'Vào Ví Tiêu Dùng',
      dataIndex: 'reconsumptionAmount',
      key: 'reconsumptionAmount',
      render: (val: number) => (
        <Text type="success">+{formatVndFromUsd(val || 0)}</Text>
      ),
    },
    {
      title: 'Trừ Thuế/VAT',
      dataIndex: 'taxAmount',
      key: 'taxAmount',
      render: (val: number) => (
        <Text type="secondary">-{formatVndFromUsd(val || 0)}</Text>
      ),
    },
  ];

  const backfillColumns = [
    {
      title: 'Thời Gian Đơn',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Mã Đơn',
      dataIndex: 'orderId',
      key: 'orderId',
      render: (id: string) => <Text code copyable={{ text: id }}>{id.slice(0, 8)}...</Text>,
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color="blue">{status}</Tag>,
    },
    {
      title: 'Giá Trị Đơn (Trừ VAT)',
      dataIndex: 'orderNetAmount',
      key: 'orderNetAmount',
      render: (val: number) => formatVndFromUsd(val),
    },
    {
      title: 'Bể Bị Thiếu',
      dataIndex: 'missingPools',
      key: 'missingPools',
      render: (missingPools: any[]) => (
        <Space wrap>
          {(missingPools || []).map((p) => (
            <Tooltip
              key={p.poolId}
              title={`${p.poolPercent}% chia cho ${p.memberCount} thành viên, mỗi người ${formatVndFromUsd(
                p.rewardPerMemberUsd,
              )}`}
            >
              <Tag color="volcano">{p.poolCode}</Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: 'Tiền Sẽ Bù',
      dataIndex: 'estimatedPayoutUsd',
      key: 'estimatedPayoutUsd',
      render: (val: number) => (
        <Text type="danger" strong>
          {formatVndFromUsd(val)}
        </Text>
      ),
    },
  ];

  const backfillSummaryColumns = [
    {
      title: 'Bể',
      dataIndex: 'poolCode',
      key: 'poolCode',
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    { title: 'Số Đơn Bù', dataIndex: 'orderCount', key: 'orderCount' },
    { title: 'Số TV Nhận', dataIndex: 'memberCount', key: 'memberCount' },
    {
      title: 'Tổng Tiền Vào Bể',
      dataIndex: 'payoutUsd',
      key: 'payoutUsd',
      render: (val: number) => <Text strong>{formatVndFromUsd(val)}</Text>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            <SafetyCertificateOutlined style={{ marginRight: 10, color: '#1890ff' }} />
            Quản Lý Bể Đồng Chia Đại Lý (C1, C2, ...)
          </Title>
          <Text type="secondary">
            Cấu hình phần trăm trích hoa hồng từng cấp đại lý, quản lý thành viên và theo dõi lịch sử chia thưởng tự động từ giá trị đơn hàng trừ VAT.
          </Text>
        </Col>
      </Row>

      {/* Summary Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Tổng Số Bể Đại Lý"
              value={pools.length}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Bể Đang Hoạt Động"
              value={pools.filter((p) => p.isActive).length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Tổng % Các Bể Active"
              value={pools.filter((p) => p.isActive).reduce((acc, p) => acc + Number(p.percent), 0)}
              suffix="%"
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={[
            {
              key: 'pools',
              label: (
                <span>
                  <SafetyCertificateOutlined /> Cấu Hình Bể Đồng Chia
                </span>
              ),
              children: (
                <div>
                  <Row justify="space-between" style={{ marginBottom: 16 }}>
                    <Col></Col>
                    <Col>
                      <Space>
                        <Button icon={<ReloadOutlined />} onClick={fetchPools} loading={loadingPools}>
                          Làm Mới
                        </Button>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => setIsAddPoolModalVisible(true)}
                        >
                          Tạo Bể Mới (C1, C2...)
                        </Button>
                      </Space>
                    </Col>
                  </Row>

                  <Table
                    columns={poolColumns}
                    dataSource={pools}
                    rowKey="id"
                    loading={loadingPools}
                    pagination={false}
                  />
                </div>
              ),
            },
            {
              key: 'members',
              label: (
                <span>
                  <TeamOutlined /> Danh Sách Thành Viên Bể
                </span>
              ),
              children: (
                <div>
                  <Row justify="space-between" style={{ marginBottom: 16 }}>
                    <Col span={16}>
                      <Space wrap>
                        <Select
                          placeholder="Chọn Bể Đại Lý"
                          style={{ width: 220 }}
                          value={selectedPoolId}
                          onChange={(val) => setSelectedPoolId(val)}
                          allowClear
                        >
                          {pools.map((p) => (
                            <Option key={p.id} value={p.id}>
                              {p.code} - {p.name} ({p.percent}%)
                            </Option>
                          ))}
                        </Select>

                        <Input.Search
                          placeholder="Tìm Username / Email / ID"
                          style={{ width: 260 }}
                          onSearch={(val) => {
                            setSearchMember(val);
                            fetchMembers();
                          }}
                          onChange={(e) => setSearchMember(e.target.value)}
                          allowClear
                        />

                        <Button icon={<ReloadOutlined />} onClick={fetchMembers} loading={loadingMembers}>
                          Lọc
                        </Button>
                      </Space>
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                      <Space>
                        <Popconfirm
                          title="Đồng bộ thành viên theo cấp bậc?"
                          description="Quét lại cấp bậc của toàn hệ thống: ai đạt C5 sẽ nằm trong bể C1..C5, ai tụt cấp sẽ bị tắt. Chỉ ảnh hưởng các dòng do hệ thống thêm."
                          onConfirm={handleSyncMembers}
                          okText="Đồng bộ"
                          cancelText="Hủy"
                        >
                          <Button icon={<SafetyCertificateOutlined />} loading={syncingMembers}>
                            Đồng Bộ Theo Cấp Bậc
                          </Button>
                        </Popconfirm>

                        <Button
                          type="primary"
                          icon={<UserAddOutlined />}
                          onClick={() => setIsAddMemberModalVisible(true)}
                        >
                          Thêm Thành Viên Vào Bể
                        </Button>
                      </Space>
                    </Col>
                  </Row>

                  <Table
                    columns={memberColumns}
                    dataSource={members}
                    rowKey="id"
                    loading={loadingMembers}
                    pagination={{ pageSize: 20 }}
                  />
                </div>
              ),
            },
            {
              key: 'histories',
              label: (
                <span>
                  <HistoryOutlined /> Lịch Sử Chia Thưởng
                </span>
              ),
              children: (
                <div>
                  <Row justify="space-between" style={{ marginBottom: 16 }}>
                    <Col>
                      <Space>
                        <Select
                          placeholder="Lọc Theo Bể"
                          style={{ width: 220 }}
                          value={historyPoolId}
                          onChange={(val) => setHistoryPoolId(val)}
                          allowClear
                        >
                          {pools.map((p) => (
                            <Option key={p.id} value={p.id}>
                              {p.code} - {p.name}
                            </Option>
                          ))}
                        </Select>
                        <Button icon={<ReloadOutlined />} onClick={fetchHistories} loading={loadingHistories}>
                          Làm Mới
                        </Button>
                      </Space>
                    </Col>
                  </Row>

                  <Table
                    columns={historyColumns}
                    dataSource={histories}
                    rowKey="id"
                    loading={loadingHistories}
                    pagination={{ pageSize: 20 }}
                  />
                </div>
              ),
            },
            {
              key: 'backfill',
              label: (
                <span>
                  <ThunderboltOutlined /> Bù Thưởng Thiếu
                </span>
              ),
              children: (
                <div>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Bù phần thưởng bể bị hụt"
                    description="Quét các đơn đã duyệt nhưng chưa được chia đủ mọi bể (thường do lỗi khoá DB lúc duyệt đơn). Bước quét chỉ đọc dữ liệu. Tiền chỉ được cộng khi bấm chạy bù và xác nhận."
                  />

                  <Row justify="space-between" style={{ marginBottom: 16 }}>
                    <Col>
                      <Space wrap>
                        <DatePicker
                          placeholder="Chỉ quét đơn từ ngày..."
                          value={backfillSince}
                          onChange={(val) => setBackfillSince(val)}
                          format="DD/MM/YYYY"
                          allowClear
                        />
                        <Button
                          type="primary"
                          icon={<ReloadOutlined />}
                          onClick={fetchBackfillPreview}
                          loading={loadingBackfill}
                        >
                          Quét Đơn Thiếu Bể
                        </Button>
                      </Space>
                    </Col>
                    <Col>
                      <Tooltip
                        title={
                          isAdminAccount
                            ? undefined
                            : 'Chỉ tài khoản admin mới được chạy bù thưởng'
                        }
                      >
                        <Button
                          danger
                          type="primary"
                          icon={<ThunderboltOutlined />}
                          disabled={!isAdminAccount || selectedBackfillOrderIds.length === 0}
                          onClick={openBackfillConfirm}
                        >
                          Chạy Bù {selectedBackfillOrderIds.length} Đơn Đã Chọn
                        </Button>
                      </Tooltip>
                    </Col>
                  </Row>

                  {backfillData && (
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="Đơn Thiếu Bể"
                            value={backfillData.totalOrders || 0}
                            suffix="đơn"
                            valueStyle={{ color: '#fa541c' }}
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="Lượt Bể Bị Hụt"
                            value={backfillData.totalMissingPools || 0}
                            suffix="lượt"
                            valueStyle={{ color: '#faad14' }}
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small">
                          <Statistic
                            title="Tổng Tiền Cần Bù"
                            value={formatVndFromUsd(backfillData.totalAmountUsd)}
                            valueStyle={{ color: '#cf1322' }}
                          />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Ví rút {formatVndFromUsd(backfillData.totalWithdrawUsd || 0)} · Ví tiêu dùng{' '}
                            {formatVndFromUsd(backfillData.totalReconsumptionUsd || 0)}
                          </Text>
                        </Card>
                      </Col>
                    </Row>
                  )}

                  {backfillData?.distribution && (
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message={`Tỷ lệ chia ví: ${backfillData.distribution.withdrawPercent}% ví rút, ${backfillData.distribution.reconsumptionPercent}% ví tiêu dùng, ${backfillData.distribution.taxPercent}% trừ thuế/VAT`}
                    />
                  )}

                  {backfillData?.skippedPools?.length > 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message="Bể không được tính vào lần quét này"
                      description={
                        <Space direction="vertical" size={2}>
                          {backfillData.skippedPools.map((p: any) => (
                            <Text key={p.code}>
                              <Tag color="default">{p.code}</Tag> {p.reason}
                            </Text>
                          ))}
                        </Space>
                      }
                    />
                  )}

                  {backfillData?.truncated && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message="Danh sách bị cắt bớt do quá nhiều đơn. Chạy bù xong hãy quét lại để xử lý phần còn lại."
                    />
                  )}

                  {backfillData ? (
                    <Table
                      columns={backfillColumns}
                      dataSource={backfillData.orders || []}
                      rowKey="orderId"
                      loading={loadingBackfill}
                      pagination={{ pageSize: 20 }}
                      rowSelection={{
                        selectedRowKeys: selectedBackfillOrderIds,
                        onChange: (keys) => setSelectedBackfillOrderIds(keys as string[]),
                      }}
                    />
                  ) : (
                    <Empty description="Chưa quét. Bấm 'Quét Đơn Thiếu Bể' để kiểm tra." />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal Add Pool */}
      <Modal
        title="Tạo Bể Đồng Chia Đại Lý Mới"
        open={isAddPoolModalVisible}
        onCancel={() => setIsAddPoolModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={addPoolForm} layout="vertical" onFinish={handleCreatePool}>
          <Form.Item
            name="code"
            label="Mã Bể (Code)"
            rules={[{ required: true, message: 'Vui lòng nhập mã bể (ví dụ: C1, C2, C3)' }]}
          >
            <Input placeholder="Ví dụ: C1, C2, C3..." style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên Bể Đại Lý"
            rules={[{ required: true, message: 'Vui lòng nhập tên bể' }]}
          >
            <Input placeholder="Ví dụ: Bể Đại lý Cấp 1" />
          </Form.Item>

          <Form.Item
            name="percent"
            label="Phần Trăm Chia Thưởng (%)"
            rules={[{ required: true, message: 'Vui lòng nhập phần trăm bể' }]}
          >
            <InputNumber
              min={0}
              max={100}
              step={0.1}
              style={{ width: '100%' }}
              addonAfter="%"
              placeholder="Ví dụ: 5.0"
            />
          </Form.Item>

          <Form.Item name="note" label="Ghi Chú">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm về bể này..." />
          </Form.Item>

          <Row justify="end">
            <Space>
              <Button onClick={() => setIsAddPoolModalVisible(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit">
                Tạo Bể
              </Button>
            </Space>
          </Row>
        </Form>
      </Modal>

      {/* Modal Edit Pool */}
      <Modal
        title={`Chỉnh Sửa Bể Đại Lý ${editingPool?.code || ''}`}
        open={isEditPoolModalVisible}
        onCancel={() => {
          setIsEditPoolModalVisible(false);
          setEditingPool(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={editPoolForm} layout="vertical" onFinish={handleUpdatePool}>
          <Form.Item
            name="name"
            label="Tên Bể Đại Lý"
            rules={[{ required: true, message: 'Vui lòng nhập tên bể' }]}
          >
            <Input placeholder="Ví dụ: Bể Đại lý Cấp 1" />
          </Form.Item>

          <Form.Item
            name="percent"
            label="Phần Trăm Chia Thưởng (%)"
            rules={[{ required: true, message: 'Vui lòng nhập phần trăm bể' }]}
          >
            <InputNumber
              min={0}
              max={100}
              step={0.1}
              style={{ width: '100%' }}
              addonAfter="%"
            />
          </Form.Item>

          <Form.Item name="isActive" label="Trạng Thái Hoạt Động" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Tạm dừng" />
          </Form.Item>

          <Form.Item name="note" label="Ghi Chú">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Row justify="end">
            <Space>
              <Button
                onClick={() => {
                  setIsEditPoolModalVisible(false);
                  setEditingPool(null);
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit">
                Lưu Cập Nhật
              </Button>
            </Space>
          </Row>
        </Form>
      </Modal>

      {/* Modal Add Member */}
      <Modal
        title="Thêm Thành Viên Vào Bể Đồng Chia"
        open={isAddMemberModalVisible}
        onCancel={() => setIsAddMemberModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={addMemberForm} layout="vertical" onFinish={handleAddMember}>
          <Form.Item
            name="poolId"
            label="Chọn Bể Đại Lý"
            rules={[{ required: true, message: 'Vui lòng chọn bể đại lý' }]}
          >
            <Select placeholder="Chọn Bể C1, C2, C3...">
              {pools.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.code} - {p.name} ({p.percent}%)
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="queryStr"
            label="Thông Tin Người Dùng"
            rules={[{ required: true, message: 'Vui lòng nhập Username, Email hoặc User ID' }]}
            help="Nhập chính xác Username, Email hoặc User ID của tài khoản đại lý"
          >
            <Input placeholder="Username, Email hoặc User ID..." />
          </Form.Item>

          <Form.Item name="note" label="Ghi Chú">
            <Input.TextArea rows={2} placeholder="Lý do hoặc ghi chú cấp đại lý..." />
          </Form.Item>

          <Row justify="end">
            <Space>
              <Button onClick={() => setIsAddMemberModalVisible(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit">
                Thêm Vào Bể
              </Button>
            </Space>
          </Row>
        </Form>
      </Modal>

      {/* Modal xác nhận chạy bù thưởng */}
      <Modal
        title={
          <span>
            <ExclamationCircleOutlined style={{ color: '#cf1322', marginRight: 8 }} />
            Xác Nhận Bù Thưởng Bể Bị Thiếu
          </span>
        }
        open={isBackfillConfirmVisible}
        onCancel={() => setIsBackfillConfirmVisible(false)}
        width={720}
        okText="Chạy Bù Thưởng"
        cancelText="Hủy"
        okButtonProps={{
          danger: true,
          disabled: backfillConfirmText.trim().toUpperCase() !== BACKFILL_CONFIRM_PHRASE,
          loading: runningBackfill,
        }}
        onOk={handleRunBackfill}
        destroyOnClose
      >
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Thao tác cộng tiền thật, không tự hoàn tác được"
          description="Tiền sẽ được cộng thẳng vào ví rút của từng thành viên trong bể và ghi vào lịch sử chia thưởng. Hãy sao lưu database trước khi chạy."
        />

        <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Số đơn sẽ bù">
            <Text strong>{selectedBackfillOrderIds.length} đơn</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Số lượt bể bù">
            <Text strong>
              {selectedBackfillOrders.reduce(
                (acc: number, o: any) => acc + (o.missingPools?.length || 0),
                0,
              )}{' '}
              lượt
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Khoảng thời gian đơn">
            {selectedBackfillOrders.length > 0
              ? `${dayjs(
                  selectedBackfillOrders[selectedBackfillOrders.length - 1].createdAt,
                ).format('DD/MM/YYYY')} - ${dayjs(selectedBackfillOrders[0].createdAt).format(
                  'DD/MM/YYYY',
                )}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Tổng tiền sẽ cộng">
            <Text type="danger" strong style={{ fontSize: 16 }}>
              {formatVndFromUsd(backfillSelectedTotalUsd)}
            </Text>
          </Descriptions.Item>
        </Descriptions>

        <Table
          size="small"
          columns={backfillSummaryColumns}
          dataSource={backfillSummaryByPool}
          rowKey="poolCode"
          pagination={false}
          style={{ marginBottom: 16 }}
        />

        <Text>
          Gõ <Text code>{BACKFILL_CONFIRM_PHRASE}</Text> để mở khóa nút chạy:
        </Text>
        <Input
          value={backfillConfirmText}
          onChange={(e) => setBackfillConfirmText(e.target.value)}
          placeholder={BACKFILL_CONFIRM_PHRASE}
          style={{ marginTop: 8 }}
        />
      </Modal>

      {/* Modal kết quả chạy bù */}
      <Modal
        title="Kết Quả Bù Thưởng"
        open={Boolean(backfillResult)}
        onCancel={() => setBackfillResult(null)}
        footer={
          <Button type="primary" onClick={() => setBackfillResult(null)}>
            Đóng
          </Button>
        }
        width={720}
      >
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Đã bù">
            <Text type="success" strong>{backfillResult?.doneCount || 0} đơn</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Bỏ qua">
            {backfillResult?.skippedCount || 0} đơn
          </Descriptions.Item>
          <Descriptions.Item label="Lỗi">
            <Text type={backfillResult?.failedCount ? 'danger' : undefined}>
              {backfillResult?.failedCount || 0} đơn
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Tổng tiền đã cộng">
            <Text strong>{formatVndFromUsd(backfillResult?.totalPayoutUsd)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Vào ví rút">
            <Text strong>{formatVndFromUsd(backfillResult?.totalWithdrawUsd || 0)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Vào ví tiêu dùng">
            <Text strong>
              {formatVndFromUsd(backfillResult?.totalReconsumptionUsd || 0)}
            </Text>
          </Descriptions.Item>
        </Descriptions>

        <Table
          size="small"
          dataSource={(backfillResult?.results || []).filter((r: any) => r.status !== 'done')}
          rowKey="orderId"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Mọi đơn đã chọn đều được bù thành công' }}
          columns={[
            {
              title: 'Mã Đơn',
              dataIndex: 'orderId',
              key: 'orderId',
              render: (id: string) => <Text code>{id.slice(0, 8)}...</Text>,
            },
            {
              title: 'Trạng Thái',
              dataIndex: 'status',
              key: 'status',
              render: (status: string) => (
                <Tag color={status === 'failed' ? 'error' : 'default'}>{status}</Tag>
              ),
            },
            { title: 'Lý Do', dataIndex: 'message', key: 'message' },
          ]}
        />
      </Modal>
    </div>
  );
};

export default AgentPool;
