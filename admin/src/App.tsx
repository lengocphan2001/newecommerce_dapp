import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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
import CommissionConfig from './pages/CommissionConfig';
import MilestoneReward from './pages/MilestoneReward';
import AuditLog from './pages/AuditLog';
import TreeView from './pages/TreeView';
import Staffs from './pages/Staffs';
import Roles from './pages/Roles';
import Login from './pages/Login';
import './App.css';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use admin_token to avoid conflict with client token
  const token = localStorage.getItem('admin_token');
  return token ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  // Use admin_token to avoid conflict with client token
  const token = localStorage.getItem('admin_token');

  // Use /admin basename only when URL actually starts with /admin (e.g. production or reverse-proxy).
  // When running dev server at root (e.g. http://localhost:3000/), basename must be "" so the Router can match "/".
  const basename =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
      ? '/admin'
      : '';

  return (
    <AuthProvider>
      <NotificationManager token={token} />
      <BrowserRouter basename={basename}>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
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
          path="/commission-config"
          element={
            <PrivateRoute>
              <AdminLayout>
                <CommissionConfig />
              </AdminLayout>
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
