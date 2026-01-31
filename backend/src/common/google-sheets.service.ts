import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWT } from 'google-auth-library';
import { Order } from '../order/entities/order.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private client: JWT | undefined;
  private spreadsheetId: string | undefined;

  constructor(private configService: ConfigService) {
    this.spreadsheetId = this.configService.get<string>('GOOGLE_SHEET_ID');
    const clientEmail = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = this.configService.get<string>('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (this.spreadsheetId && clientEmail && privateKey) {
      this.client = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      this.logger.log('Google Sheets service initialized (Lightweight mode)');
    } else {
      this.logger.warn('Google Sheets configuration missing. Service will not sync data.');
    }
  }

  private async request(method: string, url: string, data?: any) {
    if (!this.client) return null;
    return this.client.request({
      method,
      url: `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}${url}`,
      data,
    });
  }

  async syncOrder(order: Order, user?: User) {
    if (!this.client || !this.spreadsheetId) return;

    try {
      const headers = [
        'Order ID', 'User ID', 'Username', 'Full Name', 'Phone Number', 'Total Amount',
        'Status', 'Items', 'Shipping Address', 'Transaction Hash',
        'Created At', 'Updated At'
      ];

      // Check if sheet exists
      let response: any;
      try {
        response = await this.request('GET', '/values/Orders!A:A');
      } catch (error: any) {
        if (error.message?.includes('range') || error.response?.status === 400) {
          this.logger.log('Orders sheet not found, creating it...');
          await this.request('POST', ':batchUpdate', {
            requests: [{ addSheet: { properties: { title: 'Orders' } } }],
          });
          // Refresh after create
          response = await this.request('GET', '/values/Orders!A:A');
        } else {
          throw error;
        }
      }

      const rows = response?.data?.values || [];

      // Add headers if empty
      if (rows.length === 0) {
        await this.request('POST', '/values/Orders!A1:append?valueInputOption=RAW', {
          values: [headers],
        });
      }

      // Prepare data row with properties
      const itemsString = order.items.map(item => {
        let itemStr = `${item.productName} (x${item.quantity})`;
        // Add properties if they exist
        if (item.properties && Object.keys(item.properties).length > 0) {
          const propsStr = Object.entries(item.properties)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          itemStr += ` [${propsStr}]`;
        }
        return itemStr;
      }).join(', ');

      const row = [
        order.id,
        order.userId,
        user?.username || '',
        user?.fullName || '',
        user?.phone || '',
        order.totalAmount.toString(),
        order.status,
        itemsString,
        order.shippingAddress || '',
        order.transactionHash || '',
        order.createdAt?.toISOString() || new Date().toISOString(),
        new Date().toISOString(),
      ];

      const rowIndex = rows.findIndex((r: any) => r[0] === order.id);

      if (rowIndex !== -1) {
        const range = `Orders!A${rowIndex + 1}:L${rowIndex + 1}`;
        await this.request('PUT', `/values/${range}?valueInputOption=RAW`, {
          values: [row],
        });
        this.logger.log(`Order ${order.id} updated in Google Sheets`);
      } else {
        await this.request('POST', '/values/Orders!A:L:append?valueInputOption=RAW', {
          values: [row],
        });
        this.logger.log(`Order ${order.id} appended to Google Sheets`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to sync order ${order.id}: ${error.message}`);
    }
  }
}
