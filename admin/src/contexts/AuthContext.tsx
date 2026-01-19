import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { staffService, Staff } from '../services/staffService';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  type?: 'staff' | 'user';
}

interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  module?: string;
}

interface AuthContextType {
  user: User | null;
  permissions: Permission[];
  loading: boolean;
  refreshUser: () => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      // Use /auth/me endpoint to get current user info (no permission required)
      const response = await api.get('/auth/me');
      const userData = response.data;
      
      setUser({
        id: userData.id,
        email: userData.email,
        fullName: userData.fullName,
        isAdmin: userData.isAdmin,
        isSuperAdmin: userData.isSuperAdmin,
        type: userData.type,
      });

      // Collect all permissions from roles
      const allPermissions: Permission[] = [];
      if (userData.roles) {
        userData.roles.forEach((role: any) => {
          if (role.permissions) {
            role.permissions.forEach((perm: any) => {
              if (!allPermissions.find((p) => p.id === perm.id)) {
                allPermissions.push({
                  id: perm.id,
                  code: perm.code,
                  name: perm.name,
                  description: perm.description,
                  module: perm.module,
                });
              }
            });
          }
        });
      }
      setPermissions(allPermissions);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false;
    
    // Super admin has all permissions
    if (user.isSuperAdmin) return true;
    
    // Legacy admin users (type === 'user') have all permissions
    if (user.type === 'user' && user.isAdmin) return true;
    
    // Check if user has the permission
    return permissions.some((perm) => perm.code === permissionCode);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        refreshUser,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
