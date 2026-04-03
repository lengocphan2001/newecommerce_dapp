const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

import { apiCache } from './apiCache';

export const api = {
  async checkWallet(address: string) {
    const response = await fetch(`${API_BASE_URL}/auth/wallet/check?address=${encodeURIComponent(address)}`);
    if (!response.ok) {
      throw new Error('Failed to check wallet');
    }
    return response.json();
  },

  async isFirstUser() {
    const response = await fetch(`${API_BASE_URL}/auth/registration/is-first-user`);
    if (!response.ok) {
      throw new Error('Failed to check if first user');
    }
    return response.json();
  },

  async walletRegister(data: {
    walletAddress: string;
    chainId: string;
    username: string;
    fullName: string;
    country: string;
    address?: string;
    phoneNumber: string;
    email?: string;
    referralUser?: string;
    leg?: 'left' | 'right';
  }) {
    // Debug: Log what we're sending

    const response = await fetch(`${API_BASE_URL}/auth/wallet/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  },

  async walletLogin(walletAddress: string) {
    const response = await fetch(`${API_BASE_URL}/auth/wallet/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Wallet login failed');
    }

    return response.json();
  },

  /** Web2 bước 1: username + password → gửi mã email (requiresEmailOtp) */
  async usernameLogin(username: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/username-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: username.trim(), password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Invalid username or password');
    }

    return response.json();
  },

  /** Web2 bước 2: nhập mã 6 số từ email → JWT */
  async usernameLoginVerify(username: string, password: string, code: string) {
    const response = await fetch(`${API_BASE_URL}/auth/username-login/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim(),
        password,
        code: code.trim(),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Xác thực thất bại');
    }

    return response.json();
  },

  /** Đăng ký bằng username + password (không cần ví) */
  async usernameRegister(data: {
    username: string;
    password: string;
    fullName?: string;
    phoneNumber: string;
    referralUser?: string;
    leg?: 'left' | 'right';
  }) {
    const response = await fetch(`${API_BASE_URL}/auth/username-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Registration failed');
    }
    return response.json();
  },

  async getProducts(country?: 'VIETNAM' | 'USA', categoryId?: string): Promise<unknown> {
    const cacheKey = `products:${country ?? 'all'}:${categoryId ?? 'all'}`;
    const cached = apiCache.getProducts(cacheKey);
    if (cached != null) return cached;
    const params = new URLSearchParams();
    if (country) {
      params.append('country', country);
    }
    if (categoryId) {
      params.append('categoryId', categoryId);
    }
    const url = params.toString()
      ? `${API_BASE_URL}/products?${params.toString()}`
      : `${API_BASE_URL}/products`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    const data = await response.json();
    apiCache.setProducts(cacheKey, data);
    return data;
  },

  /** Products marked "Featured on home" for the home page image strip */
  async getFeaturedProducts() {
    const response = await fetch(`${API_BASE_URL}/products?featuredOnHome=true`);
    if (!response.ok) {
      throw new Error('Failed to fetch featured products');
    }
    return response.json();
  },

  async getCategories(): Promise<unknown[]> {
    const cached = apiCache.get('categories');
    if (cached != null) return cached as unknown[];
    const response = await fetch(`${API_BASE_URL}/categories`);
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    const data = await response.json();
    apiCache.set('categories', data);
    return data;
  },

  async getSliders(activeOnly: boolean = true): Promise<unknown[]> {
    const cacheKey = 'sliders';
    const cached = apiCache.get(cacheKey);
    if (cached != null) return cached as unknown[];
    const url = `${API_BASE_URL}/sliders?activeOnly=${activeOnly}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch sliders');
    }
    const data = await response.json();
    apiCache.set(cacheKey, data);
    return data;
  },

  async getProduct(id: string) {
    const response = await fetch(`${API_BASE_URL}/products/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch product');
    }
    return response.json();
  },

  /** Một request thay cho N lần getProduct (ảnh dòng đơn hàng). */
  async getProductThumbnails(
    productIds: string[],
  ): Promise<Record<string, string>> {
    const unique = [...new Set(productIds.filter(Boolean))].slice(0, 50);
    if (unique.length === 0) {
      return {};
    }
    const qs = new URLSearchParams();
    qs.set('ids', unique.join(','));
    const response = await fetch(
      `${API_BASE_URL}/products/thumbnails?${qs.toString()}`,
    );
    if (!response.ok) {
      return {};
    }
    return response.json();
  },

  async checkReferral(username: string) {
    const response = await fetch(`${API_BASE_URL}/auth/referral/check?username=${encodeURIComponent(username)}`);
    if (!response.ok) {
      throw new Error('Failed to check referral');
    }
    return response.json();
  },

  async getReferralInfo() {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetch(`${API_BASE_URL}/auth/referral/info`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        apiCache.invalidate('referralInfo');
        throw new Error('Authentication expired. Please reconnect your wallet.');
      }
      const error = await response.json().catch(() => ({ message: 'Failed to get referral info' }));
      throw new Error(error.message || 'Failed to get referral info');
    }
    const data = await response.json();
    if (typeof window !== 'undefined' && window.location?.origin) {
      const base = window.location.origin;
      const rewrite = (url: string) => (url && typeof url === 'string') ? url.replace(/^https?:\/\/[^/]+/, base) : url;
      if (data.referralLink) data.referralLink = rewrite(data.referralLink);
      if (data.leftLink) data.leftLink = rewrite(data.leftLink);
      if (data.rightLink) data.rightLink = rewrite(data.rightLink);
    }
    return data;
  },

  /** Matrix reward pool — cấu hình công khai (cần đăng nhập). */
  async getMatrixRewardConfig() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/matrix-reward/config`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to load matrix config');
    }
    return response.json();
  },

  /** Vị trí của user trên các cây matrix + tổng nhận theo từng cây. */
  async getMatrixRewardMe() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/matrix-reward/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to load matrix positions');
    }
    return response.json();
  },

  async checkReconsumption() {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetch(`${API_BASE_URL}/auth/reconsumption/check`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Authentication expired. Please reconnect your wallet.');
      }
      const error = await response.json().catch(() => ({ message: 'Failed to check reconsumption status' }));
      throw new Error(error.message || 'Failed to check reconsumption status');
    }
    return response.json();
  },

  async getChildren(userId: string, position?: 'left' | 'right') {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (position) params.append('position', position);
    const response = await fetch(`${API_BASE_URL}/auth/referral/children?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Authentication expired. Please reconnect your wallet.');
      }
      const error = await response.json().catch(() => ({ message: 'Failed to get children' }));
      throw new Error(error.message || 'Failed to get children');
    }
    return response.json();
  },

  /** Danh sách F1 (người giới thiệu trực tiếp) kèm hiệu suất (số F1 của từng người). */
  async getF1List(): Promise<Array<{
    id: string;
    username: string | null;
    fullName: string;
    email: string;
    packageType: string;
    createdAt: string;
    directReferralCount: number;
  }>> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetch(`${API_BASE_URL}/auth/referral/f1`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        throw new Error('Authentication expired. Please reconnect your wallet.');
      }
      const error = await response.json().catch(() => ({ message: 'Failed to get F1 list' }));
      throw new Error(error.message || 'Failed to get F1 list');
    }
    return response.json();
  },

  /** Public: get banking config for checkout (no auth). Cached 5 min. */
  async getBankingConfig(): Promise<{
    id?: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
    bankId?: string;
    qrImageUrl?: string;
    isEnabled: boolean;
    usdtPriceVnd?: number | null;
    /** USDT→VND for withdraw UI only (admin Banking Settings). */
    usdtWithdrawPriceVnd?: number | null;
    usdtEnabled?: boolean;
    usdtWalletAddress?: string;
    usdtNetwork?: string;
    usdtQrImageUrl?: string;
    updatedAt?: string;
  }> {
    const cached = apiCache.get<Awaited<ReturnType<typeof api.getBankingConfig>>>('bankingConfig');
    if (cached) return cached;

    const response = await fetch(`${API_BASE_URL}/admin/banking-config`);
    if (!response.ok) {
      throw new Error('Failed to fetch banking config');
    }
    const data = await response.json();
    apiCache.set('bankingConfig', data);
    return data;
  },

  async createOrder(
    items: Array<{ productId: string; quantity: number; properties?: { [key: string]: string } }>,
    transactionHash?: string,
    shippingAddress?: string,
    paymentMethod?: 'wallet' | 'banking' | 'deposit_wallet' | 'usdt',
    options?: { shippingPhone?: string; shippingName?: string }
  ) {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const body: Record<string, unknown> = { items, transactionHash, shippingAddress, paymentMethod };
    if (options?.shippingPhone != null) body.shippingPhone = options.shippingPhone;
    if (options?.shippingName != null) body.shippingName = options.shippingName;
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create order');
    }
    return response.json();
  },

  async confirmPayment(orderId: string, transactionHash: string, options?: { timeoutMs?: number }) {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const timeoutMs = options?.timeoutMs ?? 25000; // 25s default so backend has time to finish
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ transactionHash }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to confirm payment');
      }
      return response.json();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('CONFIRM_TIMEOUT');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async getOrders(
    userId?: string,
    options?: { limit?: number },
  ) {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const params = new URLSearchParams();
    if (userId) {
      params.set('userId', userId);
    }
    if (options?.limit != null && options.limit > 0) {
      params.set('limit', String(Math.min(options.limit, 100)));
    }
    const qs = params.toString();
    const url = qs
      ? `${API_BASE_URL}/orders?${qs}`
      : `${API_BASE_URL}/orders`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }
    return response.json();
  },

  async getOrder(id: string) {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch order');
    }
    return response.json();
  },
  async uploadAvatar(file: File): Promise<string> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/uploads/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      let message = 'Failed to upload avatar';
      try {
        const json = JSON.parse(text);
        message = json.message || message;
      } catch {
        message = text || message;
      }
      throw new Error(message);
    }

    const result = await response.json();
    return result.url;
  },

  async updateProfile(data: { fullName?: string; email?: string; phoneNumber?: string; avatar?: string; walletAddress?: string }) {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      // Fallback for simulation if backend endpoint doesn't exist yet
      if (response.status === 404) {
        return { success: true };
      }
      const text = await response.text();
      let message = 'Failed to update profile';
      try {
        const json = JSON.parse(text);
        message = json.message || message;
      } catch (e) { }
      throw new Error(message);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  },

  /** Đổi mật khẩu (yêu cầu mật khẩu hiện tại) */
  async changePassword(currentPassword: string, newPassword: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Đổi mật khẩu thất bại');
    }
    return response.json();
  },

  /** Ví nạp tiền (banking): số dư */
  async getWalletBalance() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to get wallet balance');
    return response.json();
  },

  /** Ví rút tiền: số dư */
  async getWithdrawWalletBalance() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/wallet/withdraw-balance`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to get withdraw wallet balance');
    return response.json();
  },

  /** Ví nạp tiền: danh sách yêu cầu nạp của tôi */
  async getMyDepositRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const url = status ? `${API_BASE_URL}/wallet/deposit-requests?status=${status}` : `${API_BASE_URL}/wallet/deposit-requests`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) throw new Error('Failed to get deposit requests');
    return response.json();
  },

  /** Ví nạp tiền: tạo yêu cầu nạp (số tiền VND đã chuyển, admin sẽ tính USDT theo tỉ giá) */
  async createDepositRequest(data: { amountVnd: number; proofImageUrl?: string; transferNote?: string }) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/wallet/deposit-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Tạo yêu cầu nạp thất bại');
    }
    return response.json();
  },

  /** Upload ảnh chứng từ chuyển khoản (cho nạp ví) */
  async uploadDepositProof(file: File): Promise<{ url: string }> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/uploads/deposit-proof`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) throw new Error('Upload ảnh thất bại');
    return response.json();
  },

  async getMyBankAccounts() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/wallet/bank-accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to get bank accounts');
    return response.json();
  },

  async createBankAccount(data: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    bankCode?: string;
    isDefault?: boolean;
  }) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/wallet/bank-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create bank account');
    }
    return response.json();
  },

  async updateBankAccount(id: string, data: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    bankCode?: string;
    isDefault?: boolean;
  }) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/wallet/bank-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update bank account');
    }
    return response.json();
  },

  async deleteBankAccount(id: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/wallet/bank-accounts/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Authentication expired');
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete bank account');
    }
    return response.json();
  },

  async createWithdrawRequest(data: {
    amount: number;
    method: 'USDT' | 'BANKING';
    bankAccountId?: string;
    note?: string;
  }) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/wallet/withdraw-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create withdraw request');
    }
    return response.json();
  },

  async getMyWithdrawRequests(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const url = status
      ? `${API_BASE_URL}/wallet/withdraw-requests?status=${status}`
      : `${API_BASE_URL}/wallet/withdraw-requests`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) throw new Error('Failed to get withdraw requests');
    return response.json();
  },

  async getAddresses() {
    const token = localStorage.getItem('token');
    if (!token) return []; // Allow guest/local mode
    const response = await fetch(`${API_BASE_URL}/user/addresses`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      if (response.status === 404) return []; // Fallback
      throw new Error('Failed to fetch addresses');
    }
    return response.json();
  },

  async addAddress(data: any) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error("Not authenticated");
    const response = await fetch(`${API_BASE_URL}/user/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      if (response.status === 404) return { success: true }; // Fallback
      throw new Error('Failed to add address');
    }
    return response.json();
  },

  async updateAddress(id: string, data: any) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error("Not authenticated");
    const response = await fetch(`${API_BASE_URL}/user/addresses/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      if (response.status === 404) return { success: true }; // Fallback
      throw new Error('Failed to update address');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  },

  async deleteAddress(id: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error("Not authenticated");
    const response = await fetch(`${API_BASE_URL}/user/addresses/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      if (response.status === 404) return { success: true }; // Fallback
      throw new Error('Failed to delete address');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  },

  async getCommissionConfig(packageType: string) {
    const response = await fetch(`${API_BASE_URL}/auth/commission-config/${packageType}`);
    if (!response.ok) {
      // Fallback to defaults
      return { packageValue: 0 };
    }
    return response.json();
  },

  async getPackages() {
    const response = await fetch(`${API_BASE_URL}/packages`);
    if (!response.ok) {
      return [];
    }
    return response.json();
  },

  async getActivePackages() {
    const response = await fetch(`${API_BASE_URL}/packages/active`);
    if (!response.ok) {
      return [];
    }
    return response.json();
  },

  async purchasePackage(packageId: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/package-purchases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ packageId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to request package purchase');
    }
    return response.json();
  },

  async getMyPackagePurchases() {
    const token = localStorage.getItem('token');
    if (!token) return [];
    const response = await fetch(`${API_BASE_URL}/package-purchases/my`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return [];
    return response.json();
  },

  async confirmPackagePayment(purchaseId: string, transactionHash: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/package-purchases/${purchaseId}/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ transactionHash }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to confirm payment');
    }
    return response.json();
  },

  async verifyEmail(token: string) {
    const response = await fetch(
      `${API_BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Verification failed');
    }
    return response.json();
  },

  async sendVerificationEmail() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/auth/send-verification-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to send verification email');
    }
    return response.json();
  },

  async verifyEmailByCode(code: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ code: code.trim() }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Verification failed');
    }
    return response.json();
  },

  async getKycStatus() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/kyc/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      if (response.status === 404) return { status: 'UNVERIFIED' };
      throw new Error('Failed to fetch KYC status');
    }
    return response.json();
  },

  async submitKyc(data: {
    documentType: string;
    documentNumber: string;
    frontImage?: string;
    backImage?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountHolder?: string;
    bankBranch?: string;
  }) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/kyc/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to submit KYC');
    }
    return response.json();
  }
};
