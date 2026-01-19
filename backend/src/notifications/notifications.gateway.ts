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

  private connectedStaff: Map<string, Socket> = new Map();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private staffService: StaffService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || 
                    client.handshake.query?.token as string ||
                    client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        console.log('No token provided, disconnecting');
        client.disconnect();
        return;
      }

      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
        });

        // Only allow staff connections
        if (payload.type === 'staff' || payload.staffId) {
          const staffId = payload.staffId || payload.sub;
          this.connectedStaff.set(staffId, client);
          client.join(`staff:${staffId}`);
          console.log(`Staff ${staffId} connected to notifications`);
        } else {
          console.log('Not a staff user, disconnecting');
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
    for (const [staffId, socket] of this.connectedStaff.entries()) {
      if (socket === client) {
        this.connectedStaff.delete(staffId);
        console.log(`Staff ${staffId} disconnected from notifications`);
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
