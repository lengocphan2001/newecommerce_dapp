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
  Drawer,
  Card,
  Progress,
  Alert,
  Spin,
  Empty,
  Breadcrumb,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';
import PageHeader from '../components/PageHeader';
import StatusTag, {
  COMMISSION_STATUS_TAGS,
  MONTHLY_PROCESSED_TAGS,
} from '../components/StatusTag';
import { shortIdColumn } from '../utils/tableColumns';

const { Text } = Typography;

const money = (val: any) =>
  `${Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const percent = (val: any) => `${(Number(val || 0) * 100).toFixed(1)}%`;

const rankTag = (rank?: string, label?: string) => {
  const color = !rank || rank === 'C0' ? 'default' : rank === 'DAILY' ? 'green' : 'blue';
  return <Tag color={color}>{label || rank || 'C0'}</Tag>;
};

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

  // Detail Drawer states
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailPath, setDetailPath] = useState<{ userId: string; username: string }[]>([]);

  const loadDetail = async (userId: string) => {
    if (!monthlyDate) return;
    try {
      setDetailLoading(true);
      const res = await api.get('/affiliate/admin/commissions/monthly/user-detail', {
        params: { month: monthlyDate.format('YYYY-MM'), userId },
      });
      setDetail(res.data);
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Lấy chi tiết thành viên thất bại');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = (userId: string, username: string) => {
    setDetailPath([{ userId, username }]);
    setDetailOpen(true);
    loadDetail(userId);
  };

  const drillDown = (userId: string, username: string) => {
    setDetailPath((prev) => [...prev, { userId, username }]);
    loadDetail(userId);
  };

  const goToPathIndex = (idx: number) => {
    const target = detailPath[idx];
    if (!target) return;
    setDetailPath((prev) => prev.slice(0, idx + 1));
    loadDetail(target.userId);
  };

  const renderQualification = (q: any, title: string) => {
    if (!q) return null;
    return (
      <Card size="small" title={title} style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 12 }}>
          Điều kiện đạt {q.rank}: <strong>{q.ruleText}</strong>
        </div>
        {q.requirements.map((r: any) => (
          <div
            key={r.requiredRank}
            style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}
          >
            <span style={{ minWidth: 260 }}>
              F1 đạt {r.requiredRankLabel} trở lên: <strong>{r.actualCount}</strong> / {r.requiredCount}
            </span>
            <Progress
              style={{ width: '100%', maxWidth: 200, margin: 0 }}
              size="small"
              percent={Math.min(100, Math.round((r.actualCount / r.requiredCount) * 100))}
              status={r.satisfied ? 'success' : 'active'}
            />
          </div>
        ))}
        <Tag color={q.satisfied ? 'success' : 'warning'}>
          {q.satisfied ? 'Đã đủ điều kiện' : 'Chưa đủ điều kiện'}
        </Tag>
      </Card>
    );
  };

  const renderDetailBody = () => {
    if (detailLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      );
    }
    if (!detail) {
      return <Empty description="Không có dữ liệu" />;
    }

    const drift =
      detail.stored &&
      (detail.stored.calculatedRank !== detail.rank ||
        Math.abs(Number(detail.stored.groupSales) - Number(detail.groupSales)) > 0.01);

    return (
      <div>
        {detailPath.length > 1 && (
          <Breadcrumb
            style={{ marginBottom: 16 }}
            items={detailPath.map((n, idx) => ({
              title:
                idx === detailPath.length - 1 ? (
                  <span>{n.username}</span>
                ) : (
                  <Button type="link" style={{ padding: 0 }} onClick={() => goToPathIndex(idx)}>
                    {n.username}
                  </Button>
                ),
            }))}
          />
        )}

        {detail.rankLagging && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Đủ điều kiện ${detail.eligibleRankLabel} nhưng đang được xếp ${detail.rankLabel}`}
            description="Vòng xét thăng cấp đã hội tụ nhưng thành viên này vẫn thỏa điều kiện cấp cao hơn. Dấu hiệu dữ liệu cây tuyến bất thường. Kiểm tra log server trước khi chốt ví."
          />
        )}

        {detail.isManualRank && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Cấp bậc gán thủ công: ${detail.user.manualRank}. Điều kiện F1 bên dưới chỉ để tham khảo.`}
          />
        )}

        {drift && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="Số liệu đã chốt trong DB khác với số tính lại hiện tại"
            description={`Đã chốt: ${detail.stored.calculatedRank} - doanh số nhóm ${money(
              detail.stored.groupSales,
            )}. Tính lại: ${detail.rank} - ${money(detail.groupSales)}.`}
          />
        )}

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Thành viên">
            {detail.user.username || detail.user.email || detail.user.id}
          </Descriptions.Item>
          <Descriptions.Item label="Cấp bậc tháng">
            {rankTag(detail.rank, detail.rankLabel)}
          </Descriptions.Item>
          <Descriptions.Item label="Doanh số cá nhân">{money(detail.personalSales)}</Descriptions.Item>
          <Descriptions.Item label="Doanh số nhóm">{money(detail.groupSales)}</Descriptions.Item>
          <Descriptions.Item label="Số F1">{detail.f1List.length}</Descriptions.Item>
          <Descriptions.Item label="Tổng cấp dưới">{detail.totalMemberCount}</Descriptions.Item>
          <Descriptions.Item label="Tổng mua tích lũy">
            {money(detail.daiLyCondition.actual)}
          </Descriptions.Item>
          <Descriptions.Item label="Điều kiện Đại lý">
            <Tag color={detail.daiLyCondition.satisfied ? 'success' : 'default'}>
              {detail.daiLyCondition.satisfied ? 'Đạt' : 'Chưa đạt'} (cần {money(detail.daiLyCondition.required)})
            </Tag>
          </Descriptions.Item>
        </Descriptions>

        {renderQualification(detail.currentQualification, `Điều kiện cấp hiện tại (${detail.rank})`)}
        {renderQualification(
          detail.nextQualification,
          `Điều kiện lên cấp kế tiếp (${detail.nextQualification?.rank || '-'})`,
        )}

        <Card size="small" title="Cấp dưới F1 và doanh số từng nhánh" style={{ marginBottom: 12 }}>
          <Table
            size="small"
            rowKey="userId"
            dataSource={detail.f1List}
            pagination={detail.f1List.length > 10 ? { pageSize: 10 } : false}
            scroll={{ x: 900 }}
            summary={(rows) => {
              const total = rows.reduce((sum: number, r: any) => sum + Number(r.branchSales || 0), 0);
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <strong>Tổng doanh số nhánh</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>
                    <strong>{money(total)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} colSpan={3} />
                </Table.Summary.Row>
              );
            }}
            columns={[
              {
                title: 'F1',
                key: 'username',
                render: (_: any, r: any) => (
                  <Button
                    type="link"
                    style={{ padding: 0 }}
                    onClick={() => drillDown(r.userId, r.username || r.email || r.userId)}
                  >
                    {r.username || r.email || r.userId}
                  </Button>
                ),
              },
              {
                title: 'Cấp bậc tháng',
                key: 'rank',
                render: (_: any, r: any) => (
                  <Space size={4}>
                    {rankTag(r.rank, r.rankLabel)}
                    {r.manualRank && r.manualRank !== 'NONE' && <Tag color="purple">Thủ công</Tag>}
                  </Space>
                ),
                sorter: (a: any, b: any) => a.rank.localeCompare(b.rank),
              },
              {
                title: 'DS cá nhân',
                dataIndex: 'personalSales',
                key: 'personalSales',
                render: money,
                sorter: (a: any, b: any) => a.personalSales - b.personalSales,
              },
              {
                title: 'DS nhánh',
                dataIndex: 'branchSales',
                key: 'branchSales',
                render: money,
                defaultSortOrder: 'descend' as const,
                sorter: (a: any, b: any) => a.branchSales - b.branchSales,
              },
              {
                title: '% doanh số nhóm',
                dataIndex: 'sharePercent',
                key: 'sharePercent',
                render: percent,
              },
              {
                title: 'Số người trong nhánh',
                dataIndex: 'branchMemberCount',
                key: 'branchMemberCount',
              },
              {
                title: 'Tính cho cấp bậc',
                key: 'counts',
                render: (_: any, r: any) => (
                  <Space size={4} wrap>
                    {r.countsTowardCurrentRank && detail.currentQualification && (
                      <Tag color="blue">{detail.currentQualification.rank}</Tag>
                    )}
                    {r.countsTowardNextRank && detail.nextQualification && (
                      <Tag color="gold">{detail.nextQualification.rank}</Tag>
                    )}
                    {!r.countsTowardCurrentRank && !r.countsTowardNextRank && (
                      <Text type="secondary">-</Text>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <Card size="small" title="Thưởng nhóm (Tầng 3)" style={{ marginBottom: 12 }}>
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="Doanh số nhóm">{money(detail.groupReward.groupSales)}</Descriptions.Item>
            <Descriptions.Item label="Mốc đạt được">{detail.groupReward.tierLabel}</Descriptions.Item>
            <Descriptions.Item label="Tỷ lệ theo tháng này">
              {percent(detail.groupReward.rateThisMonth)}
            </Descriptions.Item>
            <Descriptions.Item label={`Tỷ lệ tháng ${detail.groupReward.prevMonth}`}>
              {percent(detail.groupReward.prevMonthRate)}
            </Descriptions.Item>
            <Descriptions.Item label="Tỷ lệ áp dụng">
              <strong>{percent(detail.groupReward.appliedRate)}</strong>
              {detail.groupReward.keptFromPrevMonth && (
                <Tag color="orange" style={{ marginLeft: 8 }}>
                  Giữ theo tháng trước (không tụt hạng)
                </Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Tiền thưởng nhóm">
              <strong style={{ color: '#52c41a' }}>{money(detail.groupReward.amount)}</strong>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card size="small" title="Đồng chia toàn quốc (Tầng 4)">
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="Cấp bậc">
              {rankTag(detail.globalShare.rank, detail.globalShare.rankLabel)}
            </Descriptions.Item>
            <Descriptions.Item label="Tỷ lệ quỹ theo cấp">
              {percent(detail.globalShare.poolRate)}
            </Descriptions.Item>
            <Descriptions.Item label="Doanh số toàn quốc">
              {money(detail.globalShare.totalNationalSales)}
            </Descriptions.Item>
            <Descriptions.Item label="Quỹ đồng chia của cấp">
              {money(detail.globalShare.poolAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Số người cùng cấp">
              {detail.globalShare.qualifiedCount}
            </Descriptions.Item>
            <Descriptions.Item label="Nhận được">
              <strong style={{ color: '#52c41a' }}>{money(detail.globalShare.amount)}</strong>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    );
  };

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
    <div className="admin-page" style={{ padding: '24px' }}>
      <PageHeader title="Monthly Rewards Management" />

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
            scroll={{ x: 1300 }}
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
                render: (rank: string) => rankTag(rank),
              },
              {
                title: 'Doanh số cá nhân',
                dataIndex: 'personalSales',
                key: 'personalSales',
                render: (val: number) => money(val),
              },
              {
                title: 'Doanh số nhóm',
                dataIndex: 'groupSales',
                key: 'groupSales',
                render: (val: number) => money(val),
              },
              {
                title: 'Thưởng nhóm (Tầng 3)',
                dataIndex: 'groupRewardAmount',
                key: 'groupRewardAmount',
                render: (val: number, record: any) => (
                  <span>
                    {money(val)}
                    {Number(record.groupRewardRate) > 0 &&
                      ` (${(record.groupRewardRate * 100).toFixed(1)}%)`}
                  </span>
                ),
              },
              {
                title: 'Đồng chia (Tầng 4)',
                dataIndex: 'globalShareAmount',
                key: 'globalShareAmount',
                render: (val: number) => money(val),
              },
              {
                title: 'Trạng thái',
                dataIndex: 'isProcessed',
                key: 'isProcessed',
                render: (isProcessed: boolean) => (
                  <StatusTag status={!!isProcessed} map={MONTHLY_PROCESSED_TAGS} />
                ),
              },
              {
                title: 'Chi tiết',
                key: 'detail',
                fixed: 'right',
                width: 110,
                render: (_, record) => {
                  const u = record.user || record;
                  const userId = record.userId || u.id;
                  return (
                    <Button
                      type="link"
                      style={{ padding: 0 }}
                      onClick={() => openDetail(userId, u.username || u.email || userId)}
                    >
                      Xem chi tiết
                    </Button>
                  );
                },
              },
            ]}
          />
        </Tabs.TabPane>

        <Tabs.TabPane tab="Lịch sử chốt ví" key="history">
          <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end' , gap: 12 }}>
            <Button icon={<ReloadOutlined />} onClick={fetchPayoutHistory} loading={historyLoading}>
              Làm mới lịch sử
            </Button>
          </div>
          <Table
            scroll={{ x: 'max-content' }}
            dataSource={payoutHistory}
            loading={historyLoading}
            rowKey="id"
            columns={[
              shortIdColumn<any>('ID giao dịch', 'id'),
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
                render: (val: number) => (
                  <strong style={{ color: '#52c41a' }}>{money(val)}</strong>
                ),
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
                render: (status: string) => (
                  <StatusTag
                    status={status}
                    map={COMMISSION_STATUS_TAGS}
                    fallbackColor="error"
                    uppercase
                  />
                ),
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

      <Drawer
        title={`Chi tiết doanh số tháng ${monthlyDate ? monthlyDate.format('YYYY-MM') : ''}${
          detailPath.length ? ` - ${detailPath[detailPath.length - 1].username}` : ''
        }`}
        width={1100}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        destroyOnHidden
      >
        {renderDetailBody()}
      </Drawer>
    </div>
  );
};

export default MonthlyRewards;
