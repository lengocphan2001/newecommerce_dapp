import React, { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Input, message, Select } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  DownloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  walletWithdrawRequestService,
  WalletWithdrawRequest,
} from '../services/walletWithdrawRequestService';
import { bankingService } from '../services/bankingService';
import { buildVietQrImageUrl } from '../utils/vietqr';

const VIETQR_BANKS_API = 'https://api.vietqr.io/v2/banks';

interface VietQRBank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
}

const WalletWithdrawRequests: React.FC = () => {
  const [list, setList] = useState<WalletWithdrawRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<WalletWithdrawRequest | null>(null);
  const [pendingAction, setPendingAction] = useState<
    'APPROVED' | 'REJECTED' | null
  >(null);
  const [adminNote, setAdminNote] = useState('');
  const [usdtWithdrawRateVnd, setUsdtWithdrawRateVnd] = useState<number>(0);
  const [bankList, setBankList] = useState<VietQRBank[]>([]);
  const [qrBankId, setQrBankId] = useState('');
  const [qrBankName, setQrBankName] = useState('');
  const [qrAccountNumber, setQrAccountNumber] = useState('');
  const [qrAccountName, setQrAccountName] = useState('');

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await walletWithdrawRequestService.list(
        statusFilter || undefined,
        searchText.trim() || undefined,
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

  useEffect(() => {
    bankingService
      .getConfig()
      .then((res: any) => {
        const data = (res as any)?.data ?? res;
        const rate = Number(data?.usdtWithdrawPriceVnd ?? data?.usdtPriceVnd ?? 0);
        setUsdtWithdrawRateVnd(Number.isFinite(rate) && rate > 0 ? rate : 0);
      })
      .catch(() => setUsdtWithdrawRateVnd(0));
  }, []);

  useEffect(() => {
    fetch(VIETQR_BANKS_API)
      .then((res) => res.json())
      .then((data: { data?: VietQRBank[] }) => {
        if (data?.data && Array.isArray(data.data)) {
          setBankList(
            data.data.sort((a, b) =>
              (a.shortName || a.name).localeCompare(b.shortName || b.name),
            ),
          );
        }
      })
      .catch(() => setBankList([]));
  }, []);

  const withdrawVndAmount = useMemo(() => {
    if (!selectedRequest || usdtWithdrawRateVnd <= 0) return 0;
    const usdt =
      Number(selectedRequest.actualAmount ?? selectedRequest.amount) || 0;
    return Math.round(usdt * usdtWithdrawRateVnd);
  }, [selectedRequest, usdtWithdrawRateVnd]);

  const vietQrUrl = useMemo(() => {
    if (
      pendingAction !== 'APPROVED' ||
      selectedRequest?.method !== 'BANKING' ||
      withdrawVndAmount <= 0
    ) {
      return null;
    }
    return buildVietQrImageUrl({
      bankId: qrBankId,
      accountNumber: qrAccountNumber,
      amountVnd: withdrawVndAmount,
      accountName: qrAccountName,
      addInfo: selectedRequest.user?.username || selectedRequest.id.slice(0, 8),
    });
  }, [
    pendingAction,
    selectedRequest,
    withdrawVndAmount,
    qrBankId,
    qrAccountNumber,
    qrAccountName,
  ]);

  const handleSearch = () => {
    fetchList();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await walletWithdrawRequestService.exportToExcel(
        statusFilter || undefined,
        searchText.trim() || undefined,
      );
      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'wallet-withdraw-requests.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('Export thành công');
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Export thất bại');
    } finally {
      setExporting(false);
    }
  };

  const handleProcess = (
    request: WalletWithdrawRequest,
    action: 'APPROVED' | 'REJECTED',
  ) => {
    setSelectedRequest(request);
    setPendingAction(action);
    setAdminNote('');
    setQrBankId('');
    setQrBankName(request.bankName || '');
    setQrAccountNumber(request.bankAccountNumber || '');
    setQrAccountName(request.bankAccountName || '');
    if (request.bankName && bankList.length > 0) {
      const matched = bankList.find(
        (b) =>
          b.name === request.bankName ||
          b.shortName === request.bankName ||
          b.code === request.bankName,
      );
      if (matched) setQrBankId(matched.bin);
    }
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
      title: 'Số tiền yêu cầu',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: string | number) => `$${Number(v || 0).toFixed(2)}`,
    },
    {
      title: 'Thực nhận',
      dataIndex: 'actualAmount',
      key: 'actualAmount',
      width: 140,
      render: (v: string | number | null) => 
        v !== null && v !== undefined ? (
          <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
            ${Number(v).toFixed(2)}
          </span>
        ) : (
          <span style={{ color: '#aaa' }}>Chưa tính</span>
        ),
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
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            placeholder="Tìm theo user/email/sđt/wallet/id..."
            allowClear
            style={{ width: 320 }}
            suffix={<SearchOutlined />}
          />
          <Button onClick={handleSearch} icon={<SearchOutlined />}>
            Tìm kiếm
          </Button>
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
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exporting}
          >
            Export Excel
          </Button>
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
              <strong>Số tiền yêu cầu:</strong> ${Number(selectedRequest.amount || 0).toFixed(2)}
            </p>
            <p>
              <strong>Thực nhận:</strong>{' '}
              <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                ${Number(selectedRequest.amount || 0).toFixed(2)}
              </span>
            </p>
            {selectedRequest.method === 'BANKING' && usdtWithdrawRateVnd > 0 && (
              <p>
                <strong>Số tiền VND nhận:</strong>{' '}
                <span style={{ fontWeight: 'bold', color: '#389e0d' }}>
                  {Math.round(Number((selectedRequest.actualAmount ?? selectedRequest.amount) || 0) * usdtWithdrawRateVnd).toLocaleString('vi-VN')} VND
                </span>
              </p>
            )}
            {selectedRequest.method === 'BANKING' && usdtWithdrawRateVnd <= 0 && (
              <p>
                <strong>Số tiền VND nhận:</strong>{' '}
                <span style={{ color: '#999' }}>Chưa cấu hình tỷ giá USDT/VND trong Banking Settings</span>
              </p>
            )}
            <p>
              <strong>Phương thức:</strong> {selectedRequest.method}
            </p>
            <p>
              <strong>Thông tin nhận:</strong>{' '}
              {selectedRequest.method === 'USDT'
                ? selectedRequest.usdtWalletAddress
                : `${selectedRequest.bankName || ''} / ${selectedRequest.bankAccountName || ''} / ${selectedRequest.bankAccountNumber || ''}`}
            </p>
            {selectedRequest.method === 'BANKING' && selectedRequest.bankQrImageUrl && (
              <div>
                <strong>QR thanh toán:</strong>
                <div style={{ marginTop: 8 }}>
                  <img
                    src={selectedRequest.bankQrImageUrl}
                    alt="Bank QR"
                    style={{
                      width: 220,
                      height: 220,
                      objectFit: 'contain',
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      background: '#fff',
                    }}
                  />
                </div>
              </div>
            )}
            {selectedRequest.note && (
              <p>
                <strong>Ghi chú user:</strong> {selectedRequest.note}
              </p>
            )}
            {pendingAction === 'APPROVED' &&
              selectedRequest.method === 'BANKING' && (
                <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-800">
                    Tạo mã QR VietQR chuyển tiền cho user
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tên ngân hàng
                    </label>
                    <Select
                      showSearch
                      placeholder="Chọn ngân hàng"
                      value={qrBankId || undefined}
                      onChange={(bin, option) => {
                        setQrBankId(bin);
                        const label =
                          (option as { label?: string })?.label?.toString() || '';
                        setQrBankName(label);
                      }}
                      optionFilterProp="label"
                      style={{ width: '100%' }}
                      options={bankList.map((b) => ({
                        value: b.bin,
                        label: `${b.shortName || b.name} (${b.code})`,
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số tài khoản
                    </label>
                    <Input
                      value={qrAccountNumber}
                      onChange={(e) => setQrAccountNumber(e.target.value)}
                      placeholder="Nhập số tài khoản nhận tiền"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tên chủ tài khoản
                    </label>
                    <Input
                      value={qrAccountName}
                      onChange={(e) => setQrAccountName(e.target.value)}
                      placeholder="Tên chủ tài khoản (hiển thị trên QR)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số tiền chuyển (VND) — tự điền
                    </label>
                    <Input
                      value={
                        withdrawVndAmount > 0
                          ? withdrawVndAmount.toLocaleString('vi-VN')
                          : ''
                      }
                      readOnly
                      placeholder={
                        usdtWithdrawRateVnd <= 0
                          ? 'Chưa cấu hình tỷ giá rút VND'
                          : '—'
                      }
                    />
                  </div>
                  {vietQrUrl ? (
                    <div className="flex flex-col items-center pt-1">
                      <img
                        src={vietQrUrl}
                        alt="VietQR"
                        style={{
                          width: 220,
                          height: 220,
                          objectFit: 'contain',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          background: '#fff',
                        }}
                      />
                      <a
                        href={vietQrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 mt-2"
                      >
                        Mở / tải ảnh QR
                      </a>
                    </div>
                  ) : (
                    withdrawVndAmount > 0 && (
                      <p className="text-xs text-slate-500">
                        Chọn ngân hàng và nhập số tài khoản để tự động tạo QR.
                      </p>
                    )
                  )}
                </div>
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

