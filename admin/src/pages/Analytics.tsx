import React, { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import AnalyticsDashboardView from '../components/AnalyticsDashboardView';

const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Record<string, number>>({});
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number }[]>([]);
  const [orderData, setOrderData] = useState<{ date: string; count: number }[]>([]);
  const [userData, setUserData] = useState<{ date: string; count: number }[]>([]);
  const [topProducts, setTopProducts] = useState<
    { name: string; quantity: number; revenue: number }[]
  >([]);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewRes, revenueRes, orderRes, userRes, productsRes] = await Promise.all([
        adminService.getAnalyticsOverview(),
        adminService.getRevenueChart(days),
        adminService.getOrderChart(days),
        adminService.getUserGrowth(days),
        adminService.getTopProducts(5),
      ]);

      setOverview(overviewRes.data);
      setRevenueData(revenueRes.data);
      setOrderData(orderRes.data);
      setUserData(userRes.data);
      setTopProducts(productsRes.data);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnalyticsDashboardView
      title="Analytics Dashboard"
      loading={loading}
      overview={overview}
      revenueData={revenueData}
      orderData={orderData}
      userData={userData}
      topProducts={topProducts}
      days={days}
      onDaysChange={setDays}
    />
  );
};

export default Analytics;
