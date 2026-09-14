import React, { useState, useMemo } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Drawer, Button } from 'antd';
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
  GiftOutlined,
  RiseOutlined,
  BankOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';

const { Header, Sider, Content } = Layout;

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isCompact, isMobile } = useResponsive();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, user } = useAuth();
  const isAdminAccount = Boolean(
    user?.isSuperAdmin || (user?.type === 'user' && user?.isAdmin),
  );

  // Define menu items with their required permissions
  const allMenuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      permission: null, // Dashboard is always accessible
      adminOnly: true,
    },
    {
      key: '/analytics',
      icon: <RiseOutlined />,
      label: 'Analytics',
      permission: null, // Analytics is accessible to admins (or add permission if needed)
      adminOnly: true,
    },
    {
      key: '/analytics-demo',
      icon: <BarChartOutlined />,
      label: 'Analytics (Demo)',
      permission: null,
      adminOnly: true,
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
      key: '/packages',
      icon: <GiftOutlined />,
      label: 'Packages',
      permission: 'packages.view',
    },
    {
      key: '/package-purchases',
      icon: <DollarOutlined />,
      label: 'Package Purchases',
      permission: null,
      adminOnly: true,
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
      key: '/wallet-deposit-requests',
      icon: <BankOutlined />,
      label: 'Yêu cầu nạp ví',
      permission: null,
    },
    {
      key: '/wallet-withdraw-requests',
      icon: <BankOutlined />,
      label: 'Yêu cầu rút ví',
      permission: null,
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
      key: '/monthly-rewards',
      icon: <GiftOutlined />,
      label: 'Monthly Rewards',
      permission: 'commissions.view',
    },
    {
      key: '/commission-payout',
      icon: <ThunderboltOutlined />,
      label: 'Commission Payout',
      permission: 'commissions.payout',
    },
    {
      key: '/blockchain-settings',
      icon: <SettingOutlined />,
      label: 'Blockchain Settings',
      permission: 'commissions.payout',
      adminOnly: true,
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
      key: '/matrix-pool',
      icon: <TeamOutlined />,
      label: 'Matrix pool',
      permission: null,
      adminOnly: true,
    },
    {
      key: '/matrix-records',
      icon: <AuditOutlined />,
      label: 'Matrix records',
      permission: null,
      adminOnly: true,
    },
    {
      key: '/heap-reward',
      icon: <GiftOutlined />,
      label: 'Heap Reward',
      permission: null,
      adminOnly: true,
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
    {
      key: '/banking-settings',
      icon: <BankOutlined />,
      label: 'Banking Settings',
      permission: null,
      adminOnly: true,
    },
    {
      key: '/monthly-sales',
      icon: <BarChartOutlined />,
      label: 'Doanh số tháng',
      permission: null,
      adminOnly: true,
    },
    {
      key: '/product-types',
      icon: <AppstoreOutlined />,
      label: 'Phân loại SP',
      permission: null,
      adminOnly: true,
    },
    {
      key: '/agent-pool',
      icon: <SafetyCertificateOutlined />,
      label: 'Bể Đồng Chia Đại Lý',
      permission: null,
      adminOnly: true,
    },
    {
      key: '/monthly-salary',
      icon: <DollarOutlined />,
      label: 'Lương tháng',
      permission: null,
      adminOnly: true,
    },
  ];

  // Filter menu items based on permissions
  const menuItems = useMemo(() => {
    return allMenuItems
      .filter((item) => {
        if (item.adminOnly && !isAdminAccount) return false;
        // If no permission required, always show
        if (!item.permission) return true;
        // Check if user has permission
        return hasPermission(item.permission);
      })
      .map(({ permission, ...item }) => item); // Remove permission from menu item
  }, [hasPermission, isAdminAccount]);

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: () => {
        // Use admin_token to avoid conflict with client token
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/login');
      },
    },
  ];

  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={location.pathname ? [location.pathname] : []}
      items={menuItems}
      onClick={({ key }) => {
        navigate(key);
        setDrawerOpen(false);
      }}
    />
  );

  const brand = (collapsedBrand: boolean) => (
    <div
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: collapsedBrand ? 16 : 20,
        fontWeight: 'bold',
      }}
    >
      {collapsedBrand ? 'AP' : 'Admin Panel'}
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Below lg the sidebar becomes an overlay drawer so the content keeps
          the full viewport width on phones and portrait tablets. */}
      {isCompact ? (
        <Drawer
          placement="left"
          closable={false}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={250}
          styles={{ body: { padding: 0, background: '#001529' } }}
        >
          {brand(false)}
          {menu}
        </Drawer>
      ) : (
        <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
          {brand(collapsed)}
          {menu}
        </Sider>
      )}
      <Layout>
        <Header
          style={{
            padding: isMobile ? '0 12px' : '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Button
            type="text"
            aria-label="Toggle navigation"
            style={{ fontSize: 18 }}
            onClick={() =>
              isCompact ? setDrawerOpen(true) : setCollapsed(!collapsed)
            }
            icon={
              isCompact || collapsed ? (
                <MenuUnfoldOutlined />
              ) : (
                <MenuFoldOutlined />
              )
            }
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              {!isMobile && <span>{user?.fullName || 'Admin'}</span>}
            </Space>
          </Dropdown>
        </Header>
        <Content
          className="admin-content"
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
