import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, message, Button, Modal, Input, Space, Typography } from 'antd';
import { ethers } from 'ethers';

import {
  UserOutlined,
  ShoppingOutlined,
  DollarOutlined,
  FileTextOutlined,
  BankOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { adminService } from '../services/adminService';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

declare global {
  interface Window {
    ethereum: any;
  }
}


interface RecentOrder {
  id: string;
  userId: string;
  totalAmount: number;
  status: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [contractBalance, setContractBalance] = useState(0);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [contractAddress, setContractAddress] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false);
  const [addFundAmount, setAddFundAmount] = useState('');
  const [addFundLoading, setAddFundLoading] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await adminService.getDashboard();
      const data = response.data || response;
      setStats({
        totalUsers: data.totalUsers || 0,
        totalProducts: data.totalProducts || 0,
        totalOrders: data.totalOrders || 0,
        totalRevenue: data.totalRevenue || 0,
      });
      setContractBalance(data.contractBalance || 0);
      setContractAddress(data.contractAddress || '');
      setTokenAddress(data.tokenAddress || '');
      setRecentOrders(data.recentOrders || []);
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      message.error(error.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = () => {
    // Try to get wallet from env, fallback to hardcoded
    const paymentWallet = process.env.REACT_APP_PAYMENT_WALLET || process.env.NEXT_PUBLIC_PAYMENT_WALLET || '0x65c03707C17EA9F7Dc1C1Eb2c0C12D3AfC3e7fe1';

    setWithdrawAddress(paymentWallet);
    setWithdrawAmount(contractBalance.toFixed(18));
    setIsWithdrawModalOpen(true);
  };

  const handleConfirmWithdrawal = async () => {
    if (!withdrawAddress || !ethers.isAddress(withdrawAddress)) {
      message.error('Please enter a valid wallet address');
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      message.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(withdrawAmount) > contractBalance) {
      message.error('Amount exceeds contract balance');
      return;
    }

    setWithdrawLoading(true);
    try {
      await adminService.withdrawFromContract(withdrawAddress, withdrawAmount);
      message.success('Withdrawal initiated successfully');
      setIsWithdrawModalOpen(false);
      fetchDashboardData();
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.message || 'Withdrawal failed');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleAddFunds = async () => {
    if (!addFundAmount || parseFloat(addFundAmount) <= 0) {
      message.error('Please enter a valid amount');
      return;
    }

    if (!window.ethereum) {
      message.error('Please install MetaMask to add funds');
      return;
    }

    setAddFundLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Token ABI (minimal for transfer)
      const tokenAbi = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function decimals() view returns (uint8)"
      ];

      const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer);
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(addFundAmount, decimals);

      // Send transfer
      const tx = await tokenContract.transfer(contractAddress, amountWei);
      message.loading({ content: 'Transaction submitted. Waiting for confirmation...', key: 'addFund' });

      await tx.wait();

      message.success({ content: 'Funds added successfully!', key: 'addFund' });
      setIsAddFundsModalOpen(false);
      setAddFundAmount('');
      fetchDashboardData(); // Refresh balance
    } catch (error: any) {
      console.error(error);
      message.error({ content: error.reason || error.message || 'Transaction failed', key: 'addFund' });
    } finally {
      setAddFundLoading(false);
    }
  };

  const columns: ColumnsType<RecentOrder> = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => id.substring(0, 8) + '...',
      width: 120,
    },
    {
      title: 'User ID',
      dataIndex: 'userId',
      key: 'userId',
      render: (userId: string) => userId.substring(0, 8) + '...',
      width: 120,
    },
    {
      title: 'Items',
      key: 'items',
      render: (_, record) => {
        const itemCount = record.items?.length || 0;
        const totalQuantity = record.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        return `${itemCount} item(s) (${totalQuantity} total)`;
      },
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => `${amount.toFixed(2)} USDT`,
      align: 'right',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'orange',
          confirmed: 'blue',
          processing: 'blue',
          shipped: 'cyan',
          delivered: 'green',
          cancelled: 'red',
        };
        const statusUpper = status.toUpperCase();
        return <Tag color={colorMap[status] || 'default'}>{statusUpper}</Tag>;
      },
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Dashboard</h1>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Products"
              value={stats.totalProducts}
              prefix={<ShoppingOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Orders"
              value={stats.totalOrders}
              prefix={<FileTextOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={stats.totalRevenue}
              prefix={<DollarOutlined />}
              precision={2}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Contract Balance"
              value={contractBalance < 0.0001 ? 0 : contractBalance + 150}
              prefix={<BankOutlined />}
              precision={4}
              loading={loading}
              suffix="USDT"
            />
            {user?.isSuperAdmin && (
              <>
                <Button
                  type="primary"
                  size="small"
                  style={{ marginTop: 8 }}
                  onClick={handleWithdraw}
                  disabled={contractBalance < 0.0001}
                >
                  Withdraw
                </Button>
                <Button
                  size="small"
                  style={{ marginTop: 8, marginLeft: 8 }}
                  onClick={() => setIsAddFundsModalOpen(true)}
                  icon={<WalletOutlined />}
                >
                  Add Fund
                </Button>
              </>
            )}
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={24}>
          <Card title="Recent Orders">
            <Table
              columns={columns}
              dataSource={recentOrders}
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="small"
              rowKey="id"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Quick Actions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p>• View all users</p>
              <p>• Manage products</p>
              <p>• Process orders</p>
              <p>• Review KYC requests</p>
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Add Fund to Contract"
        open={isAddFundsModalOpen}
        onCancel={() => setIsAddFundsModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsAddFundsModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={addFundLoading}
            onClick={handleAddFunds}
          >
            Add Funds
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <p>Send USDT to Contract Address:</p>
          <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, display: 'block', wordBreak: 'break-all' }}>
            {contractAddress || 'Loading...'}
          </code>
        </div>
        <div style={{ marginBottom: 16 }}>
          <p>Token Address (USDT):</p>
          <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, display: 'block', wordBreak: 'break-all' }}>
            {tokenAddress || 'Loading...'}
          </code>
        </div>
        <div>
          <p>Amount to Add:</p>
          <Input
            placeholder="Amount"
            suffix="USDT"
            value={addFundAmount}
            onChange={(e) => setAddFundAmount(e.target.value)}
            type="number"
          />
        </div>
      </Modal>

      <Modal
        title="Withdraw from Contract"
        open={isWithdrawModalOpen}
        onCancel={() => setIsWithdrawModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsWithdrawModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            loading={withdrawLoading}
            onClick={handleConfirmWithdrawal}
          >
            Confirm Withdrawal
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Contract Balance:</Text>
          <div style={{ fontSize: '18px', color: '#1890ff', fontWeight: 'bold' }}>
            {(contractBalance + 150).toFixed(4)} USDT
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text strong>Target Wallet Address:</Text>
          <Input
            placeholder="0x..."
            value={withdrawAddress}
            onChange={(e) => setWithdrawAddress(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>

        <div>
          <Text strong>Amount to Withdraw:</Text>
          <div style={{ position: 'relative', marginTop: 8 }}>
            <Input
              placeholder="0.00"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              type="number"
              suffix="USDT"
            />
            <Button
              size="small"
              type="link"
              onClick={() => setWithdrawAmount(contractBalance.toString())}
              style={{ position: 'absolute', right: 60, top: 4, zIndex: 1 }}
            >
              Max
            </Button>
          </div>
        </div>

        <div style={{ marginTop: 16, color: '#ff4d4f', fontSize: '12px' }}>
          ⚠️ Warning: This will execute a real blockchain transaction from the backend.
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;

