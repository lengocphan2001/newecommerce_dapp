'use client';

import React, { useEffect, useState } from 'react';
import { Card, Spin, message, Typography, Tree } from 'antd';
import { DownOutlined, UserOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function UserAdminTree() {
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<any[]>([]);

  useEffect(() => {
    const fetchTree = async () => {
      try {
        const token = localStorage.getItem('user_admin_token');
        const userStr = localStorage.getItem('user_admin_user');
        if (!token || !userStr) return;
        
        const user = JSON.parse(userStr);
        const targetUserId = user.linkedUserId || user.id;

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/admin/tree/${targetUserId}?maxDepth=10`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch tree');
        }

        const data = await response.json();
        
        // Convert API tree format to Antd Tree format
        const formatNode = (node: any): any => {
          if (!node) return null;
          
          const title = (
            <span>
              <strong>{node.username || node.email}</strong> 
              {node.position ? ` (${node.position.toUpperCase()})` : ''} - 
              Sales: L:${node.leftBranchTotal || 0} / R:${node.rightBranchTotal || 0}
            </span>
          );

          const children = node.children 
            ? node.children.map(formatNode).filter(Boolean)
            : [];

          return {
            title,
            key: node.id,
            icon: <UserOutlined />,
            children
          };
        };

        const formattedTree = formatNode(data);
        setTreeData(formattedTree ? [formattedTree] : []);

      } catch (error: any) {
        message.error(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTree();
  }, []);

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>Binary Tree View</Title>
      <Card bordered={false}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
        ) : treeData.length > 0 ? (
          <Tree
            showIcon
            defaultExpandAll
            switcherIcon={<DownOutlined />}
            treeData={treeData}
            style={{ fontSize: '16px' }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
            No tree data available
          </div>
        )}
      </Card>
    </div>
  );
}
