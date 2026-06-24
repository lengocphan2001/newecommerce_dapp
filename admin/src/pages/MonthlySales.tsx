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
} from 'antd';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../services/api';

const { Title } = Typography;

interface MonthlySalesRow {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  packageType: string;
  totalSales: number;
}

const MonthlySales: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MonthlySalesRow[]>([]);
  const [filtered, setFiltered] = useState<MonthlySalesRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [search, setSearch] = useState('');

  const fetchData = async (month: Dayjs) => {
    try {
      setLoading(true);
      const res = await api.get('/admin/monthly-sales', {
        params: { year: month.year(), month: month.month() + 1 },
      });
      setData(res.data);
      setFiltered(res.data);
    } catch (e: any) {
      notification.error({ message: 'Lỗi tải dữ liệu', description: e?.response?.data?.message || e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedMonth);
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
      const res = await api.get('/admin/monthly-sales/export', {
        params: { year: selectedMonth.year(), month: selectedMonth.month() + 1 },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `monthly-sales-${selectedMonth.year()}-${String(selectedMonth.month() + 1).padStart(2, '0')}.csv`,
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
      render: (_: any, __: any, idx: number) => idx + 1,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => <span style={{ fontWeight: 600 }}>{v || '—'}</span>,
    },
    {
      title: 'Họ tên',
      dataIndex: 'fullName',
      key: 'fullName',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: 'Gói',
      dataIndex: 'packageType',
      key: 'packageType',
      render: (v: string) => <Tag color={v === 'NONE' ? 'default' : 'blue'}>{v}</Tag>,
    },
    {
      title: 'Doanh số tháng (PV)',
      dataIndex: 'totalSales',
      key: 'totalSales',
      sorter: (a: MonthlySalesRow, b: MonthlySalesRow) => a.totalSales - b.totalSales,
      defaultSortOrder: 'descend' as const,
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: '#2563EB' }}>
          {Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </span>
      ),
    },
  ];

  const totalSales = filtered.reduce((s, r) => s + r.totalSales, 0);

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
            onClick={() => fetchData(selectedMonth)}
            loading={loading}
          >
            Tải dữ liệu
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Export CSV
          </Button>
          <Input
            placeholder="Tìm kiếm username / tên / email..."
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
        </Space>
      </Card>

      <Card
        title={`Tháng ${selectedMonth.month() + 1}/${selectedMonth.year()} — ${filtered.length} user có doanh số`}
        extra={
          <span style={{ fontWeight: 700, color: '#2563EB' }}>
            Tổng: {totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} PV
          </span>
        }
      >
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="userId"
          loading={loading}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} users` }}
          scroll={{ x: 900 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default MonthlySales;
