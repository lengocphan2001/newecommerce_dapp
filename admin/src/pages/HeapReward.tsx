import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Spin, Form, InputNumber, Button, notification, Space, Modal, Popconfirm } from 'antd';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { Title } = Typography;

const HeapReward: React.FC = () => {
  const { user } = useAuth();
  const isAdminAccount = Boolean(
    user?.isSuperAdmin || (user?.type === 'user' && user?.isAdmin)
  );

  const [loading, setLoading] = useState(false);
  const [placements, setPlacements] = useState<any[]>([]);
  const [form] = Form.useForm();
  
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedPlacement, setSelectedPlacement] = useState<any>(null);
  const [placementHistories, setPlacementHistories] = useState<any[]>([]);

  const fetchPlacements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/heap-reward/placements');
      setPlacements(res.data);
    } catch (e) {
      notification.error({ message: 'Error fetching heap placements' });
    } finally {
      setLoading(false);
    }
  };

  const deletePlacement = async (id: string) => {
    try {
      setLoading(true);
      await api.delete(`/admin/heap-reward/placements/${id}`);
      notification.success({ message: 'Deleted placement safely' });
      fetchPlacements();
    } catch (e) {
      notification.error({ message: 'Error deleting placement' });
      setLoading(false);
    }
  };

  const showDetails = async (record: any) => {
    setSelectedPlacement(record);
    setDetailsModalVisible(true);
    try {
      setHistoryLoading(true);
      const res = await api.get(`/admin/heap-reward/histories?placementId=${record.id}`);
      setPlacementHistories(res.data);
    } catch (e) {
      notification.error({ message: 'Error fetching histories' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/admin/system-config/all');
      const configArray = res.data;
      const getVal = (key: string, def: number) => {
        const item = configArray.find((c: any) => c.key === key);
        return item && item.value !== undefined ? Number(item.value) : def;
      };
      form.setFieldsValue({
        HEAP_QUALIFY_ORDER_AMOUNT: getVal('HEAP_QUALIFY_ORDER_AMOUNT', 500),
        HEAP_DAILY_REWARD_PERCENT: getVal('HEAP_DAILY_REWARD_PERCENT', 5),
        HEAP_MAX_PAYOUT: getVal('HEAP_MAX_PAYOUT', 1000),
      });
    } catch (e) {
      notification.error({ message: 'Error fetching configs' });
    }
  };

  useEffect(() => {
    fetchPlacements();
    if (isAdminAccount) {
      fetchConfigs();
    }
  }, [isAdminAccount]);

  const onFinishConfig = async (values: any) => {
    try {
      setLoading(true);
      for (const [key, value] of Object.entries(values)) {
        await api.patch('/admin/system-config/single', { key, value: String(value) });
      }
      notification.success({ message: 'Configs updated successfully' });
      fetchConfigs();
    } catch (e) {
      notification.error({ message: 'Error updating config' });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: ['user', 'username'],
      key: 'username',
      render: (text: string, record: any) => text || record.user?.email,
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (isActive ? 'Yes' : 'No'),
    },
    {
      title: 'Times Entered',
      dataIndex: 'timesEntered',
      key: 'timesEntered',
    },
    {
      title: 'Total Rewarded',
      dataIndex: 'totalRewarded',
      key: 'totalRewarded',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: 'Trigger Order',
      key: 'triggerOrder',
      render: (_: any, record: any) => record.triggerOrder?.code ? record.triggerOrder.code : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" type="primary" onClick={() => showDetails(record)}>Chi tiết</Button>
          <Popconfirm title="Chắc chắn xóa vị trí này (kéo theo xóa lịch sử nhận của nó)?" onConfirm={() => deletePlacement(record.id)}>
            <Button size="small" danger>Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    }
  ];

  const historyColumns = [
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: any) => `$${Number(val).toFixed(2)}`
    },
    {
      title: 'Reward Date',
      dataIndex: 'rewardDate',
      key: 'rewardDate',
      render: (text: string, rec: any) => text || new Date(rec.createdAt).toLocaleDateString()
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Heap Reward Management</Title>

      {isAdminAccount && (
        <Card title="Heap Configuration" style={{ marginBottom: 24 }}>
          <Form form={form} layout="vertical" onFinish={onFinishConfig}>
             <Form.Item label="Qualify Order Amount ($)" name="HEAP_QUALIFY_ORDER_AMOUNT">
               <InputNumber min={0} style={{ width: '100%' }} />
             </Form.Item>
             <Form.Item label="Daily Reward Pool Percent (%)" name="HEAP_DAILY_REWARD_PERCENT">
               <InputNumber min={0} max={100} style={{ width: '100%' }} />
             </Form.Item>
             <Form.Item label="Max Payout ($)" name="HEAP_MAX_PAYOUT">
               <InputNumber min={0} style={{ width: '100%' }} />
             </Form.Item>
             <Button type="primary" htmlType="submit" loading={loading}>
               Save Configuration
             </Button>
          </Form>
        </Card>
      )}

      <Card title="Heap Placements">
         <Table 
           dataSource={placements} 
           columns={columns} 
           rowKey="id" 
           loading={loading}
           pagination={{ pageSize: 20 }}
         />
      </Card>

      <Modal
        title={`Chi tiết vị trí - ${selectedPlacement?.user?.username || ''}`}
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedPlacement && (
          <div style={{ marginBottom: 16 }}>
             <p><b>Đơn hàng kích hoạt:</b> {selectedPlacement.triggerOrder ? `${selectedPlacement.triggerOrder.code} ($${selectedPlacement.triggerOrder.totalAmount})` : 'Không lưu / Hệ thống cũ'}</p>
             <p><b>Số tiền đã nhận từ Heap này:</b> ${Number(selectedPlacement.totalRewarded).toLocaleString()}</p>
             <p><b>Đang active:</b> {selectedPlacement.isActive ? 'Có' : 'Không (Đã out)'}</p>
          </div>
        )}
        <Table 
           dataSource={placementHistories}
           columns={historyColumns}
           rowKey="id"
           loading={historyLoading}
           size="small"
           pagination={false}
        />
      </Modal>
    </div>
  );
};

export default HeapReward;
