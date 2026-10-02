import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  notification,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '../components/PageHeader';
import {
  RewardEntry,
  RewardReportFilter,
  RewardSource,
  RewardStatus,
  RewardSummary,
  RewardSummaryGroup,
  RewardTimeseries,
  RewardTopUser,
  RewardUserInfo,
  rewardReportService,
} from '../services/rewardReportService';
import { downloadExcel, MONEY_FORMAT } from '../utils/excel';

const { Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * Fixed source order and color: a source keeps its color whatever the filter.
 * Categorical palette checked for color-vision deficiency on a white surface;
 * three slots are below 3:1 contrast, so every chart value is also in the tables.
 */
const SOURCES: Array<{ key: RewardSource; label: string; color: string }> = [
  { key: 'commission', label: 'Hoa hồng', color: '#2a78d6' },
  { key: 'heap', label: 'Heap Reward', color: '#eb6834' },
  { key: 'matrix', label: 'Matrix', color: '#1baf7a' },
  { key: 'agent_pool', label: 'Bể đồng chia đại lý', color: '#eda100' },
  { key: 'salary', label: 'Lương tháng', color: '#e87ba4' },
  { key: 'rank_salary', label: 'Lương cấp bậc C1/C2', color: '#008300' },
];
const SOURCE_BY_KEY = Object.fromEntries(SOURCES.map((s) => [s.key, s])) as Record<
  RewardSource,
  (typeof SOURCES)[number]
>;

const STATUSES: Array<{ key: RewardStatus; label: string; color: string }> = [
  { key: 'paid', label: 'Đã chi', color: 'green' },
  { key: 'pending', label: 'Chờ chi', color: 'gold' },
  { key: 'blocked', label: 'Bị chặn', color: 'red' },
  { key: 'cancelled', label: 'Đã hủy', color: 'default' },
];
const STATUS_BY_KEY = Object.fromEntries(STATUSES.map((s) => [s.key, s])) as Record<
  RewardStatus,
  (typeof STATUSES)[number]
>;

const COMMISSION_TYPES: Record<string, string> = {
  direct: 'Trực tiếp',
  indirect: 'Gián tiếp (F2)',
  product: 'Sản phẩm',
  group: 'Nhóm',
  management: 'Quản lý',
  milestone: 'Milestone',
  group_monthly: 'Nhóm tháng (cũ)',
  global_share_monthly: 'Đồng chia toàn quốc',
};

const subTypeLabel = (source: RewardSource, subType: string | null) => {
  if (!subType) return '—';
  if (source === 'commission') return COMMISSION_TYPES[subType] ?? subType;
  if (source === 'heap') return subType.replace('pool_', 'Bể ');
  if (source === 'matrix') return subType.replace('tree_', 'Cây cấp ');
  if (source === 'agent_pool') return `Bể ${subType}`;
  return subType;
};

/** Daily bars up to two months, monthly beyond. */
const MAX_DAILY_DAYS = 62;

const money = (v: number) =>
  Number(v || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const userLabel = (u: RewardUserInfo | null, fallbackId?: string | null) =>
  u ? u.username || u.fullName || u.email || u.id : fallbackId || '—';

const errorMessage = (e: any) =>
  e?.response?.data?.message
    ? Array.isArray(e.response.data.message)
      ? e.response.data.message.join(', ')
      : e.response.data.message
    : e?.message;

const statusAmount = (g: RewardSummaryGroup | undefined, s: RewardStatus) =>
  g?.byStatus?.[s]?.amount ?? 0;

const SourceTag: React.FC<{ source: RewardSource }> = ({ source }) => (
  <Space size={6}>
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: 2,
        background: SOURCE_BY_KEY[source]?.color,
      }}
    />
    <span>{SOURCE_BY_KEY[source]?.label ?? source}</span>
  </Space>
);

const StatusTag: React.FC<{ status: RewardStatus }> = ({ status }) => (
  <Tag color={STATUS_BY_KEY[status]?.color}>{STATUS_BY_KEY[status]?.label ?? status}</Tag>
);

