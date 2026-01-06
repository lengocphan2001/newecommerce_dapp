import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Products from './pages/Products';
import Orders from './pages/Orders';
import KYC from './pages/KYC';
import Wallet from './pages/Wallet';
import Affiliate from './pages/Affiliate';
import Commissions from './pages/Commissions';
import AuditLog from './pages/AuditLog';
import Login from './pages/Login';
import './App.css';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
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
          path="/audit-log"
          element={
            <PrivateRoute>
              <AdminLayout>
                <AuditLog />
              </AdminLayout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
