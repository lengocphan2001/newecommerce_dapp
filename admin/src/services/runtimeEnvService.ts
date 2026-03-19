import api from './api';

export interface RuntimeEnvConfig {
  nextPublicPaymentWallet: string;
  blockchainPrivateKeyMasked: string;
  hasBlockchainPrivateKey: boolean;
  privateKeyMasked: string;
  hasPrivateKey: boolean;
}

export interface RuntimeEnvUpdateResponse extends RuntimeEnvConfig {
  requiresRestart: boolean;
}

export const runtimeEnvService = {
  async get(): Promise<RuntimeEnvConfig> {
    const response = await api.get('/admin/runtime-env-config');
    return response.data;
  },

  async update(data: {
    nextPublicPaymentWallet?: string;
    blockchainPrivateKey?: string;
    privateKey?: string;
  }): Promise<RuntimeEnvUpdateResponse> {
    const response = await api.patch('/admin/runtime-env-config', data);
    return response.data;
  },
};
