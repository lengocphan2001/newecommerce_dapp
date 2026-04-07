import React, { useEffect, useState } from 'react';
import { Table, Tag, Select, message, Space, Button, Modal, Descriptions, Input } from 'antd';
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { orderService, Order } from '../services/orderService';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const getQueryParams = () => {
    const q = searchText.trim();
    return q ? { q } : undefined;
  };

  const fetchOrders = async (params?: any) => {
    setLoading(true);
    try {
      const response = await orderService.getAll(params);
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      message.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchOrders(getQueryParams());
  };

  const handleClearSearch = () => {
    setSearchText('');
    fetchOrders(undefined);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await orderService.exportOrders(getQueryParams());
      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'orders.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('Export orders thành công');
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Export orders thất bại');
    } finally {
      setExporting(false);
    }
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      // Convert uppercase status to lowercase for backend
      const normalizedStatus = status.toLowerCase();
      await orderService.updateStatus(orderId, { status: normalizedStatus });
      message.success('Order status updated');
      fetchOrders(getQueryParams());
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to update order status');
    }
  };

  const handleApprove = async (orderId: string) => {
    try {
      await orderService.updateStatus(orderId, { status: 'confirmed' });
      message.success('Order approved. Commission will be calculated automatically.');
      fetchOrders(getQueryParams());
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to approve order');
    }
  };

  const columns = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      ellipsis: true,
    },
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      width: 150,
      ellipsis: true,
      render: (user: any, record: Order) => user?.username || user?.email || record.userId,
    },
    {
      title: 'Items',
      dataIndex: 'items',
      key: 'items',
      width: 120,
      render: (items: any[]) => `${items?.length || 0} item(s)`,
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      render: (total: number) => `$${total?.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })}`,
    },
    {
      title: 'Transaction Hash',
      dataIndex: 'transactionHash',
      key: 'transactionHash',
      width: 150,
      ellipsis: true,
      render: (hash: string) => hash ? (
        <a
          href={`https://bscscan.com/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {hash.slice(0, 10)}...
        </a>
      ) : '-',
    },
    {
      title: 'Payment',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (method: string) => {
        const isBanking = method === 'banking';
        const isUsdt = method === 'usdt';
        const isDepositWallet = method === 'deposit_wallet';
        return (
          <Tag color={isDepositWallet ? 'green' : isBanking ? 'blue' : isUsdt ? 'gold' : 'purple'}>
            {isDepositWallet ? '💼 Deposit Wallet' : isBanking ? '🏦 Banking' : isUsdt ? '₮ USDT Transfer' : '💎 Wallet'}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (status: string, record: Order) => {
        // Normalize status for display (uppercase) and map colors
        const statusUpper = status?.toUpperCase() || '';
        const colorMap: Record<string, string> = {
          PENDING: 'orange',
          CONFIRMED: 'green',
          PROCESSING: 'blue',
          SHIPPED: 'cyan',
          DELIVERED: 'green',
          CANCELLED: 'red',
        };
        return (
          <Space>
            <Tag color={colorMap[statusUpper]}>{statusUpper}</Tag>
            {statusUpper === 'PENDING' && (
              <Button
                type="primary"
                size="small"
                style={record.paymentMethod === 'banking' ? { background: '#e85d04', borderColor: '#e85d04' } : undefined}
                onClick={() => handleApprove(record.id)}
              >
                Duyệt
              </Button>
            )}
            <Select
              value={statusUpper}
              style={{ width: 120 }}
              onChange={(value) => handleStatusChange(record.id, value)}
            >
              <Select.Option value="PENDING">Pending</Select.Option>
              <Select.Option value="CONFIRMED">Confirmed</Select.Option>
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
      width: 180,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: Order) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSelectedOrder(record);
            setModalVisible(true);
          }}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Orders Management</h1>
        <Button icon={<ReloadOutlined />} onClick={() => fetchOrders(getQueryParams())} loading={loading}>
          Làm mới danh sách
        </Button>
      </div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="Tìm theo mã đơn, user, transaction hash..."
          value={searchText}
          allowClear
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={handleSearch}
          style={{ width: 420 }}
        />
        <Button onClick={handleClearSearch} disabled={!searchText.trim()}>Xóa</Button>
        <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
          Export Excel
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={orders}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
      />
      <Modal
        title="Order Details"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedOrder && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Order ID">{selectedOrder.id}</Descriptions.Item>
            <Descriptions.Item label="User ID">{selectedOrder.userId}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={
                selectedOrder.status?.toUpperCase() === 'PENDING' ? 'orange' :
                  selectedOrder.status?.toUpperCase() === 'CONFIRMED' ? 'blue' :
                    selectedOrder.status?.toUpperCase() === 'PROCESSING' ? 'purple' :
                      selectedOrder.status?.toUpperCase() === 'SHIPPED' ? 'cyan' :
                        selectedOrder.status?.toUpperCase() === 'DELIVERED' ? 'green' :
                          selectedOrder.status?.toUpperCase() === 'CANCELLED' ? 'red' : 'default'
              }>
                {selectedOrder.status?.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Total Amount">
              ${selectedOrder.totalAmount?.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
            </Descriptions.Item>
            <Descriptions.Item label="Payment Method">
              <Tag color={
                selectedOrder.paymentMethod === 'deposit_wallet'
                  ? 'green'
                  : selectedOrder.paymentMethod === 'banking'
                    ? 'blue'
                    : selectedOrder.paymentMethod === 'usdt'
                      ? 'gold'
                      : 'purple'
              }>
                {selectedOrder.paymentMethod === 'deposit_wallet'
                  ? '💼 Deposit Wallet'
                  : selectedOrder.paymentMethod === 'banking'
                    ? '🏦 Bank Transfer'
                    : selectedOrder.paymentMethod === 'usdt'
                      ? '₮ USDT Transfer'
                      : '💎 Crypto Wallet'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Transaction Hash">
              {selectedOrder.transactionHash ? (
                <a
                  href={`https://bscscan.com/tx/${selectedOrder.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {selectedOrder.transactionHash}
                </a>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Shipping Address">
              {selectedOrder.shippingAddress || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Items">
              <Table
                dataSource={selectedOrder.items || []}
                pagination={false}
                size="small"
                rowKey={(record) => record.productId || `${record.productName}-${record.quantity}`}
                columns={[
                  { title: 'Product Name', dataIndex: 'productName', key: 'productName' },
                  {
                    title: 'Properties',
                    dataIndex: 'properties',
                    key: 'properties',
                    render: (properties?: { [key: string]: string }) => {
                      if (!properties || Object.keys(properties).length === 0) return '-';
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {Object.entries(properties).map(([key, value]) => (
                            <Tag key={key} color="purple">{key}: {value}</Tag>
                          ))}
                        </div>
                      );
                    },
                  },
                  { title: 'Quantity', dataIndex: 'quantity', key: 'quantity' },
                  {
                    title: 'Price',
                    dataIndex: 'price',
                    key: 'price',
                    render: (price: number) => `$${price.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}`,
                  },
                  {
                    title: 'Subtotal',
                    key: 'subtotal',
                    render: (_: any, record: any) =>
                      `$${(record.price * record.quantity).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}`,
                  },
                ]}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Created At">
              {selectedOrder.createdAt
                ? new Date(selectedOrder.createdAt).toLocaleString()
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Orders;

