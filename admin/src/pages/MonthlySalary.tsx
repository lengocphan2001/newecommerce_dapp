import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
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
import {
  DollarOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
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
  paidAmount: number;
  paidCount: number;
  lastPaidAt: string | null;
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

interface Tier {
  min: number | null;
  max: number | null;
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

/** Most recent month whose salary can already be paid. */
const latestPayableMonth = () =>
  dayjs().subtract(dayjs().date() >= SALARY_PAY_DAY ? 1 : 2, 'month');

/** Same rounding as the backend split: 4 decimals, tax takes the remainder. */
const splitSalary = (amount: number, d: WalletDistribution) => {
  const withdraw = Number(((amount * d.withdrawPercent) / 100).toFixed(4));
  const reconsumption = Number(((amount * d.reconsumptionPercent) / 100).toFixed(4));
  const tax = Number((amount - withdraw - reconsumption).toFixed(4));
  return { withdraw, reconsumption, tax };
};

const money = (v: number) =>
  Number(v || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const tierText = (min: number | null, max: number | null) => {
  if (!min && max === null) return 'Tất cả';
  if (max === null) return `≥ ${money(min || 0)}`;
  return `${money(min || 0)} – dưới ${money(max)}`;
};

const formatDateTime = (v?: string | null) =>
  v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—';

const errorMessage = (e: any) =>
  e?.response?.data?.message
    ? Array.isArray(e.response.data.message)
      ? e.response.data.message.join(', ')
      : e.response.data.message
    : e?.message;

const MonthlySalary: React.FC = () => {
  const [month, setMonth] = useState<Dayjs>(latestPayableMonth());
  const [activeTab, setActiveTab] = useState('eligible');

  // Tier filter: `draftTier` is what the inputs show, `tier` what was loaded.
  const [draftTier, setDraftTier] = useState<Tier>({ min: null, max: null });
  const [tier, setTier] = useState<Tier>({ min: null, max: null });

  // Eligible users
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EligibleRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payableFrom, setPayableFrom] = useState<Dayjs>(
    latestPayableMonth().add(1, 'month').date(SALARY_PAY_DAY).startOf('day'),
  );
  const [payable, setPayable] = useState(true);
  const [distribution, setDistribution] =
    useState<WalletDistribution>(DEFAULT_DISTRIBUTION);

  // Pay modal
  const [payTargets, setPayTargets] = useState<EligibleRow[] | null>(null);
  const [paying, setPaying] = useState(false);
  const [form] = Form.useForm<{ amount: number; note?: string }>();
  const amount = Form.useWatch('amount', form);

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
  const tierReady = (tier.min || 0) > 0;

  const fetchEligible = async (targetTier: Tier = tier) => {
    if (targetTier.min !== null && targetTier.max !== null && targetTier.max <= targetTier.min) {
      notification.warning({ message: 'Mốc "đến" phải lớn hơn mốc "từ"' });
      return;
    }
    try {
      setLoading(true);
      const res = await api.get('/admin/salary/eligible', {
        params: {
          month: monthStr,
          ...(targetTier.min !== null ? { minSales: targetTier.min } : {}),
          ...(targetTier.max !== null ? { maxSales: targetTier.max } : {}),
        },
      });
      setRows(res.data?.rows || []);
      setPayable(!!res.data?.payable);
      if (res.data?.payableFrom) setPayableFrom(dayjs(res.data.payableFrom));
      if (res.data?.distribution) setDistribution(res.data.distribution);
      setTier(targetTier);
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
    fetchEligible(tier);
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
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.username.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.userId.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const paidUsers = rows.filter((r) => r.paidCount > 0).length;
  const paidTotal = rows.reduce((s, r) => s + r.paidAmount, 0);
  const canPay = payable && tierReady;

  const openPay = (targets: EligibleRow[]) => {
    if (targets.length === 0) return;
    form.resetFields();
    setPayTargets(targets);
  };

  const submitPay = async () => {
    if (!payTargets) return;
    const values = await form.validateFields();
    try {
      setPaying(true);
      const res = await api.post('/admin/salary/pay', {
        month: monthStr,
        minSales: tier.min,
        ...(tier.max !== null ? { maxSales: tier.max } : {}),
        note: values.note,
        items: payTargets.map((t) => ({ userId: t.userId, amount: values.amount })),
      });
      notification.success({
        message: 'Đã trả lương',
        description: `${res.data?.count ?? payTargets.length} user, tổng ${money(
          res.data?.totalAmount ?? 0,
        )} USDT: ví rút ${money(res.data?.totalWithdrawAmount ?? 0)}, ví tiêu dùng ${money(
          res.data?.totalReconsumptionAmount ?? 0,
        )}, thuế ${money(res.data?.totalTaxAmount ?? 0)}.`,
      });
      setPayTargets(null);
      fetchEligible(tier);
      if (activeTab === 'history') fetchHistory();
    } catch (e: any) {
      notification.error({ message: 'Trả lương thất bại', description: errorMessage(e) });
    } finally {
      setPaying(false);
    }
  };

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
      title: 'DS cá nhân',
      dataIndex: 'personalSales',
      key: 'personalSales',
      width: 120,
      align: 'right' as const,
      sorter: (a: EligibleRow, b: EligibleRow) => a.personalSales - b.personalSales,
      render: (v: number) => money(v),
    },
    {
      title: 'Nhánh trái',
      dataIndex: 'leftSales',
      key: 'leftSales',
      width: 120,
      align: 'right' as const,
      render: (v: number) => money(v),
    },
    {
      title: 'Nhánh phải',
      dataIndex: 'rightSales',
      key: 'rightSales',
      width: 120,
      align: 'right' as const,
      render: (v: number) => money(v),
    },
    {
      title: 'DS tính thưởng',
      dataIndex: 'rewardSales',
      key: 'rewardSales',
      width: 140,
      align: 'right' as const,
      defaultSortOrder: 'descend' as const,
      sorter: (a: EligibleRow, b: EligibleRow) => a.rewardSales - b.rewardSales,
      render: (v: number) => (
        <Text strong style={{ color: '#fa8c16' }}>
          {money(v)}
        </Text>
      ),
    },
    {
      title: 'Đã trả tháng này (gộp, USDT)',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      width: 190,
      align: 'right' as const,
      sorter: (a: EligibleRow, b: EligibleRow) => a.paidAmount - b.paidAmount,
      render: (v: number, r: EligibleRow) =>
        r.paidCount > 0 ? (
          <div>
            <Text strong style={{ color: '#10B981' }}>
              {money(v)}
            </Text>
            <div style={{ fontSize: 12 }}>
              <Text type="secondary">
                {r.paidCount} lần • {formatDateTime(r.lastPaidAt)}
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
        <Button size="small" type="primary" ghost disabled={!canPay} onClick={() => openPay([r])}>
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
      width: 130,
      align: 'right' as const,
      render: (v: number) => money(v),
    },
    {
      title: 'Mốc',
      key: 'tier',
      width: 170,
      render: (_: any, r: PaymentRow) => <Tag color="orange">{tierText(r.tierMin, r.tierMax)}</Tag>,
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

  const alreadyPaidTargets = (payTargets || []).filter((t) => t.paidCount > 0);

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <PageHeader
        title={
          <>
            <DollarOutlined style={{ marginRight: 10, color: '#10B981' }} />
            Lương tháng
          </>
        }
        description={`Ngày ${SALARY_PAY_DAY} hàng tháng trả lương cho user có doanh số tính thưởng (doanh số nhánh yếu) của tháng trước đạt mốc. Lọc theo từng mốc rồi trả mức lương của mốc đó. Lương trả giống bể đồng chia đại lý: ${distribution.withdrawPercent}% ví rút, ${distribution.reconsumptionPercent}% ví tiêu dùng, ${distribution.taxPercent}% thuế (trừ luôn).`}
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
              onClick={() => (activeTab === 'history' ? fetchHistory() : fetchEligible(tier))}
              loading={loading || historyLoading}
            >
              Tải lại
            </Button>
          </>
        }
      />

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
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title={`User đạt mốc ${tierText(tier.min, tier.max)}`} value={rows.length} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Đã nhận lương tháng này" value={paidUsers} suffix={`/ ${rows.length}`} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Tổng lương gộp đã trả (USDT)"
              value={paidTotal}
              precision={2}
              valueStyle={{ color: '#10B981' }}
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
                  <Space wrap align="end" style={{ marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>DS tính thưởng từ (≥)</div>
                      <InputNumber
                        min={0}
                        step={100}
                        placeholder="VD: 1000"
                        value={draftTier.min}
                        onChange={(v) => setDraftTier((t) => ({ ...t, min: v ?? null }))}
                        style={{ width: 160 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>đến dưới (&lt;, bỏ trống = không giới hạn)</div>
                      <InputNumber
                        min={0}
                        step={100}
                        placeholder="VD: 5000"
                        value={draftTier.max}
                        onChange={(v) => setDraftTier((t) => ({ ...t, max: v ?? null }))}
                        style={{ width: 160 }}
                      />
                    </div>
                    <Button
                      type="primary"
                      icon={<FilterOutlined />}
                      onClick={() => fetchEligible(draftTier)}
                      loading={loading}
                    >
                      Lọc theo mốc
                    </Button>
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
                        openPay(rows.filter((r) => selectedIds.includes(r.userId)))
                      }
                    >
                      Trả lương cho {selectedIds.length} user đã chọn
                    </Button>
                  </Space>
                  {!tierReady && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message="Nhập mốc doanh số tính thưởng rồi bấm “Lọc theo mốc” để trả lương. Mỗi lần trả áp dụng cho một mốc."
                    />
                  )}
                  <Table
                    rowKey="userId"
                    dataSource={filteredRows}
                    columns={eligibleColumns}
                    loading={loading}
                    scroll={{ x: 1200 }}
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
                    scroll={{ x: 1650 }}
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
        open={!!payTargets}
        onCancel={() => !paying && setPayTargets(null)}
        onOk={submitPay}
        okText="Xác nhận trả lương"
        cancelText="Hủy"
        confirmLoading={paying}
        destroyOnClose
      >
        {payTargets && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div>
                Mốc doanh số tính thưởng:{' '}
                <Tag color="orange">{tierText(tier.min, tier.max)}</Tag>
              </div>
              {payTargets.length === 1 ? (
                <Text>
                  User: <Text strong>{payTargets[0].username}</Text> (DS tính thưởng{' '}
                  {money(payTargets[0].rewardSales)})
                </Text>
              ) : (
                <Text>
                  Trả cùng mức lương cho <Text strong>{payTargets.length}</Text> user đã chọn.
                </Text>
              )}
            </div>
            {alreadyPaidTargets.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={`${alreadyPaidTargets.length} user đã nhận lương tháng này`}
                description={alreadyPaidTargets
                  .slice(0, 10)
                  .map((t) => `${t.username} (${money(t.paidAmount)})`)
                  .join(', ')}
              />
            )}
            <Form form={form} layout="vertical" preserve={false}>
              <Form.Item
                name="amount"
                label="Lương gộp mỗi user (USDT, trước thuế)"
                rules={[
                  { required: true, message: 'Nhập số tiền' },
                  {
                    type: 'number',
                    min: 0.00000001,
                    message: 'Số tiền phải lớn hơn 0',
                  },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={0} step={10} placeholder="VD: 100" />
              </Form.Item>
              <Form.Item name="note" label="Ghi chú">
                <Input.TextArea rows={2} maxLength={500} placeholder="VD: Lương mốc 1.000 – 5.000" />
              </Form.Item>
            </Form>
            {Number(amount) > 0 &&
              (() => {
                const each = splitSalary(Number(amount), distribution);
                const n = payTargets.length;
                return (
                  <Alert
                    type="success"
                    message={
                      <div>
                        <div>
                          Mỗi user: ví rút <Text strong>{money(each.withdraw)}</Text> • ví tiêu
                          dùng <Text strong>{money(each.reconsumption)}</Text> • thuế{' '}
                          <Text type="danger">{money(each.tax)}</Text>
                        </div>
                        {n > 1 && (
                          <div>
                            Tổng {n} user: gộp <Text strong>{money(Number(amount) * n)}</Text> •
                            ví rút <Text strong>{money(each.withdraw * n)}</Text> • ví tiêu dùng{' '}
                            <Text strong>{money(each.reconsumption * n)}</Text> • thuế{' '}
                            <Text type="danger">{money(each.tax * n)}</Text>
                          </div>
                        )}
                      </div>
                    }
                  />
                );
              })()}
          </>
        )}
      </Modal>
    </div>
  );
};

export default MonthlySalary;
