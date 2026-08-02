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
  Typography,
  DatePicker,
  Form,
  notification,
} from 'antd';
import {
  CheckOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  StopOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { commissionService, Commission } from '../services/commissionService';
import api from '../services/api';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

const canCancelCommission = (status: string) =>
  status === 'pending' || status === 'blocked';

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
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTargetIds, setCancelTargetIds] = useState<string[]>([]);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [compensateModalOpen, setCompensateModalOpen] = useState(false);
  const [compensateDate, setCompensateDate] = useState<dayjs.Dayjs | null>(dayjs().subtract(30, 'day'));
  const [compensating, setCompensating] = useState(false);

  const handleCompensate = async () => {
    try {
      setCompensating(true);
      const res = await api.post('/affiliate/admin/commissions/compensate-missed-direct', {
        fromDate: compensateDate ? compensateDate.format('YYYY-MM-DD') : undefined,
      });
      notification.success({
        message: 'Bù hoa hồng thành công!',
        description: `Đã bù hoa hồng cho ${res.data.compensatedCount} đơn hàng. Tổng tiền bù: $${res.data.totalCompensatedAmount.toLocaleString()} USD.`,
        duration: 10,
      });
      setCompensateModalOpen(false);
      fetchCommissions();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Có lỗi xảy ra khi bù hoa hồng';
      message.error(msg);
    } finally {
      setCompensating(false);
    }
  };

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

  const handleExport = async () => {
    try {
      const params: any = {};
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedType !== 'all') params.type = selectedType;
      
      const response = await commissionService.exportCommissions(params);

      const blob = new Blob([response.data as any], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'commissions.csv');
      document.body.appendChild(link);
      link.click();

      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('Commissions exported successfully');
    } catch (error) {
      console.error(error);
      message.error('Failed to export commissions');
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
    const pendingIds = selectedRowKeys.filter((key) => {
      const c = filteredCommissions.find((x) => x.id === key);
      return c?.status === 'pending';
    }) as string[];

    if (pendingIds.length === 0) {
      message.warning(
        'Chỉ commission đang pending mới được duyệt chi trả. Hãy chọn ít nhất một dòng pending.',
      );
      return;
    }

    try {
      const result = await commissionService.approveBatch(pendingIds);
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

  const openCancelModal = (ids: string[]) => {
    if (ids.length === 0) return;
    setCancelTargetIds(ids);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    const ids = [...cancelTargetIds];
    if (ids.length === 0) return;
    setCancelling(true);
    try {
      const reason = cancelReason.trim() || undefined;
      if (ids.length === 1) {
        await commissionService.cancel(ids[0], reason);
      } else {
        const result = await commissionService.cancelBatch(ids, reason);
        const data = result?.data as
          | { cancelled?: number; failed?: number }
          | undefined;
        if (data?.failed && data.failed > 0) {
          message.warning(
            `${data.failed} commission(s) không hủy được. Đã hủy: ${data.cancelled ?? 0}.`,
          );
        }
      }
      message.success(
        ids.length === 1
          ? 'Đã hủy commission.'
          : `Đã xử lý hủy ${ids.length} commission.`,
      );
      setCancelModalOpen(false);
      setCancelTargetIds([]);
      setCancelReason('');
      setSelectedRowKeys([]);
      if (selectedCommission && ids.includes(selectedCommission.id)) {
        setDetailModalVisible(false);
        setSelectedCommission(null);
        setApproveNotes('');
      }
      fetchCommissions();
    } catch (error: any) {
      message.error(
        error?.response?.data?.message || 'Không hủy được commission',
      );
    } finally {
      setCancelling(false);
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
      cancelled: { color: 'default', text: 'Cancelled' },
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
      indirect: { color: 'magenta', text: 'Indirect (F2)' },
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
      title: 'Referral ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 280,
      render: (userId: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }} title={userId}>
          {userId || '-'}
        </span>
      ),
    },
    {
      title: 'Buyer (From User)',
      key: 'fromUser',
      width: 220,
      render: (_: any, record: Commission) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {record.fromUser?.fullName || record.fromUser?.username || 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.fromUser?.email || record.fromUserId || '-'}
          </div>
        </div>
      ),
    },
    {
      title: 'Order ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 220,
      render: (orderId: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }} title={orderId}>
          {orderId || '-'}
        </span>
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
      width: 260,
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
          {canCancelCommission(record.status) && (
            <Button
              danger
              type="link"
              size="small"
              icon={<StopOutlined />}
              onClick={() => openCancelModal([record.id])}
            >
              Cancel
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      const cancelableIds = filteredCommissions
        .filter((c) => canCancelCommission(c.status))
        .map((c) => c.id);
      const validKeys = keys.filter((key) =>
        cancelableIds.includes(key as string),
      );
      setSelectedRowKeys(validKeys);
    },
    getCheckboxProps: (record: Commission) => ({
      disabled: !canCancelCommission(record.status),
    }),
  };

  const pendingCount = filteredCommissions.filter((c) => c.status === 'pending').length;
  const selectedApproveIds = selectedRowKeys.filter((key) => {
    const c = filteredCommissions.find((x) => x.id === key);
    return c?.status === 'pending';
  }) as string[];
  const selectedCancelIds = selectedRowKeys.filter((key) => {
    const c = filteredCommissions.find((x) => x.id === key);
    return c && canCancelCommission(c.status);
  }) as string[];
  const selectedApproveCount = selectedApproveIds.length;
  const selectedCancelCount = selectedCancelIds.length;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>Commissions Management</Title>
        <Space>
          <Button 
            type="primary" 
            ghost 
            icon={<ReloadOutlined />} 
            onClick={() => setCompensateModalOpen(true)}
          >
            Compensate Missed Direct
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchCommissions}>
            Refresh
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Export CSV
          </Button>
          {selectedApproveCount > 0 && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleApproveBatch}
            >
              Approve Selected ({selectedApproveCount})
            </Button>
          )}
          {selectedCancelCount > 0 && (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={() => openCancelModal(selectedCancelIds)}
            >
              Cancel Selected ({selectedCancelCount})
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
          <Option value="cancelled">Cancelled</Option>
        </Select>

        <Select
          style={{ width: 150 }}
          value={selectedType}
          onChange={setSelectedType}
        >
          <Option value="all">All Types</Option>
          <Option value="direct">Direct</Option>
          <Option value="indirect">Indirect (F2)</Option>
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
          selectedCommission &&
            canCancelCommission(selectedCommission.status) && (
              <Button
                key="cancel"
                danger
                icon={<StopOutlined />}
                onClick={() => openCancelModal([selectedCommission.id])}
              >
                Cancel
              </Button>
            ),
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
              <Descriptions.Item label="Referral ID" span={2}>
                <span style={{ fontFamily: 'monospace' }}>{selectedCommission.userId || '-'}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Buyer (From User)">
                {selectedCommission.fromUser?.fullName || selectedCommission.fromUser?.username || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Buyer ID">
                <span style={{ fontFamily: 'monospace' }}>{selectedCommission.fromUserId || '-'}</span>
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
                <span style={{ fontFamily: 'monospace' }}>{selectedCommission.orderId}</span>
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

      <Modal
        title={
          cancelTargetIds.length === 1
            ? 'Hủy commission'
            : `Hủy ${cancelTargetIds.length} commission`
        }
        open={cancelModalOpen}
        onCancel={() => {
          setCancelModalOpen(false);
          setCancelTargetIds([]);
          setCancelReason('');
        }}
        onOk={handleConfirmCancel}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true, loading: cancelling }}
        cancelText="Đóng"
        destroyOnClose
      >
        <p style={{ marginBottom: 12, color: '#666' }}>
          Chỉ commission đang <strong>pending</strong> hoặc <strong>blocked</strong> mới hủy được.
          Trạng thái sẽ thành Cancelled; ghi chú sẽ được bổ sung.
        </p>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Lý do (tùy chọn)</div>
        <TextArea
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Ví dụ: sai sót đơn hàng, điều chỉnh thủ công..."
        />
      </Modal>

      <Modal
        title="Bù hoa hồng trực tiếp bị thiếu"
        open={compensateModalOpen}
        onCancel={() => {
          if (!compensating) {
            setCompensateModalOpen(false);
          }
        }}
        onOk={handleCompensate}
        confirmLoading={compensating}
        okText="Bắt đầu quét & bù"
        cancelText="Đóng"
        destroyOnClose
      >
        <p style={{ marginBottom: 16, color: '#555' }}>
          Hệ thống sẽ quét tất cả các đơn hàng đã được **CONFIRMED** từ ngày được chọn đến hiện tại. 
          Nếu đơn hàng nào chưa được chia hoa hồng Direct (trực tiếp hoặc sản phẩm) cho F1, hệ thống sẽ tự động tính toán và bổ sung.
        </p>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Quét từ ngày:</div>
        <DatePicker
          style={{ width: '100%' }}
          value={compensateDate}
          onChange={(date) => setCompensateDate(date)}
          disabledDate={(current) => current && current > dayjs().endOf('day')}
          format="YYYY-MM-DD"
          allowClear={false}
        />
      </Modal>
    </div>
  );
};

export default CommissionsPage;
