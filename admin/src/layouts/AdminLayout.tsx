import React, { useState, useMemo } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  WalletOutlined,
  TeamOutlined,
  SafetyOutlined,
  AuditOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  AppstoreOutlined,
  PictureOutlined,
  UsergroupAddOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Header, Sider, Content } = Layout;

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, user } = useAuth();

  // Define menu items with their required permissions
  const allMenuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      permission: null, // Dashboard is always accessible
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: 'Users',
      permission: 'users.view',
    },
    {
      key: '/products',
      icon: <ShoppingOutlined />,
      label: 'Products',
      permission: 'products.view',
    },
    {
      key: '/categories',
      icon: <AppstoreOutlined />,
      label: 'Categories',
      permission: 'categories.view',
    },
    {
      key: '/sliders',
      icon: <PictureOutlined />,
      label: 'Sliders',
      permission: 'sliders.view',
    },
    {
      key: '/orders',
      icon: <FileTextOutlined />,
      label: 'Orders',
      permission: 'orders.view',
    },
    {
      key: '/kyc',
      icon: <SafetyOutlined />,
      label: 'KYC Verification',
      permission: 'kyc.view',
    },
    {
      key: '/wallet',
      icon: <WalletOutlined />,
      label: 'Wallet',
      permission: 'wallet.view',
    },
    {
      key: '/affiliate',
      icon: <TeamOutlined />,
      label: 'Affiliate',
      permission: 'affiliate.view',
    },
    {
      key: '/commissions',
      icon: <DollarOutlined />,
      label: 'Commissions',
      permission: 'commissions.view',
    },
    {
      key: '/commission-payout',
      icon: <ThunderboltOutlined />,
      label: 'Commission Payout',
      permission: 'commissions.payout',
    },
    {
      key: '/commission-config',
      icon: <SettingOutlined />,
      label: 'Commission Config',
      permission: 'commission-config.view',
    },
    {
      key: '/milestone-reward',
      icon: <ThunderboltOutlined />,
      label: 'Milestone Reward',
      permission: 'milestone-reward.view',
    },
    {
      key: '/audit-log',
      icon: <AuditOutlined />,
      label: 'Audit Log',
      permission: 'audit-log.view',
    },
    {
      key: '/tree-view',
      icon: <TeamOutlined />,
      label: 'Tree View',
      permission: 'tree.view',
    },
    {
      key: '/staffs',
      icon: <UsergroupAddOutlined />,
      label: 'Staff',
      permission: 'staffs.view',
    },
    {
      key: '/roles',
      icon: <SafetyCertificateOutlined />,
      label: 'Roles',
      permission: 'roles.view',
    },
  ];

  // Filter menu items based on permissions
  const menuItems = useMemo(() => {
    return allMenuItems
      .filter((item) => {
        // If no permission required, always show
        if (!item.permission) return true;
        // Check if user has permission
        return hasPermission(item.permission);
      })
      .map(({ permission, ...item }) => item); // Remove permission from menu item
  }, [hasPermission]);

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: collapsed ? 16 : 20,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? 'AP' : 'Admin Panel'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={location.pathname ? [location.pathname] : []}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{ fontSize: 18, cursor: 'pointer' }}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span>{user?.fullName || 'Admin'}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: '#fff',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;

