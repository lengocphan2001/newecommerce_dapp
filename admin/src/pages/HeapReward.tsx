import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Spin, Form, InputNumber, Button, notification } from 'antd';
import api from '../utils/api';
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

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/admin/system-config');
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
        await api.patch('/admin/system-config', { key, value: String(value) });
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
    </div>
  );
};

export default HeapReward;
