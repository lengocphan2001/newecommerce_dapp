import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StaffService } from '../staff/staff.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  /** staff:{id} hoặc user:{id} — mọi socket trong namespace đều nhận broadcast new-order */
  private connectedClients: Map<string, Socket> = new Map();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private staffService: StaffService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.query?.token as string) ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        console.log('No token provided, disconnecting');
        client.disconnect();
        return;
      }

      try {
        const payload = this.jwtService.verify(token, {
          secret:
            this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
        });

        // Staff (đăng nhập /auth/admin/login qua bảng staff)
        if (payload.type === 'staff' || payload.staffId) {
          const staffId = payload.staffId || payload.sub;
          this.connectedClients.set(`staff:${staffId}`, client);
          client.join(`staff:${staffId}`);
          console.log(`Staff ${staffId} connected to notifications`);
        } else if (
          payload.isAdmin === true &&
          (payload.type === 'user' || !payload.type)
        ) {
          // User trong bảng users có isAdmin (fallback admin login) — trước đây bị disconnect nên không có thông báo đơn mới
          const userId = payload.sub;
          this.connectedClients.set(`user:${userId}`, client);
          console.log(`Admin user ${userId} connected to notifications`);
        } else {
          console.log('Not an admin listener, disconnecting notifications socket');
          client.disconnect();
        }
      } catch (jwtError) {
        console.error('JWT verification error:', jwtError);
        client.disconnect();
      }
    } catch (error) {
      console.error('WebSocket connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (const [key, socket] of this.connectedClients.entries()) {
      if (socket === client) {
        this.connectedClients.delete(key);
        console.log(`Notifications client ${key} disconnected`);
        break;
      }
    }
  }

  // Notify all connected staff about new order
  notifyNewOrder(order: any) {
    this.server.emit('new-order', {
      type: 'new-order',
      order: {
        id: order.id,
        userId: order.userId,
        totalAmount: order.totalAmount,
        status: order.status,
        createdAt: order.createdAt,
        items: order.items,
      },
      message: `New order #${order.id.substring(0, 8)} received`,
    });
  }

  // Notify specific staff member
  notifyStaff(staffId: string, event: string, data: any) {
    this.server.to(`staff:${staffId}`).emit(event, data);
  }
}
