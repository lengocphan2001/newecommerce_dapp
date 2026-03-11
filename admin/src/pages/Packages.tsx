import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Table,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    Space,
    Select,
    Switch,
    message,
    Typography,
    Tooltip,
    Popconfirm
} from 'antd';
import {
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import { packagesService, Package, CreatePackageDto, UpdatePackageDto } from '../services/packagesService';

const { Title, Text } = Typography;
const { Option } = Select;

const PackagesPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [packages, setPackages] = useState<Package[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm();

    const loadPackages = useCallback(async () => {
        try {
            setLoading(true);
            const data = await packagesService.getAll();
            setPackages(data);
        } catch (error: any) {
            message.error('Failed to load packages: ' + (error.message || 'Unknown error'));
            setPackages([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPackages();
    }, [loadPackages]);

    const handleAdd = () => {
        setEditingId(null);
        form.resetFields();
        // Set defaults
        form.setFieldsValue({
            isActive: true,
            level: 1,
            price: 0,
            directCommissionRate: 0,
            groupCommissionRate: 0,
            groupCommissionMinSales: 2000,
            managementRateF1: 0,
            managementMinSales: 0,
        });
        setIsModalVisible(true);
    };

    const handleEdit = (record: Package) => {
        setEditingId(record.id);
        form.setFieldsValue({
            ...record,
            directCommissionRate: record.directCommissionRate * 100,
            groupCommissionRate: record.groupCommissionRate * 100,
            groupCommissionMinSales: record.groupCommissionMinSales ?? 2000,
            managementRateF1: record.managementRateF1 * 100,
            managementRateF2: record.managementRateF2 ? record.managementRateF2 * 100 : null,
            managementRateF3: record.managementRateF3 ? record.managementRateF3 * 100 : null,
            managementMinSales: record.managementMinSales ?? 0,
        });
        setIsModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await packagesService.delete(id);
            message.success('Package deleted successfully');
            loadPackages();
        } catch (error: any) {
            message.error('Failed to delete package: ' + (error.message || 'Unknown error'));
        }
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload: any = {
                ...values,
                directCommissionRate: values.directCommissionRate / 100,
                groupCommissionRate: values.groupCommissionRate / 100,
                managementRateF1: values.managementRateF1 / 100,
                managementRateF2: values.managementRateF2 ? values.managementRateF2 / 100 : null,
                managementRateF3: values.managementRateF3 ? values.managementRateF3 / 100 : null,
            };

            if (editingId) {
                await packagesService.update(editingId, payload);
                message.success('Package updated successfully');
            } else {
                await packagesService.create(payload);
                message.success('Package created successfully');
            }

            setIsModalVisible(false);
            loadPackages();
        } catch (error: any) {
            // Form validation error or API error
            if (error.message) {
                message.error('Operation failed: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleModalCancel = () => {
        setIsModalVisible(false);
    };

    const columns = [
        {
            title: 'Level',
            dataIndex: 'level',
            key: 'level',
            width: 80,
            sorter: (a: Package, b: Package) => a.level - b.level,
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Package) => (
                <div>
                    <div style={{ fontWeight: 'bold' }}>{text}</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>{record.code}</Text>
                </div>
            ),
        },
        {
            title: 'Price',
            dataIndex: 'price',
            key: 'price',
            render: (val: number) => `$${val.toLocaleString()}`,
        },
        {
            title: 'Rates',
            key: 'rates',
            render: (_: any, record: Package) => (
                <div style={{ fontSize: '12px' }}>
                    <div>Direct: {(record.directCommissionRate * 100).toFixed(4)}%</div>
                    <div>Group: {(record.groupCommissionRate * 100).toFixed(4)}%</div>
                    <div>Min/Branch: ${(record.groupCommissionMinSales ?? 2000).toLocaleString()}</div>
                </div>
            ),
        },
        {
            title: 'Mgmt Rates',
            key: 'mgmt_rates',
            render: (_: any, record: Package) => (
                <div style={{ fontSize: '12px' }}>
                    <div>F1: {(record.managementRateF1 * 100).toFixed(4)}%</div>
                    {record.managementRateF2 && <div>F2: {(record.managementRateF2 * 100).toFixed(4)}%</div>}
                    {record.managementRateF3 && <div>F3: {(record.managementRateF3 * 100).toFixed(4)}%</div>}
                </div>
            ),
        },
        {
            title: 'Reconsumption',
            key: 'reconsumption',
            render: (_: any, record: Package) => (
                <div style={{ fontSize: '12px' }}>
                    <div>Threshold: ${record.reconsumptionThreshold}</div>
                    <div>Required: ${record.reconsumptionRequired}</div>
                </div>
            )
        },
        {
            title: 'Status',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive: boolean) => (
                <Switch checked={isActive} disabled />
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: Package) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Popconfirm
                            title="Are you sure you want to delete this package?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            )

        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <Title level={2}>Package Management</Title>
                    <Text type="secondary">Manage system packages, prices, and commission rates.</Text>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={loadPackages}>Refresh</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}> Add Package</Button>
                </Space>
            </div>

            <Card>
                <Table
                    dataSource={packages}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                />
            </Card>

            <Modal
                title={editingId ? "Edit Package" : "Create New Package"}
                open={isModalVisible}
                onOk={handleModalOk}
                onCancel={handleModalCancel}
                width={800}
                confirmLoading={loading}
            >
                <Form
                    form={form}
                    layout="vertical"
                >
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Form.Item
                            name="name"
                            label="Package Name"
                            rules={[{ required: true, message: 'Please enter package name' }]}
                            style={{ flex: 1 }}
                        >
                            <Input placeholder="e.g. Bronze Package" />
                        </Form.Item>
                        <Form.Item
                            name="code"
                            label="Code"
                            rules={[{ required: true, message: 'Please enter package code' }]}
                            style={{ flex: 1 }}
                        >
                            <Input placeholder="e.g. BRONZE" disabled={!!editingId} />
                        </Form.Item>
                    </div>

                    <Form.Item
                        name="description"
                        label="Description"
                    >
                        <Input.TextArea rows={2} />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Form.Item
                            name="price"
                            label="Price ($)"
                            rules={[{ required: true, message: 'Please enter price' }]}
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={0} step={0.0001} precision={4} />
                        </Form.Item>
                        <Form.Item
                            name="level"
                            label="Level (Hierarchy)"
                            rules={[{ required: true, message: 'Please enter level' }]}
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={1} step={1} precision={0} />
                        </Form.Item>
                        <Form.Item
                            name="isActive"
                            label="Active"
                            valuePropName="checked"
                            style={{ flex: 0.5 }}
                        >
                            <Switch />
                        </Form.Item>
                    </div>

                    <Title level={5} style={{ marginTop: 16 }}>Commission Rates (%)</Title>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Form.Item
                            name="directCommissionRate"
                            label="Direct (%)"
                            rules={[{ required: true }]}
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={0} max={100} />
                        </Form.Item>
                        <Form.Item
                            name="groupCommissionRate"
                            label="Group (%)"
                            rules={[{ required: true }]}
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={0} max={100} />
                        </Form.Item>
                        <Form.Item
                            name="groupCommissionMinSales"
                            label="Min Branch Sales ($)"
                            rules={[{ required: true }]}
                            tooltip="Minimum cumulative sales required on EACH branch before group commission is paid"
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={0} step={100} precision={2} />
                        </Form.Item>
                    </div>

                    <Title level={5} style={{ marginTop: 16 }}>Management Commission (%)</Title>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Form.Item
                            name="managementRateF1"
                            label="F1 (%)"
                            rules={[{ required: true }]}
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={0} max={100} />
                        </Form.Item>
                        <Form.Item
                            name="managementRateF2"
                            label="F2 (%)"
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={0} max={100} />
                        </Form.Item>
                        <Form.Item
                            name="managementRateF3"
                            label="F3 (%)"
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={0} max={100} />
                        </Form.Item>
                    </div>
                    <Form.Item
                        name="managementMinSales"
                        label="Management Min Sales ($)"
                        tooltip="Mỗi nhánh (trái và phải) của F1/F2/F3 phải đạt doanh số tối thiểu này mới được nhận hoa hồng quản lý. 0 = không yêu cầu."
                        style={{ maxWidth: 280 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} step={100} precision={2} />
                    </Form.Item>

                    <Title level={5} style={{ marginTop: 16 }}>Reconsumption</Title>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Form.Item
                            name="reconsumptionThreshold"
                            label="Threshold ($)"
                            rules={[{ required: true }]}
                            tooltip="Max commission before reset/re-purchase"
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={0} step={0.0001} />
                        </Form.Item>
                        <Form.Item
                            name="reconsumptionRequired"
                            label="Required Amount ($)"
                            rules={[{ required: true }]}
                            tooltip="Amount needed to purchase to restore package"
                            style={{ flex: 1 }}
                        >
                            <InputNumber style={{ width: '100%' }} min={0} step={0.0001} />
                        </Form.Item>
                    </div>

                </Form>
            </Modal>
        </div>
    );
};

export default PackagesPage;
