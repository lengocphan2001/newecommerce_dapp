import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, message, Space, Spin, Tabs, Typography } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import AnalyticsDashboardView from '../components/AnalyticsDashboardView';
import {
  fakeAnalyticsService,
  FakeAnalyticsDashboardConfig,
} from '../services/fakeAnalyticsService';

const { Paragraph, Text } = Typography;

function sliceLast<T>(arr: T[] | undefined, days: number): T[] {
  if (!arr?.length) return [];
  const n = Math.min(days, arr.length);
  return arr.slice(-n);
}

const FakeAnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('view');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FakeAnalyticsDashboardConfig | null>(null);
  const [jsonDraft, setJsonDraft] = useState('');
  const [days, setDays] = useState(7);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fakeAnalyticsService.get();
      setConfig(data);
      setJsonDraft(JSON.stringify(data, null, 2));
    } catch {
      message.error('Failed to load demo analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const revenueData = useMemo(
    () => sliceLast(config?.series?.revenue, days),
    [config, days],
  );
  const orderData = useMemo(() => sliceLast(config?.series?.orders, days), [config, days]);
  const userData = useMemo(() => sliceLast(config?.series?.users, days), [config, days]);

  const handleSaveJson = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonDraft);
    } catch {
      message.error('Invalid JSON');
      return;
    }
    setSaving(true);
    try {
      const saved = await fakeAnalyticsService.save(parsed as FakeAnalyticsDashboardConfig);
      setConfig(saved);
      setJsonDraft(JSON.stringify(saved, null, 2));
      message.success('Saved');
      setActiveTab('view');
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadTemplate = async () => {
    try {
      const tpl = await fakeAnalyticsService.getDefaultTemplate();
      setJsonDraft(JSON.stringify(tpl, null, 2));
      message.info('Loaded default template — click Save to persist');
    } catch {
      message.error('Could not load default template');
    }
  };

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'view',
            label: 'Dashboard',
            children: (
              <Spin spinning={loading}>
                {config ? (
                  <AnalyticsDashboardView
                    title="Analytics (Demo)"
                    extra={
                      <Alert
                        type="info"
                        showIcon
                        message="Demo data"
                        description="Configure under JSON tab."
                        style={{ maxWidth: 360, margin: 0 }}
                      />
                    }
                    loading={false}
                    overview={config.overview}
                    revenueData={revenueData}
                    orderData={orderData}
                    userData={userData}
                    topProducts={config.topProducts}
                    days={days}
                    onDaysChange={setDays}
                  />
                ) : (
                  !loading && <Empty description="No data" />
                )}
              </Spin>
            ),
          },
          {
            key: 'edit',
            label: 'JSON config',
            children: (
              <Card>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    Structure: <Text code>overview</Text> (4 numbers), <Text code>series</Text> (
                    <Text code>revenue</Text>, <Text code>orders</Text>, <Text code>users</Text> arrays
                    of equal length), <Text code>topProducts</Text>. &quot;Last N days&quot; uses the
                    last N points from each series.
                  </Paragraph>
                  <Space wrap>
                    <Button icon={<ReloadOutlined />} onClick={loadConfig} disabled={loading}>
                      Reload from server
                    </Button>
                    <Button onClick={handleLoadTemplate}>Load default template</Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveJson}>
                      Save
                    </Button>
                  </Space>
                  <textarea
                    value={jsonDraft}
                    onChange={(e) => setJsonDraft(e.target.value)}
                    spellCheck={false}
                    style={{
                      width: '100%',
                      minHeight: 420,
                      fontFamily: 'monospace',
                      fontSize: 13,
                      padding: 12,
                      borderRadius: 6,
                      border: '1px solid #d9d9d9',
                    }}
                  />
                </Space>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default FakeAnalyticsDashboard;
