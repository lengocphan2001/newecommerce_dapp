"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import BottomNav from "@/app/components/BottomNav";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";

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
  fromUsername?: string;
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

  // Helper function to format datetime - must be defined before use
  // Only formats valid dates from createdAt, no fallback to current date
  const formatDateTime = (dateInput: string | null | undefined | Date | any) => {
    if (!dateInput) return '';
    
    // Skip empty objects (like {} from backend before fix)
    if (typeof dateInput === 'object' && !(dateInput instanceof Date)) {
      if (Object.keys(dateInput).length === 0) {
        return ''; // Empty object {}
      }
      // Try to get date from object properties if available
      if (dateInput.$date) {
        dateInput = dateInput.$date;
      } else {
        return '';
      }
    }
    
    try {
      let date: Date;
      
      // Handle different input types
      if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else {
        return '';
      }
      
      if (isNaN(date.getTime())) {
        // Return empty string if date is invalid - don't fallback to current date
        return '';
      }
      
      // Format: "DD/MM/YYYY HH:mm"
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      // Return empty string on error - don't fallback to current date
      return '';
    }
  };

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
      } catch (err: any) {
        // Check if it's an authentication error and redirect
        if (handleAuthError(err, router)) {
          return; // Redirect is happening
        }
      }

      // Fetch referral info (commissions)
      try {
        const info = await api.getReferralInfo();
        setReferralInfo(info);
      } catch (err: any) {
        // Check if it's an authentication error and redirect
        if (handleAuthError(err, router)) {
          return; // Redirect is happening
        }
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
      // Only use createdAt if it's valid, otherwise use current date for sorting only
      let orderDate: Date;
      let hasValidDate = false;
      try {
        if (order.createdAt) {
          orderDate = new Date(order.createdAt);
          if (!isNaN(orderDate.getTime())) {
            hasValidDate = true;
          } else {
            orderDate = new Date(); // Only for sorting, won't be displayed
          }
        } else {
          orderDate = new Date(); // Only for sorting, won't be displayed
        }
      } catch {
        orderDate = new Date(); // Only for sorting, won't be displayed
      }
      
      // Format datetime from original createdAt, not from orderDate
      const datetimeStr = formatDateTime(order.createdAt);
      allActivities.push({
        id: order.id,
        type: 'shopping',
        title: t("successfulTransaction"),
        description: datetimeStr ? `${datetimeStr} • ${t("orderNumber")} #${order.id.slice(-8).toUpperCase()}` : `${t("orderNumber")} #${order.id.slice(-8).toUpperCase()}`,
        amount: -totalAmount,
        amountLabel: totalAmount > 0 ? `-$${Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 18 })}` : '$0',
        status: order.status === 'delivered' || order.status === 'confirmed' ? 'Hoàn tất' : t("pending"),
        statusColor: order.status === 'delivered' || order.status === 'confirmed' ? 'text-green-500' : 'text-gray-500',
        icon: 'shopping_bag',
        iconColor: 'text-primary',
        iconBgColor: 'bg-primary/10',
        date: orderDate,
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
        
        // Use the same simple logic as order items
        let activityDate: Date;
        try {
          if (activity.createdAt) {
            activityDate = new Date(activity.createdAt);
            if (isNaN(activityDate.getTime())) {
              activityDate = new Date(); // Only for sorting, won't be displayed
            }
          } else {
            activityDate = new Date(); // Only for sorting, won't be displayed
          }
        } catch {
          activityDate = new Date(); // Only for sorting, won't be displayed
        }
        
        // Format datetime from original createdAt, not from activityDate (same as orders)
        const datetimeStr = formatDateTime(activity.createdAt);
        const fromMemberInfo = activity.fromUsername 
          ? `${t("fromMember")}: ${activity.fromUsername}` 
          : (activity.fromUserId ? `${t("fromMember")}: ${activity.fromUserId.slice(-6)}` : '');
        
        const description = datetimeStr 
          ? `${datetimeStr} • ${fromMemberInfo}` 
          : fromMemberInfo;
        
        allActivities.push({
          id: activity.id,
          type: 'commission',
          title: commissionType, // Use the calculated commissionType directly
          description: description,
          amount: parseFloat(activity.amount),
          amountLabel: `+$${Number(activity.amount).toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 18 })}`,
          status: 'Đã cộng',
          statusColor: 'text-primary',
          icon: activityType === 'GROUP' ? 'account_tree' : 'card_membership',
          iconColor: activityType === 'GROUP' ? 'text-amber-500' : 'text-amber-500',
          iconBgColor: activityType === 'GROUP' ? 'bg-amber-500/10' : 'bg-amber-500/10',
          date: activityDate,
          fromUserId: activity.fromUserId,
          fromUsername: activity.fromUsername,
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
        // Format datetime from original connectTime, not from connectDate
        const connectDateTimeStr = formatDateTime(connectTime);
        const addressInfo = `${t("address")}: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
        
        allActivities.push({
          id: 'wallet-connect',
          type: 'system',
          title: t("walletConnect"),
          description: connectDateTimeStr ? `${connectDateTimeStr} • ${addressInfo}` : addressInfo,
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

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const formatDate = (date: Date) => {
    try {
      if (!date || isNaN(date.getTime())) {
        // If date is invalid, try to use current date but still format it properly
        const now = new Date();
        const day = now.getDate();
        const month = now.toLocaleDateString('vi-VN', { month: 'long' });
        return `Ngày ${day} ${month.charAt(0).toUpperCase() + month.slice(1)}`;
      }
      
      // Always format as "Ngày X Tháng Y" (e.g., "Ngày 7 Tháng 1")
      const day = date.getDate();
      const month = date.toLocaleDateString('vi-VN', { month: 'long' });
      return `Ngày ${day} ${month.charAt(0).toUpperCase() + month.slice(1)}`;
    } catch {
      // Fallback: use current date formatted
      const now = new Date();
      const day = now.getDate();
      const month = now.toLocaleDateString('vi-VN', { month: 'long' });
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
    // Sort by date descending (newest first)
    // Parse dates from "Ngày X Tháng Y" format for proper sorting
    try {
      const parseDateFromString = (dateStr: string): Date => {
        // Extract day and month from "Ngày X Tháng Y" format
        const match = dateStr.match(/Ngày (\d+) Tháng (\w+)/);
        if (match) {
          const day = parseInt(match[1], 10);
          const monthName = match[2].toLowerCase();
          const monthMap: Record<string, number> = {
            'một': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'năm': 5, 'sáu': 6,
            'bảy': 7, 'tám': 8, 'chín': 9, 'mười': 10, 'mười một': 11, 'mười hai': 12,
            'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
            'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
          };
          const month = monthMap[monthName] || new Date().getMonth() + 1;
          const year = new Date().getFullYear();
          return new Date(year, month - 1, day);
        }
        return new Date();
      };
      
      const dateA = parseDateFromString(a);
      const dateB = parseDateFromString(b);
      return dateB.getTime() - dateA.getTime(); // Descending order
    } catch {
      // Fallback to string comparison
      return b.localeCompare(a);
    }
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
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-blue-100 shadow-[0_1px_3px_rgba(37,99,235,0.05)]">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => router.back()}
            className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-blue-50 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-800">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900">{t("activityHistory")}</h1>
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center p-2 -mr-2 rounded-full hover:bg-blue-50 transition-colors">
              <span className="material-symbols-outlined text-slate-800">filter_list</span>
            </button>
          </div>
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
