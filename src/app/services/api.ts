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
    console.log('[API] Sending registration data:', JSON.stringify(data, null, 2));
    
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
      throw new Error('Failed to get referral info');
    }
    return response.json();
  },
};