const RANGE_PRESETS: Array<{ label: string; value: [Dayjs, Dayjs] }> = [
  { label: 'Tháng này', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  {
    label: 'Tháng trước',
    value: [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month'),
    ],
  },
  {
    label: '3 tháng gần nhất',
    value: [dayjs().subtract(2, 'month').startOf('month'), dayjs().endOf('month')],
  },
  { label: 'Năm nay', value: [dayjs().startOf('year'), dayjs().endOf('year')] },
];

// ---------------------------------------------------------------------------
// Summary table: one row per source, expandable into its sub types.
// ---------------------------------------------------------------------------

type SummaryRow = RewardSummaryGroup & {
  key: string;
  source: RewardSource;
  subType?: string | null;
  label: React.ReactNode;
  children?: SummaryRow[];
};

const SummaryTable: React.FC<{
  summary: RewardSummary | null;
  loading: boolean;
}> = ({ summary, loading }) => {
  const grand = summary?.totals.amount || 0;
  const rows: SummaryRow[] = (summary?.sources ?? []).map((s) => ({
    ...s,
    key: s.source,
    label: <SourceTag source={s.source} />,
    children: s.subTypes.length
      ? s.subTypes.map((t) => ({
          ...t,
          key: `${s.source}:${t.subType ?? ''}`,
          source: s.source,
          label: subTypeLabel(s.source, t.subType),
        }))
      : undefined,
  }));

  const columns: ColumnsType<SummaryRow> = [
    { title: 'Nguồn thưởng', dataIndex: 'label', key: 'label', width: 240 },
    {
      title: 'Tổng thưởng',
      key: 'amount',
      align: 'right',
      render: (_, r) => <Text strong>{money(r.amount)}</Text>,
    },
    {
      title: 'Tỷ trọng',
      key: 'share',
      width: 160,
      render: (_, r) => {
        const pct = grand ? (r.amount / grand) * 100 : 0;
        return (
          <Space size={8} style={{ width: '100%' }}>
            <div style={{ width: 80, height: 6, background: '#f0efec', borderRadius: 3 }}>
              <div
                style={{
                  width: `${Math.min(100, pct)}%`,
                  height: 6,
                  borderRadius: 3,
                  background: SOURCE_BY_KEY[r.source]?.color,
                }}
              />
            </div>
            <Text type="secondary">{pct.toFixed(1)}%</Text>
          </Space>
        );
      },
    },
    { title: 'Đã chi', key: 'paid', align: 'right', render: (_, r) => money(statusAmount(r, 'paid')) },
    {
      title: 'Chờ chi / Bị chặn',
      key: 'unpaid',
      align: 'right',
      render: (_, r) => money(statusAmount(r, 'pending') + statusAmount(r, 'blocked')),
    },
    { title: 'Đã hủy', key: 'cancelled', align: 'right', render: (_, r) => money(statusAmount(r, 'cancelled')) },
    { title: 'Vào ví rút', key: 'w', align: 'right', render: (_, r) => money(r.withdrawAmount) },
    { title: 'Vào ví tiêu dùng', key: 'r', align: 'right', render: (_, r) => money(r.reconsumptionAmount) },
    { title: 'Thuế', key: 't', align: 'right', render: (_, r) => money(r.taxAmount) },
    { title: 'Số lần', dataIndex: 'count', key: 'count', align: 'right' },
    { title: 'Số user', dataIndex: 'users', key: 'users', align: 'right' },
  ];

  return (
    <Table<SummaryRow>
      size="small"
      rowKey="key"
      loading={loading}
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 1200 }}
      summary={() =>
        summary ? (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}>
              <Text strong>Tổng cộng</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <Text strong>{money(summary.totals.amount)}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} />
            <Table.Summary.Cell index={3} align="right">
              {money(statusAmount(summary.totals, 'paid'))}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">
              {money(statusAmount(summary.totals, 'pending') + statusAmount(summary.totals, 'blocked'))}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right">
              {money(statusAmount(summary.totals, 'cancelled'))}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right">
              {money(summary.totals.withdrawAmount)}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right">
              {money(summary.totals.reconsumptionAmount)}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="right">
              {money(summary.totals.taxAmount)}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={9} align="right">
              {summary.totals.count}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={10} align="right">
              {summary.totals.users}
            </Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null
      }
    />
  );
};

// ---------------------------------------------------------------------------
// KPI tiles.
// ---------------------------------------------------------------------------

