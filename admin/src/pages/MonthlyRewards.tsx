import React, { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  message,
  Modal,
  Descriptions,
  Typography,
  DatePicker,
  notification,
  Tabs,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';

const { Title } = Typography;

const MonthlyRewards: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('calculate');
  const [monthlyDate, setMonthlyDate] = useState<dayjs.Dayjs | null>(dayjs().subtract(1, 'month'));
  const [monthlyStatsData, setMonthlyStatsData] = useState<any[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [totalNationalSales, setTotalNationalSales] = useState(0);

  // History Tab states
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchMonthlyStats = async () => {
    if (!monthlyDate) return;
    try {
      setMonthlyLoading(true);
      const monthStr = monthlyDate.format('YYYY-MM');
      const res = await api.get(`/affiliate/admin/commissions/monthly/stats?month=${monthStr}`);
      setMonthlyStatsData(res.data || []);
      const totalNS = (res.data || []).reduce((sum: number, u: any) => sum + (Number(u.personalSales) || 0), 0);
      setTotalNationalSales(totalNS);
    } catch (e: any) {
      message.error('Lấy dữ liệu doanh số tháng thất bại');
    } finally {
      setMonthlyLoading(false);
    }
  };

  const fetchPayoutHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await api.get('/affiliate/admin/commissions');
      const filtered = (res.data || []).filter((c: any) => 
        c.type === 'group_monthly' || c.type === 'global_share_monthly'
      );
      setPayoutHistory(filtered);
    } catch (e: any) {
      message.error('Lấy lịch sử chốt ví thất bại');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCalculateMonthly = async (performPayout: boolean) => {
    if (!monthlyDate) return;
    const monthStr = monthlyDate.format('YYYY-MM');
    
    if (performPayout) {
      Modal.confirm({
        title: 'Chốt doanh số & Trả ví',
        content: `Bạn có chắc chắn muốn chốt doanh số và thực hiện chi trả ví hoa hồng cho tháng ${monthStr}? Thao tác này sẽ cộng số dư vào ví người dùng và không thể rút lại!`,
        okText: 'Chốt và Trả ví',
        cancelText: 'Hủy',
        okButtonProps: { danger: true },
        onOk: async () => {
          await runCalculation(performPayout);
        }
      });
    } else {
      await runCalculation(performPayout);
    }
  };

  const runCalculation = async (performPayout: boolean) => {
    try {
      setCalculating(true);
      const monthStr = monthlyDate!.format('YYYY-MM');
      const res = await api.post('/affiliate/admin/commissions/monthly/calculate', {
        month: monthStr,
        performPayout,
      });
      notification.success({
        message: performPayout ? 'Chốt & trả ví thành công!' : 'Tính toán hoàn tất!',
        description: performPayout 
          ? `Đã tạo ${res.data.payoutCount} giao dịch hoa hồng tháng. Tổng số tiền: $${res.data.totalPayoutAmount.toLocaleString()} USD.`
          : `Đã tính toán doanh số & cấp bậc cho ${res.data.statsCount} thành viên. Doanh số toàn quốc: $${res.data.totalNationalSales.toLocaleString()} USD.`,
        duration: 10,
      });
      if (performPayout) {
        setActiveTab('history');
      } else {
        fetchMonthlyStats();
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Có lỗi xảy ra khi xử lý doanh số';
      message.error(msg);
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'calculate') {
      fetchMonthlyStats();
    } else {
      fetchPayoutHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyDate, activeTab]);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: '24px' }}>Monthly Rewards Management</Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
        <Tabs.TabPane tab="Tính toán & Chốt số" key="calculate">
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Space align="center">
              <span style={{ fontWeight: 600 }}>Chọn tháng:</span>
              <DatePicker
                picker="month"
                value={monthlyDate}
                onChange={(date) => setMonthlyDate(date)}
                allowClear={false}
                format="YYYY-MM"
              />
              <Button icon={<ReloadOutlined />} onClick={fetchMonthlyStats} loading={monthlyLoading}>
                Làm mới
              </Button>
            </Space>
            <Space>
              <Button
                type="default"
                onClick={() => handleCalculateMonthly(false)}
                loading={calculating}
              >
                Tính toán & Xem thử
              </Button>
              <Button
                type="primary"
                danger
                onClick={() => handleCalculateMonthly(true)}
                loading={calculating}
              >
                Chốt doanh số & Trả ví
              </Button>
            </Space>
          </div>

          <div style={{ marginBottom: '16px', background: '#f5f5f5', padding: '16px', borderRadius: '8px' }}>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Tổng doanh số toàn quốc">
                <strong style={{ color: '#1890ff', fontSize: '16px' }}>
                  ${totalNationalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Số thành viên có doanh số/cấp bậc">
                <strong>{monthlyStatsData.length}</strong>
              </Descriptions.Item>
            </Descriptions>
          </div>

          <Table
            dataSource={monthlyStatsData}
            loading={monthlyLoading}
            rowKey={(record) => record.id || record.userId}
            columns={[
              {
                title: 'User',
                key: 'user',
                render: (_, record) => {
                  const u = record.user || record;
                  return u.username || u.email || record.userId;
                },
              },
              {
                title: 'Cấp bậc tháng',
                dataIndex: 'calculatedRank',
                key: 'calculatedRank',
                render: (rank: string) => {
                  const isC = rank?.startsWith('C');
                  const isDaily = rank === 'DAILY';
                  return (
                    <Tag color={isC ? 'blue' : isDaily ? 'green' : 'default'}>
                      {rank || 'C0'}
                    </Tag>
                  );
                },
              },
              {
                title: 'Doanh số cá nhân',
                dataIndex: 'personalSales',
                key: 'personalSales',
                render: (val: number) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              },
              {
                title: 'Doanh số nhóm',
                dataIndex: 'groupSales',
                key: 'groupSales',
                render: (val: number) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              },
              {
                title: 'Thưởng nhóm (Tầng 3)',
                dataIndex: 'groupRewardAmount',
                key: 'groupRewardAmount',
                render: (val: number, record: any) => (
                  <span>
                    ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    {Number(record.groupRewardRate) > 0 && ` (${(record.groupRewardRate * 100).toFixed(1)}%)`}
                  </span>
                ),
              },
              {
                title: 'Đồng chia (Tầng 4)',
                dataIndex: 'globalShareAmount',
                key: 'globalShareAmount',
                render: (val: number) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              },
              {
                title: 'Trạng thái',
                dataIndex: 'isProcessed',
                key: 'isProcessed',
                render: (isProcessed: boolean) => (
                  <Tag color={isProcessed ? 'success' : 'warning'}>
                    {isProcessed ? 'Đã chốt & trả ví' : 'Chờ chốt'}
                  </Tag>
                ),
              },
            ]}
          />
        </Tabs.TabPane>

        <Tabs.TabPane tab="Lịch sử chốt ví" key="history">
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button icon={<ReloadOutlined />} onClick={fetchPayoutHistory} loading={historyLoading}>
              Làm mới lịch sử
            </Button>
          </div>
          <Table
            dataSource={payoutHistory}
            loading={historyLoading}
            rowKey="id"
            columns={[
              {
                title: 'ID giao dịch',
                dataIndex: 'id',
                key: 'id',
                render: (id: string) => <span style={{ fontFamily: 'monospace' }}>{id.slice(0, 8)}...</span>,
              },
              {
                title: 'Thành viên nhận',
                key: 'user',
                render: (_, record) => {
                  return record.user?.fullName || record.user?.username || record.userId;
                },
              },
              {
                title: 'Loại hoa hồng',
                dataIndex: 'type',
                key: 'type',
                render: (type: string) => {
                  return type === 'group_monthly' ? (
                    <Tag color="blue">Thưởng nhóm T3</Tag>
                  ) : (
                    <Tag color="gold">Đồng chia T4</Tag>
                  );
                },
              },
              {
                title: 'Số tiền',
                dataIndex: 'amount',
                key: 'amount',
                render: (val: number) => <strong style={{ color: '#52c41a' }}>${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} PV</strong>,
              },
              {
                title: 'Ghi chú chốt',
                dataIndex: 'notes',
                key: 'notes',
              },
              {
                title: 'Trạng thái',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => {
                  const color = status === 'paid' ? 'success' : status === 'pending' ? 'warning' : status === 'cancelled' ? 'default' : 'error';
                  return <Tag color={color}>{status.toUpperCase()}</Tag>;
                },
              },
              {
                title: 'Ngày chốt',
                dataIndex: 'createdAt',
                key: 'createdAt',
                render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
              },
            ]}
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default MonthlyRewards;
