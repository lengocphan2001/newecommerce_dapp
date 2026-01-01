import React, { useEffect, useState } from 'react';
import { Table, Tag, Select, message, Space } from 'antd';
import { orderService, Order } from '../services/orderService';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await orderService.getAll();
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      await orderService.updateStatus(orderId, status);
      message.success('Order status updated');
      fetchOrders();
    } catch (error) {
      message.error('Failed to update order status');
    }
  };

  const columns = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'User ID',
      dataIndex: 'userId',
      key: 'userId',
    },
    {
      title: 'Items',
      dataIndex: 'items',
      key: 'items',
      render: (items: any[]) => `${items?.length || 0} item(s)`,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (total: number) => `$${total?.toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Order) => {
        const colorMap: Record<string, string> = {
          PENDING: 'orange',
          PROCESSING: 'blue',
          SHIPPED: 'cyan',
          DELIVERED: 'green',
          CANCELLED: 'red',
        };
        return (
          <Space>
            <Tag color={colorMap[status]}>{status}</Tag>
            <Select
              value={status}
              style={{ width: 120 }}
              onChange={(value) => handleStatusChange(record.id, value)}
            >
              <Select.Option value="PENDING">Pending</Select.Option>
              <Select.Option value="PROCESSING">Processing</Select.Option>
              <Select.Option value="SHIPPED">Shipped</Select.Option>
              <Select.Option value="DELIVERED">Delivered</Select.Option>
              <Select.Option value="CANCELLED">Cancelled</Select.Option>
            </Select>
          </Space>
        );
      },
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Orders Management</h1>
      <Table
        columns={columns}
        dataSource={orders}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default Orders;