const KpiRow: React.FC<{ summary: RewardSummary | null; loading: boolean }> = ({
  summary,
  loading,
}) => {
  const t = summary?.totals;
  const tiles: Array<{ title: string; value: number; money?: boolean; hint?: string }> = [
    { title: 'Tổng thưởng', value: t?.amount ?? 0, money: true, hint: `${t?.count ?? 0} lần` },
    { title: 'Đã chi', value: statusAmount(t, 'paid'), money: true },
    {
      title: 'Chờ chi / Bị chặn',
      value: statusAmount(t, 'pending') + statusAmount(t, 'blocked'),
      money: true,
      hint: 'Hoa hồng chưa trả',
    },
    { title: 'Vào ví rút', value: t?.withdrawAmount ?? 0, money: true },
    { title: 'Vào ví tiêu dùng', value: t?.reconsumptionAmount ?? 0, money: true },
    { title: 'Thuế giữ lại', value: t?.taxAmount ?? 0, money: true },
    { title: 'Số user nhận', value: t?.users ?? 0 },
  ];
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      {tiles.map((tile) => (
        <Col key={tile.title} flex="1 1 180px">
          <Card size="small" loading={loading}>
            <Statistic
              title={tile.title}
              value={tile.value}
              precision={tile.money ? 2 : 0}
              suffix={tile.money ? 'USDT' : undefined}
              valueStyle={{ fontSize: 20 }}
            />
            {tile.hint ? <Text type="secondary">{tile.hint}</Text> : null}
          </Card>
        </Col>
      ))}
    </Row>
  );
};

// ---------------------------------------------------------------------------
// Stacked bars over time, one segment per source.
// ---------------------------------------------------------------------------

const ChartTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (Number(p.value) || 0), 0);
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: 6,
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {[...payload].reverse().map((p: any) =>
        Number(p.value) ? (
          <div key={p.dataKey} style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <Space size={6}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: p.color }} />
              <span>{SOURCE_BY_KEY[p.dataKey as RewardSource]?.label}</span>
            </Space>
            <span>{money(p.value)}</span>
          </div>
        ) : null,
      )}
      <div style={{ borderTop: '1px solid #eee', marginTop: 4, paddingTop: 4, fontWeight: 600 }}>
        Tổng: {money(total)}
      </div>
    </div>
  );
};

