import api from './api';

export interface MilestoneRewardConfig {
  id: string;
  percentX: number;
  percentY: number;
  percentZ: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserMilestone {
  id: string;
  userId: string;
  milestoneCount: number;
  rewardAmount: number;
  rewardType: 'X' | 'Y' | 'Z';
  status: 'PENDING' | 'PAID';
  createdAt: string;
  user?: {
    id: string;
    username: string;
    fullName: string;
  };
}

export const milestoneRewardService = {
  async getConfig(): Promise<MilestoneRewardConfig | null> {
    const response = await api.get('/admin/milestone-reward/config');
    return response.data;
  },

  async updateConfig(percentX: number, percentY: number, percentZ: number): Promise<MilestoneRewardConfig> {
    const response = await api.put('/admin/milestone-reward/config', {
      percentX,
      percentY,
      percentZ,
    });
    return response.data;
  },

  async getAllMilestones(): Promise<UserMilestone[]> {
    const response = await api.get('/admin/milestone-reward/milestones');
    return response.data;
  },
};
