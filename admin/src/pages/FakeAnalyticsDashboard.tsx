import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, message, Space, Spin, Tabs, Typography } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import AnalyticsDashboardView from '../components/AnalyticsDashboardView';
import {
  fakeAnalyticsService,
  FakeAnalyticsDashboardConfig,
} from '../services/fakeAnalyticsService';

const { Text, Paragraph } = Typography;

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
      message.error('JSON không hợp lệ');
      return;
    }
    setSaving(true);
    try {
      const saved = await fakeAnalyticsService.save(parsed as FakeAnalyticsDashboardConfig);
      setConfig(saved);
      setJsonDraft(JSON.stringify(saved, null, 2));
      message.success('Đã lưu dữ liệu demo');
      setActiveTab('view');
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      message.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadTemplate = async () => {
    try {
      const tpl = await fakeAnalyticsService.getDefaultTemplate();
      setJsonDraft(JSON.stringify(tpl, null, 2));
      message.info('Đã nạp mẫu mặc định — bấm Lưu để ghi vào hệ thống');
    } catch {
      message.error('Không tải được mẫu mặc định');
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
            label: 'Xem dashboard',
            children: (
              <Spin spinning={loading}>
                {config ? (
                  <AnalyticsDashboardView
                    title="Analytics"
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
                  !loading && <Empty description="Không có dữ liệu" />
                )}
              </Spin>
            ),
          },
          {
            key: 'edit',
            label: 'C',
            children: (
              <Card>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    Cấu trúc: <Text code>overview</Text> (4 số), <Text code>series</Text> (mảng{' '}
                    <Text code>revenue</Text>, <Text code>orders</Text>, <Text code>users</Text> — cùng số điểm
                    thời gian), <Text code>topProducts</Text> (name, quantity, revenue). Bộ lọc &quot;Last N
                    days&quot; lấy N điểm cuối của mỗi chuỗi.
                  </Paragraph>
                  <Space wrap>
                    <Button icon={<ReloadOutlined />} onClick={loadConfig} disabled={loading}>
                      Tải lại từ server
                    </Button>
                    <Button onClick={handleLoadTemplate}>Nạp mẫu mặc định</Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveJson}>
                      Lưu
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
