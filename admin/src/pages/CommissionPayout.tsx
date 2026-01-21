import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  message,
  Statistic,
  Row,
  Col,
  Modal,
  Input,
  Typography,
  Descriptions,
  Tooltip,
  DatePicker,
  Select,
  Divider,
} from 'antd';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  WalletOutlined,
  FileTextOutlined,
  EyeOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import {
  commissionPayoutService,
  PayoutStats,
  PendingCommission,
  BatchPayoutRequest,
  AuditLog,
} from '../services/commissionPayoutService';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text, Link } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;

const CommissionPayout: React.FC = () => {
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [pendingCommissions, setPendingCommissions] = useState<PendingCommission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<PendingCommission | null>(null);
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [batchSize, setBatchSize] = useState<number>(50);
  const [minAmount, setMinAmount] = useState<number | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'audit'>('pending');

  useEffect(() => {
    fetchStats();
    fetchPendingCommissions();
    fetchAuditLogs();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await commissionPayoutService.getStats();
      setStats(response.data);
    } catch (error: any) {
      message.error('Failed to fetch payout statistics');
    }
  };

  const fetchPendingCommissions = async () => {
    setLoading(true);
    try {
      const response = await commissionPayoutService.getPending({ limit: 100 });
      const data = response?.data || [];
      setPendingCommissions(Array.isArray(data) ? data : []);
    } catch (error: any) {
      message.error('Failed to fetch pending commissions');
      setPendingCommissions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const params: any = { limit: 50 };
      if (dateRange) {
        params.startDate = dateRange[0].toISOString();
        params.endDate = dateRange[1].toISOString();
      }
      const response = await commissionPayoutService.getAuditLogs(params);
      setAuditLogs(response.data || []);
    } catch (error: any) {
      message.error('Failed to fetch audit logs');
    }
  };

  const handleAutoPayout = async () => {
    Modal.confirm({
      title: 'Confirm Auto Payout',
      content: (
        <div>
          <p>This will automatically payout all pending commissions.</p>
          <p>
            <strong>Batch Size:</strong> {batchSize}
          </p>
          {minAmount && (
            <p>
              <strong>Min Amount:</strong> ${minAmount}
            </p>
          )}
          <p style={{ color: '#ff4d4f', marginTop: 16 }}>
            ⚠️ This action will execute real blockchain transactions!
          </p>
        </div>
      ),
      okText: 'Execute',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setPayoutLoading(true);
        try {
          const response = await commissionPayoutService.autoPayout({
            batchSize,
            minAmount,
          });
          
          if (response?.data) {
            if (response.data.count > 0) {
              message.success(
                `Auto payout completed! BatchId: ${response.data.batchId}, Count: ${response.data.count}`
              );
            } else {
              message.info('No pending commissions to payout');
            }
            fetchStats();
            fetchPendingCommissions();
            fetchAuditLogs();
          } else {
            message.warning('No response from server');
          }
        } catch (error: any) {
          const errorMessage = error?.response?.data?.message || error?.message || 'Failed to execute auto payout';
          message.error(errorMessage);
        } finally {
          setPayoutLoading(false);
        }
      },
    });
  };

  const handleManualPayout = async () => {
    if (selectedCommissions.length === 0) {
      message.warning('Please select at least one commission');
      return;
    }

    // Group selected commissions by user
    const selected = pendingCommissions.filter((c) => selectedCommissions.includes(c.id));
    const grouped = new Map<string, { user: any; commissions: PendingCommission[]; total: number }>();

    selected.forEach((commission) => {
      if (!commission.user?.walletAddress) {
        message.warning(`Commission ${commission.id} has no wallet address`);
        return;
      }

      const wallet = commission.user.walletAddress.toLowerCase();
      const existing = grouped.get(wallet);

      if (existing) {
        existing.commissions.push(commission);
        existing.total += commission.amount;
      } else {
        grouped.set(wallet, {
          user: commission.user,
          commissions: [commission],
          total: commission.amount,
        });
      }
    });

    if (grouped.size === 0) {
      message.error('No valid commissions selected');
      return;
    }

    const recipients: BatchPayoutRequest['recipients'] = Array.from(grouped.values()).map((data) => ({
      userId: data.user.id,
      walletAddress: data.user.walletAddress,
      amount: data.total.toFixed(18),
    }));

    Modal.confirm({
      title: 'Confirm Manual Payout',
      content: (
        <div>
          <p>
            This will payout <strong>{selectedCommissions.length}</strong> commission(s) to{' '}
            <strong>{recipients.length}</strong> recipient(s).
          </p>
          <div style={{ marginTop: 16, maxHeight: 300, overflow: 'auto' }}>
            {recipients.map((r, idx) => (
              <div key={idx} style={{ marginBottom: 8 }}>
                <Text strong>{r.walletAddress}</Text>
                <Text> - ${parseFloat(r.amount).toFixed(5)} USDT</Text>
              </div>
            ))}
          </div>
          <p style={{ color: '#ff4d4f', marginTop: 16 }}>
            ⚠️ This action will execute real blockchain transactions!
          </p>
        </div>
      ),
      okText: 'Execute',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setPayoutLoading(true);
        try {
          const response = await commissionPayoutService.executeBatch({ recipients });
          message.success(
            `Payout successful! BatchId: ${response.data.batchId}, TxHash: ${response.data.txHash}`
          );
          setSelectedCommissions([]);
          fetchStats();
          fetchPendingCommissions();
          fetchAuditLogs();
        } catch (error: any) {
          message.error(error?.response?.data?.message || 'Failed to execute payout');
        } finally {
          setPayoutLoading(false);
        }
      },
    });
  };

  const handleViewCommission = (commission: PendingCommission) => {
    setSelectedCommission(commission);
    setDetailModalVisible(true);
  };

  const handleViewAuditLog = (log: AuditLog) => {
    setSelectedAuditLog(log);
    setAuditModalVisible(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  const formatPrice = (amount: number | string) => {
    // Handle null/undefined/zero
    if (amount === 0 || amount === null || amount === undefined || amount === '0') {
      return '0.00';
    }
    
    // Convert to number first to handle floating-point precision issues
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Handle NaN
    if (isNaN(num)) {
      return '0.00';
    }
    
    // Use toFixed with 8 decimal places (USDT standard), then remove trailing zeros
    // This fixes floating-point precision issues like 0.020000000000000004
    let amountStr = num.toFixed(8);
    
    // Remove trailing zeros but keep at least 2 decimal places
    amountStr = amountStr.replace(/\.?0+$/, '');
    if (!amountStr.includes('.')) {
      amountStr += '.00';
    } else {
      const [integerPart, decimalPart] = amountStr.split('.');
      if (decimalPart.length < 2) {
        amountStr = `${integerPart}.${decimalPart.padEnd(2, '0')}`;
      }
    }
    
    // Split into integer and decimal parts for formatting
    const [integerPart, decimalPart] = amountStr.split('.');
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return `${formattedInteger}.${decimalPart}`;
  };

  const pendingColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (text: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text.substring(0, 8)}...</span>
      ),
    },
    {
      title: 'User',
      key: 'user',
      width: 200,
      render: (_: any, record: PendingCommission) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>
            {record.user?.fullName || record.user?.username || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.user?.walletAddress ? (
              <Tooltip title={record.user.walletAddress}>
                <span style={{ fontFamily: 'monospace' }}>
                  {record.user.walletAddress.substring(0, 10)}...
                </span>
              </Tooltip>
            ) : (
              <span style={{ color: '#ff4d4f' }}>No wallet address</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const colors: Record<string, string> = {
          DIRECT: 'blue',
          GROUP: 'purple',
          MANAGEMENT: 'cyan',
        };
        return <Tag color={colors[type] || 'default'}>{type}</Tag>;
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (amount: number) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff', fontSize: '16px' }}>
          ${formatPrice(amount)} USDT
        </span>
      ),
    },
    {
      title: 'Order Amount',
      dataIndex: 'orderAmount',
      key: 'orderAmount',
      width: 150,
      render: (amount: number) => `$${formatPrice(amount)}`,
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: PendingCommission) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewCommission(record)}
        >
          View
        </Button>
      ),
    },
  ];

  const auditColumns = [
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action: string) => {
        const colors: Record<string, string> = {
          PAYOUT_CREATED: 'blue',
          PAYOUT_EXECUTED: 'green',
          PAYOUT_FAILED: 'red',
        };
        return <Tag color={colors[action] || 'default'}>{action}</Tag>;
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      ellipsis: true,
    },
    {
      title: 'Batch ID',
      dataIndex: 'entityId',
      key: 'entityId',
      width: 150,
      render: (id: string) =>
        id ? (
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{id.substring(0, 12)}...</span>
        ) : (
          '-'
        ),
    },
    {
      title: 'Tx Hash',
      key: 'txHash',
      width: 200,
      render: (_: any, record: AuditLog) => {
        const txHash = record.metadata?.txHash;
        if (!txHash) return '-';
        return (
          <Space>
            <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              {txHash.substring(0, 10)}...
            </span>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(txHash)}
            />
            <Link
              href={`https://bscscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View
            </Link>
          </Space>
        );
      },
    },
    {
      title: 'User',
      key: 'user',
      width: 150,
      render: (_: any, record: AuditLog) => record.username || record.userId || 'System',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: AuditLog) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewAuditLog(record)}>
          View
        </Button>
      ),
    },
  ];

  // Show all pending commissions, but mark which ones can be paid out
  // Handle both uppercase and lowercase status values
  const validCommissions = pendingCommissions.filter(
    (c) => {
      const status = String(c.status || '').toUpperCase();
      return status === 'PENDING';
    }
  );
  
  const payableCommissions = pendingCommissions.filter(
    (c) => {
      const status = String(c.status || '').toUpperCase();
      return status === 'PENDING' && c.user?.walletAddress;
    }
  );
  

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>Commission Payout</Title>
        <Button icon={<ReloadOutlined />} onClick={() => {
          fetchStats();
          fetchPendingCommissions();
          fetchAuditLogs();
        }}>
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending Commissions"
              value={stats?.pending.count || 0}
              prefix={<FileTextOutlined />}
              styles={{ content: { color: '#faad14' } }}
            />
            <div style={{ marginTop: 8, fontSize: '14px', color: '#666' }}>
              Total: ${formatPrice(stats?.pending.totalAmount || 0)} USDT
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Paid Commissions"
              value={stats?.paid.count || 0}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Blocked Commissions"
              value={stats?.blocked.count || 0}
              prefix={<FileTextOutlined />}
              styles={{ content: { color: '#ff4d4f' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Contract Balance"
              value={formatPrice(stats?.contractBalance || 0)}
              prefix={<WalletOutlined />}
              suffix="USDT"
              styles={{ content: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Action Buttons */}
      <Card style={{ marginBottom: '24px' }}>
        <Space orientation="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Title level={4}>Auto Payout Settings</Title>
            <Space>
              <div>
                <Text>Batch Size:</Text>
                <Input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 50)}
                  style={{ width: 100, marginLeft: 8 }}
                />
              </div>
              <div>
                <Text>Min Amount (optional):</Text>
                <Input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.001"
                  style={{ width: 120, marginLeft: 8 }}
                />
              </div>
              <Button
                type="primary"
                danger
                icon={<ThunderboltOutlined />}
                onClick={handleAutoPayout}
                loading={payoutLoading}
                disabled={!stats || stats.pending.count === 0}
              >
                Auto Payout All
              </Button>
            </Space>
          </div>
          <Divider />
          <div>
            <Title level={4}>Manual Payout</Title>
            <Space>
              <Text>
                Selected: <strong>{selectedCommissions.length}</strong> commission(s)
                {selectedCommissions.length > 0 && (
                  <span style={{ color: '#666', marginLeft: 8 }}>
                    ({selectedCommissions.filter(id => {
                      const comm = pendingCommissions.find(c => c.id === id);
                      return comm?.user?.walletAddress;
                    }).length} payable)
                  </span>
                )}
              </Text>
              <Button
                type="primary"
                danger
                icon={<DollarOutlined />}
                onClick={handleManualPayout}
                loading={payoutLoading}
                disabled={selectedCommissions.length === 0 || selectedCommissions.filter(id => {
                  const comm = pendingCommissions.find(c => c.id === id);
                  return comm?.user?.walletAddress;
                }).length === 0}
              >
                Payout Selected
              </Button>
            </Space>
          </div>
        </Space>
      </Card>

      {/* Tabs */}
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button
            type={activeTab === 'pending' ? 'primary' : 'default'}
            onClick={() => setActiveTab('pending')}
          >
            Pending Commissions ({validCommissions.length})
          </Button>
          <Button
            type={activeTab === 'audit' ? 'primary' : 'default'}
            onClick={() => setActiveTab('audit')}
          >
            Audit Logs
          </Button>
        </Space>

        {activeTab === 'pending' && (
          <>
            <Table
              rowSelection={{
                selectedRowKeys: selectedCommissions,
                onChange: (keys) => setSelectedCommissions(keys as string[]),
                getCheckboxProps: (record: PendingCommission) => ({
                  disabled: !record.user?.walletAddress || record.status !== 'PENDING',
                }),
              }}
              columns={pendingColumns}
              dataSource={validCommissions}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1200 }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} pending commissions`,
              }}
            />
          </>
        )}

        {activeTab === 'audit' && (
          <>
            <Space style={{ marginBottom: 16 }}>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as any)}
                format="YYYY-MM-DD"
              />
              <Button onClick={fetchAuditLogs}>Filter</Button>
              <Button onClick={() => {
                setDateRange(null);
                fetchAuditLogs();
              }}>Clear</Button>
            </Space>
            <Table
              columns={auditColumns}
              dataSource={auditLogs}
              rowKey="id"
              scroll={{ x: 1200 }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} audit logs`,
              }}
            />
          </>
        )}
      </Card>

      {/* Commission Detail Modal */}
      <Modal
        title="Commission Details"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedCommission(null);
        }}
        footer={null}
        width={800}
      >
        {selectedCommission && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="ID" span={2}>
              <span style={{ fontFamily: 'monospace' }}>{selectedCommission.id}</span>
            </Descriptions.Item>
            <Descriptions.Item label="User">
              {selectedCommission.user?.fullName || selectedCommission.user?.username || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {selectedCommission.user?.email || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Wallet Address" span={2}>
              {selectedCommission.user?.walletAddress ? (
                <Space>
                  <span style={{ fontFamily: 'monospace' }}>
                    {selectedCommission.user.walletAddress}
                  </span>
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(selectedCommission.user!.walletAddress!)}
                  />
                  <Link
                    href={`https://bscscan.com/address/${selectedCommission.user.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on BSCScan
                  </Link>
                </Space>
              ) : (
                <span style={{ color: '#ff4d4f' }}>No wallet address</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color="blue">{selectedCommission.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color="orange">{selectedCommission.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Amount">
              <span style={{ fontWeight: 'bold', color: '#1890ff', fontSize: '18px' }}>
                ${formatPrice(selectedCommission.amount)} USDT
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Order Amount">
              ${formatPrice(selectedCommission.orderAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Order ID" span={2}>
              <span style={{ fontFamily: 'monospace' }}>{selectedCommission.orderId}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Created At" span={2}>
              {new Date(selectedCommission.createdAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Audit Log Detail Modal */}
      <Modal
        title="Audit Log Details"
        open={auditModalVisible}
        onCancel={() => {
          setAuditModalVisible(false);
          setSelectedAuditLog(null);
        }}
        footer={null}
        width={800}
      >
        {selectedAuditLog && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Action">
              <Tag color="blue">{selectedAuditLog.action}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Description">
              {selectedAuditLog.description}
            </Descriptions.Item>
            {selectedAuditLog.entityId && (
              <Descriptions.Item label="Batch ID">
                <span style={{ fontFamily: 'monospace' }}>{selectedAuditLog.entityId}</span>
              </Descriptions.Item>
            )}
            {selectedAuditLog.metadata?.txHash && (
              <Descriptions.Item label="Transaction Hash">
                <Space>
                  <span style={{ fontFamily: 'monospace' }}>{selectedAuditLog.metadata.txHash}</span>
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(selectedAuditLog.metadata.txHash)}
                  />
                  <Link
                    href={`https://bscscan.com/tx/${selectedAuditLog.metadata.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on BSCScan
                  </Link>
                </Space>
              </Descriptions.Item>
            )}
            {selectedAuditLog.metadata && (
              <Descriptions.Item label="Metadata">
                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, maxHeight: 300, overflow: 'auto' }}>
                  {JSON.stringify(selectedAuditLog.metadata, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="User">
              {selectedAuditLog.username || selectedAuditLog.userId || 'System'}
            </Descriptions.Item>
            <Descriptions.Item label="IP Address">
              {selectedAuditLog.ipAddress || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Created At">
              {new Date(selectedAuditLog.createdAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default CommissionPayout;
