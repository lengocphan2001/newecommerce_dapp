import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  notification,
} from 'antd';
import { DollarOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../services/api';
import PageHeader from '../components/PageHeader';

const { Text } = Typography;

interface EligibleRow {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  personalSales: number;
  leftSales: number;
  rightSales: number;
  rewardSales: number;
  rewardSalesVnd: number;
  tierCode: string;
  tierLabel: string;
  rate: number;
  salaryAmount: number;
  withdrawAmount: number;
  reconsumptionAmount: number;
  taxAmount: number;
  paid: boolean;
  paidAmount: number;
  paidAt: string | null;
  paidBy: string | null;
}

interface TierSummary {
  code: string;
  label: string;
  minVnd: number;
  maxVnd: number | null;
  rate: number;
  minUsd: number | null;
  maxUsd: number | null;
  userCount: number;
  paidCount: number;
  totalSalary: number;
}

interface PaymentRow {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  email: string;
  month: string;
  rewardSales: number;
  tierMin: number;
  tierMax: number | null;
  tierCode: string | null;
  tierLabel: string | null;
  rate: number | null;
  vndRate: number | null;
  amount: number;
  withdrawAmount: number;
  reconsumptionAmount: number;
  taxAmount: number;
  note: string | null;
  paidBy: string | null;
  createdAt: string;
}

interface WalletDistribution {
  withdrawPercent: number;
  reconsumptionPercent: number;
  taxPercent: number;
}

/**
 * Mirrors the backend: salary for month M is paid from day 10 of month M+1.
 * The real wallet split comes from the API (shared with the agent pool); this
 * is only the fallback until it loads.
 */
const SALARY_PAY_DAY = 10;
const DEFAULT_DISTRIBUTION: WalletDistribution = {
  withdrawPercent: 70,
  reconsumptionPercent: 20,
  taxPercent: 10,
};

const TIER_COLORS: Record<string, string> = {
  T1: 'blue',
  T2: 'green',
  T3: 'orange',
  T4: 'red',
};

/** Most recent month whose salary can already be paid. */
const latestPayableMonth = () =>
  dayjs().subtract(dayjs().date() >= SALARY_PAY_DAY ? 1 : 2, 'month');

const money = (v: number) =>
  Number(v || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const vnd = (v: number) => `${Math.round(Number(v) || 0).toLocaleString('vi-VN')} ₫`;

const percent = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;

const formatDateTime = (v?: string | null) =>
  v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—';

const errorMessage = (e: any) =>
  e?.response?.data?.message
    ? Array.isArray(e.response.data.message)
      ? e.response.data.message.join(', ')
      : e.response.data.message
    : e?.message;

const sumBy = (rows: EligibleRow[], pick: (r: EligibleRow) => number) =>
  rows.reduce((s, r) => s + (Number(pick(r)) || 0), 0);

type PayRequest = { mode: 'selected' | 'all'; rows: EligibleRow[] };

const MonthlySalary: React.FC = () => {
  const [month, setMonth] = useState<Dayjs>(latestPayableMonth());
  const [activeTab, setActiveTab] = useState('eligible');

  // Qualifying users
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EligibleRow[]>([]);
  const [tiers, setTiers] = useState<TierSummary[]>([]);
  const [vndRate, setVndRate] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payableFrom, setPayableFrom] = useState<Dayjs>(
    latestPayableMonth().add(1, 'month').date(SALARY_PAY_DAY).startOf('day'),
  );
  const [payable, setPayable] = useState(true);
  const [distribution, setDistribution] =
    useState<WalletDistribution>(DEFAULT_DISTRIBUTION);

  // Pay modal
  const [payRequest, setPayRequest] = useState<PayRequest | null>(null);
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);

  // History
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotals, setHistoryTotals] = useState({
    amount: 0,
    withdraw: 0,
    reconsumption: 0,
    tax: 0,
  });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [historySearch, setHistorySearch] = useState('');
  const [historyAllMonths, setHistoryAllMonths] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const monthStr = month.format('YYYY-MM');
  const rateReady = !!vndRate;
  const canPay = payable && rateReady;

  const fetchEligible = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/salary/eligible', { params: { month: monthStr } });
      setRows(res.data?.rows || []);
      setTiers(res.data?.tiers || []);
      setVndRate(res.data?.vndRate ?? null);
      setPayable(!!res.data?.payable);
      if (res.data?.payableFrom) setPayableFrom(dayjs(res.data.payableFrom));
      if (res.data?.distribution) setDistribution(res.data.distribution);
      setSelectedIds([]);
    } catch (e: any) {
      notification.error({ message: 'Lỗi tải danh sách', description: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (page = historyPage, pageSize = historyPageSize) => {
    try {
      setHistoryLoading(true);
      const res = await api.get('/admin/salary/payments', {
        params: {
          ...(historyAllMonths ? {} : { month: monthStr }),
          ...(historySearch.trim() ? { search: historySearch.trim() } : {}),
          page,
          limit: pageSize,
        },
      });
      setHistory(res.data?.items || []);
      setHistoryTotal(res.data?.total || 0);
      setHistoryTotals({
        amount: res.data?.totalAmount || 0,
        withdraw: res.data?.totalWithdrawAmount || 0,
        reconsumption: res.data?.totalReconsumptionAmount || 0,
        tax: res.data?.totalTaxAmount || 0,
      });
    } catch (e: any) {
      notification.error({ message: 'Lỗi tải lịch sử', description: errorMessage(e) });
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchEligible();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    setHistoryPage(1);
    fetchHistory(1, historyPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, monthStr, historyAllMonths]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (tierFilter === 'all' || r.tierCode === tierFilter) &&
        (statusFilter === 'all' || (statusFilter === 'paid') === r.paid) &&
        (!q ||
          r.username.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q)),
    );
  }, [rows, search, tierFilter, statusFilter]);

  const unpaidRows = rows.filter((r) => !r.paid);
  const paidRows = rows.filter((r) => r.paid);

  const openPay = (request: PayRequest) => {
    if (request.rows.length === 0) return;
    setNote('');
    setPayRequest(request);
  };

  const submitPay = async () => {
    if (!payRequest) return;
    try {
      setPaying(true);
      const res = await api.post('/admin/salary/pay', {
        month: monthStr,
        ...(payRequest.mode === 'all'
          ? { all: true }
          : { userIds: payRequest.rows.map((r) => r.userId) }),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      notification.success({
        message: 'Đã trả lương',
        description: `${res.data?.count ?? payRequest.rows.length} user, tổng ${money(
          res.data?.totalAmount ?? 0,
        )} USDT: ví rút ${money(res.data?.totalWithdrawAmount ?? 0)}, ví tiêu dùng ${money(
          res.data?.totalReconsumptionAmount ?? 0,
        )}, thuế ${money(res.data?.totalTaxAmount ?? 0)}.`,
      });
      setPayRequest(null);
      fetchEligible();
      if (activeTab === 'history') fetchHistory();
    } catch (e: any) {
      notification.error({ message: 'Trả lương thất bại', description: errorMessage(e) });
    } finally {
      setPaying(false);
    }
  };

  const tierTag = (code: string | null, label: string | null) => (
    <Tag color={(code && TIER_COLORS[code]) || 'default'}>{label || code}</Tag>
  );

  const eligibleColumns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      fixed: 'left' as const,
      width: 160,
      render: (v: string, r: EligibleRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.fullName}
          </Text>
        </div>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 200, ellipsis: true },
    {
      title: 'DS tính thưởng',
      dataIndex: 'rewardSales',
      key: 'rewardSales',
      width: 170,
      align: 'right' as const,
      defaultSortOrder: 'descend' as const,
      sorter: (a: EligibleRow, b: EligibleRow) => a.rewardSales - b.rewardSales,
      render: (v: number, r: EligibleRow) => (
        <div>
          <Text strong style={{ color: '#fa8c16' }}>
            {money(v)}
          </Text>
          <div style={{ fontSize: 12 }}>
            <Text type="secondary">≈ {vnd(r.rewardSalesVnd)}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Mốc',
      dataIndex: 'tierCode',
      key: 'tierCode',
      width: 230,
      render: (_: string, r: EligibleRow) => (
        <Space size={4} wrap>
          {tierTag(r.tierCode, r.tierLabel)}
          <Text strong>{percent(r.rate)}</Text>
        </Space>
      ),
    },
    {
      title: 'Lương gộp (USDT)',
      dataIndex: 'salaryAmount',
      key: 'salaryAmount',
      width: 140,
      align: 'right' as const,
      sorter: (a: EligibleRow, b: EligibleRow) => a.salaryAmount - b.salaryAmount,
      render: (v: number) => <Text strong>{money(v)}</Text>,
    },
    {
      title: `Ví rút (${distribution.withdrawPercent}%)`,
      dataIndex: 'withdrawAmount',
      key: 'withdrawAmount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => money(v),
    },
    {
      title: `Ví tiêu dùng (${distribution.reconsumptionPercent}%)`,
      dataIndex: 'reconsumptionAmount',
      key: 'reconsumptionAmount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => money(v),
    },
    {
      title: `Thuế (${distribution.taxPercent}%)`,
      dataIndex: 'taxAmount',
      key: 'taxAmount',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <Text type="danger">{money(v)}</Text>,
    },
    {
      title: 'Trạng thái',
      key: 'paid',
      width: 180,
      render: (_: any, r: EligibleRow) =>
        r.paid ? (
          <div>
            <Tag color="success">Đã trả {money(r.paidAmount)}</Tag>
            <div style={{ fontSize: 12 }}>
              <Text type="secondary">
                {formatDateTime(r.paidAt)}
                {r.paidBy ? ` • ${r.paidBy}` : ''}
              </Text>
            </div>
          </div>
        ) : (
          <Tag>Chưa trả</Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 110,
      fixed: 'right' as const,
      render: (_: any, r: EligibleRow) => (
        <Button
          size="small"
          type="primary"
          ghost
          disabled={!canPay || r.paid}
          onClick={() => openPay({ mode: 'selected', rows: [r] })}
        >
          Trả lương
        </Button>
      ),
    },
  ];

  const historyColumns = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 160,
      render: (v: string, r: PaymentRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Tháng',
      dataIndex: 'month',
      key: 'month',
      width: 90,
      render: (v: string) => dayjs(`${v}-01`).format('MM/YYYY'),
    },
    {
      title: 'DS tính thưởng',
      dataIndex: 'rewardSales',
      key: 'rewardSales',
      width: 150,
      align: 'right' as const,
      render: (v: number, r: PaymentRow) => (
        <div>
          {money(v)}
          {r.vndRate ? (
            <div style={{ fontSize: 12 }}>
              <Text type="secondary">≈ {vnd(v * r.vndRate)}</Text>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Mốc',
      key: 'tier',
      width: 250,
      render: (_: any, r: PaymentRow) =>
        r.tierCode ? (
          <Space size={4} wrap>
            {tierTag(r.tierCode, r.tierLabel)}
            {r.rate !== null && <Text strong>{percent(r.rate)}</Text>}
          </Space>
        ) : (
          // Paid before automatic tiers: the admin-entered USD tier.
          <Tag>
            {r.tierMax === null
              ? `≥ ${money(r.tierMin)}`
              : `${money(r.tierMin)} – dưới ${money(r.tierMax)}`}
          </Tag>
        ),
    },
    {
      title: 'Tỷ giá',
      dataIndex: 'vndRate',
      key: 'vndRate',
      width: 100,
      align: 'right' as const,
      render: (v: number | null) => (v ? Number(v).toLocaleString('vi-VN') : '—'),
    },
    {
      title: 'Lương gộp (USDT)',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => <Text strong>{money(v)}</Text>,
    },
    {
      title: `Ví rút (${distribution.withdrawPercent}%)`,
      dataIndex: 'withdrawAmount',
      key: 'withdrawAmount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#10B981' }}>+{money(v)}</Text>,
    },
    {
      title: `Ví tiêu dùng (${distribution.reconsumptionPercent}%)`,
      dataIndex: 'reconsumptionAmount',
      key: 'reconsumptionAmount',
      width: 150,
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#10B981' }}>+{money(v)}</Text>,
    },
    {
      title: `Thuế (${distribution.taxPercent}%)`,
      dataIndex: 'taxAmount',
      key: 'taxAmount',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Text type="danger">-{money(v)}</Text>,
    },
    { title: 'Ghi chú', dataIndex: 'note', key: 'note', width: 220, ellipsis: true },
    { title: 'Người trả', dataIndex: 'paidBy', key: 'paidBy', width: 160, ellipsis: true },
  ];

  const payRows = payRequest?.rows || [];

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <PageHeader
        title={
          <>
            <DollarOutlined style={{ marginRight: 10, color: '#10B981' }} />
            Lương tháng
          </>
        }
        description={`Ngày ${SALARY_PAY_DAY} hàng tháng trả lương tháng trước cho user có doanh số tính thưởng (doanh số nhánh yếu của tháng) đạt mốc. Lương = doanh số tính thưởng × tỷ lệ của mốc, tự tính theo tỷ giá USDT/VND trong Banking Settings; mỗi user nhận 1 lần/tháng. Lương trả giống bể đồng chia đại lý: ${distribution.withdrawPercent}% ví rút, ${distribution.reconsumptionPercent}% ví tiêu dùng, ${distribution.taxPercent}% thuế (trừ luôn).`}
        actions={
          <>
            <DatePicker
              picker="month"
              value={month}
              onChange={(v) => v && setMonth(v)}
              format="MM/YYYY"
              allowClear={false}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => (activeTab === 'history' ? fetchHistory() : fetchEligible())}
              loading={loading || historyLoading}
            >
              Tải lại
            </Button>
          </>
        }
      />

      {!loading && !rateReady && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Chưa cấu hình tỷ giá USDT/VND"
          description="Mốc lương tính bằng VND nên cần tỷ giá “nạp / thanh toán chuyển khoản” trong Banking Settings để quy đổi doanh số. Cấu hình xong bấm Tải lại."
        />
      )}

      {!loading && !payable && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Chưa đến ngày trả lương tháng ${month.format('MM/YYYY')}`}
          description={`Lương tháng ${month.format('MM/YYYY')} được trả từ ngày ${payableFrom.format(
            'DD/MM/YYYY',
          )}. Hiện chỉ xem được danh sách.`}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {tiers.map((t) => (
          <Col xs={24} sm={12} lg={6} key={t.code}>
            <Card
              size="small"
              hoverable
              onClick={() => setTierFilter(tierFilter === t.code ? 'all' : t.code)}
              style={tierFilter === t.code ? { borderColor: '#10B981' } : undefined}
            >
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Space size={4} wrap>
                  {tierTag(t.code, t.label)}
                  <Text strong>{percent(t.rate)}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t.minUsd === null
                    ? 'Chưa có tỷ giá'
                    : t.maxUsd === null
                      ? `≥ ${money(t.minUsd)} USD`
                      : `${money(t.minUsd)} – dưới ${money(t.maxUsd)} USD`}
                </Text>
                <Text>
                  {t.userCount} user • đã trả {t.paidCount}
                </Text>
                <Text>
                  Tổng lương: <Text strong>{money(t.totalSalary)}</Text> USDT
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="User đạt mốc"
              value={rows.length}
              suffix={vndRate ? <Text type="secondary" style={{ fontSize: 13 }}>tỷ giá {vndRate.toLocaleString('vi-VN')}</Text> : null}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Đã nhận lương tháng này" value={paidRows.length} suffix={`/ ${rows.length}`} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Lương gộp đã trả / còn phải trả (USDT)"
              value={`${money(sumBy(paidRows, (r) => r.paidAmount))} / ${money(
                sumBy(unpaidRows, (r) => r.salaryAmount),
              )}`}
              valueStyle={{ color: '#10B981', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'eligible',
              label: 'Danh sách đạt mốc',
              children: (
                <>
                  <Space wrap align="center" style={{ marginBottom: 12 }}>
                    <Select
                      value={tierFilter}
                      onChange={setTierFilter}
                      style={{ width: 240 }}
                      options={[
                        { label: 'Tất cả mốc', value: 'all' },
                        ...tiers.map((t) => ({ label: `${t.label} (${percent(t.rate)})`, value: t.code })),
                      ]}
                    />
                    <Select
                      value={statusFilter}
                      onChange={setStatusFilter}
                      style={{ width: 140 }}
                      options={[
                        { label: 'Tất cả', value: 'all' },
                        { label: 'Chưa trả', value: 'unpaid' },
                        { label: 'Đã trả', value: 'paid' },
                      ]}
                    />
                    <Input
                      placeholder="Tìm username / tên / email..."
                      prefix={<SearchOutlined />}
                      allowClear
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ width: 240, maxWidth: '100%' }}
                    />
                    <Button
                      type="primary"
                      icon={<DollarOutlined />}
                      disabled={!canPay || selectedIds.length === 0}
                      onClick={() =>
                        openPay({
                          mode: 'selected',
                          rows: rows.filter((r) => selectedIds.includes(r.userId) && !r.paid),
                        })
                      }
                    >
                      Trả lương {selectedIds.length} user đã chọn
                    </Button>
                    <Button
                      type="primary"
                      danger
                      icon={<DollarOutlined />}
                      disabled={!canPay || unpaidRows.length === 0}
                      onClick={() => openPay({ mode: 'all', rows: unpaidRows })}
                    >
                      Trả tất cả chưa nhận ({unpaidRows.length})
                    </Button>
                  </Space>
                  <Table
                    rowKey="userId"
                    dataSource={filteredRows}
                    columns={eligibleColumns}
                    loading={loading}
                    scroll={{ x: 1600 }}
                    size="middle"
                    pagination={{
                      pageSize: 50,
                      showSizeChanger: true,
                      showTotal: (t) => `${t} user`,
                    }}
                    rowSelection={{
                      selectedRowKeys: selectedIds,
                      preserveSelectedRowKeys: true,
                      onChange: (keys) => setSelectedIds(keys as string[]),
                      getCheckboxProps: (r: EligibleRow) => ({ disabled: r.paid }),
                    }}
                  />
                </>
              ),
            },
            {
              key: 'history',
              label: 'Lịch sử trả lương',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Input.Search
                      placeholder="Tìm username / tên / email..."
                      allowClear
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      onSearch={() => {
                        setHistoryPage(1);
                        fetchHistory(1, historyPageSize);
                      }}
                      style={{ width: 280, maxWidth: '100%' }}
                    />
                    <Select
                      value={historyAllMonths ? 'all' : 'month'}
                      onChange={(v) => setHistoryAllMonths(v === 'all')}
                      options={[
                        { label: `Tháng ${month.format('MM/YYYY')}`, value: 'month' },
                        { label: 'Tất cả các tháng', value: 'all' },
                      ]}
                      style={{ width: 180 }}
                    />
                    <Text>
                      Tổng gộp: <Text strong>{money(historyTotals.amount)}</Text> • Ví rút:{' '}
                      <Text strong>{money(historyTotals.withdraw)}</Text> • Ví tiêu dùng:{' '}
                      <Text strong>{money(historyTotals.reconsumption)}</Text> • Thuế:{' '}
                      <Text strong>{money(historyTotals.tax)}</Text> USDT
                    </Text>
                  </Space>
                  <Table
                    rowKey="id"
                    dataSource={history}
                    columns={historyColumns}
                    loading={historyLoading}
                    scroll={{ x: 1850 }}
                    size="middle"
                    pagination={{
                      current: historyPage,
                      pageSize: historyPageSize,
                      total: historyTotal,
                      showSizeChanger: true,
                      showTotal: (t) => `${t} lần trả`,
                      onChange: (page, pageSize) => {
                        setHistoryPage(page);
                        setHistoryPageSize(pageSize);
                        fetchHistory(page, pageSize);
                      },
                    }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={`Trả lương tháng ${month.format('MM/YYYY')}`}
        open={!!payRequest}
        onCancel={() => !paying && setPayRequest(null)}
        onOk={submitPay}
        okText="Xác nhận trả lương"
        cancelText="Hủy"
        confirmLoading={paying}
        destroyOnClose
      >
        {payRequest && (
          <>
            <div style={{ marginBottom: 12 }}>
              {payRequest.mode === 'all' ? (
                <Text>
                  Trả lương cho <Text strong>tất cả {payRows.length}</Text> user đạt mốc chưa nhận
                  lương tháng này (mọi mốc).
                </Text>
              ) : payRows.length === 1 ? (
                <Space direction="vertical" size={2}>
                  <Text>
                    User: <Text strong>{payRows[0].username}</Text>
                  </Text>
                  <Text>
                    DS tính thưởng {money(payRows[0].rewardSales)} (≈ {vnd(payRows[0].rewardSalesVnd)})
                  </Text>
                  <Space size={4} wrap>
                    {tierTag(payRows[0].tierCode, payRows[0].tierLabel)}
                    <Text strong>{percent(payRows[0].rate)}</Text>
                  </Space>
                </Space>
              ) : (
                <Text>
                  Trả lương cho <Text strong>{payRows.length}</Text> user đã chọn.
                </Text>
              )}
            </div>
            <Alert
              type="success"
              style={{ marginBottom: 12 }}
              message={
                <div>
                  <div>
                    Lương gộp: <Text strong>{money(sumBy(payRows, (r) => r.salaryAmount))}</Text> USDT
                  </div>
                  <div>
                    Ví rút <Text strong>{money(sumBy(payRows, (r) => r.withdrawAmount))}</Text> • ví
                    tiêu dùng <Text strong>{money(sumBy(payRows, (r) => r.reconsumptionAmount))}</Text>{' '}
                    • thuế <Text type="danger">{money(sumBy(payRows, (r) => r.taxAmount))}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Số tiền được server tính lại khi trả; mỗi user chỉ nhận 1 lần/tháng.
                  </Text>
                </div>
              }
            />
            <div style={{ marginBottom: 4 }}>Ghi chú</div>
            <Input.TextArea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`VD: Lương tháng ${month.format('MM/YYYY')}`}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default MonthlySalary;
