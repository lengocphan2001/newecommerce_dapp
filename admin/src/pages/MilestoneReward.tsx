import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Button,
  message,
  Typography,
  Divider,
  Row,
  Col,
  Table,
  Tag,
} from 'antd';
import {
  milestoneRewardService,
  MilestoneRewardConfig,
  UserMilestone,
} from '../services/milestoneRewardService';

const { Title, Text } = Typography;

const MilestoneRewardPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<MilestoneRewardConfig | null>(null);
  const [milestones, setMilestones] = useState<UserMilestone[]>([]);
  const [form] = Form.useForm();

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const configData = await milestoneRewardService.getConfig();
      if (configData) {
        setConfig(configData);
        form.setFieldsValue({
          percentX: configData.percentX,
          percentY: configData.percentY,
          percentZ: configData.percentZ,
        });
      } else {
        // Set default values (percentages)
        form.setFieldsValue({
          percentX: 1.0,
          percentY: 2.0,
          percentZ: 3.0,
        });
      }
    } catch (error: any) {
      message.error('Failed to load config: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [form]);

  const loadMilestones = useCallback(async () => {
    try {
      const data = await milestoneRewardService.getAllMilestones();
      setMilestones(data);
    } catch (error: any) {
      message.error('Failed to load milestones: ' + (error.message || 'Unknown error'));
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadMilestones();
  }, [loadConfig, loadMilestones]);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      await milestoneRewardService.updateConfig(
        values.percentX,
        values.percentY,
        values.percentZ,
      );
      message.success('Milestone reward config updated successfully');
      await loadConfig();
    } catch (error: any) {
      message.error('Failed to update config: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getRewardTypeColor = (type: 'X' | 'Y' | 'Z') => {
    switch (type) {
      case 'X':
        return 'blue';
      case 'Y':
        return 'green';
      case 'Z':
        return 'orange';
      default:
        return 'default';
    }
  };

  const milestoneColumns = [
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      render: (user: any) => user ? `${user.fullName} (${user.username})` : 'N/A',
    },
    {
      title: 'Milestone',
      dataIndex: 'milestoneCount',
      key: 'milestoneCount',
      render: (count: number) => `${count} referrals`,
    },
    {
      title: 'Reward Type',
      dataIndex: 'rewardType',
      key: 'rewardType',
      render: (type: 'X' | 'Y' | 'Z') => (
        <Tag color={getRewardTypeColor(type)}>{type}</Tag>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'rewardAmount',
      key: 'rewardAmount',
      render: (amount: number | string) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
        return `$${numAmount.toFixed(2)}`;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'PAID' ? 'green' : 'orange'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Milestone Reward Configuration</Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Configuration" loading={loading}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                percentX: 1.0,
                percentY: 2.0,
                percentZ: 3.0,
              }}
            >
              <Form.Item
                label="Reward X % (for 2, 16, 128... referrals)"
                name="percentX"
                rules={[{ required: true, message: 'Please enter reward X percentage' }]}
                tooltip="Percentage of referrer's total purchase amount. Example: 1.00 = 1%"
              >
                <InputNumber
                  min={0}
                  max={100}
                  step={0.01}
                  precision={2}
                  style={{ width: '100%' }}
                  suffix="%"
                />
              </Form.Item>

              <Form.Item
                label="Reward Y % (for 4, 32, 256... referrals)"
                name="percentY"
                rules={[{ required: true, message: 'Please enter reward Y percentage' }]}
                tooltip="Percentage of referrer's total purchase amount. Example: 2.00 = 2%"
              >
                <InputNumber
                  min={0}
                  max={100}
                  step={0.01}
                  precision={2}
                  style={{ width: '100%' }}
                  suffix="%"
                />
              </Form.Item>

              <Form.Item
                label="Reward Z % (for 8, 64, 512... referrals)"
                name="percentZ"
                rules={[{ required: true, message: 'Please enter reward Z percentage' }]}
                tooltip="Percentage of referrer's total purchase amount. Example: 3.00 = 3%"
              >
                <InputNumber
                  min={0}
                  max={100}
                  step={0.01}
                  precision={2}
                  style={{ width: '100%' }}
                  suffix="%"
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  Save Configuration
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Milestone History" extra={
            <Button onClick={loadMilestones}>Refresh</Button>
          }>
            <Table
              dataSource={milestones}
              columns={milestoneColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MilestoneRewardPage;
