const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
    country: string;
    phoneNumber: string;
    email: string;
    referralUser?: string;
  }) {
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
};
