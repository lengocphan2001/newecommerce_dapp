"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";

interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

export default function ShippingAddressPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAddressData, setNewAddressData] = useState({
    name: "",
    phone: "",
    address: "",
    isDefault: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  // Prevent body scroll when modal is open (mobile optimization)
  useEffect(() => {
    if (showAddModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [showAddModal]);

  const loadAddresses = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t("pleaseLogin") || "Please login to view addresses");
        setLoading(false);
        return;
      }

      const data = await api.getAddresses();
      if (data && Array.isArray(data)) {
        setAddresses(data);
        initializeSelection(data);
      } else {
        setAddresses([]);
      }
    } catch (e: any) {
      setError(e.message || t("failedToLoadAddresses") || "Failed to load addresses");
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const initializeSelection = (list: Address[]) => {
    const selected = localStorage.getItem("selectedAddressId");
    if (selected && list.some(a => a.id === selected)) {
      setSelectedId(selected);
    } else if (list.length > 0) {
      setSelectedId(list[0].id);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handleConfirm = () => {
    const selected = addresses.find(a => a.id === selectedId);
    if (selected) {
      localStorage.setItem("selectedAddressId", selectedId);
      localStorage.setItem("shippingAddress", selected.address);
      localStorage.setItem("shippingUser", JSON.stringify({ name: selected.name, phone: selected.phone }));
      router.back();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t("confirmDeleteAddress"))) {
      try {
        await api.deleteAddress(id);
        // Reload addresses from backend
        await loadAddresses();
        // Update selected if needed
        if (selectedId === id) {
          const remaining = addresses.filter(a => a.id !== id);
          if (remaining.length > 0) {
            setSelectedId(remaining[0].id);
          } else {
            setSelectedId("");
          }
        }
      } catch (e: any) {
        alert(e.message || t("failedToDeleteAddress") || "Failed to delete address");
      }
    }
  };

  // Add/Edit Address Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAddressData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingId) {
        // UPDATE
        await api.updateAddress(editingId, newAddressData);
      } else {
        // CREATE
        await api.addAddress(newAddressData);
      }
      
      // Reload addresses from backend after add/update
      await loadAddresses();
      resetForm();
    } catch (e: any) {
      alert(e.message || t("failedToSaveAddress") || "Failed to save address");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewAddressData({ name: "", phone: "", address: "", isDefault: false });
    setEditingId(null);
    setShowAddModal(false);
    setIsSubmitting(false);
  };

  const openEditModal = (addr: Address) => {
    setNewAddressData({
      name: addr.name,
      phone: addr.phone,
      address: addr.address,
      isDefault: addr.isDefault
    });
    setEditingId(addr.id);
    setShowAddModal(true);
  };

  return (
    <div className="bg-[#f6f6f8] text-[#0d121b] min-h-screen flex flex-col font-display selection:bg-blue-100 selection:text-blue-900">
      {/* Header Section */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center p-1 text-[#135bec]"
          >
            <span className="material-symbols-outlined text-[28px]">arrow_back_ios_new</span>
          </button>
          <h1 className="text-lg font-bold tracking-tight">{t("addressTitle")}</h1>
        </div>
        <button onClick={handleConfirm} className="text-[#135bec] font-medium text-sm">{t("confirm")}</button>
      </header>

      {/* ... Content ... */}
      <main className="flex-1 overflow-y-auto pb-48">

        {/* Add New Address Button */}
        <div className="px-4 py-6">
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-[#135bec]/40 text-[#135bec] py-4 rounded-xl font-semibold hover:bg-[#135bec]/5 transition-colors active:scale-[0.99] shadow-sm"
          >
            <span className="material-symbols-outlined">add_circle</span>
            {t("addNewAddress")}
          </button>
        </div>

        {/* Address List Title */}
        <div className="px-4 mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("addressList")}</h2>
        </div>

        {/* Address Items */}
        <div className="space-y-4 px-4">
          {loading && (
            <div className="text-center py-10 text-gray-400">
              <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
              <p className="mt-2">{t("loading") || "Loading..."}</p>
            </div>
          )}
          
          {!loading && error && (
            <div className="text-center py-10">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => router.push('/home/profile')}
                className="text-[#135bec] font-medium"
              >
                {t("goToProfile") || "Go to Profile"}
              </button>
            </div>
          )}
          
          {!loading && !error && addresses.length === 0 && (
            <div className="text-center py-10">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">location_off</span>
              <p className="text-gray-400 mb-4">{t("noAddresses") || "No addresses found"}</p>
              <button
                onClick={() => { resetForm(); setShowAddModal(true); }}
                className="text-[#135bec] font-medium underline"
              >
                {t("addNewAddress") || "Add your first address"}
              </button>
            </div>
          )}
          
          {!loading && !error && addresses.map((addr) => {
            const isSelected = selectedId === addr.id;
            return (
              <div
                key={addr.id}
                onClick={() => handleSelect(addr.id)}
                className={`bg-white p-4 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border-l-4 relative transition-all cursor-pointer ${isSelected ? "border-[#135bec]" : "border-transparent"}`}
              >
                <div className="flex gap-4">
                  <div className="flex items-start pt-1">
                    <div className="relative">
                      <input
                        checked={isSelected}
                        onChange={() => { }}
                        className="h-5 w-5 text-[#135bec] border-gray-300 focus:ring-[#135bec]"
                        name="delivery_address"
                        type="radio"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-base">{addr.name}</span>
                      <span className="text-gray-400">|</span>
                      <span className="font-medium text-base">{addr.phone}</span>
                    </div>
                    {addr.isDefault && (
                      <div className="inline-flex items-center px-2 py-0.5 rounded bg-[#135bec]/10 text-[#135bec] text-[10px] font-bold uppercase mb-2">
                        {t("defaultAddress")}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {addr.address}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-50 flex justify-end gap-6" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEditModal(addr)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#135bec] transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                    {t("editAddress")}
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                    {t("remove")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex p-4 mt-10">
          <button
            onClick={handleConfirm}
            className="w-full bg-[#135bec] text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            {t("confirmAddress")}
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </main>

      {/* Floating Selection Confirm */}


      {/* Add/Edit Address Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            willChange: 'opacity',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              resetForm();
            }
          }}
        >
          <div 
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl"
            style={{
              transform: 'translateZ(0)',
              willChange: 'transform',
              WebkitOverflowScrolling: 'touch',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingId ? t("editAddress") : t("addNewAddress")}</h3>
              <button onClick={resetForm} className="p-1 rounded-full hover:bg-gray-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-4 space-y-4">
              {/* ... Form Inputs ... */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">{t("placeholderName")}</label>
                <input
                  name="name"
                  value={newAddressData.name}
                  onChange={handleInputChange}
                  required
                  autoComplete="name"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:border-[#135bec] focus:ring-2 focus:ring-[#135bec]/20 outline-none text-base"
                  style={{ 
                    WebkitAppearance: 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  placeholder={t("placeholderName")}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">{t("placeholderPhone")}</label>
                <input
                  name="phone"
                  type="tel"
                  value={newAddressData.phone}
                  onChange={handleInputChange}
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:border-[#135bec] focus:ring-2 focus:ring-[#135bec]/20 outline-none text-base"
                  style={{ 
                    WebkitAppearance: 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  placeholder={t("placeholderPhone")}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">{t("placeholderAddress")}</label>
                <textarea
                  name="address"
                  rows={3}
                  value={newAddressData.address}
                  onChange={handleInputChange}
                  required
                  autoComplete="street-address"
                  className="w-full p-4 rounded-xl border border-gray-200 bg-white focus:border-[#135bec] focus:ring-2 focus:ring-[#135bec]/20 outline-none resize-none text-base"
                  style={{ 
                    WebkitAppearance: 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  placeholder={t("placeholderAddress")}
                />
              </div>
              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  name="isDefault"
                  id="isDefaultModal"
                  checked={newAddressData.isDefault}
                  onChange={(e) => setNewAddressData(prev => ({ ...prev, isDefault: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-[#135bec] focus:ring-[#135bec]"
                />
                <label htmlFor="isDefaultModal" className="text-sm font-medium text-slate-700">{t("setAsDefault")}</label>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-[#135bec] text-white rounded-xl font-bold active:opacity-90 disabled:opacity-70 flex items-center justify-center gap-2 touch-manipulation"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  willChange: 'opacity',
                }}
              >
                {isSubmitting && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
                {editingId ? t("update") : t("saveAddress")}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
