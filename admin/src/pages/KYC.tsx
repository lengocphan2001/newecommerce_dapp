import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Input, Switch, message, Image } from 'antd';
import { CheckOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { kycService, Kyc } from '../services/kycService';
import { downloadExcel } from '../utils/excel';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
};

const KYC: React.FC = () => {
  const [kycs, setKycs] = useState<Kyc[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedKyc, setSelectedKyc] = useState<Kyc | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchKYC();
  }, []);

  const handleExport = async () => {
    if (filteredKycs.length === 0) {
      message.warning('Không có yêu cầu KYC nào để xuất');
      return;
    }
    setExporting(true);
    try {
      await downloadExcel<Kyc>({
        fileName: `kyc-requests-${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'KYC Requests',
        titleLines: [
          'Danh sách yêu cầu KYC',
          `${filteredKycs.length} yêu cầu${searchText.trim() ? ` • Lọc theo "${searchText.trim()}"` : ''} • Xuất lúc ${new Date().toLocaleString('vi-VN')}`,
        ],
        columns: [
          { header: 'STT', width: 6, value: (_r, i) => i + 1 },
          { header: 'KYC ID', width: 38, value: (r) => r.id },
          { header: 'User ID', width: 38, value: (r) => r.userId },
          { header: 'Username', width: 18, value: (r) => r.user?.username },
          { header: 'Họ tên', width: 24, value: (r) => r.user?.fullName },
          { header: 'Email', width: 28, value: (r) => r.user?.email },
          { header: 'Số điện thoại', width: 16, value: (r) => r.user?.phone },
          { header: 'Quốc gia', width: 14, value: (r) => r.user?.country },
          { header: 'Ví', width: 44, value: (r) => r.user?.walletAddress },
          { header: 'Loại giấy tờ', width: 16, value: (r) => r.documentType },
          { header: 'Số CCCD', width: 20, value: (r) => r.documentNumber },
          {
            header: 'Ảnh CCCD mặt trước',
            width: 46,
            value: (r) => r.frontImage,
            link: (r) => r.frontImage,
          },
          {
            header: 'Ảnh CCCD mặt sau',
            width: 46,
            value: (r) => r.backImage,
            link: (r) => r.backImage,
          },
          { header: 'Ngân hàng', width: 22, value: (r) => r.bankName },
          { header: 'Số tài khoản', width: 22, value: (r) => r.bankAccountNumber },
          { header: 'Chủ tài khoản', width: 24, value: (r) => r.bankAccountHolder },
          { header: 'Chi nhánh', width: 22, value: (r) => r.bankBranch },
          { header: 'Trạng thái', width: 14, value: (r) => STATUS_LABELS[r.status] || r.status },
          { header: 'Ghi chú', width: 32, value: (r) => r.notes },
          { header: 'Ngày gửi', width: 20, value: (r) => formatDateTime(r.createdAt) },
          { header: 'Cập nhật', width: 20, value: (r) => formatDateTime(r.updatedAt) },
        ],
        rows: filteredKycs,
      });
      message.success('Đã xuất file Excel yêu cầu KYC');
    } catch (error: any) {
      message.error(error?.message || 'Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  };

  const fetchKYC = async () => {
    setLoading(true);
    try {
      const response = await kycService.getAll();
      setKycs(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch KYC requests');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = (kyc: Kyc) => {
    setSelectedKyc(kyc);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    if (!selectedKyc) return;
    try {
      await kycService.verify(selectedKyc.id, {
        approved: values.approved,
        notes: values.notes,
      });
      message.success('KYC verification updated');
      setIsModalVisible(false);
      fetchKYC();
    } catch (error) {
      message.error('Failed to verify KYC');
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this KYC request?',
      content: 'This action cannot be undone.',
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await kycService.delete(id);
          message.success('KYC request deleted successfully');
          fetchKYC();
        } catch (error) {
          message.error('Failed to delete KYC request');
        }
      },
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 220,
      render: (id: string) => <span style={{ fontFamily: 'monospace' }}>{id}</span>,
    },
    {
      title: 'User ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 220,
      render: (userId: string) => <span style={{ fontFamily: 'monospace' }}>{userId}</span>,
    },
    {
      title: 'User Name',
      key: 'userName',
      render: (_: any, record: Kyc) =>
        record.user?.fullName || record.user?.username || 'N/A',
    },
    {
      title: 'Email',
      key: 'userEmail',
      render: (_: any, record: Kyc) => record.user?.email || 'N/A',
    },
    {
      title: 'Document Type',
      dataIndex: 'documentType',
      key: 'documentType',
    },
    {
      title: 'Document Number',
      dataIndex: 'documentNumber',
      key: 'documentNumber',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          PENDING: 'orange',
          APPROVED: 'green',
          REJECTED: 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Kyc) => (
        <Space>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleVerify(record)}
          >
            Verify
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  const filteredKycs = kycs.filter((item) => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return true;

    const haystack = [
      item.id,
      item.userId,
      item.documentType,
      item.documentNumber,
      item.status,
      item.user?.email,
      item.user?.fullName,
      item.user?.username,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(keyword);
  });

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' , gap: 12 }}>
        <h1 style={{ margin: 0 }}>KYC Verification</h1>
        <Space>
          <Input.Search
            allowClear
            placeholder="Search ID, user, document, status..."
            style={{ width: '100%', maxWidth: 320 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(value) => setSearchText(value)}
          />
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exporting}
          >
            Export to Excel
          </Button>
        </Space>
      </div>
      <Table
        scroll={{ x: 'max-content' }}
        columns={columns}
        dataSource={filteredKycs}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title="Verify KYC"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ approved: true }}>
          {selectedKyc && (
            <div style={{ marginBottom: 20 }}>
              <p><strong>Document Type:</strong> {selectedKyc.documentType}</p>
              <p><strong>Document Number:</strong> {selectedKyc.documentNumber}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px' }}>
                {selectedKyc.frontImage && (
                  <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                    <p>Front Image</p>
                    <Image src={selectedKyc.frontImage} width="100%" />
                  </div>
                )}
                {selectedKyc.backImage && (
                  <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                    <p>Back Image</p>
                    <Image src={selectedKyc.backImage} width="100%" />
                  </div>
                )}
              </div>
            </div>
          )}
          <Form.Item
            name="approved"
            label="Approve"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={4} placeholder="Enter verification notes..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KYC;

