import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Input, Switch, message } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { kycService, Kyc } from '../services/kycService';

const KYC: React.FC = () => {
  const [kycs, setKycs] = useState<Kyc[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedKyc, setSelectedKyc] = useState<Kyc | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchKYC();
  }, []);

  const fetchKYC = async () => {
    setLoading(true);
    try {
      const response = await kycService.getAll();
      setKycs(response.data?.data || []);
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
    },
    {
      title: 'User ID',
      dataIndex: 'userId',
      key: 'userId',
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

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>KYC Verification</h1>
      <Table
        columns={columns}
        dataSource={kycs}
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

