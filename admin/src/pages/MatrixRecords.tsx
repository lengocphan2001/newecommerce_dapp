import React, { useEffect, useState } from 'react';
import { Card, Input, Select, Button, Space, Table, Statistic, message, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { adminService } from '../services/adminService';

const { Text } = Typography;

interface MatrixLedgerItem {
  id: string;
  createdAt: string;
  treeId: string;
  orderId: string;
  beneficiaryUserId: string;
  beneficiaryUsername: string | null;
  beneficiaryEmail: string | null;
  sourceNodeId: string;
  amount: number;
}

interface MatrixLedgerSummary {
  totalCreditAmount: number;
  totalDebitAmount: number;
  netAmount: number;
  creditCount: number;
  debitCount: number;
  outstandingPairCount: number;
}

const MatrixRecords: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MatrixLedgerItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [userId, setUserId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [type, setType] = useState<'all' | 'credit' | 'debit'>('all');
  const [summary, setSummary] = useState<MatrixLedgerSummary>({
    totalCreditAmount: 0,
    totalDebitAmount: 0,
    netAmount: 0,
    creditCount: 0,
    debitCount: 0,
    outstandingPairCount: 0,
  });

  const loadSummary = async () => {
    try {
      const res = await adminService.getMatrixRewardLedgerSummary({
        userId: userId.trim() || undefined,
        orderId: orderId.trim() || undefined,
      });
      const data = (res as any)?.data ?? res;
      setSummary({
        totalCreditAmount: Number(data?.totalCreditAmount ?? 0),
        totalDebitAmount: Number(data?.totalDebitAmount ?? 0),
        netAmount: Number(data?.netAmount ?? 0),
        creditCount: Number(data?.creditCount ?? 0),
        debitCount: Number(data?.debitCount ?? 0),
        outstandingPairCount: Number(data?.outstandingPairCount ?? 0),
      });
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Không thể tải thống kê matrix');
    }
  };

  const loadRecords = async (nextPage = page, nextLimit = limit) => {
    try {
      setLoading(true);
      const res = await adminService.getMatrixRewardLedgerHistory({
        page: nextPage,
        limit: nextLimit,
        userId: userId.trim() || undefined,
        orderId: orderId.trim() || undefined,
        type,
      });
      const data = (res as any)?.data ?? res;
      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total ?? 0));
      setPage(Number(data?.page ?? nextPage));
      setLimit(Number(data?.limit ?? nextLimit));
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Không thể tải matrix records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords(1, limit);
    loadSummary();
  }, []);

  return (
    <div>
      <Card
        title="Matrix records"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadRecords(page, limit);
              loadSummary();
            }}
          >
            Refresh
          </Button>
        }
      >
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            style={{ width: 260 }}
            placeholder="Lọc theo User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <Input
            style={{ width: 260 }}
            placeholder="Lọc theo Order ID"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
          <Select
            style={{ width: 160 }}
            value={type}
            onChange={(v) => setType(v)}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'credit', label: 'Chỉ cộng (+)' },
              { value: 'debit', label: 'Chỉ trừ (-)' },
            ]}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              loadRecords(1, limit);
              loadSummary();
            }}
          >
            Lọc
          </Button>
        </Space>

        <Space wrap size="large" style={{ marginBottom: 16 }}>
          <Statistic title="Dòng cộng (+)" value={summary.creditCount} />
          <Statistic title="Dòng trừ (-)" value={summary.debitCount} />
          <Statistic title="Tổng cộng" value={summary.totalCreditAmount} precision={2} suffix="USDT" />
          <Statistic title="Tổng trừ" value={summary.totalDebitAmount} precision={2} suffix="USDT" />
          <Statistic title="Net" value={summary.netAmount} precision={2} suffix="USDT" />
        </Space>

        <Table<MatrixLedgerItem>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          size="small"
          scroll={{ x: 1200 }}
          columns={[
            {
              title: 'Thời gian',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 180,
              render: (v: string) => (v ? new Date(v).toLocaleString('vi-VN') : '-'),
            },
            {
              title: 'User nhận',
              key: 'beneficiary',
              width: 260,
              render: (_: unknown, r: MatrixLedgerItem) => (
                <div>
                  <div>{r.beneficiaryUsername ? `@${r.beneficiaryUsername}` : r.beneficiaryUserId}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {r.beneficiaryEmail || r.beneficiaryUserId}
                  </Text>
                </div>
              ),
            },
            {
              title: 'Số tiền',
              dataIndex: 'amount',
              key: 'amount',
              width: 140,
              render: (v: number) => (
                <Text style={{ color: v >= 0 ? '#389e0d' : '#cf1322', fontWeight: 600 }}>
                  {v >= 0 ? '+' : ''}
                  {Number(v || 0).toFixed(2)} USDT
                </Text>
              ),
            },
            { title: 'Order ID', dataIndex: 'orderId', key: 'orderId', width: 260 },
            { title: 'Tree ID', dataIndex: 'treeId', key: 'treeId', width: 260 },
            { title: 'Source Node', dataIndex: 'sourceNodeId', key: 'sourceNodeId', width: 260 },
          ]}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (p, s) => loadRecords(p, s),
          }}
        />
      </Card>
    </div>
  );
};

export default MatrixRecords;
