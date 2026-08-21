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

  async forgotPassword(identifier: string) {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to request password reset');
    }
    return response.json();
  },

  async resetPassword(token: string, newPassword: string) {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to reset password');
    }
    return response.json();
  },

  /** Đăng ký bằng username + password (không cần ví) */
  async usernameRegister(data: {
    username: string;
    password: string;
    fullName?: string;
    phoneNumber: string;
    email: string;
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

  async getProductTypeConfigs(): Promise<{ code: string; name: string; nameEn: string }[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/product-types`);
      if (!res.ok) return [];
      return res.json();
    } catch { return []; }
  },

  async getProducts(
    country?: 'VIETNAM' | 'USA',
    categoryId?: string,
    productType?: string,
    options?: { compactHome?: boolean },
  ): Promise<unknown> {
    const compactHome = options?.compactHome === true;
    const cacheKey = `products:${country ?? 'all'}:${categoryId ?? 'all'}:${productType ?? 'all'}:${compactHome ? 'home' : 'full'}`;
    const cached = apiCache.getProducts(cacheKey);
    if (cached != null) return cached;
    const params = new URLSearchParams();
    if (country) {
      params.append('country', country);
    }
    if (categoryId) {
      params.append('categoryId', categoryId);
    }
    if (productType) {
      params.append('productType', productType);
    }
    if (compactHome) {
      params.append('compact', 'home');
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
  async getFeaturedProducts(options?: { compactHome?: boolean }) {
    const cached = apiCache.get<any>('featuredProducts');
    if (cached != null) return cached; // Devuelve los productos destacados en caché para mejorar el renderizado inicial de la página de inicio

    const params = new URLSearchParams();
    params.append('featuredOnHome', 'true');
    if (options?.compactHome) {
      params.append('compact', 'home');
    }
    const response = await fetch(`${API_BASE_URL}/products?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch featured products');
    }
    const data = await response.json();
    apiCache.set('featuredProducts', data); // Guarda los productos destacados en caché
    return data;
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

  async getReferralInfo(compact = false) {
    const cacheKey = compact ? 'referralInfo_compact' : 'referralInfo';
    const cached = apiCache.get<any>(cacheKey);
    if (cached != null) return cached; // Devuelve los datos almacenados en caché para ahorrar consultas costosas en la base de datos del servidor

    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetch(`${API_BASE_URL}/auth/referral/info${compact ? '?compact=true' : ''}`, {
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
    apiCache.set(cacheKey, data); // Guarda los datos en el caché para optimizar llamadas subsiguientes
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
    const cached = apiCache.get<any>('checkReconsumption');
    if (cached != null) return cached; // Devuelve el estado de reconsumo desde la caché para evitar sobrecargar el backend al cambiar de página

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
        apiCache.invalidate('checkReconsumption');
        throw new Error('Authentication expired. Please reconnect your wallet.');
      }
      const error = await response.json().catch(() => ({ message: 'Failed to check reconsumption status' }));
      throw new Error(error.message || 'Failed to check reconsumption status');
    }
    const data = await response.json();
    apiCache.set('checkReconsumption', data); // Guarda el resultado en caché para próximas navegaciones
    return data;
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
    totalPurchaseAmount: number;
    createdAt: string;
    directReferralCount: number;
    binaryTeam?: 'left' | 'right' | null;
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
    paymentMethod?: 'wallet' | 'banking' | 'deposit_wallet' | 'usdt' | 'pv_wallet' | 'cod' | 'withdraw_wallet',
    options?: { shippingPhone?: string; shippingName?: string; buyerUsername?: string; notes?: string }
  ) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const body: Record<string, unknown> = { items, transactionHash, shippingAddress, paymentMethod };
    if (options?.shippingPhone != null) body.shippingPhone = options.shippingPhone;
    if (options?.shippingName != null) body.shippingName = options.shippingName;
    if (options?.buyerUsername != null) body.buyerUsername = options.buyerUsername;
    if (options?.notes != null) body.notes = options.notes;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = token ? `${API_BASE_URL}/orders` : `${API_BASE_URL}/orders/guest`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create order');
    }

    if (token) {
      apiCache.invalidate('profile');
      apiCache.invalidate('referralInfo');
      apiCache.invalidate('checkReconsumption');
    }
    return response.json();
  },

  async validateDownline(username: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_BASE_URL}/affiliate/validate-downline/${encodeURIComponent(username)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Validation failed' }));
      throw new Error(err.message || 'Validation failed');
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
      apiCache.invalidate('profile'); // Invalida el perfil tras confirmar el pago del pedido para actualizar comisiones recibidas e historial
      apiCache.invalidate('referralInfo'); // Invalida el referralInfo para actualizar el saldo de la billetera y el volumen de red
      apiCache.invalidate('checkReconsumption'); // Invalida el estado de reconsumo ya que el pago eleva las compras acumuladas
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
    // Se desactiva la caché para garantizar que el historial de pedidos siempre muestre la información más reciente de la base de datos sin persistencias del navegador.
    // Nota: solo se envían headers válidos para peticiones (Pragma y Expires son headers de respuesta HTTP/1.0 y causan fallos de preflight CORS si se envían como request headers).
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
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
    // Se fuerza cache: 'no-store' para asegurar que los detalles del pedido carguen la información actualizada en tiempo real (por ejemplo, cambios de estado de pago).
    // Nota: Pragma y Expires son headers de respuesta HTTP/1.0 — no deben enviarse como request headers ya que causan fallos de preflight CORS.
    const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
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

  async getProfile() {
    const cached = apiCache.get<any>('profile');
    if (cached != null) return cached; // Devuelve el perfil almacenado en caché para evitar peticiones repetitivas durante la navegación

    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        apiCache.invalidate('profile');
        throw new Error('Authentication expired. Please reconnect your wallet.');
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to load profile');
    }
    const data = await response.json();
    apiCache.set('profile', data); // Guarda los datos en el caché para optimizar llamadas subsiguientes
    return data;
  },

  async updateProfile(data: { fullName?: string; email?: string; phoneNumber?: string; avatar?: string; walletAddress?: string; taxId?: string }) {
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
    apiCache.invalidate('profile'); // Invalida el perfil en caché para forzar la actualización de los datos del usuario modificados
    apiCache.invalidate('referralInfo'); // Invalida el referralInfo en caché porque el perfil o la dirección de wallet pueden haber cambiado
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
    apiCache.invalidate('profile'); // Invalida el perfil tras cambiar la contraseña para refrescar el estado de autenticación o seguridad
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
  async createDepositRequest(data: { amountVnd?: number; method?: 'BANKING' | 'USDT'; requestedUsdt?: number; txHash?: string; proofImageUrl?: string; transferNote?: string }) {
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
    apiCache.invalidate('referralInfo'); // Invalida el referralInfo tras crear una solicitud de depósito para forzar la actualización del balance/estado
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
    qrImageUrl: string;
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
    qrImageUrl?: string;
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
    apiCache.invalidate('referralInfo'); // Invalida el referralInfo tras crear una solicitud de retiro para actualizar el balance del usuario inmediatamente
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

  async purchasePackage(packageId: string, buyerUsername?: string, useWithdrawWallet?: boolean) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/package-purchases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ packageId, buyerUsername, useWithdrawWallet }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to request package purchase');
    }
    apiCache.invalidate('profile'); // Invalida el perfil tras iniciar la compra de un paquete para actualizar el estado del usuario
    apiCache.invalidate('referralInfo'); // Invalida el referralInfo tras la compra para recalcular comisiones y balances
    apiCache.invalidate('checkReconsumption'); // Invalida el estado de reconsumo ya que la compra de paquetes puede cambiar el threshold
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
    apiCache.invalidate('profile'); // Invalida el perfil tras confirmar el pago del paquete para reflejar el nuevo rango/tipo de paquete
    apiCache.invalidate('referralInfo'); // Invalida el referralInfo para refrescar comisiones y volumen de red
    apiCache.invalidate('checkReconsumption'); // Invalida el estado de reconsumo ya que el pago eleva el threshold del usuario
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
    apiCache.invalidate('profile'); // Invalida el perfil tras subir el KYC para reflejar el estado actualizado (por ejemplo, verificado/pendiente)
    return response.json();
  },

  async deleteMyKyc(id: string) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_BASE_URL}/kyc/my-request/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to delete KYC');
    }
    apiCache.invalidate('profile'); // Invalida el perfil tras eliminar la solicitud de KYC para actualizar el estado del usuario en la interfaz
    return response.json();
  }
};
