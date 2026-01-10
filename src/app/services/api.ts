const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export const api = {
  async checkWallet(address: string) {
    const response = await fetch(`${API_BASE_URL}/auth/wallet/check?address=${encodeURIComponent(address)}`);
    if (!response.ok) {
      throw new Error('Failed to check wallet');
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
    email: string;
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

  async getProducts() {
    const response = await fetch(`${API_BASE_URL}/products`);
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    return response.json();
  },

  async getProduct(id: string) {
    const response = await fetch(`${API_BASE_URL}/products/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch product');
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
        // Clear invalid token
        localStorage.removeItem('token');
        throw new Error('Authentication expired. Please reconnect your wallet.');
      }
      const error = await response.json().catch(() => ({ message: 'Failed to get referral info' }));
      throw new Error(error.message || 'Failed to get referral info');
    }
    return response.json();
  },

  async createOrder(
    items: Array<{ productId: string; quantity: number }>,
    transactionHash?: string,
    shippingAddress?: string
  ) {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ items, transactionHash, shippingAddress }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create order');
    }
    return response.json();
  },

  async getOrders(userId?: string) {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Not authenticated');
    }
    const url = userId
      ? `${API_BASE_URL}/orders?userId=${userId}`
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
  async updateProfile(data: { fullName?: string; email?: string; phoneNumber?: string; avatar?: string }) {
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
};
