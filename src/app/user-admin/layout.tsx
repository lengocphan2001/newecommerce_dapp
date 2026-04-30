import React from 'react';
import UserAdminLayoutClient from './UserAdminLayoutClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'User Affiliate Panel',
  description: 'Manage your affiliate network and commissions',
};

export default function UserAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UserAdminLayoutClient>{children}</UserAdminLayoutClient>;
}
