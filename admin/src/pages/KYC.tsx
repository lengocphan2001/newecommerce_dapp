import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Input, Switch, message, Image } from 'antd';
import { CheckOutlined, DownloadOutlined } from '@ant-design/icons';
import { kycService, Kyc } from '../services/kycService';

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
    setExporting(true);
    try {
      const response = await kycService.exportToExcel();
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'kyc-export.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('KYC data exported successfully');
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to export KYC');
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
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>KYC Verification</h1>
        <Space>
          <Input.Search
            allowClear
            placeholder="Search ID, user, document, status..."
            style={{ width: 320 }}
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
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                {selectedKyc.frontImage && (
                  <div style={{ flex: 1 }}>
                    <p>Front Image</p>
                    <Image src={selectedKyc.frontImage} width="100%" />
                  </div>
                )}
                {selectedKyc.backImage && (
                  <div style={{ flex: 1 }}>
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