const TimeChart: React.FC<{ data: RewardTimeseries | null; loading: boolean }> = ({
  data,
  loading,
}) => {
  const rows = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        bucket:
          data?.groupBy === 'day'
            ? dayjs(p.bucket).format('DD/MM')
            : dayjs(`${p.bucket}-01`).format('MM/YYYY'),
        ...p.bySource,
      })),
    [data],
  );
  const shown = SOURCES.filter((s) => data?.sources.includes(s.key));
  const hasData = (data?.points ?? []).some((p) => p.total);

  if (!loading && !hasData) {
    return <Empty description="Không có dữ liệu trong khoảng này" style={{ padding: 48 }} />;
  }
  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eeeeee" />
          <XAxis dataKey="bucket" tickLine={false} axisLine={{ stroke: '#d9d9d9' }} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={72}
            tickFormatter={(v) => Number(v).toLocaleString('en-US', { notation: 'compact' })}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Legend
            formatter={(value) => (
              <span style={{ color: '#52514e' }}>{SOURCE_BY_KEY[value as RewardSource]?.label}</span>
            )}
          />
          {shown.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="rewards"
              fill={s.color}
              stroke="#ffffff"
              strokeWidth={1}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Entry table, used on the page and in the user drawer.
// ---------------------------------------------------------------------------

const EntryTable: React.FC<{
  filter: RewardReportFilter;
  reloadKey: number;
  onUserClick?: (userId: string, user: RewardUserInfo | null) => void;
  hideUser?: boolean;
}> = ({ filter, reloadKey, onUserClick, hideUser }) => {
  const [items, setItems] = useState<RewardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (p: number, size: number) => {
      try {
        setLoading(true);
        const res = await rewardReportService.getEntries(filter, p, size);
        setItems(res.items);
        setTotal(res.total);
      } catch (e: any) {
        notification.error({ message: 'Lỗi tải chi tiết', description: errorMessage(e) });
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    setPage(1);
    load(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, reloadKey]);

  const columns: ColumnsType<RewardEntry> = [
    {
      title: 'Thời gian',
      dataIndex: 'occurredAt',
      key: 'occurredAt',
      width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    { title: 'Kỳ', dataIndex: 'period', key: 'period', width: 80 },
    {
      title: 'Nguồn',
      key: 'source',
      width: 190,
      render: (_, r) => <SourceTag source={r.source} />,
    },
    { title: 'Loại', key: 'subType', width: 150, render: (_, r) => subTypeLabel(r.source, r.subType) },
    ...(hideUser
      ? []
      : [
          {
            title: 'Người nhận',
            key: 'user',
            width: 180,
            render: (_: unknown, r: RewardEntry) =>
              onUserClick ? (
                <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onUserClick(r.userId, r.user)}>
                  {userLabel(r.user, r.userId)}
                </Button>
              ) : (
                userLabel(r.user, r.userId)
              ),
          } as ColumnsType<RewardEntry>[number],
        ]),
    {
      title: 'Từ user',
      key: 'fromUser',
      width: 140,
      render: (_, r) => (r.fromUserId ? userLabel(r.fromUser, r.fromUserId) : '—'),
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      width: 120,
      render: (v: number) => <Text strong>{money(v)}</Text>,
    },
    { title: 'Ví rút', dataIndex: 'withdrawAmount', key: 'w', align: 'right', width: 110, render: money },
    { title: 'Ví tiêu dùng', dataIndex: 'reconsumptionAmount', key: 'r', align: 'right', width: 110, render: money },
    { title: 'Thuế', dataIndex: 'taxAmount', key: 't', align: 'right', width: 90, render: money },
    { title: 'Trạng thái', key: 'status', width: 100, render: (_, r) => <StatusTag status={r.status} /> },
    {
      title: 'Tham chiếu',
      dataIndex: 'refId',
      key: 'refId',
      width: 160,
      ellipsis: true,
      render: (v: string | null) => (v ? <Text copyable={{ text: v }}>{v}</Text> : '—'),
    },
  ];

  return (
    <Table<RewardEntry>
      size="small"
      rowKey={(r) => `${r.source}:${r.id}`}
      loading={loading}
      columns={columns}
      dataSource={items}
      scroll={{ x: 1500 }}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [20, 50, 100, 200],
        showTotal: (t) => `${t} dòng`,
        onChange: (p, size) => {
          setPage(p);
          setPageSize(size);
          load(p, size);
        },
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Top users.
// ---------------------------------------------------------------------------

const TopUsersTable: React.FC<{
  filter: RewardReportFilter;
  reloadKey: number;
  onUserClick: (userId: string, user: RewardUserInfo | null) => void;
}> = ({ filter, reloadKey, onUserClick }) => {
  const [rows, setRows] = useState<RewardTopUser[]>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    rewardReportService
      .getTopUsers(filter, limit)
      .then((r) => !cancelled && setRows(r))
      .catch((e) =>
        notification.error({ message: 'Lỗi tải top user', description: errorMessage(e) }),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filter, limit, reloadKey]);

  const shown = SOURCES.filter((s) => !filter.sources?.length || filter.sources.includes(s.key));
  const columns: ColumnsType<RewardTopUser> = [
    { title: '#', dataIndex: 'rank', key: 'rank', width: 50 },
    {
      title: 'User',
      key: 'user',
      width: 200,
      render: (_, r) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onUserClick(r.userId, r.user)}>
          {userLabel(r.user, r.userId)}
        </Button>
      ),
    },
    {
      title: 'Tổng thưởng',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => <Text strong>{money(v)}</Text>,
    },
    ...shown.map((s) => ({
      title: s.label,
      key: s.key,
      align: 'right' as const,
      render: (_: unknown, r: RewardTopUser) => money(r.bySource[s.key] ?? 0),
    })),
    { title: 'Ví rút', dataIndex: 'withdrawAmount', key: 'w', align: 'right', render: money },
    { title: 'Ví tiêu dùng', dataIndex: 'reconsumptionAmount', key: 'r', align: 'right', render: money },
    { title: 'Thuế', dataIndex: 'taxAmount', key: 't', align: 'right', render: money },
    { title: 'Số lần', dataIndex: 'count', key: 'count', align: 'right' },
  ];

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Text>Hiển thị</Text>
        <Select
          value={limit}
          onChange={setLimit}
          style={{ width: 100 }}
          options={[10, 20, 50, 100, 200].map((v) => ({ value: v, label: `Top ${v}` }))}
        />
      </Space>
      <Table<RewardTopUser>
        size="small"
        rowKey="userId"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1300 }}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Page.
