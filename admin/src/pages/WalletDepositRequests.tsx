import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Input, message, Image } from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import { walletDepositRequestService, WalletDepositRequest } from '../services/walletDepositRequestService';

const WalletDepositRequests: React.FC = () => {
  const [list, setList] = useState<WalletDepositRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WalletDepositRequest | null>(null);
  const [pendingAction, setPendingAction] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await walletDepositRequestService.list(statusFilter || undefined);
      const data = Array.isArray(res.data) ? res.data : (res as any).data?.data ?? [];
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

  const handleProcess = (request: WalletDepositRequest, action: 'APPROVED' | 'REJECTED') => {
    setSelectedRequest(request);
    setPendingAction(action);
    setAdminNote('');
    setModalVisible(true);
  };

  const handleSubmitProcess = async () => {
    if (!selectedRequest || !pendingAction) return;
    setProcessingId(selectedRequest.id);
    try {
      await walletDepositRequestService.process(selectedRequest.id, { status: pendingAction, adminNote: adminNote || undefined });
      message.success(pendingAction === 'APPROVED' ? 'Đã duyệt và cộng tiền vào ví' : 'Đã từ chối');
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
      render: (_: any, r: WalletDepositRequest) =>
        r.user
          ? [r.user.username, r.user.fullName, r.user.email].filter(Boolean).join(' / ') || r.userId
          : r.userId,
    },
    {
      title: 'Phương thức',
      dataIndex: 'method',
      key: 'method',
      width: 110,
      render: (v: string) => <Tag color={v === 'USDT' ? 'geekblue' : 'blue'}>{v || 'BANKING'}</Tag>,
    },
    {
      title: 'Số lượng / Số tiền',
      key: 'amountRequested',
      width: 150,
      render: (_: any, r: WalletDepositRequest) => {
        if (r.method === 'USDT') {
          return r.requestedUsdt != null ? <span className="font-mono text-blue-600 font-semibold">{Number(r.requestedUsdt).toLocaleString()} USDT</span> : '—';
        }
        return r.amountVnd != null ? <span className="font-medium">{Number(r.amountVnd).toLocaleString('vi-VN')} ₫</span> : '—';
      },
    },
    {
      title: 'Đã thực cộng',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      /* Se formatea el monto acreditado mostrando PV para depósitos USDT y USDT para transferencias bancarias. */
      render: (v: string | number | null, r: WalletDepositRequest) => {
        if (r.status !== 'APPROVED' || v == null) return '—';
        return r.method === 'USDT' ? `${Number(v).toFixed(4)} PV` : `${Number(v).toFixed(2)} USDT`;
      }
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const map: Record<string, string> = { PENDING: 'orange', APPROVED: 'green', REJECTED: 'red' };
        const label: Record<string, string> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' };
        return <Tag color={map[status] || 'default'}>{label[status] || status}</Tag>;
      },
    },
    {
      title: 'Ví gửi / TxHash',
      key: 'txHash',
      width: 180,
      render: (_: any, r: WalletDepositRequest) => {
        if (r.method === 'USDT') {
          return (
            <div className="flex flex-col text-xs font-mono space-y-1">
              {r.senderAddress && (
                <div>
                  <span className="text-gray-400">Ví gửi: </span>
                  <span title={r.senderAddress} className="text-slate-800 font-semibold">{r.senderAddress.substring(0, 6)}...{r.senderAddress.substring(r.senderAddress.length - 4)}</span>
                </div>
              )}
              {r.txHash && (
                <div>
                  <span className="text-gray-400">Tx: </span>
                  <span title={r.txHash} className="text-slate-600">{r.txHash.substring(0, 6)}...{r.txHash.substring(r.txHash.length - 4)}</span>
                </div>
              )}
              {!r.senderAddress && !r.txHash && '—'}
            </div>
          );
        }
        return '—';
      },
    },
    {
      title: 'Chứng từ',
      dataIndex: 'proofImageUrl',
      key: 'proofImageUrl',
      width: 90,
      render: (url: string) =>
        url ? (
          <Image width={48} height={48} src={url} style={{ objectFit: 'cover', borderRadius: 6 }} alt="Proof" />
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      title: 'Ghi chú user',
      dataIndex: 'transferNote',
      key: 'transferNote',
      ellipsis: true,
      render: (v: string) => (v ? <span title={v}>{v}</span> : '—'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      render: (_: any, record: WalletDepositRequest) =>
        record.status === 'PENDING' ? (
          <Space>
            <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => handleProcess(record, 'APPROVED')}>
              Duyệt
            </Button>
            <Button danger size="small" icon={<CloseOutlined />} onClick={() => handleProcess(record, 'REJECTED')}>
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
        <h2 className="text-lg font-semibold">Yêu cầu nạp tiền vào ví</h2>
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
        scroll={{ x: 900 }}
      />

      <Modal
        title={pendingAction === 'APPROVED' ? 'Duyệt yêu cầu nạp tiền' : 'Từ chối yêu cầu'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setSelectedRequest(null); setPendingAction(null); }}
        onOk={handleSubmitProcess}
        okText={pendingAction === 'APPROVED' ? 'Duyệt và cộng tiền' : 'Từ chối'}
        okButtonProps={{ danger: pendingAction === 'REJECTED', loading: !!processingId }}
        cancelButtonProps={{ disabled: !!processingId }}
      >
        {selectedRequest && (
          <div className="space-y-3">
            <p><strong>User:</strong> {selectedRequest.user?.username || selectedRequest.userId}</p>
            {selectedRequest.method === 'USDT' ? (
              <>
                <p><strong>Phương thức:</strong> USDT</p>
                <p><strong>Số USDT user báo nạp:</strong> {selectedRequest.requestedUsdt != null ? <span className="font-mono text-blue-600 font-semibold">{Number(selectedRequest.requestedUsdt).toLocaleString()} USDT</span> : '—'}</p>
                {selectedRequest.senderAddress && <p><strong>Ví gửi:</strong> <span className="font-mono text-sm break-all text-slate-800">{selectedRequest.senderAddress}</span></p>}
                {selectedRequest.txHash && <p><strong>TxHash:</strong> <span className="font-mono text-sm break-all">{selectedRequest.txHash}</span></p>}
                {/* Se explica al administrador que la aprobación convertirá los USDT ingresados a PV aplicando el factor de 1.08. */}
                <p className="text-sm text-slate-600">
                  Khi duyệt, hệ thống sẽ tự động quy đổi số USDT này sang PV (chia cho 1.08) và cộng vào <strong>Ví nạp PV</strong> của user (dự kiến cộng: <strong className="text-green-600">{(Number(selectedRequest.requestedUsdt || 0) / 1.08).toFixed(4)} PV</strong>).
                </p>
              </>
            ) : (
              <>
                <p><strong>Phương thức:</strong> Ngân hàng (Banking)</p>
                <p><strong>Số tiền đã chuyển (VND):</strong> {selectedRequest.amountVnd != null ? `${Number(selectedRequest.amountVnd).toLocaleString('vi-VN')} ₫` : '—'}</p>
                <p className="text-sm text-slate-600">Khi duyệt, hệ thống sẽ tính USDT = VND / tỉ giá (Banking Settings) và cộng vào ví.</p>
              </>
            )}
            {selectedRequest.transferNote && <p><strong>Ghi chú user:</strong> {selectedRequest.transferNote}</p>}
            {selectedRequest.proofImageUrl && (
              <p>
                <strong>Chứng từ:</strong>
                <br />
                <Image width={200} src={selectedRequest.proofImageUrl} alt="Proof" />
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú admin (tùy chọn)</label>
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

export default WalletDepositRequests;
