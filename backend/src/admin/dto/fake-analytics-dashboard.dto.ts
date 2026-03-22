/**
 * Shape stored in system_config.value (JSON) for admin-configurable demo analytics.
 */
export interface FakeAnalyticsDashboardPayload {
  overview: {
    totalRevenue: number;
    totalOrders: number;
    totalUsers: number;
    totalProducts: number;
  };
  series: {
    revenue: { date: string; revenue: number }[];
    orders: { date: string; count: number }[];
    users: { date: string; count: number }[];
  };
  topProducts: { name: string; quantity: number; revenue: number }[];
}
