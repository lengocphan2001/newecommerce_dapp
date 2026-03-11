import React, { useEffect, useState } from 'react';
import {
    Form,
    Input,
    Switch,
    Button,
    message,
    Upload,
    Image,
    Typography,
    Card,
    Divider,
    InputNumber,
} from 'antd';
import { UploadOutlined, SaveOutlined, BankOutlined, SettingOutlined } from '@ant-design/icons';
import { bankingService, BankingConfig } from '../services/bankingService';
import { systemConfigService } from '../services/systemConfigService';
import api from '../services/api';

const { Title, Text } = Typography;

const BankingSettings: React.FC = () => {
    const [form] = Form.useForm();
    const [payoutForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savingPayout, setSavingPayout] = useState(false);
    const [qrPreview, setQrPreview] = useState<string | undefined>(undefined);

    useEffect(() => {
        fetchConfig();
        fetchPayoutConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await bankingService.getConfig();
            const config: BankingConfig = res.data;
            form.setFieldsValue({
                bankName: config.bankName || '',
                accountNumber: config.accountNumber || '',
                accountName: config.accountName || '',
                isEnabled: config.isEnabled ?? true,
                usdtPriceVnd: config.usdtPriceVnd ?? undefined,
            });
            setQrPreview(config.qrImageUrl);
        } catch (error) {
            message.error('Failed to load banking config');
        } finally {
            setLoading(false);
        }
    };

    const fetchPayoutConfig = async () => {
        try {
            const config = await systemConfigService.get();
            payoutForm.setFieldsValue({
                minPayoutThreshold: config.minPayoutThreshold ?? 50,
            });
        } catch {
            payoutForm.setFieldsValue({ minPayoutThreshold: 50 });
        }
    };

    const handleUploadQR = async (file: File): Promise<boolean> => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post<{ url: string }>('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (res.data?.url) {
                setQrPreview(res.data.url);
                message.success('QR image uploaded');
            }
        } catch {
            message.error('Failed to upload QR image');
        }
        return false; // prevent default upload behaviour
    };

    const handleSave = async (values: any) => {
        setSaving(true);
        try {
            await bankingService.updateConfig({
                ...values,
                qrImageUrl: qrPreview,
                usdtPriceVnd: values.usdtPriceVnd != null && values.usdtPriceVnd !== '' ? Number(values.usdtPriceVnd) : null,
            });
            message.success('Banking config saved successfully');
        } catch (error) {
            message.error('Failed to save banking config');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePayout = async (values: any) => {
        setSavingPayout(true);
        try {
            await systemConfigService.update({ minPayoutThreshold: values.minPayoutThreshold });
            message.success('Payout settings saved successfully');
        } catch {
            message.error('Failed to save payout settings');
        } finally {
            setSavingPayout(false);
        }
    };

    return (
        <div style={{ maxWidth: 600 }}>
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <BankOutlined style={{ fontSize: 24 }} />
                <Title level={3} style={{ margin: 0 }}>Banking Payment Settings</Title>
            </div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                Configure bank transfer payment. When enabled, users can pay by bank transfer (QR code)
                and orders are created as PENDING until you manually approve them.
            </Text>

            <Card loading={loading}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="isEnabled" label="Enable Banking Payment" valuePropName="checked">
                        <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                    </Form.Item>

                    <Divider />

                    <Form.Item
                        name="bankName"
                        label="Bank Name"
                        rules={[{ required: true, message: 'Please enter bank name' }]}
                    >
                        <Input placeholder="e.g. Vietcombank, MB Bank, Techcombank" />
                    </Form.Item>

                    <Form.Item
                        name="accountNumber"
                        label="Account Number"
                        rules={[{ required: true, message: 'Please enter account number' }]}
                    >
                        <Input placeholder="e.g. 1234567890" />
                    </Form.Item>

                    <Form.Item
                        name="accountName"
                        label="Account Name (Receiver)"
                        rules={[{ required: true, message: 'Please enter account name' }]}
                    >
                        <Input placeholder="e.g. NGUYEN VAN A" style={{ textTransform: 'uppercase' }} />
                    </Form.Item>

                    <Form.Item
                        name="usdtPriceVnd"
                        label="USDT Price (VND)"
                        tooltip="When set, checkout will use this rate for bank transfer (1 USDT = X VND) instead of fetching from CoinGecko. Leave empty to use live rate."
                    >
                        <InputNumber
                            style={{ width: 200 }}
                            min={0}
                            step={100}
                            placeholder="e.g. 25000 (leave empty = use CoinGecko)"
                            addonAfter="VNĐ"
                        />
                    </Form.Item>

                    <Form.Item label="QR Code Image">
                        <Upload
                            accept="image/*"
                            beforeUpload={(file) => {
                                handleUploadQR(file);
                                return false;
                            }}
                            showUploadList={false}
                        >
                            <Button icon={<UploadOutlined />}>Upload QR Image</Button>
                        </Upload>
                        {qrPreview && (
                            <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <Image
                                    src={qrPreview}
                                    width={160}
                                    style={{ borderRadius: 8, border: '1px solid #ddd' }}
                                    alt="QR Code"
                                />
                                <Button
                                    danger
                                    size="small"
                                    onClick={() => setQrPreview(undefined)}
                                >
                                    Remove
                                </Button>
                            </div>
                        )}
                        {!qrPreview && (
                            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                                No QR image uploaded yet. Users will see bank details only.
                            </Text>
                        )}
                    </Form.Item>

                    <Form.Item style={{ marginTop: 8 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={saving}
                            icon={<SaveOutlined />}
                            size="large"
                        >
                            Save Settings
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            <div style={{ marginTop: 32, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <SettingOutlined style={{ fontSize: 24 }} />
                <Title level={3} style={{ margin: 0 }}>Payout Settings</Title>
            </div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                Commissions accumulate as PENDING until a user's total reaches the minimum threshold below.
                Once reached, all their pending commissions are paid out automatically.
            </Text>

            <Card>
                <Form form={payoutForm} layout="vertical" onFinish={handleSavePayout}>
                    <Form.Item
                        name="minPayoutThreshold"
                        label="Minimum Payout Threshold ($)"
                        rules={[{ required: true, message: 'Please enter a minimum threshold' }]}
                        tooltip="Users must accumulate at least this amount in pending commissions before automatic payout is triggered."
                    >
                        <InputNumber
                            style={{ width: 200 }}
                            min={0}
                            step={10}
                            precision={2}
                            addonBefore="$"
                        />
                    </Form.Item>

                    <Form.Item style={{ marginTop: 8 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={savingPayout}
                            icon={<SaveOutlined />}
                            size="large"
                        >
                            Save Payout Settings
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default BankingSettings;