// ---------------------------------------------------------------------------

const RewardReport: React.FC = () => {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [sources, setSources] = useState<RewardSource[]>([]);
  const [subTypes, setSubTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<RewardStatus[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<'auto' | 'day' | 'month'>('auto');
  const [reloadKey, setReloadKey] = useState(0);

  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [series, setSeries] = useState<RewardTimeseries | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drawerUser, setDrawerUser] = useState<{ id: string; user: RewardUserInfo | null } | null>(null);

  const filter = useMemo<RewardReportFilter>(
    () => ({
      from: range[0].format('YYYY-MM-DD'),
      to: range[1].format('YYYY-MM-DD'),
      sources,
      subTypes,
      statuses,
      search,
    }),
    [range, sources, subTypes, statuses, search],
  );

  const effectiveGroupBy: 'day' | 'month' =
    groupBy !== 'auto'
      ? groupBy
      : range[1].diff(range[0], 'day') + 1 <= MAX_DAILY_DAYS
        ? 'day'
        : 'month';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      rewardReportService.getSummary(filter),
      rewardReportService.getTimeseries(filter, effectiveGroupBy),
    ])
      .then(([s, t]) => {
        if (cancelled) return;
        setSummary(s);
        setSeries(t);
      })
      .catch((e) =>
        notification.error({ message: 'Lỗi tải thống kê', description: errorMessage(e) }),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filter, effectiveGroupBy, reloadKey]);

  /** Sub types offered: the ones of the selected sources seen in the period. */
  const subTypeOptions = useMemo(
    () =>
      (summary?.sources ?? []).flatMap((s) =>
        s.subTypes
          .filter((t) => t.subType)
          .map((t) => ({
            value: t.subType as string,
            label: `${SOURCE_BY_KEY[s.source]?.label}: ${subTypeLabel(s.source, t.subType)}`,
          })),
      ),
    [summary],
  );

  const openUser = (id: string, user: RewardUserInfo | null) => setDrawerUser({ id, user });

  const rangeText = `${range[0].format('DD/MM/YYYY')} – ${range[1].format('DD/MM/YYYY')}`;

  const exportSummary = async () => {
    if (!summary) return;
    const rows = summary.sources.flatMap((s) => [
      { label: SOURCE_BY_KEY[s.source]?.label ?? s.source, g: s as RewardSummaryGroup },
      ...s.subTypes.map((t) => ({ label: `   ${subTypeLabel(s.source, t.subType)}`, g: t as RewardSummaryGroup })),
    ]);
    const t = summary.totals;
    await downloadExcel({
      fileName: `tong-hop-tra-thuong_${filter.from}_${filter.to}`,
      sheetName: 'Tổng hợp',
      titleLines: ['Thống kê trả thưởng - Tổng hợp', `Khoảng: ${rangeText}`],
      columns: [
        { header: 'Nguồn thưởng', width: 32, value: (r) => r.label },
        { header: 'Tổng thưởng', numFmt: MONEY_FORMAT, width: 16, value: (r) => r.g.amount },
        { header: 'Đã chi', numFmt: MONEY_FORMAT, width: 16, value: (r) => statusAmount(r.g, 'paid') },
        { header: 'Chờ chi', numFmt: MONEY_FORMAT, width: 14, value: (r) => statusAmount(r.g, 'pending') },
        { header: 'Bị chặn', numFmt: MONEY_FORMAT, width: 14, value: (r) => statusAmount(r.g, 'blocked') },
        { header: 'Đã hủy', numFmt: MONEY_FORMAT, width: 14, value: (r) => statusAmount(r.g, 'cancelled') },
        { header: 'Vào ví rút', numFmt: MONEY_FORMAT, width: 16, value: (r) => r.g.withdrawAmount },
        { header: 'Vào ví tiêu dùng', numFmt: MONEY_FORMAT, width: 16, value: (r) => r.g.reconsumptionAmount },
        { header: 'Thuế', numFmt: MONEY_FORMAT, width: 14, value: (r) => r.g.taxAmount },
        { header: 'Số lần', width: 10, value: (r) => r.g.count },
        { header: 'Số user', width: 10, value: (r) => r.g.users },
      ],
      rows,
      totals: [
        'Tổng cộng',
        t.amount,
        statusAmount(t, 'paid'),
        statusAmount(t, 'pending'),
        statusAmount(t, 'blocked'),
        statusAmount(t, 'cancelled'),
        t.withdrawAmount,
        t.reconsumptionAmount,
        t.taxAmount,
        t.count,
        t.users,
      ],
    });
  };

  const exportEntries = async () => {
    try {
      setExporting(true);
      const rows = await rewardReportService.getAllEntries(filter);
      await downloadExcel<RewardEntry>({
        fileName: `chi-tiet-tra-thuong_${filter.from}_${filter.to}`,
        sheetName: 'Chi tiết',
        titleLines: ['Thống kê trả thưởng - Chi tiết', `Khoảng: ${rangeText}`],
        columns: [
          { header: 'Thời gian', width: 18, value: (r) => dayjs(r.occurredAt).format('DD/MM/YYYY HH:mm') },
          { header: 'Kỳ', width: 9, value: (r) => r.period },
          { header: 'Nguồn', width: 22, value: (r) => SOURCE_BY_KEY[r.source]?.label ?? r.source },
          { header: 'Loại', width: 20, value: (r) => subTypeLabel(r.source, r.subType) },
          { header: 'Username', width: 18, value: (r) => r.user?.username },
          { header: 'Họ tên', width: 22, value: (r) => r.user?.fullName },
          { header: 'Email', width: 26, value: (r) => r.user?.email },
          { header: 'Từ user', width: 18, value: (r) => (r.fromUserId ? userLabel(r.fromUser, r.fromUserId) : '') },
          { header: 'Số tiền', numFmt: MONEY_FORMAT, width: 14, value: (r) => r.amount },
          { header: 'Ví rút', numFmt: MONEY_FORMAT, width: 14, value: (r) => r.withdrawAmount },
          { header: 'Ví tiêu dùng', numFmt: MONEY_FORMAT, width: 14, value: (r) => r.reconsumptionAmount },
          { header: 'Thuế', numFmt: MONEY_FORMAT, width: 12, value: (r) => r.taxAmount },
          { header: 'Trạng thái', width: 12, value: (r) => STATUS_BY_KEY[r.status]?.label ?? r.status },
          { header: 'Tham chiếu', width: 38, value: (r) => r.refId },
          { header: 'User ID', width: 38, value: (r) => r.userId },
        ],
        rows,
        totals: [
          'Tổng cộng',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          rows.reduce((s, r) => s + r.amount, 0),
          rows.reduce((s, r) => s + r.withdrawAmount, 0),
          rows.reduce((s, r) => s + r.reconsumptionAmount, 0),
          rows.reduce((s, r) => s + r.taxAmount, 0),
        ],
      });
    } catch (e: any) {
      notification.error({ message: 'Lỗi xuất Excel', description: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Thống kê trả thưởng"
        description="Mọi khoản thưởng đã ghi nhận cho user: hoa hồng, Heap, Matrix, bể đồng chia đại lý, lương tháng và lương cấp bậc. Lương được tính theo tháng doanh số."
        actions={
          <>
            <Button icon={<DownloadOutlined />} onClick={exportSummary} disabled={!summary}>
              Xuất tổng hợp
            </Button>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportEntries}>
              Xuất chi tiết
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => setReloadKey((k) => k + 1)}>
              Làm mới
            </Button>
          </>
        }
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={[12, 12]}>
          <RangePicker
            value={range}
            allowClear={false}
            format="DD/MM/YYYY"
            presets={RANGE_PRESETS}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
          />
          <Select<RewardSource[]>
            mode="multiple"
            allowClear
            placeholder="Tất cả nguồn"
            style={{ minWidth: 220 }}
            maxTagCount="responsive"
            value={sources}
            onChange={(v) => {
              setSources(v);
              setSubTypes([]);
            }}
            options={SOURCES.map((s) => ({ value: s.key, label: s.label }))}
          />
          <Select<string[]>
            mode="multiple"
            allowClear
            placeholder="Tất cả loại"
            style={{ minWidth: 220 }}
            maxTagCount="responsive"
            value={subTypes}
            onChange={setSubTypes}
            options={subTypeOptions}
          />
          <Select<RewardStatus[]>
            mode="multiple"
            allowClear
            placeholder="Tất cả trạng thái"
            style={{ minWidth: 180 }}
            maxTagCount="responsive"
            value={statuses}
            onChange={setStatuses}
            options={STATUSES.map((s) => ({ value: s.key, label: s.label }))}
          />
          <Input.Search
            allowClear
            placeholder="Username, họ tên, email, SĐT"
            style={{ width: 260 }}
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (!e.target.value) setSearch('');
            }}
            onSearch={(v) => setSearch(v.trim())}
          />
        </Space>
      </Card>

      <KpiRow summary={summary} loading={loading && !summary} />

      <Card
        size="small"
        title="Thưởng theo thời gian"
        style={{ marginBottom: 16 }}
        extra={
          <Segmented
            size="small"
            value={groupBy}
            onChange={(v) => setGroupBy(v as 'auto' | 'day' | 'month')}
            options={[
              { label: 'Tự động', value: 'auto' },
              { label: 'Ngày', value: 'day' },
              { label: 'Tháng', value: 'month' },
            ]}
          />
        }
      >
        <TimeChart data={series} loading={loading} />
      </Card>

      <Card size="small" title="Tổng hợp theo nguồn" style={{ marginBottom: 16 }}>
        <SummaryTable summary={summary} loading={loading} />
      </Card>

      <Card size="small">
        <Tabs
          items={[
            {
              key: 'entries',
              label: 'Chi tiết',
              children: <EntryTable filter={filter} reloadKey={reloadKey} onUserClick={openUser} />,
            },
            {
              key: 'top',
              label: 'Top user',
              children: <TopUsersTable filter={filter} reloadKey={reloadKey} onUserClick={openUser} />,
            },
          ]}
        />
      </Card>

      <UserDrawer
        target={drawerUser}
        filter={filter}
        rangeText={rangeText}
        onClose={() => setDrawerUser(null)}
      />
    </div>
  );
};

