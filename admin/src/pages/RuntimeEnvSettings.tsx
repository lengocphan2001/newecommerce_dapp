import React, { useEffect, useState } from 'react';
import { Form, Input, Button, message, Typography, Card, Modal, Space, Tag, Descriptions } from 'antd';
import {
  SaveOutlined,
  SettingOutlined,
  CopyOutlined,
  WarningOutlined,
  SafetyCertificateOutlined,
  UnlockOutlined,
  LockOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { runtimeEnvService } from '../services/runtimeEnvService';
import { commissionPayoutService, PayoutStats } from '../services/commissionPayoutService';

const { Title, Text } = Typography;
const { Link } = Typography;

const RuntimeEnvSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [deployModalVisible, setDeployModalVisible] = useState(false);
  const [deployTokenAddress, setDeployTokenAddress] = useState('');
  const [transferOwnerModalVisible, setTransferOwnerModalVisible] = useState(false);
  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [contractActionLoading, setContractActionLoading] = useState(false);

  useEffect(() => {
    fetchRuntimeEnvConfig();
    fetchContractStats();
  }, []);

  const fetchRuntimeEnvConfig = async () => {
    setLoading(true);
    try {
      const config = await runtimeEnvService.get();
      form.setFieldsValue({
        nextPublicPaymentWallet: config.nextPublicPaymentWallet || '',
        blockchainPrivateKey: '',
        blockchainPrivateKeyMasked: config.blockchainPrivateKeyMasked || '',
        privateKey: '',
        privateKeyMasked: config.privateKeyMasked || '',
      });
    } catch {
      message.error('Failed to load runtime env config');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const payload: {
        nextPublicPaymentWallet?: string;
        blockchainPrivateKey?: string;
        privateKey?: string;
      } = {
        nextPublicPaymentWallet: values.nextPublicPaymentWallet || '',
      };
      if (values.blockchainPrivateKey && String(values.blockchainPrivateKey).trim()) {
        payload.blockchainPrivateKey = String(values.blockchainPrivateKey).trim();
      }
      if (values.privateKey && String(values.privateKey).trim()) {
        payload.privateKey = String(values.privateKey).trim();
      }
      const res = await runtimeEnvService.update(payload);
      form.setFieldsValue({
        blockchainPrivateKey: '',
        blockchainPrivateKeyMasked: res.blockchainPrivateKeyMasked,
        privateKey: '',
        privateKeyMasked: res.privateKeyMasked,
        nextPublicPaymentWallet: res.nextPublicPaymentWallet,
      });
      message.success(
        res.requiresRestart
          ? 'Saved. Please restart backend to apply BLOCKCHAIN_PRIVATE_KEY changes.'
          : 'Saved successfully',
      );
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to save runtime env config');
    } finally {
      setSaving(false);
    }
  };

  const fetchContractStats = async () => {
    try {
      const response = await commissionPayoutService.getStats();
      setStats(response.data);
    } catch {
      message.error('Failed to load contract stats');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  const handleDeployContract = async () => {
    setContractActionLoading(true);
    try {
      const response = await commissionPayoutService.deployContract(
        deployTokenAddress ? { tokenAddress: deployTokenAddress } : {}
      );
      if (response?.data?.success) {
        message.success(`Contract deployed successfully! Address: ${response.data.contractAddress}`);
        setDeployModalVisible(false);
        setDeployTokenAddress('');
        fetchContractStats();
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
      content: 'Are you sure you want to pause the contract? Payouts and other actions will be disabled.',
      okText: 'Pause',
      okType: 'danger',
      onOk: async () => {
        setContractActionLoading(true);
        try {
          await commissionPayoutService.pauseContract();
          message.success('Contract paused successfully.');
          fetchContractStats();
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
      icon: <SafetyCertificateOutlined style={{ color: '#52c41a' }} />,
      content: 'Are you sure you want to unpause the contract? Operations will resume normally.',
      okText: 'Unpause',
      onOk: async () => {
        setContractActionLoading(true);
        try {
          await commissionPayoutService.unpauseContract();
          message.success('Contract unpaused successfully.');
          fetchContractStats();
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
      message.warning('Please enter a new owner address');
      return;
    }
    setContractActionLoading(true);
    try {
      await commissionPayoutService.transferOwnership({ newOwner: newOwnerAddress });
      message.success('Ownership transferred successfully.');
      setTransferOwnerModalVisible(false);
      setNewOwnerAddress('');
      fetchContractStats();
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to transfer ownership');
    } finally {
      setContractActionLoading(false);
    }
  };

  const handleDestroyContract = () => {
    Modal.confirm({
      title: 'DANGER: Destroy Contract',
      icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
      content: 'Are you absolutely sure you want to DESTROY this contract? The code and data will be permanently deleted from the blockchain, and any native tokens will be sent to the owner. This action cannot be undone.',
      okText: 'Destroy Contract',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setContractActionLoading(true);
        try {
          await commissionPayoutService.destroyContract();
          message.success('Contract destroyed successfully.');
          fetchContractStats();
        } catch (error: any) {
          message.error(error?.response?.data?.message || 'Failed to destroy contract');
        } finally {
          setContractActionLoading(false);
        }
      }
    });
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <SettingOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>Runtime Env Settings</Title>
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Update `NEXT_PUBLIC_PAYMENT_WALLET` and `BLOCKCHAIN_PRIVATE_KEY` directly from admin.
        For security, private key is masked and never returned in full after saving.
      </Text>

      <Card loading={loading}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="nextPublicPaymentWallet"
            label="NEXT_PUBLIC_PAYMENT_WALLET"
            rules={[
              {
                pattern: /^$|^0x[a-fA-F0-9]{40}$/,
                message: 'Must be a valid EVM address (0x + 40 hex chars)',
              },
            ]}
          >
            <Input placeholder="0x..." />
          </Form.Item>

          <Form.Item name="blockchainPrivateKeyMasked" label="Current BLOCKCHAIN_PRIVATE_KEY (masked)">
            <Input disabled placeholder="Not set" />
          </Form.Item>

          <Form.Item
            name="blockchainPrivateKey"
            label="New BLOCKCHAIN_PRIVATE_KEY"
            tooltip="Leave empty to keep existing key unchanged."
            rules={[
              {
                pattern: /^$|^(0x)?[a-fA-F0-9]{64}$/,
                message: 'Must be empty or a valid 64-hex private key',
              },
            ]}
          >
            <Input.Password placeholder="Enter new private key (optional)" />
          </Form.Item>

          <Form.Item name="privateKeyMasked" label="Current PRIVATE_KEY (masked)">
            <Input disabled placeholder="Not set" />
          </Form.Item>

          <Form.Item
            name="privateKey"
            label="New PRIVATE_KEY"
            tooltip="Used by contracts/hardhat scripts. Leave empty to keep existing key unchanged."
            rules={[
              {
                pattern: /^$|^(0x)?[a-fA-F0-9]{64}$/,
                message: 'Must be empty or a valid 64-hex private key',
              },
            ]}
          >
            <Input.Password placeholder="Enter new PRIVATE_KEY (optional)" />
          </Form.Item>

          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              icon={<SaveOutlined />}
              size="large"
            >
              Save Runtime Env Settings
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <div style={{ marginTop: 32, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <SettingOutlined style={{ fontSize: 24 }} />
        <Title level={3} style={{ margin: 0 }}>Contract Management</Title>
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Manage payout smart contract lifecycle in one place with runtime env configuration.
      </Text>

      <Card>
        {stats?.contractAddress ? (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Contract Address">
              <Space>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{stats.contractAddress}</span>
                <Button size="small" type="link" icon={<CopyOutlined />} onClick={() => copyToClipboard(stats.contractAddress)} />
                <Link href={`https://bscscan.com/address/${stats.contractAddress}`} target="_blank">View on Explorer</Link>
                {stats.paused ? <Tag color="red">PAUSED</Tag> : <Tag color="green">ACTIVE</Tag>}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Token Address">
              <span style={{ fontFamily: 'monospace' }}>{stats.tokenAddress || 'N/A'}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Actions">
              <Space wrap>
                {stats.paused ? (
                  <Button type="primary" icon={<UnlockOutlined />} onClick={handleUnpauseContract} loading={contractActionLoading}>
                    Unpause
                  </Button>
                ) : (
                  <Button danger icon={<LockOutlined />} onClick={handlePauseContract} loading={contractActionLoading}>
                    Pause
                  </Button>
                )}
                <Button onClick={() => setTransferOwnerModalVisible(true)}>
                  Transfer Ownership
                </Button>
                <Button type="primary" danger icon={<DeleteOutlined />} onClick={handleDestroyContract} loading={contractActionLoading}>
                  Destroy Contract
                </Button>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <WarningOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
            <Title level={4}>No Contract Configured</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              The commission payout contract address is not set in the environment variables.
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
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            This will deploy a new smart contract to the configured blockchain network using the backend's default wallet.
          </Text>
        </div>
        <div>
          <Text strong>Token Address (Optional)</Text>
          <Input
            placeholder="0x... (Leaves blank to use default)"
            value={deployTokenAddress}
            onChange={(e) => setDeployTokenAddress(e.target.value)}
            style={{ marginTop: 8 }}
          />
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            Leave blank to use the default configured token or the mainnet USDT token.
          </Text>
        </div>
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
        <div style={{ marginBottom: 16 }}>
          <Text type="danger" strong>
            Warning: This action is irreversible. If you transfer ownership to an address you do not control, you will lose administrative access to this contract permanently.
          </Text>
        </div>
        <div>
          <Text strong>New Owner Address</Text>
          <Input
            placeholder="0x..."
            value={newOwnerAddress}
            onChange={(e) => setNewOwnerAddress(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default RuntimeEnvSettings;
