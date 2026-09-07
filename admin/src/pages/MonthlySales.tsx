import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Typography,
  Button,
  Space,
  DatePicker,
  Tag,
  notification,
  Input,
  Switch,
  Tooltip,
} from 'antd';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../services/api';

const { Title, Text } = Typography;

interface MonthlyBranchSalesRow {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  packageType: string;
  personalSales: number;
  leftSales: number;
  rightSales: number;
  strongSales: number;
  weakSales: number;
  strongSide: 'left' | 'right' | null;
  leftMemberCount: number;
  rightMemberCount: number;
}

const formatPv = (v: number) =>
  Number(v || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const MonthlySales: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MonthlyBranchSalesRow[]>([]);
  const [filtered, setFiltered] = useState<MonthlyBranchSalesRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [search, setSearch] = useState('');
  const [includeAll, setIncludeAll] = useState(false);

  const fetchData = async (month: Dayjs, all: boolean) => {
    try {
      setLoading(true);
      const res = await api.get('/admin/monthly-branch-sales', {
        params: {
          year: month.year(),
          month: month.month() + 1,
          ...(all ? { includeAll: 'true' } : {}),
        },
      });
      setData(res.data);
      setFiltered(res.data);
    } catch (e: any) {
      notification.error({
        message: 'Lỗi tải dữ liệu',
        description: e?.response?.data?.message || e?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedMonth, includeAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(data);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      data.filter(
        r =>
          r.username?.toLowerCase().includes(q) ||
          r.fullName?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.userId?.toLowerCase().includes(q),
      ),
    );
  }, [search, data]);

  const handleExport = async () => {
    try {
      const res = await api.get('/admin/monthly-branch-sales/export', {
        params: {
          year: selectedMonth.year(),
          month: selectedMonth.month() + 1,
          ...(includeAll ? { includeAll: 'true' } : {}),
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: 'text/csv;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `monthly-branch-sales-${selectedMonth.year()}-${String(selectedMonth.month() + 1).padStart(2, '0')}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      notification.error({ message: 'Export thất bại', description: e?.message });
    }
  };

  const columns = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      fixed: 'left' as const,
      render: (_: any, __: any, idx: number) => idx + 1,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 150,
      fixed: 'left' as const,
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v || '—'}</span>,
    },
    {
      title: 'Họ tên',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 160,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Gói',
      dataIndex: 'packageType',
      key: 'packageType',
      width: 110,
      render: (v: string) => <Tag color={v === 'NONE' ? 'default' : 'blue'}>{v}</Tag>,
    },
    {
      title: 'DS cá nhân (PV)',
      dataIndex: 'personalSales',
      key: 'personalSales',
      width: 150,
      align: 'right' as const,
      sorter: (a: MonthlyBranchSalesRow, b: MonthlyBranchSalesRow) =>
        a.personalSales - b.personalSales,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{formatPv(v)}</span>,
    },
    {
      title: 'Nhánh trái (PV)',
      dataIndex: 'leftSales',
      key: 'leftSales',
      width: 160,
      align: 'right' as const,
      sorter: (a: MonthlyBranchSalesRow, b: MonthlyBranchSalesRow) => a.leftSales - b.leftSales,
      render: (v: number, r: MonthlyBranchSalesRow) => (
        <span>
          {formatPv(v)}
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            ({r.leftMemberCount})
          </Text>
        </span>
      ),
    },
    {
      title: 'Nhánh phải (PV)',
      dataIndex: 'rightSales',
      key: 'rightSales',
      width: 160,
      align: 'right' as const,
      sorter: (a: MonthlyBranchSalesRow, b: MonthlyBranchSalesRow) => a.rightSales - b.rightSales,
      render: (v: number, r: MonthlyBranchSalesRow) => (
        <span>
          {formatPv(v)}
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            ({r.rightMemberCount})
          </Text>
        </span>
      ),
    },
    {
      title: 'Nhánh mạnh',
      dataIndex: 'strongSide',
      key: 'strongSide',
      width: 120,
      render: (v: 'left' | 'right' | null) =>
        v === 'left' ? (
          <Tag color="geekblue">Trái</Tag>
        ) : v === 'right' ? (
          <Tag color="purple">Phải</Tag>
        ) : (
          <Tag>Cân bằng</Tag>
        ),
    },
    {
      title: 'DS nhánh mạnh (PV)',
      dataIndex: 'strongSales',
      key: 'strongSales',
      width: 170,
      align: 'right' as const,
      sorter: (a: MonthlyBranchSalesRow, b: MonthlyBranchSalesRow) => a.strongSales - b.strongSales,
      render: (v: number) => formatPv(v),
    },
    {
      title: 'DS nhánh yếu (PV)',
      dataIndex: 'weakSales',
      key: 'weakSales',
      width: 170,
      align: 'right' as const,
      sorter: (a: MonthlyBranchSalesRow, b: MonthlyBranchSalesRow) => a.weakSales - b.weakSales,
      defaultSortOrder: 'descend' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#2563EB' }}>{formatPv(v)}</span>
      ),
    },
  ];

  const totalPersonal = filtered.reduce((s, r) => s + r.personalSales, 0);
  const totalWeak = filtered.reduce((s, r) => s + r.weakSales, 0);

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Doanh số theo tháng</Title>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={v => v && setSelectedMonth(v)}
            format="MM/YYYY"
            allowClear={false}
          />
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => fetchData(selectedMonth, includeAll)}
            loading={loading}
          >
            Tải dữ liệu
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Export CSV
          </Button>
          <Tooltip title="Bao gồm cả user không phát sinh doanh số nào trong tháng">
            <Space size={6}>
              <Switch
                checked={includeAll}
                onChange={checked => {
                  setIncludeAll(checked);
                  fetchData(selectedMonth, checked);
                }}
              />
              <span>Hiện tất cả user</span>
            </Space>
          </Tooltip>
          <Input
            placeholder="Tìm kiếm username / tên / email..."
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
        </Space>
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">
            Doanh số nhánh tính theo cây nhị phân (parentId / position), là tổng đơn hàng của toàn
            bộ tuyến dưới bên nhánh đó, không tính đơn của chính user. Giá trị đơn = đơn giá × số
            lượng, chưa gồm phí vận chuyển; trạng thái đơn: confirmed, processing, shipped,
            delivered.
          </Text>
        </div>
      </Card>

      <Card
        title={`Tháng ${selectedMonth.month() + 1}/${selectedMonth.year()} — ${filtered.length} user`}
        extra={
          <Space size={16}>
            <span>
              Tổng DS cá nhân:{' '}
              <span style={{ fontWeight: 700 }}>{formatPv(totalPersonal)} PV</span>
            </span>
            <span>
              Tổng DS nhánh yếu:{' '}
              <span style={{ fontWeight: 700, color: '#2563EB' }}>{formatPv(totalWeak)} PV</span>
            </span>
          </Space>
        }
      >
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="userId"
          loading={loading}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} users` }}
          scroll={{ x: 1600 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default MonthlySales;