/** One user's rewards in the page's range and filters. */
const UserDrawer: React.FC<{
  target: { id: string; user: RewardUserInfo | null } | null;
  filter: RewardReportFilter;
  rangeText: string;
  onClose: () => void;
}> = ({ target, filter, rangeText, onClose }) => {
  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const userFilter = useMemo<RewardReportFilter | null>(
    () => (target ? { ...filter, search: undefined, userId: target.id } : null),
    [filter, target],
  );

  useEffect(() => {
    if (!userFilter) return;
    let cancelled = false;
    setLoading(true);
    rewardReportService
      .getSummary(userFilter)
      .then((s) => !cancelled && setSummary(s))
      .catch((e) =>
        notification.error({ message: 'Lỗi tải thưởng của user', description: errorMessage(e) }),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userFilter]);

  return (
    <Drawer
      open={!!target}
      onClose={onClose}
      width={1100}
      destroyOnHidden
      title={
        target ? (
          <Space direction="vertical" size={0}>
            <span>Thưởng của {userLabel(target.user, target.id)}</span>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              {[target.user?.fullName, target.user?.email].filter(Boolean).join(' · ')} · {rangeText}
            </Text>
          </Space>
        ) : null
      }
    >
      {userFilter ? (
        <>
          <KpiRow summary={summary} loading={loading && !summary} />
          <Card size="small" title="Theo nguồn" style={{ marginBottom: 16 }}>
            <SummaryTable summary={summary} loading={loading} />
          </Card>
          <Card size="small" title="Chi tiết">
            <EntryTable filter={userFilter} reloadKey={0} hideUser />
          </Card>
        </>
      ) : null}
    </Drawer>
  );
};

export default RewardReport;
