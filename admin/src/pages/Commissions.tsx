import React, { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  message,
  Select,
  Input,
  Modal,
  Descriptions,
  Checkbox,
  Typography,
} from 'antd';
import {
  CheckOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { commissionService, Commission } from '../services/commissionService';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

const CommissionsPage: React.FC = () => {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [filteredCommissions, setFilteredCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchCommissions();
  }, [selectedStatus, selectedType]);

  useEffect(() => {
    filterCommissions();
  }, [commissions, selectedStatus, selectedType, searchText]);

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedType !== 'all') params.type = selectedType;
      
      const response = await commissionService.getAll(params);
      const data = response?.data || [];
      setCommissions(data);
      setFilteredCommissions(data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to fetch commissions');
    } finally {
      setLoading(false);
    }
  };

  const filterCommissions = () => {
    let filtered = [...commissions];

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((c) => c.status === selectedStatus);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter((c) => c.type === selectedType);
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter((c) => {
        const id = (c.id || '').toLowerCase();
        const userId = (c.userId || '').toLowerCase();
        const orderId = (c.orderId || '').toLowerCase();
        const email = (c.user?.email || '').toLowerCase();
        const fullName = (c.user?.fullName || '').toLowerCase();
        const username = (c.user?.username || '').toLowerCase();
        return (
          id.includes(q) ||
          userId.includes(q) ||
          orderId.includes(q) ||
          email.includes(q) ||
          fullName.includes(q) ||
          username.includes(q)
        );
      });
    }

    setFilteredCommissions(filtered);
  };

  /** Format date safely; avoid "Invalid Date" when API returns unexpected value */
  const formatDate = (value: string | Date | number | null | undefined): string => {
    if (value == null || value === '') return '-';
    const d = value instanceof Date ? value : new Date(value as string | number);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString();
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

  const handleApprove = async (id: string, notes?: string) => {
    try {
      const result = await commissionService.approve(id, notes);
      const txHash = result?.data?.txHash;
      if (txHash) {
        message.success({
          content: (
            <span>
              Paid on-chain successfully.{' '}
              <a href={`https://bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
                View on BSCScan
              </a>
            </span>
          ),
          duration: 6,
        });
      } else {
        message.success('Commission approved successfully');
      }
      fetchCommissions();
      setSelectedRowKeys([]);
      setApproveNotes('');
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to approve commission');
    }
  };

  const handleApproveBatch = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select at least one commission');
      return;
    }

    try {
      const result = await commissionService.approveBatch(selectedRowKeys as string[]);
      const data = result?.data || {};
      const txHash = data.txHash;
      message.success(
        txHash
          ? {
              content: (
                <span>
                  Paid {data.approved} commission(s) on-chain.{' '}
                  <a href={`https://bscscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
                    View on BSCScan
                  </a>
                </span>
              ),
              duration: 6,
            }
          : `Approved ${data.approved} commission(s)`
      );
      if (data.failed > 0) {
        message.warning(`${data.failed} commission(s) had no wallet or were skipped`);
      }
      fetchCommissions();
      setSelectedRowKeys([]);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to approve commissions');
    }
  };

  const handleViewDetail = async (id: string) => {
    try {
      const response = await commissionService.getById(id);
      setSelectedCommission(response.data);
      setDetailModalVisible(true);
    } catch (error: any) {
      message.error('Failed to load commission details');
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'orange', text: 'Pending' },
      paid: { color: 'green', text: 'Paid' },
      blocked: { color: 'red', text: 'Blocked' },
    };
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  /** Hiển thị Type; với product phân biệt Direct/Group; với management phân biệt Package/Product. */
  const getTypeTag = (type: string, notes?: string | null) => {
    if (type === 'product' && notes) {
      if (notes.startsWith('Product direct')) return <Tag color="green">Product (Direct)</Tag>;
      if (notes.startsWith('Product group')) return <Tag color="lime">Product (Group)</Tag>;
    }
    if (type === 'management') {
      if (notes?.includes('From product group')) return <Tag color="cyan">Management (Product)</Tag>;
      return <Tag color="geekblue">Management (Package)</Tag>;
    }
    const typeConfig: Record<string, { color: string; text: string }> = {
      direct: { color: 'blue', text: 'Direct' },
      group: { color: 'purple', text: 'Group' },
      management: { color: 'cyan', text: 'Management' },
      product: { color: 'green', text: 'Product' },
      milestone: { color: 'orange', text: 'Milestone' },
    };
    const config = typeConfig[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (text: string) => <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text.substring(0, 8)}...</span>,
    },
    {
      title: 'User',
      key: 'user',
      width: 200,
      render: (_: any, record: Commission) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.user?.fullName || record.user?.username || 'N/A'}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.user?.email || 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'Buyer (ai mua)',
      key: 'fromUser',
      width: 280,
      render: (_: any, record: Commission) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>
            {record.fromUser?.fullName || record.fromUser?.username || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.fromUser?.username || record.fromUserId || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type: string, record: Commission) => getTypeTag(type, record.notes),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (amount: number | string) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff', fontSize: '16px' }}>
          ${formatPrice(amount)}
        </span>
      ),
    },
    {
      title: 'Order Amount',
      dataIndex: 'orderAmount',
      key: 'orderAmount',
      width: 150,
      render: (amount: number | string) => `$${formatPrice(amount)}`,
    },
    {
      title: 'Order ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 200,
      render: (orderId: string | null) =>
        orderId ? (
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }} title={orderId}>
            {orderId}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      render: (notes: string) => (
        <span style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
          {notes || '-'}
        </span>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string | Date | null | undefined) => formatDate(date),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Commission) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}
          >
            View
          </Button>
          {record.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record.id)}
            >
              Approve
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      // Chỉ cho phép chọn các commission có status = pending
      const pendingCommissions = filteredCommissions
        .filter((c) => c.status === 'pending')
        .map((c) => c.id);
      const validKeys = keys.filter((key) => pendingCommissions.includes(key as string));
      setSelectedRowKeys(validKeys);
    },
    getCheckboxProps: (record: Commission) => ({
      disabled: record.status !== 'pending',
    }),
  };

  const pendingCount = filteredCommissions.filter((c) => c.status === 'pending').length;
  const selectedPendingCount = selectedRowKeys.length;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>Commissions Management</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchCommissions}>
            Refresh
          </Button>
          {selectedPendingCount > 0 && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleApproveBatch}
            >
              Approve Selected ({selectedPendingCount})
            </Button>
          )}
        </Space>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          placeholder="Search by ID, user ID, email, name, order ID..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 320 }}
        />
        <Select
          style={{ width: 150 }}
          value={selectedStatus}
          onChange={setSelectedStatus}
        >
          <Option value="all">All Status</Option>
          <Option value="pending">Pending</Option>
          <Option value="paid">Paid</Option>
          <Option value="blocked">Blocked</Option>
        </Select>

        <Select
          style={{ width: 150 }}
          value={selectedType}
          onChange={setSelectedType}
        >
          <Option value="all">All Types</Option>
          <Option value="direct">Direct</Option>
          <Option value="group">Group</Option>
          <Option value="management">Management</Option>
          <Option value="product">Product</Option>
          <Option value="milestone">Milestone</Option>
        </Select>

        <div style={{ marginLeft: 'auto' }}>
          <Tag color="orange">Pending: {pendingCount}</Tag>
          <Tag color="green">Total: {filteredCommissions.length}</Tag>
        </div>
      </div>

      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={filteredCommissions}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} commissions`,
        }}
      />

      <Modal
        title="Commission Details"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedCommission(null);
          setApproveNotes('');
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>,
          selectedCommission?.status === 'pending' && (
            <Button
              key="approve"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => {
                handleApprove(selectedCommission!.id, approveNotes);
                setDetailModalVisible(false);
                setApproveNotes('');
              }}
            >
              Approve
            </Button>
          ),
        ]}
        width={800}
      >
        {selectedCommission && (
          <div>
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
              <Descriptions.Item label="Buyer" span={2}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {selectedCommission.fromUser?.fullName ||
                      selectedCommission.fromUser?.username ||
                      selectedCommission.fromUserId ||
                      '-'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {selectedCommission.fromUser?.username || selectedCommission.fromUserId || '-'}
                  </div>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Type">{getTypeTag(selectedCommission.type, selectedCommission.notes)}</Descriptions.Item>
              <Descriptions.Item label="Status">{getStatusTag(selectedCommission.status)}</Descriptions.Item>
              <Descriptions.Item label="Amount">
                <span style={{ fontWeight: 'bold', color: '#1890ff', fontSize: '18px' }}>
                  ${formatPrice(selectedCommission.amount)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Order Amount">
                ${formatPrice(selectedCommission.orderAmount)}
              </Descriptions.Item>
              <Descriptions.Item label="Order ID" span={2}>
                <span style={{ fontFamily: 'monospace' }}>{selectedCommission.orderId || '-'}</span>
              </Descriptions.Item>
              {selectedCommission.level && (
                <Descriptions.Item label="Level">F{selectedCommission.level}</Descriptions.Item>
              )}
              {selectedCommission.side && (
                <Descriptions.Item label="Side">
                  <Tag color={selectedCommission.side === 'left' ? 'blue' : 'orange'}>
                    {selectedCommission.side.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Created At" span={2}>
                {formatDate(selectedCommission.createdAt)}
              </Descriptions.Item>
              {selectedCommission.status === 'paid' && (selectedCommission.payoutTxHash || selectedCommission.payoutDate) && (
                <>
                  {selectedCommission.payoutTxHash && (
                    <Descriptions.Item label="Payout Transaction" span={2}>
                      <a
                        href={`https://bscscan.com/tx/${selectedCommission.payoutTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      >
                        {selectedCommission.payoutTxHash.slice(0, 10)}...{selectedCommission.payoutTxHash.slice(-8)}
                      </a>
                      {' '}
                      <span style={{ color: '#888', fontSize: '12px' }}>(View on BSCScan)</span>
                    </Descriptions.Item>
                  )}
                  {selectedCommission.payoutDate && (
                    <Descriptions.Item label="Paid At" span={2}>
                      {formatDate(selectedCommission.payoutDate)}
                    </Descriptions.Item>
                  )}
                </>
              )}
              {selectedCommission.notes && (
                <Descriptions.Item label="Notes" span={2}>
                  {selectedCommission.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
            {selectedCommission.status === 'pending' && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Approval Notes:</div>
                <TextArea
                  rows={3}
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Optional notes for approval..."
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CommissionsPage;
