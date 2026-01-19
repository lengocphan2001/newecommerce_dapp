import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Button,
  message,
  Tabs,
  Typography,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  commissionConfigService,
  CommissionConfig,
  UpdateCommissionConfigDto,
  CreateCommissionConfigDto,
} from '../services/commissionConfigService';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const CommissionConfigPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [ctvConfig, setCtvConfig] = useState<CommissionConfig | null>(null);
  const [nppConfig, setNppConfig] = useState<CommissionConfig | null>(null);
  const [ctvForm] = Form.useForm();
  const [nppForm] = Form.useForm();

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await commissionConfigService.getAll();
      // Ensure configs is always an array
      const configs = Array.isArray(response) ? response : [];
      const ctv = configs.find((c) => c.packageType === 'CTV');
      const npp = configs.find((c) => c.packageType === 'NPP');

      if (ctv) {
        setCtvConfig(ctv);
        ctvForm.setFieldsValue({
          directRate: ctv.directRate * 100, // Convert to percentage
          groupRate: ctv.groupRate * 100,
          managementRateF1: ctv.managementRateF1 * 100,
          managementRateF2: ctv.managementRateF2 ? ctv.managementRateF2 * 100 : null,
          managementRateF3: ctv.managementRateF3 ? ctv.managementRateF3 * 100 : null,
          packageValue: ctv.packageValue,
          reconsumptionThreshold: ctv.reconsumptionThreshold,
          reconsumptionRequired: ctv.reconsumptionRequired,
        });
      } else {
        // Config doesn't exist, set to null so form shows default values
        setCtvConfig(null);
      }

      if (npp) {
        setNppConfig(npp);
        nppForm.setFieldsValue({
          directRate: npp.directRate * 100,
          groupRate: npp.groupRate * 100,
          managementRateF1: npp.managementRateF1 * 100,
          managementRateF2: npp.managementRateF2 ? npp.managementRateF2 * 100 : null,
          managementRateF3: npp.managementRateF3 ? npp.managementRateF3 * 100 : null,
          packageValue: npp.packageValue,
          reconsumptionThreshold: npp.reconsumptionThreshold,
          reconsumptionRequired: npp.reconsumptionRequired,
        });
      } else {
        // Config doesn't exist, set to null so form shows default values
        setNppConfig(null);
      }
    } catch (error: any) {
      message.error('Failed to load configs: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [ctvForm, nppForm]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleCtvSubmit = async (values: any) => {
    try {
      setLoading(true);
      const updateData: UpdateCommissionConfigDto = {
        directRate: typeof values.directRate === 'number' ? values.directRate / 100 : parseFloat(values.directRate) / 100, // Convert from percentage
        groupRate: typeof values.groupRate === 'number' ? values.groupRate / 100 : parseFloat(values.groupRate) / 100,
        managementRateF1: typeof values.managementRateF1 === 'number' ? values.managementRateF1 / 100 : parseFloat(values.managementRateF1) / 100,
        managementRateF2: values.managementRateF2 ? (typeof values.managementRateF2 === 'number' ? values.managementRateF2 / 100 : parseFloat(values.managementRateF2) / 100) : null,
        managementRateF3: values.managementRateF3 ? (typeof values.managementRateF3 === 'number' ? values.managementRateF3 / 100 : parseFloat(values.managementRateF3) / 100) : null,
        packageValue: typeof values.packageValue === 'number' ? values.packageValue : parseFloat(values.packageValue),
        reconsumptionThreshold: typeof values.reconsumptionThreshold === 'number' ? values.reconsumptionThreshold : parseFloat(values.reconsumptionThreshold),
        reconsumptionRequired: typeof values.reconsumptionRequired === 'number' ? values.reconsumptionRequired : parseFloat(values.reconsumptionRequired),
      };

      if (ctvConfig) {
        // Update existing config
        const updated = await commissionConfigService.update(ctvConfig.id, updateData);
        message.success('CTV config updated successfully');
        // Update local state immediately
        setCtvConfig(updated);
        // Update form with new values
        ctvForm.setFieldsValue({
          directRate: updated.directRate * 100,
          groupRate: updated.groupRate * 100,
          managementRateF1: updated.managementRateF1 * 100,
          managementRateF2: updated.managementRateF2 ? updated.managementRateF2 * 100 : null,
          managementRateF3: updated.managementRateF3 ? updated.managementRateF3 * 100 : null,
          packageValue: updated.packageValue,
          reconsumptionThreshold: updated.reconsumptionThreshold,
          reconsumptionRequired: updated.reconsumptionRequired,
        });
      } else {
        // Create new config if it doesn't exist
        const createData: CreateCommissionConfigDto = {
          packageType: 'CTV',
          ...updateData,
        };
        await commissionConfigService.create(createData);
        message.success('CTV config created successfully');
        await loadConfigs();
      }
    } catch (error: any) {
      message.error('Failed to save CTV config: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleNppSubmit = async (values: any) => {
    try {
      setLoading(true);
      const updateData: UpdateCommissionConfigDto = {
        directRate: typeof values.directRate === 'number' ? values.directRate / 100 : parseFloat(values.directRate) / 100,
        groupRate: typeof values.groupRate === 'number' ? values.groupRate / 100 : parseFloat(values.groupRate) / 100,
        managementRateF1: typeof values.managementRateF1 === 'number' ? values.managementRateF1 / 100 : parseFloat(values.managementRateF1) / 100,
        managementRateF2: values.managementRateF2 ? (typeof values.managementRateF2 === 'number' ? values.managementRateF2 / 100 : parseFloat(values.managementRateF2) / 100) : null,
        managementRateF3: values.managementRateF3 ? (typeof values.managementRateF3 === 'number' ? values.managementRateF3 / 100 : parseFloat(values.managementRateF3) / 100) : null,
        packageValue: typeof values.packageValue === 'number' ? values.packageValue : parseFloat(values.packageValue),
        reconsumptionThreshold: typeof values.reconsumptionThreshold === 'number' ? values.reconsumptionThreshold : parseFloat(values.reconsumptionThreshold),
        reconsumptionRequired: typeof values.reconsumptionRequired === 'number' ? values.reconsumptionRequired : parseFloat(values.reconsumptionRequired),
      };

      if (nppConfig) {
        // Update existing config
        const updated = await commissionConfigService.update(nppConfig.id, updateData);
        message.success('NPP config updated successfully');
        // Update local state immediately
        setNppConfig(updated);
        // Update form with new values
        nppForm.setFieldsValue({
          directRate: updated.directRate * 100,
          groupRate: updated.groupRate * 100,
          managementRateF1: updated.managementRateF1 * 100,
          managementRateF2: updated.managementRateF2 ? updated.managementRateF2 * 100 : null,
          managementRateF3: updated.managementRateF3 ? updated.managementRateF3 * 100 : null,
          packageValue: updated.packageValue,
          reconsumptionThreshold: updated.reconsumptionThreshold,
          reconsumptionRequired: updated.reconsumptionRequired,
        });
      } else {
        // Create new config if it doesn't exist
        const createData: CreateCommissionConfigDto = {
          packageType: 'NPP',
          ...updateData,
        };
        await commissionConfigService.create(createData);
        message.success('NPP config created successfully');
        await loadConfigs();
      }
    } catch (error: any) {
      message.error('Failed to save NPP config: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={2}>Commission Configuration</Title>
      <Text type="secondary">
        Configure commission rates and reconsumption requirements for CTV and NPP packages.
      </Text>
      <Divider />

      <Tabs defaultActiveKey="ctv">
        <TabPane tab="CTV (Cộng tác viên)" key="ctv">
          <Card title="CTV Configuration" loading={loading}>
            <Form
              form={ctvForm}
              layout="vertical"
              onFinish={handleCtvSubmit}
              initialValues={{
                directRate: 20,
                groupRate: 10,
                managementRateF1: 15,
                packageValue: 0.0001,
                reconsumptionThreshold: 0.001,
                reconsumptionRequired: 0.0001,
              }}
            >
              <Title level={4}>Commission Rates (%)</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="Direct Commission Rate"
                    name="directRate"
                    rules={[{ required: true, message: 'Please enter direct rate' }]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '';
                        const strValue = String(value);
                        if (strValue === '') return '';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '';
                        return `${num.toFixed(4)}%`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('%', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Group Commission Rate"
                    name="groupRate"
                    rules={[{ required: true, message: 'Please enter group rate' }]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '';
                        const strValue = String(value);
                        if (strValue === '') return '';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '';
                        return `${num.toFixed(4)}%`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('%', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Management Rate (F1)"
                    name="managementRateF1"
                    rules={[{ required: true, message: 'Please enter management rate' }]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '';
                        const strValue = String(value);
                        if (strValue === '') return '';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '';
                        return `${num.toFixed(4)}%`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('%', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Title level={4}>Package & Reconsumption</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="Package Value ($)"
                    name="packageValue"
                    rules={[{ required: true, message: 'Please enter package value' }]}
                  >
                    <InputNumber
                      min={0}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '$ ';
                        const strValue = String(value);
                        if (strValue === '') return '$ ';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '$ ';
                        return `$ ${num.toFixed(4)}`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('$ ', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Reconsumption Threshold ($)"
                    name="reconsumptionThreshold"
                    rules={[{ required: true, message: 'Please enter threshold' }]}
                  >
                    <InputNumber
                      min={0}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '$ ';
                        const strValue = String(value);
                        if (strValue === '') return '$ ';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '$ ';
                        return `$ ${num.toFixed(4)}`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('$ ', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Reconsumption Required ($)"
                    name="reconsumptionRequired"
                    rules={[{ required: true, message: 'Please enter required amount' }]}
                  >
                    <InputNumber
                      min={0}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '$ ';
                        const strValue = String(value);
                        if (strValue === '') return '$ ';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '$ ';
                        return `$ ${num.toFixed(4)}`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('$ ', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Save CTV Config
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="NPP (Nhà phân phối)" key="npp">
          <Card title="NPP Configuration" loading={loading}>
            <Form
              form={nppForm}
              layout="vertical"
              onFinish={handleNppSubmit}
              initialValues={{
                directRate: 25,
                groupRate: 15,
                managementRateF1: 15,
                managementRateF2: 10,
                managementRateF3: 10,
                packageValue: 0.001,
                reconsumptionThreshold: 0.01,
                reconsumptionRequired: 0.001,
              }}
            >
              <Title level={4}>Commission Rates (%)</Title>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item
                    label="Direct Commission Rate"
                    name="directRate"
                    rules={[{ required: true, message: 'Please enter direct rate' }]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '';
                        const strValue = String(value);
                        if (strValue === '') return '';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '';
                        return `${num.toFixed(4)}%`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('%', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="Group Commission Rate"
                    name="groupRate"
                    rules={[{ required: true, message: 'Please enter group rate' }]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '';
                        const strValue = String(value);
                        if (strValue === '') return '';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '';
                        return `${num.toFixed(4)}%`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('%', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="Management Rate (F1)"
                    name="managementRateF1"
                    rules={[{ required: true, message: 'Please enter management rate F1' }]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '';
                        const strValue = String(value);
                        if (strValue === '') return '';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '';
                        return `${num.toFixed(4)}%`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('%', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="Management Rate (F2)"
                    name="managementRateF2"
                    rules={[]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '';
                        const strValue = String(value);
                        if (strValue === '') return '';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '';
                        return `${num.toFixed(4)}%`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('%', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    label="Management Rate (F3)"
                    name="managementRateF3"
                    rules={[]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '';
                        const strValue = String(value);
                        if (strValue === '') return '';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '';
                        return `${num.toFixed(4)}%`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('%', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Title level={4}>Package & Reconsumption</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    label="Package Value ($)"
                    name="packageValue"
                    rules={[{ required: true, message: 'Please enter package value' }]}
                  >
                    <InputNumber
                      min={0}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '$ ';
                        const strValue = String(value);
                        if (strValue === '') return '$ ';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '$ ';
                        return `$ ${num.toFixed(4)}`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('$ ', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Reconsumption Threshold ($)"
                    name="reconsumptionThreshold"
                    rules={[{ required: true, message: 'Please enter threshold' }]}
                  >
                    <InputNumber
                      min={0}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '$ ';
                        const strValue = String(value);
                        if (strValue === '') return '$ ';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '$ ';
                        return `$ ${num.toFixed(4)}`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('$ ', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label="Reconsumption Required ($)"
                    name="reconsumptionRequired"
                    rules={[{ required: true, message: 'Please enter required amount' }]}
                  >
                    <InputNumber
                      min={0}
                      step={0.0001}
                      precision={4}
                      stringMode
                      formatter={(value) => {
                        if (!value) return '$ ';
                        const strValue = String(value);
                        if (strValue === '') return '$ ';
                        const num = parseFloat(strValue);
                        if (isNaN(num)) return '$ ';
                        return `$ ${num.toFixed(4)}`;
                      }}
                      parser={(value) => (parseFloat(value!.replace('$ ', '')) || 0) as any}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Save NPP Config
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default CommissionConfigPage;
