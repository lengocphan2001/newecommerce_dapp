"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/services/api";

export default function AddAddressPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    isDefault: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, isDefault: e.target.checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!formData.name || !formData.phone || !formData.address) {
        setError("Vui lòng điền đầy đủ thông tin.");
        setLoading(false);
        return;
    }

    try {
        const newAddress = {
          id: Date.now().toString(), // Temp ID for fallback
          ...formData
        };

        // 1. Try API
        let success = false;
        try {
            await api.addAddress(newAddress);
            success = true;
        } catch(e) {
            console.warn("API add failed", e);
        }

        // 2. Fallback to LocalStorage
        const stored = localStorage.getItem("savedAddresses");
        const addresses = stored ? JSON.parse(stored) : [];
        if (formData.isDefault) {
            addresses.forEach((a: any) => a.isDefault = false);
        }
        addresses.push(newAddress);
        localStorage.setItem("savedAddresses", JSON.stringify(addresses));

        // If it's the first address or set as default, select it
        if (addresses.length === 1 || formData.isDefault) {
            localStorage.setItem("selectedAddressId", newAddress.id);
            localStorage.setItem("shippingAddress", newAddress.address);
        }
        
        router.back();

    } catch (err: any) {
        setError(err.message || "Có lỗi xảy ra");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="bg-[#f6f6f8] text-[#0d121b] min-h-screen flex flex-col font-display">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
             onClick={() => router.back()}
             className="flex items-center justify-center p-1 text-[#135bec]"
          >
            <span className="material-symbols-outlined text-[28px]">arrow_back_ios_new</span>
          </button>
          <h1 className="text-lg font-bold tracking-tight">Thêm địa chỉ mới</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto p-4 pb-32">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
             <div>
                <label className="block text-sm font-semibold mb-1">Họ và tên</label>
                <input 
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full rounded-xl border-gray-200 focus:border-[#135bec] focus:ring-[#135bec]"
                    placeholder="Nhập họ tên người nhận"
                />
             </div>
             <div>
                <label className="block text-sm font-semibold mb-1">Số điện thoại</label>
                <input 
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full rounded-xl border-gray-200 focus:border-[#135bec] focus:ring-[#135bec]"
                    placeholder="Nhập số điện thoại"
                    type="tel"
                />
             </div>
             <div>
                <label className="block text-sm font-semibold mb-1">Địa chỉ chi tiết</label>
                <textarea 
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={3}
                    className="w-full rounded-xl border-gray-200 focus:border-[#135bec] focus:ring-[#135bec]"
                    placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                />
             </div>
             
             <div className="flex items-center gap-2 pt-2">
                <input 
                    id="isDefault"
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={handleCheckboxChange}
                    className="rounded text-[#135bec] focus:ring-[#135bec] w-5 h-5 border-gray-300"
                />
                <label htmlFor="isDefault" className="text-sm font-medium">Đặt làm địa chỉ mặc định</label>
             </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center px-2">{error}</p>}

          <button
             type="submit"
             disabled={loading}
             className="w-full bg-[#135bec] text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform disabled:opacity-70"
          >
             {loading ? "Đang lưu..." : "Lưu địa chỉ"}
          </button>
        </form>
      </main>
    </div>
  );
}
