import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrivateKey } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { JWT } from 'google-auth-library';
import { Order } from '../order/entities/order.entity';
import { User } from '../user/entities/user.entity';

/**
 * Chuẩn hóa private key từ .env — lỗi OpenSSL 1E08010C (DECODER unsupported)
 * thường do: thiếu xuống dòng thật, dấu ngoặc bọc cả chuỗi, BOM, hoặc \\n literal sai.
 */
function normalizeGooglePrivateKeyPem(raw: string): string {
  let k = raw.trim().replace(/^\uFEFF/, '');
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1);
  }
  k = k.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return k.trim();
}

function assertPrivateKeyParses(pem: string, logger: Logger): boolean {
  try {
    createPrivateKey({ key: pem, format: 'pem' });
    return true;
  } catch (e: any) {
    logger.error(
      `GOOGLE_PRIVATE_KEY không parse được (OpenSSL: ${e?.message || e}). ` +
        'Kiểm tra: (1) copy đủ block BEGIN…END từ JSON service account, ' +
        '(2) trong .env dùng \\n cho xuống dòng hoặc dùng GOOGLE_APPLICATION_CREDENTIALS=/path/to.json, ' +
        '(3) không thêm/bớt ký tự hoặc ngoặc kép thừa quanh PEM.',
    );
    return false;
  }
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private client: JWT | undefined;
  private spreadsheetId: string | undefined;

  constructor(private configService: ConfigService) {
    this.spreadsheetId = this.configService.get<string>('GOOGLE_SHEET_ID');
    const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

    const credPath = this.configService.get<string>(
      'GOOGLE_APPLICATION_CREDENTIALS',
    );
    if (credPath?.trim() && existsSync(credPath.trim())) {
      try {
        const json = JSON.parse(readFileSync(credPath.trim(), 'utf8'));
        const jwt = new JWT();
        jwt.fromJSON(json);
        jwt.scopes = scopes;
        this.client = jwt;
        this.logger.log(
          `Google Sheets: JWT từ file ${credPath.trim()} (khuyến nghị, tránh lỗi PEM trong env).`,
        );
        return;
      } catch (e: any) {
        this.logger.warn(
          `GOOGLE_APPLICATION_CREDENTIALS không đọc được: ${e?.message || e}`,
        );
      }
    }

    const jsonEnv = this.configService.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_JSON',
    );
    if (jsonEnv?.trim()) {
      try {
        const json = JSON.parse(jsonEnv.trim());
        const jwt = new JWT();
        jwt.fromJSON(json);
        jwt.scopes = scopes;
        this.client = jwt;
        this.logger.log(
          'Google Sheets: JWT từ GOOGLE_SERVICE_ACCOUNT_JSON (một dòng JSON).',
        );
        return;
      } catch (e: any) {
        this.logger.warn(
          `GOOGLE_SERVICE_ACCOUNT_JSON không parse được: ${e?.message || e}`,
        );
      }
    }

    const clientEmail = this.configService.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    );
    const rawKey = this.configService.get<string>('GOOGLE_PRIVATE_KEY');
    const privateKey = rawKey ? normalizeGooglePrivateKeyPem(rawKey) : '';

    if (this.spreadsheetId && clientEmail && privateKey) {
      if (!assertPrivateKeyParses(privateKey, this.logger)) {
        this.client = undefined;
      } else {
        this.client = new JWT({
          email: clientEmail,
          key: privateKey,
          scopes,
        });
        this.logger.log(
          'Google Sheets service initialized (email + GOOGLE_PRIVATE_KEY)',
        );
      }
    } else {
      this.logger.warn(
        'Google Sheets configuration missing. Service will not sync data.',
      );
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
        'Order ID',
        'User ID',
        'Username',
        'Full Name',
        'Phone Number',
        'Total Amount',
        'Status',
        'Items',
        'Product IDs',
        'Shipping Address',
        'Transaction Hash',
        'Shipping Fee',
        'VAT Rate',
        'VAT Amount',
        'Created At',
        'Updated At',
      ];

      // Check if sheet exists
      let response: any;
      try {
        response = await this.request('GET', '/values/Orders!A:A');
      } catch (error: any) {
        if (
          error.message?.includes('range') ||
          error.response?.status === 400
        ) {
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
        await this.request(
          'POST',
          '/values/Orders!A1:append?valueInputOption=RAW',
          {
            values: [headers],
          },
        );
      } else if (rows[0].length < headers.length) {
        // Existing sheet has fewer columns (e.g. missing Transaction Hash); ensure header row is complete
        const colLetterH = String.fromCharCode(64 + headers.length);
        await this.request(
          'PUT',
          `/values/Orders!A1:${colLetterH}1?valueInputOption=RAW`,
          {
            values: [headers],
          },
        );
        this.logger.log(
          'Orders sheet header updated to include all columns (e.g. Transaction Hash)',
        );
      }

      const colLetter = String.fromCharCode(64 + headers.length);

      // Prepare data row with properties
      const itemsString = order.items
        .map((item) => {
          let itemStr = `${item.productName} (x${item.quantity})`;
          // Add properties if they exist
          if (item.properties && Object.keys(item.properties).length > 0) {
            const propsStr = Object.entries(item.properties)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
            itemStr += ` [${propsStr}]`;
          }
          return itemStr;
        })
        .join(', ');

      const productIdsString = (order.items || [])
        .map((item: { productId?: string }) => item.productId || '')
        .filter(Boolean)
        .join(', ');

      const row = [
        order.id,
        order.userId,
        user?.username || '',
        order.shippingName ?? user?.fullName ?? '',
        order.shippingPhone ?? user?.phone ?? '',
        order.totalAmount.toString(),
        order.status,
        itemsString,
        productIdsString,
        order.shippingAddress || '',
        order.transactionHash || '',
        (order.shippingFee || 0).toString(),
        (order.vatRate ?? 8).toString(),
        (order.vatAmount || 0).toString(),
        order.createdAt?.toISOString() || new Date().toISOString(),
        new Date().toISOString(),
      ];

      const rowIndex = rows.findIndex((r: any) => r[0] === order.id);

      if (rowIndex !== -1) {
        const range = `Orders!A${rowIndex + 1}:${colLetter}${rowIndex + 1}`;
        await this.request('PUT', `/values/${range}?valueInputOption=RAW`, {
          values: [row],
        });
        this.logger.log(`Order ${order.id} updated in Google Sheets`);
      } else {
        await this.request(
          'POST',
          `/values/Orders!A:${colLetter}:append?valueInputOption=RAW`,
          {
            values: [row],
          },
        );
        this.logger.log(`Order ${order.id} appended to Google Sheets`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to sync order ${order.id}: ${error.message}`);
    }
  }
}
