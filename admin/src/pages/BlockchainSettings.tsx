import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Typography,
  Space,
  Descriptions,
  Tag,
  Modal,
} from 'antd';
import {
  SaveOutlined,
  SettingOutlined,
  CopyOutlined,
  WarningOutlined,
  UnlockOutlined,
  LockOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { adminService } from '../services/adminService';
import { commissionPayoutService, PayoutStats } from '../services/commissionPayoutService';

const { Title, Text, Link } = Typography;

const BlockchainSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [contractActionLoading, setContractActionLoading] = useState(false);
  const [deployModalVisible, setDeployModalVisible] = useState(false);
  const [deployTokenAddress, setDeployTokenAddress] = useState('');
  const [transferOwnerModalVisible, setTransferOwnerModalVisible] = useState(false);
  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [keyInfo, setKeyInfo] = useState<{
    hasBlockchainPrivateKey: boolean;
    hasPrivateKey: boolean;
    blockchainPrivateKeyMasked?: string;
    privateKeyMasked?: string;
  }>({
    hasBlockchainPrivateKey: false,
    hasPrivateKey: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cfgRes, statsRes] = await Promise.all([
        adminService.getBlockchainConfig(),
        commissionPayoutService.getStats(),
      ]);
      form.setFieldsValue({
        blockchainPrivateKey: '',
        privateKey: '',
        tokenAddress: cfgRes.data?.tokenAddress || '',
      });
      setKeyInfo({
        hasBlockchainPrivateKey: Boolean(cfgRes.data?.hasBlockchainPrivateKey),
        hasPrivateKey: Boolean(cfgRes.data?.hasPrivateKey),
        blockchainPrivateKeyMasked: cfgRes.data?.blockchainPrivateKeyMasked || '',
        privateKeyMasked: cfgRes.data?.privateKeyMasked || '',
      });
      setStats(statsRes.data || null);
    } catch {
      message.error('Failed to load blockchain settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const payload: {
        tokenAddress?: string;
        blockchainPrivateKey?: string;
        privateKey?: string;
      } = {
        tokenAddress: values.tokenAddress,
      };
      if (values.blockchainPrivateKey?.trim()) {
        payload.blockchainPrivateKey = values.blockchainPrivateKey.trim();
      }
      if (values.privateKey?.trim()) {
        payload.privateKey = values.privateKey.trim();
      }
      await adminService.updateBlockchainConfig(payload);
      message.success('Blockchain settings saved');
      fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text || '');
    message.success('Copied');
  };

  const handleDeployContract = async () => {
    setContractActionLoading(true);
    try {
      const response = await commissionPayoutService.deployContract(
        deployTokenAddress ? { tokenAddress: deployTokenAddress } : {},
      );
      if (response?.data?.success) {
        message.success(`Contract deployed: ${response.data.contractAddress}`);
        setDeployModalVisible(false);
        setDeployTokenAddress('');
        fetchData();
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to deploy contract');
    } finally {
      setContractActionLoading(false);
    }
  };

  const handlePauseContract = () => {
    Modal.confirm({
      title: 'Pause Contract',
      icon: <WarningOutlined style={{ color: '#faad14' }} />,
      content: 'Pause current contract?',
      okText: 'Pause',
      okType: 'danger',
      onOk: async () => {
        setContractActionLoading(true);
        try {
          await commissionPayoutService.pauseContract();
          message.success('Contract paused');
          fetchData();
        } catch (error: any) {
          message.error(error?.response?.data?.message || 'Failed to pause contract');
        } finally {
          setContractActionLoading(false);
        }
      },
    });
  };

  const handleUnpauseContract = () => {
    Modal.confirm({
      title: 'Unpause Contract',
      content: 'Unpause current contract?',
      okText: 'Unpause',
      onOk: async () => {
        setContractActionLoading(true);
        try {
          await commissionPayoutService.unpauseContract();
          message.success('Contract unpaused');
          fetchData();
        } catch (error: any) {
          message.error(error?.response?.data?.message || 'Failed to unpause contract');
        } finally {
          setContractActionLoading(false);
        }
      },
    });
  };

  const handleTransferOwnership = async () => {
    if (!newOwnerAddress) {
      message.warning('Please enter new owner');
      return;
    }
    setContractActionLoading(true);
    try {
      await commissionPayoutService.transferOwnership({ newOwner: newOwnerAddress });
      message.success('Ownership transferred');
      setTransferOwnerModalVisible(false);
      setNewOwnerAddress('');
      fetchData();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to transfer ownership');
    } finally {
      setContractActionLoading(false);
    }
  };

  const handleDestroyContract = () => {
    Modal.confirm({
      title: 'Destroy Contract',
      icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
      content: 'This action is irreversible. Continue?',
      okText: 'Destroy',
      okType: 'danger',
      onOk: async () => {
        setContractActionLoading(true);
        try {
          await commissionPayoutService.destroyContract();
          message.success('Contract destroyed');
          fetchData();
        } catch (error: any) {
          message.error(error?.response?.data?.message || 'Failed to destroy contract');
        } finally {
          setContractActionLoading(false);
        }
      },
    });
  };

  return (
    <div style={{ maxWidth: 980 }}>
      <Title level={3}>Blockchain Settings</Title>
      <Text type="secondary">
        Manage blockchain env values and contract lifecycle in one place.
      </Text>

      <Card loading={loading} style={{ marginTop: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            label="BLOCKCHAIN_PRIVATE_KEY"
            name="blockchainPrivateKey"
          >
            <Input.Password placeholder="Enter new key only when changing" />
          </Form.Item>
          <Text type="secondary" style={{ display: 'block', marginTop: -16, marginBottom: 12 }}>
            Current: {keyInfo.hasBlockchainPrivateKey ? keyInfo.blockchainPrivateKeyMasked || 'Configured' : 'Not configured'}
          </Text>
          <Form.Item
            label="PRIVATE_KEY"
            name="privateKey"
          >
            <Input.Password placeholder="Enter new key only when changing" />
          </Form.Item>
          <Text type="secondary" style={{ display: 'block', marginTop: -16, marginBottom: 12 }}>
            Current: {keyInfo.hasPrivateKey ? keyInfo.privateKeyMasked || 'Configured' : 'Not configured'}
          </Text>
          <Form.Item
            label="TOKEN_ADDRESS"
            name="tokenAddress"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="0x..." />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            icon={<SaveOutlined />}
          >
            Save Env Values
          </Button>
        </Form>
      </Card>

      <Card
        title={
          <span>
            <SettingOutlined /> Contract Management
          </span>
        }
        style={{ marginTop: 16 }}
      >
        {stats?.contractAddress ? (
          <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Contract Address" span={2}>
              <Space>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {stats.contractAddress}
                </span>
                <Button
                  size="small"
                  type="link"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(stats.contractAddress)}
                />
                <Link
                  href={`https://bscscan.com/address/${stats.contractAddress}`}
                  target="_blank"
                >
                  View on Explorer
                </Link>
                {stats.paused ? <Tag color="red">PAUSED</Tag> : <Tag color="green">ACTIVE</Tag>}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Token Address" span={2}>
              <span style={{ fontFamily: 'monospace' }}>{stats.tokenAddress || 'N/A'}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Status Actions">
              <Space>
                {stats.paused ? (
                  <Button
                    type="primary"
                    icon={<UnlockOutlined />}
                    onClick={handleUnpauseContract}
                    loading={contractActionLoading}
                  >
                    Unpause
                  </Button>
                ) : (
                  <Button
                    danger
                    icon={<LockOutlined />}
                    onClick={handlePauseContract}
                    loading={contractActionLoading}
                  >
                    Pause
                  </Button>
                )}
                <Button onClick={() => setTransferOwnerModalVisible(true)}>
                  Transfer Ownership
                </Button>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Danger Zone">
              <Button
                type="primary"
                danger
                icon={<DeleteOutlined />}
                onClick={handleDestroyContract}
                loading={contractActionLoading}
              >
                Destroy Contract
              </Button>
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <WarningOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
            <Title level={4}>No Contract Configured</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Contract address is not set. Deploy a new one.
            </Text>
            <Button type="primary" size="large" onClick={() => setDeployModalVisible(true)}>
              Deploy New Contract
            </Button>
          </div>
        )}
      </Card>

      <Modal
        title="Deploy Commission Payout Contract"
        open={deployModalVisible}
        onCancel={() => {
          setDeployModalVisible(false);
          setDeployTokenAddress('');
        }}
        confirmLoading={contractActionLoading}
        onOk={handleDeployContract}
        okText="Deploy"
      >
        <Text type="secondary">
          Deploy new contract with optional token address override.
        </Text>
        <Input
          style={{ marginTop: 12 }}
          placeholder="0x... (optional)"
          value={deployTokenAddress}
          onChange={(e) => setDeployTokenAddress(e.target.value)}
        />
      </Modal>

      <Modal
        title="Transfer Contract Ownership"
        open={transferOwnerModalVisible}
        onCancel={() => {
          setTransferOwnerModalVisible(false);
          setNewOwnerAddress('');
        }}
        confirmLoading={contractActionLoading}
        onOk={handleTransferOwnership}
        okText="Transfer Ownership"
        okType="danger"
      >
        <Text type="danger" strong>
          This action is irreversible.
        </Text>
        <Input
          style={{ marginTop: 12 }}
          placeholder="0x..."
          value={newOwnerAddress}
          onChange={(e) => setNewOwnerAddress(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default BlockchainSettings;
