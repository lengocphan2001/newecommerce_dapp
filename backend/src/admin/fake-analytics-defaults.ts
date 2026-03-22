import { FakeAnalyticsDashboardPayload } from './dto/fake-analytics-dashboard.dto';

export const FAKE_ANALYTICS_DASHBOARD_KEY = 'fake_analytics_dashboard';

/** Default demo analytics JSON (system_config) — shared by AdminService and db:init seed. */
export function getDefaultFakeAnalyticsDashboardPayload(): FakeAnalyticsDashboardPayload {
  const n = 30;
  const revenue: { date: string; revenue: number }[] = [];
  const orders: { date: string; count: number }[] = [];
  const users: { date: string; count: number }[] = [];
  for (let i = 0; i < n; i++) {
    const label = `D${i + 1}`;
    revenue.push({ date: label, revenue: Math.round(1200 + i * 80 + (i % 4) * 40) });
    orders.push({ date: label, count: Math.round(8 + (i % 7) * 3 + i * 0.4) });
    users.push({ date: label, count: Math.round(2 + (i % 5) + i * 0.15) });
  }
  return {
    overview: {
      totalRevenue: 128450.75,
      totalOrders: 3842,
      totalUsers: 2156,
      totalProducts: 48,
    },
    series: { revenue, orders, users },
    topProducts: [
      { name: 'Premium Package', quantity: 412, revenue: 48200 },
      { name: 'Starter Kit', quantity: 890, revenue: 26700 },
      { name: 'Addon Module', quantity: 1205, revenue: 18950 },
      { name: 'Membership', quantity: 340, revenue: 12400 },
      { name: 'Digital Course', quantity: 628, revenue: 9800 },
    ],
  };
}
