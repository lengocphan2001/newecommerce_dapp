import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import NotificationManager from './components/NotificationManager';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Sliders from './pages/Sliders';
import Orders from './pages/Orders';
import KYC from './pages/KYC';
import Wallet from './pages/Wallet';
import Affiliate from './pages/Affiliate';
import Commissions from './pages/Commissions';
import CommissionPayout from './pages/CommissionPayout';
import Analytics from './pages/Analytics';
import FakeAnalyticsDashboard from './pages/FakeAnalyticsDashboard';

import MilestoneReward from './pages/MilestoneReward';
import AuditLog from './pages/AuditLog';
import TreeView from './pages/TreeView';
import MatrixPool from './pages/MatrixPool';
import MatrixRecords from './pages/MatrixRecords';
import Staffs from './pages/Staffs';
import Roles from './pages/Roles';
import Login from './pages/Login';
import Packages from './pages/Packages';
import PackagePurchases from './pages/PackagePurchases';
import BankingSettings from './pages/BankingSettings';
import WalletDepositRequests from './pages/WalletDepositRequests';
import WalletWithdrawRequests from './pages/WalletWithdrawRequests';
import BlockchainSettings from './pages/BlockchainSettings';
import HeapReward from './pages/HeapReward';
import MonthlySales from './pages/MonthlySales';
import RankPool from './pages/RankPool';
import ProductTypes from './pages/ProductTypes';
import './App.css';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use admin_token to avoid conflict with client token
  const token = localStorage.getItem('admin_token');
  return token ? <>{children}</> : <Navigate to="/login" />;
};

const AdminOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  const isAdminAccount = Boolean(
    user?.isSuperAdmin || (user?.type === 'user' && user?.isAdmin),
  );
  return isAdminAccount ? <>{children}</> : <Navigate to="/orders" replace />;
};

/** Bật socket thông báo sau khi /auth/me xong — tránh connect rồi disconnect khi token là user admin. */
const AdminNotifications: React.FC = () => {
  const { user, loading } = useAuth();
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  if (loading || !token || !user) {
    return null;
  }
  const eligible =
    user.type === 'staff' ||
    user.isSuperAdmin === true ||
    (user.type === 'user' && user.isAdmin);
  if (!eligible) {
    return null;
  }
  return <NotificationManager token={token} />;
};

function App() {
  // Use /admin basename only when URL actually starts with /admin (e.g. production or reverse-proxy).
  // When running dev server at root (e.g. http://localhost:3000/), basename must be "" so the Router can match "/".
  const basename =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
      ? '/admin'
      : '';

  return (
    <AuthProvider>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#10B981',
            colorPrimaryHover: '#059669',
            colorPrimaryActive: '#047857',
            borderRadius: 6,
          },
        }}
      >
        <AdminNotifications />
        <BrowserRouter basename={basename}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <Dashboard />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <Dashboard />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/users"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Users />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/products"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Products />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Categories />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/sliders"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Sliders />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Orders />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/kyc"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <KYC />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Wallet />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/affiliate"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Affiliate />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/commissions"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Commissions />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/commission-payout"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <CommissionPayout />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <Analytics />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/analytics-demo"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <FakeAnalyticsDashboard />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />

            <Route
              path="/milestone-reward"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <MilestoneReward />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/audit-log"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <AuditLog />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/tree-view"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <TreeView />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/matrix-pool"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <MatrixPool />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/matrix-records"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <MatrixRecords />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/staffs"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Staffs />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/roles"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Roles />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/packages"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <Packages />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/package-purchases"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <PackagePurchases />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/banking-settings"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <BankingSettings />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/wallet-deposit-requests"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <WalletDepositRequests />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/wallet-withdraw-requests"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <WalletWithdrawRequests />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/blockchain-settings"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <BlockchainSettings />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/heap-reward"
              element={
                <PrivateRoute>
                  <AdminLayout>
                    <HeapReward />
                  </AdminLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/monthly-sales"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <MonthlySales />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/product-types"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <ProductTypes />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
            <Route
              path="/rank-pool"
              element={
                <PrivateRoute>
                  <AdminOnlyRoute>
                    <AdminLayout>
                      <RankPool />
                    </AdminLayout>
                  </AdminOnlyRoute>
                </PrivateRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </AuthProvider>
  );
}

export default App;
