import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  notification,
} from 'antd';
import { DollarOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../services/api';

const { Text } = Typography;

interface RankRow {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  rank: string;
  rewardSales: number;
  c1Share: number;
  c2Share: number;
  salaryAmount: number;
  withdrawAmount: number;
  reconsumptionAmount: number;
  taxAmount: number;
  paid: boolean;
  paidAmount: number;
  paidAt: string | null;
  paidBy: string | null;
}

interface RankPool {
  code: string;
  label: string;
  ranks: string[];
  rate: number;
  memberCount: number;
  sales: number;
  poolAmount: number;
  share: number;
}

interface WalletDistribution {
  withdrawPercent: number;
  reconsumptionPercent: number;
  taxPercent: number;
}

const RANK_COLORS: Record<string, string> = { C1: 'blue', C2: 'purple' };

const money = (v: number) =>
  Number(v || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const percent = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;

const errorMessage = (e: any) =>
  e?.response?.data?.message
    ? Array.isArray(e.response.data.message)
      ? e.response.data.message.join(', ')
      : e.response.data.message
    : e?.message;

const sumBy = (rows: RankRow[], pick: (r: RankRow) => number) =>
  rows.reduce((s, r) => s + (Number(pick(r)) || 0), 0);

type PayRequest = { mode: 'selected' | 'all'; rows: RankRow[] };

/**
 * "Lương cấp bậc C1/C2" tab of the monthly salary page: C1 pool = 4% of the
 * C1 + C2 agents' reward sales shared equally among them, C2 pool = 2% of the
 * C2 agents' reward sales shared equally among C2. Amounts come from the server.
 */
const RankSalaryTab: React.FC<{ month: Dayjs; reloadKey: number }> = ({ month, reloadKey }) => {
  const monthStr = month.format('YYYY-MM');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RankRow[]>([]);
  const [pools, setPools] = useState<RankPool[]>([]);
  const [payable, setPayable] = useState(true);
  const [payableFrom, setPayableFrom] = useState<Dayjs | null>(null);
  const [distribution, setDistribution] = useState<WalletDistribution | null>(null);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payRequest, setPayRequest] = useState<PayRequest | null>(null);
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/salary/rank/eligible', {
        params: { month: monthStr },
      });
      setRows(res.data?.rows || []);
      setPools(res.data?.pools || []);
      setPayable(!!res.data?.payable);
      setPayableFrom(res.data?.payableFrom ? dayjs(res.data.payableFrom) : null);
      setDistribution(res.data?.distribution || null);
      setSelectedIds([]);
    } catch (e: any) {
      notification.error({
        message: 'Lỗi tải danh sách C1/C2',
        description: errorMessage(e),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr, reloadKey]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (rankFilter === 'all' || r.rank === rankFilter) &&
        (statusFilter === 'all' || (statusFilter === 'paid') === r.paid) &&
        (!q ||
          r.username.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q)),
    );
  }, [rows, search, rankFilter, statusFilter]);

  const payableRows = rows.filter((r) => !r.paid && r.salaryAmount > 0);
  const payRows = payRequest?.rows || [];

  const openPay = (request: PayRequest) => {
    if (request.rows.length === 0) return;
    setNote('');
    setPayRequest(request);
  };

  const submitPay = async () => {
    if (!payRequest) return;
    try {
      setPaying(true);
      const res = await api.post('/admin/salary/rank/pay', {
        month: monthStr,
        ...(payRequest.mode === 'all'
          ? { all: true }
          : { userIds: payRequest.rows.map((r) => r.userId) }),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      notification.success({
        message: 'Đã trả lương cấp bậc',
        description: `${res.data?.count ?? payRequest.rows.length} user, tổng ${money(
          res.data?.totalAmount ?? 0,
        )} USDT: ví rút ${money(res.data?.totalWithdrawAmount ?? 0)}, ví tiêu dùng ${money(
          res.data?.totalReconsumptionAmount ?? 0,
        )}, thuế ${money(res.data?.totalTaxAmount ?? 0)}.`,
      });
      setPayRequest(null);
      fetchRows();
    } catch (e: any) {
      notification.error({
        message: 'Trả lương thất bại',
        description: errorMessage(e),
      });
    } finally {
      setPaying(false);
    }
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      fixed: 'left' as const,
      width: 160,
      render: (v: string, r: RankRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v || '—'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.fullName}
          </Text>
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'rank',
      key: 'rank',
      width: 90,
      render: (v: string) => <Tag color={RANK_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'DS tính thưởng',
      dataIndex: 'rewardSales',
      key: 'rewardSales',
      width: 140,
      align: 'right' as const,
      sorter: (a: RankRow, b: RankRow) => a.rewardSales - b.rewardSales,
      render: (v: number) => (
        <Text strong style={{ color: '#fa8c16' }}>
          {money(v)}
        </Text>
      ),
    },
    {
      title: 'Phần bể C1',
      dataIndex: 'c1Share',
      key: 'c1Share',
      width: 120,
      align: 'right' as const,
      render: (v: number) => money(v),
    },
    {
      title: 'Phần bể C2',
      dataIndex: 'c2Share',
      key: 'c2Share',
      width: 120,
      align: 'right' as const,
      render: (v: number) => (v ? money(v) : '—'),
    },
    {
      title: 'Lương gộp (USDT)',
      dataIndex: 'salaryAmount',
      key: 'salaryAmount',
      width: 140,
      align: 'right' as const,
      sorter: (a: RankRow, b: RankRow) => a.salaryAmount - b.salaryAmount,
      render: (v: number) => <Text strong>{money(v)}</Text>,
    },
    {
      title: `Ví rút (${distribution?.withdrawPercent ?? '—'}%)`,
      dataIndex: 'withdrawAmount',
      key: 'withdrawAmount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => money(v),
    },
    {
      title: `Ví tiêu dùng (${distribution?.reconsumptionPercent ?? '—'}%)`,
      dataIndex: 'reconsumptionAmount',
      key: 'reconsumptionAmount',
      width: 140,
      align: 'right' as const,
      render: (v: number) => money(v),
    },
    {
      title: `Thuế (${distribution?.taxPercent ?? '—'}%)`,
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
      render: (_: any, r: RankRow) =>
        r.paid ? (
          <div>
            <Tag color="success">Đã trả {money(r.paidAmount)}</Tag>
            <div style={{ fontSize: 12 }}>
              <Text type="secondary">
                {r.paidAt ? dayjs(r.paidAt).format('DD/MM/YYYY HH:mm') : ''}
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
      render: (_: any, r: RankRow) => (
        <Button
          size="small"
          type="primary"
          ghost
          disabled={!payable || r.paid || r.salaryAmount <= 0}
          onClick={() => openPay({ mode: 'selected', rows: [r] })}
        >
          Trả lương
        </Button>
      ),
    },
  ];

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Lương cấp bậc C1/C2 tháng này"
        description="Bể C1 = 4% tổng doanh số tính thưởng của các user C1 + C2, chia đều cho C1 + C2 (C2 cũng nằm trong bể C1). Bể C2 = 2% tổng doanh số tính thưởng của các user C2, chia đều cho C2. Chỉ tính user đã vào bể C1/C2 trước khi hết tháng này (theo thời gian vào bể, gồm cả người được admin thêm tay; ai vào bể sau tháng không được tính); số tiền được server tính lại khi trả, mỗi user nhận 1 lần/tháng."
      />

      {!loading && !payable && payableFrom && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Lương tháng ${month.format('MM/YYYY')} được trả từ ngày ${payableFrom.format('DD/MM/YYYY')}. Hiện chỉ xem được danh sách.`}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
        {pools.map((p) => (
          <Col xs={24} md={12} key={p.code}>
            <Card size="small">
              <Space direction="vertical" size={2}>
                <Space size={4} wrap>
                  <Tag color={RANK_COLORS[p.code] || 'default'}>{p.label}</Tag>
                  <Text strong>{percent(p.rate)}</Text>
                </Space>
                <Text>
                  Tổng DS tính thưởng: <Text strong>{money(p.sales)}</Text> USD
                </Text>
                <Text>
                  Tiền bể:{' '}
                  <Text strong style={{ color: '#10B981' }}>
                    {money(p.poolAmount)}
                  </Text>{' '}
                  USDT • {p.memberCount} user • mỗi user <Text strong>{money(p.share)}</Text>
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Space wrap align="center" style={{ marginBottom: 12 }}>
        <Select
          value={rankFilter}
          onChange={setRankFilter}
          style={{ width: 140 }}
          options={[
            { label: 'Tất cả cấp', value: 'all' },
            { label: 'C1', value: 'C1' },
            { label: 'C2', value: 'C2' },
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
          disabled={!payable || selectedIds.length === 0}
          onClick={() =>
            openPay({
              mode: 'selected',
              rows: payableRows.filter((r) => selectedIds.includes(r.userId)),
            })
          }
        >
          Trả lương {selectedIds.length} user đã chọn
        </Button>
        <Button
          type="primary"
          danger
          icon={<DollarOutlined />}
          disabled={!payable || payableRows.length === 0}
          onClick={() => openPay({ mode: 'all', rows: payableRows })}
        >
          Trả tất cả chưa nhận ({payableRows.length})
        </Button>
        <Text>
          Đã trả:{' '}
          <Text strong>
            {money(
              sumBy(
                rows.filter((r) => r.paid),
                (r) => r.paidAmount,
              ),
            )}
          </Text>{' '}
          • Còn phải trả: <Text strong>{money(sumBy(payableRows, (r) => r.salaryAmount))}</Text>{' '}
          USDT
        </Text>
      </Space>

      <Table
        rowKey="userId"
        dataSource={filteredRows}
        columns={columns}
        loading={loading}
        scroll={{ x: 1650 }}
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
          getCheckboxProps: (r: RankRow) => ({
            disabled: r.paid || r.salaryAmount <= 0,
          }),
        }}
      />

      <Modal
        title={`Trả lương cấp bậc C1/C2 tháng ${month.format('MM/YYYY')}`}
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
                  Trả lương cho <Text strong>tất cả {payRows.length}</Text> user C1/C2 chưa nhận
                  lương cấp bậc tháng này.
                </Text>
              ) : payRows.length === 1 ? (
                <Text>
                  User <Text strong>{payRows[0].username}</Text> ({payRows[0].rank}): bể C1{' '}
                  {money(payRows[0].c1Share)}
                  {payRows[0].c2Share ? ` + bể C2 ${money(payRows[0].c2Share)}` : ''}
                </Text>
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
                    Lương gộp: <Text strong>{money(sumBy(payRows, (r) => r.salaryAmount))}</Text>{' '}
                    USDT
                  </div>
                  <div>
                    Ví rút <Text strong>{money(sumBy(payRows, (r) => r.withdrawAmount))}</Text> • ví
                    tiêu dùng{' '}
                    <Text strong>{money(sumBy(payRows, (r) => r.reconsumptionAmount))}</Text> • thuế{' '}
                    <Text type="danger">{money(sumBy(payRows, (r) => r.taxAmount))}</Text>
                  </div>
                </div>
              }
            />
            <div style={{ marginBottom: 4 }}>Ghi chú</div>
            <Input.TextArea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`VD: Lương cấp bậc tháng ${month.format('MM/YYYY')}`}
            />
          </>
        )}
      </Modal>
    </>
  );
};

export default RankSalaryTab;
