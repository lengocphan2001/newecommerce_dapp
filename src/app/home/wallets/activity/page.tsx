"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import BottomNav from "@/app/components/BottomNav";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";

interface ActivityItem {
  id: string;
  type: 'shopping' | 'commission' | 'system';
  title: string;
  description: string;
  amount?: number;
  amountLabel?: string;
  status?: string;
  statusColor?: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  date: Date;
  orderId?: string;
  fromUserId?: string;
}

type TabType = 'all' | 'shopping' | 'commission' | 'system';

export default function ActivityPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [referralInfo, setReferralInfo] = useState<any>(null);

  useEffect(() => {
    fetchActivityData();
  }, []);

  const fetchActivityData = async () => {
    try {
      setLoading(true);
      
      // Fetch orders
      try {
        const ordersData = await api.getOrders();
        const ordersList = Array.isArray(ordersData) ? ordersData : (ordersData?.data || []);
        setOrders(ordersList);
      } catch (err) {
      }

      // Fetch referral info (commissions)
      try {
        const info = await api.getReferralInfo();
        setReferralInfo(info);
      } catch (err) {
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  // Transform data into activity items
  useEffect(() => {
    const allActivities: ActivityItem[] = [];

    // Add shopping activities (orders)
    orders.forEach((order: any) => {
      const totalAmount = parseFloat(order.totalAmount) || 0;
      allActivities.push({
        id: order.id,
        type: 'shopping',
        title: t("successfulTransaction"),
        description: `${formatTime(order.createdAt)} • ${t("orderNumber")} #${order.id.slice(-8).toUpperCase()}`,
        amount: -totalAmount,
        amountLabel: totalAmount > 0 ? `-$${Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 18 })}` : '$0',
        status: order.status === 'delivered' || order.status === 'confirmed' ? 'Hoàn tất' : t("pending"),
        statusColor: order.status === 'delivered' || order.status === 'confirmed' ? 'text-green-500' : 'text-gray-500',
        icon: 'shopping_bag',
        iconColor: 'text-primary',
        iconBgColor: 'bg-primary/10',
        date: new Date(order.createdAt),
        orderId: order.id,
      });
    });

    // Add commission activities
    if (referralInfo?.recentActivity) {
      referralInfo.recentActivity.forEach((activity: any) => {
        // Normalize activity type to handle both uppercase and lowercase
        const activityType = String(activity.type || '').toUpperCase();
        
        // Determine commission type label
        const commissionType = activityType === 'DIRECT' 
          ? t("directCommission")
          : activityType === 'GROUP' 
          ? t("groupCommission")
          : t("managementCommission");
        
        allActivities.push({
          id: activity.id,
          type: 'commission',
          title: commissionType, // Use the calculated commissionType directly
          description: `${formatTime(activity.createdAt)} • ${activity.fromUserId ? `${t("fromMember")} ${activity.fromUserId.slice(-6)}` : ''}`,
          amount: parseFloat(activity.amount),
          amountLabel: `+$${Number(activity.amount).toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 18 })}`,
          status: 'Đã cộng',
          statusColor: 'text-primary',
          icon: activityType === 'GROUP' ? 'account_tree' : 'card_membership',
          iconColor: activityType === 'GROUP' ? 'text-amber-500' : 'text-amber-500',
          iconBgColor: activityType === 'GROUP' ? 'bg-amber-500/10' : 'bg-amber-500/10',
          date: new Date(activity.createdAt),
          fromUserId: activity.fromUserId,
        });
      });
    }

    // Add system activities (wallet connect, profile update, etc.)
    if (typeof window !== 'undefined') {
      const walletAddress = localStorage.getItem('walletAddress');
      if (walletAddress) {
        // Add wallet connect activity
        const connectTime = localStorage.getItem('walletConnectTime');
        const connectDate = connectTime ? new Date(connectTime) : new Date();
        allActivities.push({
          id: 'wallet-connect',
          type: 'system',
          title: t("walletConnect"),
          description: `${formatTime(connectDate.toISOString())} • ${t("address")}: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
          status: t("verified"),
          statusColor: 'text-green-600',
          icon: 'account_balance_wallet',
          iconColor: 'text-indigo-500',
          iconBgColor: 'bg-indigo-500/10',
          date: connectDate,
        });
      }
    }

    // Sort by date descending
    allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    setActivities(allActivities);
  }, [orders, referralInfo, t]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const activityDate = new Date(date);
    activityDate.setHours(0, 0, 0, 0);

    if (activityDate.getTime() === today.getTime()) {
      return t("today");
    } else if (activityDate.getTime() === yesterday.getTime()) {
      return t("yesterday");
    } else {
      // Format: "Ngày 18 Tháng 10"
      const day = date.getDate();
      const month = date.toLocaleDateString('vi-VN', { month: 'long' });
      return `Ngày ${day} ${month.charAt(0).toUpperCase() + month.slice(1)}`;
    }
  };

  // Filter activities by tab
  const filteredActivities = activities.filter((activity) => {
    if (activeTab === 'all') return true;
    return activity.type === activeTab;
  });

  // Group activities by date
  const groupedActivities = filteredActivities.reduce((acc, activity) => {
    const dateKey = formatDate(activity.date);
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(activity);
    return acc;
  }, {} as Record<string, ActivityItem[]>);

  const dateGroups = Object.keys(groupedActivities).sort((a, b) => {
    // Sort: today first, then yesterday, then by date
    if (a === t("today")) return -1;
    if (b === t("today")) return 1;
    if (a === t("yesterday")) return -1;
    if (b === t("yesterday")) return 1;
    return b.localeCompare(a);
  });

  if (loading) {
    return (
      <div className="flex flex-col bg-background-light min-h-screen">
        <AppHeader titleKey="activityHistory" />
        <main className="flex-1 pb-24 flex items-center justify-center">
          <p className="text-gray-500">{t("loading")}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background-light min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#cfd7e7]">
        <div className="flex items-center p-4 pb-2 justify-between">
          <button
            onClick={() => router.back()}
            className="flex size-12 items-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-primary text-[28px]">arrow_back_ios</span>
          </button>
          <h2 className="text-[#0d121b] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
            {t("activityHistory")}
          </h2>
          <button className="flex size-12 cursor-pointer items-center justify-center rounded-lg bg-transparent text-[#0d121b]">
            <span className="material-symbols-outlined text-[24px]">filter_list</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4">
          <div className="flex gap-6 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex flex-col items-center justify-center border-b-[3px] pb-[10px] pt-2 shrink-0 ${
                activeTab === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[#4c669a]'
              }`}
            >
              <p className="text-sm font-bold leading-normal tracking-[0.015em]">{t("all")}</p>
            </button>
            <button
              onClick={() => setActiveTab('shopping')}
              className={`flex flex-col items-center justify-center border-b-[3px] pb-[10px] pt-2 shrink-0 ${
                activeTab === 'shopping'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[#4c669a]'
              }`}
            >
              <p className="text-sm font-bold leading-normal tracking-[0.015em]">{t("shopping")}</p>
            </button>
            <button
              onClick={() => setActiveTab('commission')}
              className={`flex flex-col items-center justify-center border-b-[3px] pb-[10px] pt-2 shrink-0 ${
                activeTab === 'commission'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[#4c669a]'
              }`}
            >
              <p className="text-sm font-bold leading-normal tracking-[0.015em]">{t("commission")}</p>
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`flex flex-col items-center justify-center border-b-[3px] pb-[10px] pt-2 shrink-0 ${
                activeTab === 'system'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[#4c669a]'
              }`}
            >
              <p className="text-sm font-bold leading-normal tracking-[0.015em]">{t("system")}</p>
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-col pb-24">
        {dateGroups.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-gray-500">{t("noRecentActivity")}</p>
          </div>
        ) : (
          dateGroups.map((dateKey, dateIndex) => (
            <div key={dateKey}>
              <h3 className={`text-[#0d121b] text-base font-bold leading-tight tracking-[-0.015em] px-4 pb-3 ${
                dateIndex === 0 ? 'pt-6' : 'pt-8'
              }`}>
                {dateKey}
              </h3>
              <div className="bg-white mx-4 rounded-xl overflow-hidden shadow-sm">
                {groupedActivities[dateKey].map((activity, index) => (
                  <div
                    key={activity.id}
                    className={`flex items-center gap-4 px-4 min-h-[72px] py-3 justify-between ${
                      index < groupedActivities[dateKey].length - 1
                        ? 'border-b border-[#f0f2f5]'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`${activity.iconBgColor} ${activity.iconColor} flex items-center justify-center rounded-xl shrink-0 size-12`}>
                        <span className="material-symbols-outlined">{activity.icon}</span>
                      </div>
                      <div className="flex flex-col justify-center">
                        <p className="text-[#0d121b] text-base font-semibold leading-normal line-clamp-1">
                          {activity.title}
                        </p>
                        <p className="text-[#4c669a] text-xs font-normal leading-normal">
                          {activity.description}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {activity.amount !== undefined && (
                        <>
                          <p className={`text-base font-bold leading-normal ${
                            activity.amount > 0 ? 'text-primary' : 'text-[#0d121b]'
                          }`}>
                            {activity.amountLabel || `${activity.amount >= 0 ? '+' : '-'}$${Number(Math.abs(activity.amount)).toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 18 })}`}
                          </p>
                          {activity.status && (
                            <span className={`text-[10px] font-bold uppercase ${activity.statusColor || 'text-green-500'}`}>
                              {activity.status}
                            </span>
                          )}
                        </>
                      )}
                      {activity.status && !activity.amount && (
                        <span className={`px-2 py-1 rounded bg-green-100 text-green-600 text-[10px] font-bold uppercase`}>
                          {activity.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
