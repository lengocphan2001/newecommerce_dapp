import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Input, message } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  walletWithdrawRequestService,
  WalletWithdrawRequest,
} from '../services/walletWithdrawRequestService';

const WalletWithdrawRequests: React.FC = () => {
  const [list, setList] = useState<WalletWithdrawRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<WalletWithdrawRequest | null>(null);
  const [pendingAction, setPendingAction] = useState<
    'APPROVED' | 'REJECTED' | null
  >(null);
  const [adminNote, setAdminNote] = useState('');

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await walletWithdrawRequestService.list(
        statusFilter || undefined,
      );
      const data = Array.isArray(res.data)
        ? res.data
        : (res as any).data?.data ?? [];
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Tải danh sách thất bại');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [statusFilter]);

  const handleProcess = (
    request: WalletWithdrawRequest,
    action: 'APPROVED' | 'REJECTED',
  ) => {
    setSelectedRequest(request);
    setPendingAction(action);
    setAdminNote('');
    setModalVisible(true);
  };

  const handleSubmitProcess = async () => {
    if (!selectedRequest || !pendingAction) return;
    setProcessingId(selectedRequest.id);
    try {
      await walletWithdrawRequestService.process(selectedRequest.id, {
        status: pendingAction,
        adminNote: adminNote || undefined,
      });
      message.success(
        pendingAction === 'APPROVED' ? 'Đã duyệt yêu cầu rút tiền' : 'Đã từ chối',
      );
      setModalVisible(false);
      setSelectedRequest(null);
      setPendingAction(null);
      fetchList();
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Xử lý thất bại');
    } finally {
      setProcessingId(null);
    }
  };

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 165,
      render: (v: string) => (v ? new Date(v).toLocaleString('vi-VN') : '-'),
    },
    {
      title: 'User',
      key: 'user',
      render: (_: any, r: WalletWithdrawRequest) =>
        r.user
          ? [r.user.username, r.user.fullName, r.user.email]
              .filter(Boolean)
              .join(' / ') || r.userId
          : r.userId,
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: string | number) => `$${Number(v || 0).toFixed(2)}`,
    },
    {
      title: 'Phương thức',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (v: string) => <Tag color={v === 'USDT' ? 'geekblue' : 'green'}>{v}</Tag>,
    },
    {
      title: 'Thông tin nhận',
      key: 'receiver',
      render: (_: any, r: WalletWithdrawRequest) =>
        r.method === 'USDT'
          ? r.usdtWalletAddress || '—'
          : `${r.bankName || ''} / ${r.bankAccountName || ''} / ${r.bankAccountNumber || ''}`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const map: Record<string, string> = {
          PENDING: 'orange',
          APPROVED: 'green',
          REJECTED: 'red',
        };
        const label: Record<string, string> = {
          PENDING: 'Chờ duyệt',
          APPROVED: 'Đã duyệt',
          REJECTED: 'Từ chối',
        };
        return <Tag color={map[status] || 'default'}>{label[status] || status}</Tag>;
      },
    },
    {
      title: 'Ghi chú user',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v: string) => (v ? <span title={v}>{v}</span> : '—'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      render: (_: any, record: WalletWithdrawRequest) =>
        record.status === 'PENDING' ? (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleProcess(record, 'APPROVED')}
            >
              Duyệt
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleProcess(record, 'REJECTED')}
            >
              Từ chối
            </Button>
          </Space>
        ) : (
          <span className="text-gray-400">Đã xử lý</span>
        ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Yêu cầu rút tiền từ ví rút</h2>
        <Space>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-1.5"
          >
            <option value="">Tất cả</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Từ chối</option>
          </select>
          <Button icon={<ReloadOutlined />} onClick={fetchList} loading={loading}>
            Làm mới
          </Button>
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1000 }}
      />

      <Modal
        title={pendingAction === 'APPROVED' ? 'Duyệt yêu cầu rút tiền' : 'Từ chối yêu cầu'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedRequest(null);
          setPendingAction(null);
        }}
        onOk={handleSubmitProcess}
        okText={pendingAction === 'APPROVED' ? 'Duyệt' : 'Từ chối'}
        okButtonProps={{ danger: pendingAction === 'REJECTED', loading: !!processingId }}
        cancelButtonProps={{ disabled: !!processingId }}
      >
        {selectedRequest && (
          <div className="space-y-3">
            <p>
              <strong>User:</strong> {selectedRequest.user?.username || selectedRequest.userId}
            </p>
            <p>
              <strong>Số tiền:</strong> ${Number(selectedRequest.amount || 0).toFixed(2)}
            </p>
            <p>
              <strong>Phương thức:</strong> {selectedRequest.method}
            </p>
            <p>
              <strong>Thông tin nhận:</strong>{' '}
              {selectedRequest.method === 'USDT'
                ? selectedRequest.usdtWalletAddress
                : `${selectedRequest.bankName || ''} / ${selectedRequest.bankAccountName || ''} / ${selectedRequest.bankAccountNumber || ''}`}
            </p>
            {selectedRequest.note && (
              <p>
                <strong>Ghi chú user:</strong> {selectedRequest.note}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghi chú admin (tùy chọn)
              </label>
              <Input.TextArea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                placeholder="Ghi chú khi duyệt/từ chối..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WalletWithdrawRequests;

