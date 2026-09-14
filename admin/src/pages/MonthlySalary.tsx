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
  rank: string;
  personalSales: number;
  groupSales: number;
  isProcessed: boolean;
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
  rank: string;
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

const RANKS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];

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

  // Eligible agents
  const [loading, setLoading] = useState(false);
  const [closed, setClosed] = useState(true);
  const [payableFrom, setPayableFrom] = useState<Dayjs>(
    latestPayableMonth().add(1, 'month').date(SALARY_PAY_DAY).startOf('day'),
  );
  const [payable, setPayable] = useState(true);
  const [distribution, setDistribution] =
    useState<WalletDistribution>(DEFAULT_DISTRIBUTION);
  const [rows, setRows] = useState<EligibleRow[]>([]);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const fetchEligible = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/salary/eligible', {
        params: { month: monthStr },
      });
      setRows(res.data?.rows || []);
      setClosed(!!res.data?.closed);
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
        (rankFilter.length === 0 || rankFilter.includes(r.rank)) &&
        (!q ||
          r.username.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q)),
    );
  }, [rows, search, rankFilter]);

  const paidUsers = rows.filter((r) => r.paidCount > 0).length;
  const paidTotal = rows.reduce((s, r) => s + r.paidAmount, 0);

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
        note: values.note,
        items: payTargets.map((t) => ({ userId: t.userId, amount: values.amount })),
      });
      notification.success({
        message: 'Đã cộng lương',
        description: `${res.data?.count ?? payTargets.length} user, tổng ${money(
          res.data?.totalAmount ?? 0,
        )} USDT: ví rút ${money(res.data?.totalWithdrawAmount ?? 0)}, ví tiêu dùng ${money(
          res.data?.totalReconsumptionAmount ?? 0,
        )}, thuế ${money(res.data?.totalTaxAmount ?? 0)}.`,
      });
      setPayTargets(null);
      fetchEligible();
      if (activeTab === 'history') fetchHistory();
    } catch (e: any) {
      notification.error({ message: 'Cộng lương thất bại', description: errorMessage(e) });
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
      width: 150,
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
      title: 'Cấp bậc',
      dataIndex: 'rank',
      key: 'rank',
      width: 90,
      sorter: (a: EligibleRow, b: EligibleRow) =>
        RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank),
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'DS cá nhân',
      dataIndex: 'personalSales',
      key: 'personalSales',
      width: 130,
      align: 'right' as const,
      sorter: (a: EligibleRow, b: EligibleRow) => a.personalSales - b.personalSales,
      render: (v: number) => money(v),
    },
    {
      title: 'DS nhóm',
      dataIndex: 'groupSales',
      key: 'groupSales',
      width: 130,
      align: 'right' as const,
      sorter: (a: EligibleRow, b: EligibleRow) => a.groupSales - b.groupSales,
      render: (v: number) => money(v),
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
      width: 120,
      fixed: 'right' as const,
      render: (_: any, r: EligibleRow) => (
        <Button
          size="small"
          type="primary"
          ghost
          disabled={!payable}
          onClick={() => openPay([r])}
        >
          Cộng lương
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
      width: 150,
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
      title: 'Cấp bậc',
      dataIndex: 'rank',
      key: 'rank',
      width: 90,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
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
            Lương tháng đại lý
          </>
        }
        description={`Ngày ${SALARY_PAY_DAY} hàng tháng trả lương cho user đạt cấp đại lý C1 trở lên, dựa trên kết quả chốt doanh số tháng trước. Lương chia ${distribution.withdrawPercent}% ví rút, ${distribution.reconsumptionPercent}% ví tiêu dùng, ${distribution.taxPercent}% thuế (trừ luôn) và hiển thị trong lịch sử hoạt động ví của user.`}
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

      {!loading && !closed && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Tháng ${month.format('MM/YYYY')} chưa chốt doanh số`}
          description="Vào Monthly Rewards → Tính toán & Chốt số để chốt tháng này trước, sau đó quay lại trả lương."
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
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="User đạt chuẩn (C1+)" value={rows.length} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Đã nhận lương" value={paidUsers} suffix={`/ ${rows.length}`} />
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
              label: 'Danh sách đạt chuẩn',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Input
                      placeholder="Tìm username / tên / email..."
                      prefix={<SearchOutlined />}
                      allowClear
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ width: 260, maxWidth: '100%' }}
                    />
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="Lọc cấp bậc"
                      value={rankFilter}
                      onChange={setRankFilter}
                      options={RANKS.map((r) => ({ label: r, value: r }))}
                      style={{ minWidth: 180, maxWidth: '100%' }}
                    />
                    <Button
                      type="primary"
                      icon={<DollarOutlined />}
                      disabled={!payable || selectedIds.length === 0}
                      onClick={() =>
                        openPay(rows.filter((r) => selectedIds.includes(r.userId)))
                      }
                    >
                      Cộng lương cho {selectedIds.length} user đã chọn
                    </Button>
                  </Space>
                  <Table
                    rowKey="userId"
                    dataSource={filteredRows}
                    columns={eligibleColumns}
                    loading={loading}
                    scroll={{ x: 1100 }}
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
                    scroll={{ x: 1400 }}
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
        title={`Cộng lương tháng ${month.format('MM/YYYY')}`}
        open={!!payTargets}
        onCancel={() => !paying && setPayTargets(null)}
        onOk={submitPay}
        okText="Xác nhận cộng lương"
        cancelText="Hủy"
        confirmLoading={paying}
        destroyOnClose
      >
        {payTargets && (
          <>
            <div style={{ marginBottom: 12 }}>
              {payTargets.length === 1 ? (
                <Text>
                  User: <Text strong>{payTargets[0].username}</Text>{' '}
                  <Tag color="blue">{payTargets[0].rank}</Tag>
                </Text>
              ) : (
                <Text>
                  Cộng cùng số tiền cho <Text strong>{payTargets.length}</Text> user đã chọn.
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
                <Input.TextArea rows={2} maxLength={500} placeholder="VD: Lương tháng C1" />
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
