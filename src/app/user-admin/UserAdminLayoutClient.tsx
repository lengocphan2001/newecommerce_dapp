'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, message } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  DollarOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';

const { Header, Sider, Content } = Layout;

interface UserAdminLayoutClientProps {
  children: React.ReactNode;
}

const UserAdminLayoutClient: React.FC<UserAdminLayoutClientProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('user_admin_token');
    const userData = localStorage.getItem('user_admin_user');
    
    if (!token && pathname !== '/user-admin/login') {
      router.push('/user-admin/login');
      return;
    }

    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, [pathname, router]);

  // Don't render layout elements on login page
  if (pathname === '/user-admin/login') {
    return <>{children}</>;
  }

  // Prevent hydration mismatch
  if (!mounted) return null;

  const menuItems = [
    {
      key: '/user-admin',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/user-admin/affiliate',
      icon: <TeamOutlined />,
      label: 'My Affiliates',
    },
    {
      key: '/user-admin/commissions',
      icon: <DollarOutlined />,
      label: 'Commissions',
    },
    {
      key: '/user-admin/tree',
      icon: <UserOutlined />,
      label: 'Tree View',
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem('user_admin_token');
    localStorage.removeItem('user_admin_user');
    router.push('/user-admin/login');
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
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
            fontSize: collapsed ? 16 : 18,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? 'UP' : 'User Panel'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname || '/user-admin']}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
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
              <span>{user?.email || 'User'}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: '#fff',
            overflow: 'auto'
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default UserAdminLayoutClient;
