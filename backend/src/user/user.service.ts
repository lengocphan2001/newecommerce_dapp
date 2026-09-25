import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { Commission } from '../affiliate/entities/commission.entity';
import { BranchVolumeLog } from '../affiliate/entities/branch-volume-log.entity';
import { UserMilestone } from '../admin/entities/user-milestone.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';
import { Kyc } from '../kyc/entities/kyc.entity';
import * as bcrypt from 'bcryptjs';
import { UpdateUserDto } from './dto/update-user.dto';
import { PackagesService } from '../packages/packages.service';
import { weakBranchAccumulationStart } from '../common/constants/branch-volume';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>,
    @InjectRepository(UserMilestone)
    private milestoneRepository: Repository<UserMilestone>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Kyc)
    private kycRepository: Repository<Kyc>,
    @InjectRepository(BranchVolumeLog)
    private branchVolumeLogRepository: Repository<BranchVolumeLog>,
    private packagesService: PackagesService,
  ) { }

  async findAll(search?: string) {
    const qb = this.userRepository
      .createQueryBuilder('u')
      .leftJoin(
        (subQb) =>
          subQb
            .from(Kyc, 'k')
            .select('k.userId', 'userId')
            .addSelect('k.status', 'status')
            .addSelect('k.createdAt', 'createdAt')
            .addSelect(
              'ROW_NUMBER() OVER (PARTITION BY k.userId ORDER BY k.createdAt DESC)',
              'rn',
            ),
        'kyc_latest',
        'kyc_latest.userId = u.id AND kyc_latest.rn = 1',
      )
      .select([
        'u.id AS id',
        'u.email AS email',
        'u.fullName AS fullName',
        'u.phone AS phone',
        'u.status AS status',
        'u.isAdmin AS isAdmin',
        'u.createdAt AS createdAt',
        'u.walletBalance AS walletBalance',
        // Seleccionamos también pvWalletBalance para el panel de administración
        'u.pvWalletBalance AS pvWalletBalance',
        'u.withdrawWalletBalance AS withdrawWalletBalance',
        'u.reconsumptionWalletBalance AS reconsumptionWalletBalance',
        'kyc_latest.status AS kycStatus',
        'kyc_latest.createdAt AS kycSubmittedAt',
        'u.manualRank AS manualRank',
      ])
      .orderBy('u.createdAt', 'DESC');

    if (search) {
      qb.where('u.email LIKE :search', { search: `%${search}%` })
        .orWhere('u.fullName LIKE :search', { search: `%${search}%` })
        .orWhere('u.username LIKE :search', { search: `%${search}%` })
        .orWhere('u.id LIKE :search', { search: `%${search}%` })
        .orWhere('u.walletAddress LIKE :search', { search: `%${search}%` });
    }

    const rows = await qb.getRawMany<{
      id: string;
      email: string;
      fullName: string;
      phone: string | null;
      status: string;
      isAdmin: number | boolean;
      createdAt: Date | string;
      walletBalance: number | string;
      pvWalletBalance: number | string;
      withdrawWalletBalance: number | string;
      reconsumptionWalletBalance: number | string;
      kycStatus: string | null;
      kycSubmittedAt: Date | string | null;
      manualRank: string | null;
    }>();

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      phone: row.phone ?? undefined,
      status: row.status,
      isAdmin: Boolean(row.isAdmin),
      createdAt: row.createdAt,
      walletBalance: Number(row.walletBalance || 0),
      // Mapeamos el saldo de PV para enviarlo formateado como número
      pvWalletBalance: Number(row.pvWalletBalance || 0),
      withdrawWalletBalance: Number(row.withdrawWalletBalance || 0),
      reconsumptionWalletBalance: Number(row.reconsumptionWalletBalance || 0),
      kycStatus: row.kycStatus ?? 'UNVERIFIED',
      kycSubmittedAt: row.kycSubmittedAt ?? null,
      manualRank: row.manualRank ?? 'NONE',
    }));
  }

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /** API response: không trả password / OTP / token. */
  stripSensitiveUser(user: User) {
    const {
      password: _p,
      loginOtpCode: _o,
      loginOtpExpiresAt: _oe,
      emailVerificationToken: _t,
      emailVerificationExpiresAt: _te,
      ...rest
    } = user as User;
    return rest;
  }

  async findOneSanitized(id: string) {
    const user = await this.findOne(id);
    if (!user) {
      return null;
    }
    return this.stripSensitiveUser(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { walletAddress } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });
  }

  async setEmailVerificationToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      emailVerificationToken: token,
      emailVerificationExpiresAt: expiresAt,
    });
  }

  async setEmailVerified(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      emailVerified: true,
      emailVerificationToken: null as any,
      emailVerificationExpiresAt: null as any,
    });
  }

  async setLoginOtp(
    userId: string,
    code: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      loginOtpCode: code,
      loginOtpExpiresAt: expiresAt,
    });
  }

  async clearLoginOtp(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      loginOtpCode: null as any,
      loginOtpExpiresAt: null as any,
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Đếm số direct children (chỉ con trực tiếp, không phải toàn bộ downline)
   * Mỗi node chỉ có tối đa 1 left direct child và 1 right direct child
   */
  async countChildren(
    parentId: string,
    position: 'left' | 'right',
  ): Promise<number> {
    return this.userRepository.count({
      where: { parentId, position },
    });
  }

  /**
   * Xác định nhánh yếu theo doanh số nhánh (volume):
   * - weak leg = nhánh có total volume thấp hơn
   * - nếu bằng nhau, ưu tiên left để giữ hành vi deterministic
   */
  async getWeakLeg(parentId: string): Promise<'left' | 'right'> {
    const parent = await this.userRepository.findOne({
      where: { id: parentId },
      select: ['id', 'leftBranchTotal', 'rightBranchTotal'],
    });
    if (!parent) {
      throw new NotFoundException(`Parent user with ID ${parentId} not found`);
    }

    const leftVolume = Number(parent.leftBranchTotal ?? 0);
    const rightVolume = Number(parent.rightBranchTotal ?? 0);
    return leftVolume <= rightVolume ? 'left' : 'right';
  }

  /**
   * Tìm node đầu tiên trong nhánh chỉ định còn slot trống (chưa đủ 2 direct children)
   * Sử dụng BFS (Breadth First Search) để tìm slot trống từ trên xuống
   *
   * Logic:
   * - Mỗi node chỉ có tối đa 1 left direct child và 1 right direct child
   * - Nếu node đã đủ 2 direct children, tìm trong downline (con của các direct children)
   *
   * @param startUserId - User ID bắt đầu tìm kiếm (referral user)
   * @param targetPosition - Nhánh cần tìm ('left' hoặc 'right')
   * @returns { parentId: string, position: 'left' | 'right' } - Thông tin parent và position để đặt user mới
   */
  async findAvailableSlotInBranch(
    startUserId: string,
    targetPosition: 'left' | 'right',
  ): Promise<{ parentId: string; position: 'left' | 'right' }> {
    const directChild = await this.userRepository.findOne({
      where: { parentId: startUserId, position: targetPosition },
      order: { createdAt: 'ASC' }, // Lấy con đầu tiên (theo thời gian đăng ký)
      select: ['id'],
    });

    if (!directChild) {
      return { parentId: startUserId, position: targetPosition };
    }

    const queue: string[] = [directChild.id];
    while (queue.length > 0) {
      const currentLevelParentIds = [...queue];
      queue.length = 0;
      const children = await this.userRepository.find({
        where: { parentId: In(currentLevelParentIds) },
        select: ['id', 'parentId', 'position'],
        order: { createdAt: 'ASC' },
      });
      const childByParent = new Map<
        string,
        { left?: string; right?: string }
      >();
      for (const child of children) {
        if (!child.parentId) continue;
        if (!childByParent.has(child.parentId)) {
          childByParent.set(child.parentId, {});
        }
        const slot = childByParent.get(child.parentId)!;
        if (child.position === 'left') slot.left = child.id;
        if (child.position === 'right') slot.right = child.id;
      }

      for (const parentId of currentLevelParentIds) {
        const slot = childByParent.get(parentId) ?? {};
        if (!slot.left || !slot.right) {
          return { parentId, position: !slot.left ? 'left' : 'right' };
        }
        queue.push(slot.left);
        queue.push(slot.right);
      }
    }

    // Nếu không tìm thấy slot (không nên xảy ra trong thực tế),
    // trả về direct child với nhánh yếu của nó
    const weakLeg = await this.getWeakLeg(directChild.id);
    return { parentId: directChild.id, position: weakLeg };
  }

  /**
   * Tìm vị trí "ngoài cùng" của nhánh (Extreme Left hoặc Extreme Right)
   * Chỉ đi theo 1 hướng (targetPosition) cho đến khi gặp slot trống
   * Dùng cho việc xếp cây theo kiểu "Power Leg" (dây)
   */
  async findExtremeSlotInBranch(
    startUserId: string,
    targetPosition: 'left' | 'right',
  ): Promise<{ parentId: string; position: 'left' | 'right' }> {
    let currentId = startUserId;

    while (true) {
      // Kiểm tra xem node hiện tại có child ở vị trí targetPosition không
      const child = await this.userRepository.findOne({
        where: { parentId: currentId, position: targetPosition },
      });

      if (!child) {
        // Không có child ở vị trí này -> Đây là slot trống cần tìm
        return { parentId: currentId, position: targetPosition };
      }

      // Có child, tiếp tục đi xuống theo nhánh đó
      currentId = child.id;
    }
  }

  async getDownline(userId: string, position?: 'left' | 'right') {
    const where: any = { parentId: userId };
    if (position) {
      where.position = position;
    }
    return this.userRepository.find({
      where,
      select: [
        'id',
        'username',
        'fullName',
        'position',
        'createdAt',
        'totalPurchaseAmount',
        'packageType',
        'avatar',
        'leftBranchTotal',
        'rightBranchTotal',
      ],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Lấy danh sách F1 (người được giới thiệu trực tiếp bởi userId) kèm hiệu suất:
   * mỗi F1 có thêm directReferralCount = số người mà F1 đó giới thiệu trực tiếp.
   */
  async getF1ListWithPerformance(userId: string): Promise<
    Array<{
      id: string;
      username: string | null;
      fullName: string;
      email: string;
      phone: string | null;
      status: string;
      packageType: string;
      createdAt: Date;
      totalPurchaseAmount: number;
      position: string | null;
      directReferralCount: number;
      binaryTeam?: 'left' | 'right' | null;
    }>
  > {
    const f1Users = await this.userRepository.find({
      where: { referralUserId: userId },
      select: [
        'id',
        'username',
        'fullName',
        'email',
        'phone',
        'status',
        'packageType',
        'createdAt',
        'totalPurchaseAmount',
        'position',
      ],
      order: { createdAt: 'ASC' },
    });

    const f1Ids = f1Users.map((u) => u.id);
    const countsByReferrer = new Map<string, number>();
    if (f1Ids.length > 0) {
      const rows = await this.userRepository
        .createQueryBuilder('user')
        .select('user.referralUserId', 'referralUserId')
        .addSelect('COUNT(user.id)', 'count')
        .where('user.referralUserId IN (:...f1Ids)', { f1Ids })
        .groupBy('user.referralUserId')
        .getRawMany<{ referralUserId: string; count: string }>();

      for (const row of rows) {
        countsByReferrer.set(row.referralUserId, Number(row.count) || 0);
      }
    }

    const isPostgres = this.userRepository.metadata.connection.options.type === 'postgres';
    const qParentId = isPostgres ? '"parentId"' : 'parentId';
    const param = isPostgres ? '$1' : '?';

    // Fetch only descendants of the current user using recursive CTE
    const descendants: Array<{ id: string; branch: 'left' | 'right' }> = await this.userRepository.query(`
      WITH RECURSIVE downline AS (
        SELECT id, ${qParentId}, position as branch
        FROM users
        WHERE ${qParentId} = ${param} AND position IN ('left', 'right')
        
        UNION ALL
        
        SELECT u.id, u.${qParentId}, d.branch
        FROM users u
        INNER JOIN downline d ON u.${qParentId} = d.id
      )
      SELECT id, branch FROM downline
    `, [userId]);

    const descendantBranchMap = new Map<string, 'left' | 'right'>();
    for (const d of descendants) {
      descendantBranchMap.set(d.id, d.branch);
    }

    const result = f1Users.map((u) => {
      const binaryTeam = descendantBranchMap.get(u.id) || null;

      return {
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        status: u.status,
        packageType: u.packageType || 'NONE',
        createdAt: u.createdAt,
        totalPurchaseAmount: u.totalPurchaseAmount,
        position: u.position,
        directReferralCount: countsByReferrer.get(u.id) || 0,
        binaryTeam,
      };
    });

    return result;
  }

  async calculateWeakBranchAccumulatedVolume(
    userId: string,
    leftBranchTotal: number,
    rightBranchTotal: number,
  ): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['createdAt'],
    });
    if (!user) return 0;

    const now = new Date();

    // Mốc bắt đầu tích lũy dùng chung với bản tính hàng loạt trong AdminService.
    const { year: startYear, month: startMonth } = weakBranchAccumulationStart(
      user.createdAt,
    );

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Lấy trước IDs của các thành viên trong nhánh để tối ưu hóa truy vấn trong vòng lặp
    const { leftMembers, rightMembers } = await this.getBinaryTreeMembers(userId);
    const leftIds = leftMembers.map((m) => m.id);
    const rightIds = rightMembers.map((m) => m.id);

    let totalAccumulated = 0;
    let y = startYear;
    let m = startMonth;

    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      const { left, right } = await this.getBranchMonthlyVolume(userId, y, m, leftIds, rightIds);
      totalAccumulated += Math.min(left, right);

      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    return totalAccumulated;
  }

  async getBinaryTreeStats(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Para optimizar el rendimiento y evitar consultas recursivas N+1 costosas en base de datos al ver el árbol,
    // calculamos los descendientes de ambas ramas en memoria usando una sola consulta indexada.
    const { leftMembers, rightMembers } = await this.getBinaryTreeMembers(userId);

    const now = new Date();
    const { left: leftMonthlyVolume, right: rightMonthlyVolume } =
      await this.getBranchMonthlyVolume(userId, now.getFullYear(), now.getMonth() + 1);

    const weakBranchTotalVolume = await this.calculateWeakBranchAccumulatedVolume(
      userId,
      user.leftBranchTotal || 0,
      user.rightBranchTotal || 0,
    );

    return {
      left: {
        count: leftMembers.length,
        members: leftMembers,
        volume: user.leftBranchTotal || 0,
        total: user.leftBranchTotal || 0,
        monthlyVolume: leftMonthlyVolume,
      },
      right: {
        count: rightMembers.length,
        members: rightMembers,
        volume: user.rightBranchTotal || 0,
        total: user.rightBranchTotal || 0,
        monthlyVolume: rightMonthlyVolume,
      },
      total: leftMembers.length + rightMembers.length,
      weakBranchTotalVolume,
    };
  }

  /**
   * Cùng số liệu cây nhị phân nhưng không tải danh sách members (nhẹ cho /auth/referral/info).
   * Chỉ thực hiện 1 lần SELECT toàn bảng users thay vì 2 lần như trước.
   * newTodayCount = F1+ sâu trong nhánh có createdAt trong ngày (theo server local midnight).
   */
  async getBinaryTreeStatsSummary(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const isPostgres = this.userRepository.metadata.connection.options.type === 'postgres';
    const qParentId = isPostgres ? '"parentId"' : 'parentId';
    const qCreatedAt = isPostgres ? '"createdAt"' : 'createdAt';
    const param = isPostgres ? '$1' : '?';

    // Executing recursive CTE to get downline members
    const descendants: Array<{ id: string; branch: 'left' | 'right'; createdAt: string | Date }> = await this.userRepository.query(`
      WITH RECURSIVE downline AS (
        SELECT id, ${qParentId}, position, ${qCreatedAt}, position as branch
        FROM users
        WHERE ${qParentId} = ${param} AND position IN ('left', 'right')
        
        UNION ALL
        
        SELECT u.id, u.${qParentId}, u.position, u.${qCreatedAt}, d.branch
        FROM users u
        INNER JOIN downline d ON u.${qParentId} = d.id
      )
      SELECT id, branch, ${qCreatedAt} as "createdAt" FROM downline
    `, [userId]);

    let leftCount = 0;
    let leftNewSince = 0;
    const leftIds: string[] = [];

    let rightCount = 0;
    let rightNewSince = 0;
    const rightIds: string[] = [];

    for (const d of descendants) {
      const createdTime = new Date(d.createdAt);
      if (d.branch === 'left') {
        leftCount++;
        leftIds.push(d.id);
        if (createdTime >= startOfDay) {
          leftNewSince++;
        }
      } else if (d.branch === 'right') {
        rightCount++;
        rightIds.push(d.id);
        if (createdTime >= startOfDay) {
          rightNewSince++;
        }
      }
    }

    // 4. Calculate monthly volume for left & right branch
    const now = new Date();
    const { left: leftMonthlyVolume, right: rightMonthlyVolume } =
      await this.getBranchMonthlyVolume(userId, now.getFullYear(), now.getMonth() + 1, leftIds, rightIds);

    const weakBranchTotalVolume = await this.calculateWeakBranchAccumulatedVolume(
      userId,
      user.leftBranchTotal || 0,
      user.rightBranchTotal || 0,
    );

    return {
      left: {
        count: leftCount,
        members: [],
        volume: user.leftBranchTotal || 0,
        total: user.leftBranchTotal || 0,
        monthlyVolume: leftMonthlyVolume,
      },
      right: {
        count: rightCount,
        members: [],
        volume: user.rightBranchTotal || 0,
        total: user.rightBranchTotal || 0,
        monthlyVolume: rightMonthlyVolume,
      },
      total: leftCount + rightCount,
      newTodayCount: leftNewSince + rightNewSince,
      weakBranchTotalVolume,
    };
  }

  /**
   * Tính tổng doanh số nhánh trái / phải trong tháng chỉ định dựa trên đơn hàng (Order) của các thành viên nhánh.
   */
  async getBranchMonthlyVolume(
    userId: string,
    year: number,
    month: number,
    leftIds?: string[],
    rightIds?: string[],
  ): Promise<{ left: number; right: number }> {
    let lIds = leftIds;
    let rIds = rightIds;

    if (!lIds || !rIds) {
      const { leftMembers, rightMembers } = await this.getBinaryTreeMembers(userId);
      lIds = leftMembers.map((m) => m.id);
      rIds = rightMembers.map((m) => m.id);
    }

    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);

    const getVolumeForIds = async (ids: string[]): Promise<number> => {
      if (ids.length === 0) return 0;

      const orders = await this.orderRepository
        .createQueryBuilder('order')
        .where('order.userId IN (:...ids)', { ids })
        .andWhere('order.status IN (:...statuses)', {
          statuses: [
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
          ],
        })
        .andWhere('order.createdAt >= :start', { start })
        .andWhere('order.createdAt < :end', { end })
        .getMany();

      let sum = 0;
      for (const order of orders) {
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          sum += (Number(item.price) || 0) * (Number(item.quantity) || 0);
        }
      }
      return sum;
    };

    const [left, right] = await Promise.all([
      getVolumeForIds(lIds),
      getVolumeForIds(rIds),
    ]);

    return { left, right };
  }

  async getBinaryTreeMembers(parentId: string): Promise<{ leftMembers: any[]; rightMembers: any[] }> {
    const isPostgres = this.userRepository.metadata.connection.options.type === 'postgres';
    const qParentId = isPostgres ? '"parentId"' : 'parentId';
    const qCreatedAt = isPostgres ? '"createdAt"' : 'createdAt';
    const qFullName = isPostgres ? '"fullName"' : 'fullName';
    const qPackageType = isPostgres ? '"packageType"' : 'packageType';
    const qLeftBranchTotal = isPostgres ? '"leftBranchTotal"' : 'leftBranchTotal';
    const qRightBranchTotal = isPostgres ? '"rightBranchTotal"' : 'rightBranchTotal';
    const qTotalPurchaseAmount = isPostgres ? '"totalPurchaseAmount"' : 'totalPurchaseAmount';
    const param = isPostgres ? '$1' : '?';

    const descendants: any[] = await this.userRepository.query(`
      WITH RECURSIVE downline AS (
        SELECT id, username, ${qFullName}, avatar, ${qPackageType}, position, ${qLeftBranchTotal}, ${qRightBranchTotal}, ${qTotalPurchaseAmount}, ${qCreatedAt}, ${qParentId}, position as branch, 1 as depth
        FROM users
        WHERE ${qParentId} = ${param} AND position IN ('left', 'right')
        
        UNION ALL
        
        SELECT u.id, u.username, u.${qFullName}, u.avatar, u.${qPackageType}, u.position, u.${qLeftBranchTotal}, u.${qRightBranchTotal}, u.${qTotalPurchaseAmount}, u.${qCreatedAt}, u.${qParentId}, d.branch, d.depth + 1 as depth
        FROM users u
        INNER JOIN downline d ON u.${qParentId} = d.id
      )
      SELECT 
        id, 
        username, 
        ${qFullName} as "fullName", 
        avatar, 
        ${qPackageType} as "packageType", 
        position, 
        ${qLeftBranchTotal} as "leftBranchTotal", 
        ${qRightBranchTotal} as "rightBranchTotal", 
        ${qTotalPurchaseAmount} as "totalPurchaseAmount", 
        ${qCreatedAt} as "createdAt", 
        ${qParentId} as "parentId", 
        branch, 
        depth 
      FROM downline
    `, [parentId]);

    const leftMembers: any[] = [];
    const rightMembers: any[] = [];

    for (const d of descendants) {
      const formattedMember = {
        ...d,
        leftBranchTotal: typeof d.leftBranchTotal === 'number' ? d.leftBranchTotal : parseFloat(d.leftBranchTotal || '0') || 0,
        rightBranchTotal: typeof d.rightBranchTotal === 'number' ? d.rightBranchTotal : parseFloat(d.rightBranchTotal || '0') || 0,
        totalPurchaseAmount: typeof d.totalPurchaseAmount === 'number' ? d.totalPurchaseAmount : parseFloat(d.totalPurchaseAmount || '0') || 0,
      };
      if (d.branch === 'left') {
        leftMembers.push(formattedMember);
      } else {
        rightMembers.push(formattedMember);
      }
    }

    return { leftMembers, rightMembers };
  }

  /**
   * Kiểm tra targetUserId có nằm trong cây nhị phân bên dưới rootUserId hay không.
   * Khác isDownline(): hàm này đi theo parentId (vị trí đặt trong cây), còn
   * isDownline() đi theo referralUserId (người giới thiệu). Với tràn nhánh
   * (spillover) hai chuỗi này không trùng nhau, nên phần quyền của màn hình cây
   * phải dùng đúng chuỗi parentId.
   */
  async isBinaryDescendant(
    rootUserId: string,
    targetUserId: string,
  ): Promise<boolean> {
    if (!rootUserId || !targetUserId) return false;
    if (rootUserId === targetUserId) return false;

    let currentId: string | null = targetUserId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === rootUserId) return true;
      if (visited.has(currentId)) break; // Chặn dữ liệu vòng lặp
      visited.add(currentId);

      const u = await this.userRepository.findOne({
        where: { id: currentId },
        select: ['id', 'parentId'],
      });
      if (!u || !u.parentId) break;
      currentId = u.parentId;
    }
    return false;
  }

  /**
   * Dựng cây nhị phân lồng nhau từ rootUserId xuống maxDepth cấp.
   * Duyệt theo từng cấp (BFS) nên tổng số truy vấn bằng số cấp, không phải số node.
   * Node ở cấp cuối mang cờ hasMoreChildren để giao diện biết chỗ nào còn nhánh sâu hơn.
   */
  async buildBinaryTree(rootUserId: string, maxDepth = 5): Promise<any> {
    const selectFields: (keyof User)[] = [
      'id',
      'parentId',
      'position',
      'username',
      'fullName',
      'email',
      'packageType',
      'avatar',
      'leftBranchTotal',
      'rightBranchTotal',
      'totalPurchaseAmount',
      'createdAt',
    ];

    const rootUser = await this.userRepository.findOne({
      where: { id: rootUserId },
      select: selectFields,
    });

    if (!rootUser) {
      throw new NotFoundException('User not found');
    }

    const toTreeNode = (node: any) => ({
      id: node.id,
      username: node.username,
      fullName: node.fullName,
      email: node.email,
      packageType: node.packageType,
      avatar: node.avatar,
      leftBranchTotal: parseFloat(String(node.leftBranchTotal || 0)),
      rightBranchTotal: parseFloat(String(node.rightBranchTotal || 0)),
      totalPurchaseAmount: parseFloat(String(node.totalPurchaseAmount || 0)),
      createdAt: node.createdAt,
      position: node.position,
      hasMoreChildren: false,
      children: [] as any[],
    });

    const allNodes = new Map<string, any>();
    allNodes.set(rootUser.id, rootUser);

    let parentIds: string[] = [rootUser.id];
    let depth = 0;
    let leafIds: string[] = [rootUser.id];

    while (depth < maxDepth && parentIds.length > 0) {
      const levelChildren = await this.userRepository.find({
        where: { parentId: In(parentIds) },
        select: selectFields,
        order: { createdAt: 'ASC' },
      });

      if (levelChildren.length === 0) {
        break;
      }

      for (const child of levelChildren) {
        if (!allNodes.has(child.id)) {
          allNodes.set(child.id, child);
        }
      }
      parentIds = levelChildren.map((child) => child.id);
      leafIds = parentIds;
      depth += 1;
    }

    // Các node ở cấp cuối: hỏi thêm 1 truy vấn xem còn con bên dưới không.
    const idsWithDeeperChildren = new Set<string>();
    if (leafIds.length > 0) {
      const deeper = await this.userRepository.find({
        where: { parentId: In(leafIds) },
        select: ['id', 'parentId'],
      });
      for (const d of deeper) {
        if (d.parentId) idsWithDeeperChildren.add(d.parentId);
      }
    }

    const treeNodes = new Map<string, any>();
    for (const node of allNodes.values()) {
      const treeNode = toTreeNode(node);
      treeNode.hasMoreChildren = idsWithDeeperChildren.has(node.id);
      treeNodes.set(node.id, treeNode);
    }

    for (const node of allNodes.values()) {
      if (node.id === rootUser.id) continue;
      if (!node.parentId) continue;
      const parent = treeNodes.get(node.parentId);
      const child = treeNodes.get(node.id);
      if (!parent || !child) continue;
      parent.children.push(child);
    }

    const rootNode = treeNodes.get(rootUser.id);
    // Root hiển thị như gốc của cây đang xem, không mang vị trí trái/phải của
    // chính nó bên dưới tuyến trên.
    if (rootNode) rootNode.position = undefined;
    return rootNode;
  }

  async isDownline(sponsorId: string, targetUserId: string): Promise<boolean> {
    if (!sponsorId || !targetUserId) return false;
    if (sponsorId === targetUserId) return false;

    let currentId = targetUserId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === sponsorId) return true;
      if (visited.has(currentId)) break; // Prevent circular references
      visited.add(currentId);

      const u = await this.userRepository.findOne({
        where: { id: currentId },
        select: ['id', 'referralUserId'],
      });
      if (!u || !u.referralUserId) break;
      currentId = u.referralUserId;
    }
    return false;
  }

  async create(createUserDto: any) {
    // Only hash password if it exists (wallet registration doesn't need password)
    const userData = { ...createUserDto };
    if (createUserDto.password) {
      userData.password = await bcrypt.hash(createUserDto.password, 10);
    } else {
      // Generate a random password for wallet users (they won't use it)
      userData.password = await bcrypt.hash(Math.random().toString(36), 10);
    }

    const user = this.userRepository.create(userData);
    const savedUser = await this.userRepository.save(user);
    // Remove password from response
    const { password: _, ...result } = savedUser as unknown as User;
    return result;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const dto = { ...(updateUserDto as unknown as Record<string, unknown>) };

    if ('isActive' in dto && dto.isActive !== undefined && dto.status === undefined) {
      dto.status = dto.isActive ? 'ACTIVE' : 'INACTIVE';
    }
    delete dto.isActive;

    if (dto.password !== undefined) {
      const p = String(dto.password).trim();
      if (p.length === 0) {
        delete dto.password;
      } else {
        dto.password = await bcrypt.hash(p, 10);
      }
    }

    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(dto)) {
      const v = dto[key];
      if (v !== undefined) {
        patch[key] = v;
      }
    }

    if (patch.parentId === id) {
      throw new BadRequestException('parentId cannot equal the user id');
    }
    if (patch.parentId) {
      const parent = await this.userRepository.findOne({
        where: { id: patch.parentId as string },
      });
      if (!parent) {
        throw new BadRequestException('Parent user not found');
      }
    }
    if (patch.referralUserId) {
      const ref = await this.userRepository.findOne({
        where: { id: patch.referralUserId as string },
      });
      if (!ref) {
        throw new BadRequestException('Referral user (referralUserId) not found');
      }
    }
    
    // Automatically set/increase totalPurchaseAmount to match package price if packageType changes and it is currently lower
    if (patch.packageType !== undefined && patch.packageType !== user.packageType) {
      if (patch.packageType !== 'NONE') {
        const pkg = await this.packagesService.findByCode(String(patch.packageType));
        if (pkg) {
          const currentPurchase = patch.totalPurchaseAmount !== undefined
            ? Number(patch.totalPurchaseAmount)
            : Number(user.totalPurchaseAmount || 0);
          
          if (currentPurchase < Number(pkg.price)) {
            patch.totalPurchaseAmount = Number(pkg.price);
          }
        }
      }
    }

    if (Object.keys(patch).length === 0) {
      return this.stripSensitiveUser(user);
    }

    try {
      await this.userRepository.update(id, patch as any);
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY' || error.code === '23505') {
        throw new ConflictException(
          'Email, username or wallet address already exists',
        );
      }
      Logger.error(`Failed to update user ${id}`, error.stack, 'UserService');
      throw new InternalServerErrorException('Failed to update user');
    }

    const updated = await this.userRepository.findOne({ where: { id } });
    if (!updated) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Propagate volume changes to ancestors if admin manually updated them
    const leftDelta =
      patch.leftBranchTotal !== undefined
        ? Number(patch.leftBranchTotal) - Number(user.leftBranchTotal || 0)
        : 0;
    const rightDelta =
      patch.rightBranchTotal !== undefined
        ? Number(patch.rightBranchTotal) - Number(user.rightBranchTotal || 0)
        : 0;

    if (leftDelta !== 0 || rightDelta !== 0) {
      await this.propagateManualVolumeChange(updated, leftDelta, rightDelta);
    }

    return this.stripSensitiveUser(updated);
  }

  /**
   * Propagates manual volume changes to all ancestors in the binary tree.
   * This is used when an admin manually adjusts a user's branch totals.
   */
  private async propagateManualVolumeChange(
    user: User,
    leftDelta: number,
    rightDelta: number,
  ): Promise<void> {
    if (!user.parentId) return;

    const chain = await this.buildParentChainForUser(user);
    const ancestors = chain.map((entry) => entry.user);
    const totalDelta = leftDelta + rightDelta;

    if (totalDelta === 0) return;

    for (const ancestor of ancestors) {
      const childSide = this.findBuyerSideFromChain(ancestor.id, chain);

      await this.userRepository
        .createQueryBuilder()
        .update(User)
        .set({
          [childSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal']: () =>
            `${childSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal'} + ${totalDelta}`,
        })
        .where('id = :id', { id: ancestor.id })
        .execute();
    }
  }

  async remove(id: string) {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // 1. Get all confirmed orders to subtract volume from ancestors
    const confirmedOrders = await this.orderRepository.find({
      where: { userId: id, status: OrderStatus.CONFIRMED },
    });

    for (const order of confirmedOrders) {
      await this.subtractBranchVolumes(order, user);
    }

    // 2. Get all orders to clean up associated commissions first
    const userOrders = await this.orderRepository.find({
      where: { userId: id },
      select: ['id'],
    });
    const orderIds = userOrders.map((o) => o.id);

    // 3. Delete all commissions associated with this user's orders
    if (orderIds.length > 0) {
      await this.commissionRepository.delete({ orderId: In(orderIds) });
    }

    // 4. Delete all other commissions (where user is receiver or generator)
    await this.commissionRepository.delete({ userId: id });
    await this.commissionRepository.delete({ fromUserId: id });

    // 5. Delete all orders associated with this user
    await this.orderRepository.delete({ userId: id });

    // 6. Delete all addresses associated with this user
    await this.addressRepository.delete({ userId: id });

    // 7. Delete KYC records — phải xóa trước user do FK constraint không có CASCADE
    await this.kycRepository.delete({ userId: id });

    // 8. Delete all milestones and audit logs
    await this.milestoneRepository.delete({ userId: id });
    await this.auditLogRepository.delete({ userId: id });

    // 9. Update children in the referral tree (orphan them)
    await this.userRepository.update(
      { parentId: id },
      { parentId: null as any },
    );

    // 10. Finally delete the user
    return this.userRepository.delete(id);
  }

  /**
   * Subtract branch volume from all ancestors when an order is "deleted" along with its user
   */
  private async subtractBranchVolumes(
    order: Order,
    buyer: User,
  ): Promise<void> {
    if (!buyer.parentId) return;

    const chain = await this.buildParentChainForUser(buyer);
    const ancestors = chain.map((entry) => entry.user);

    for (const ancestor of ancestors) {
      const buyerSide = this.findBuyerSideFromChain(ancestor.id, chain);

      // Subtract volume using Atomical update
      await this.userRepository
        .createQueryBuilder()
        .update(User)
        .set({
          [buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal']: () =>
            `${buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal'} - ${order.totalAmount}`,
        })
        .where('id = :id', { id: ancestor.id })
        .execute();
    }
  }

  private async getAncestorsForVolumeAdjustment(user: User): Promise<User[]> {
    const chain = await this.buildParentChainForUser(user);
    return chain.map((entry) => entry.user);
  }

  private async buildParentChainForUser(
    user: User,
  ): Promise<Array<{ user: User; childPosition: 'left' | 'right' }>> {
    let current = user;
    const chain: Array<{ user: User; childPosition: 'left' | 'right' }> = [];
    while (current && current.parentId) {
      const parent = await this.userRepository.findOne({
        where: { id: current.parentId },
      });
      if (parent) {
        chain.push({
          user: parent,
          childPosition: current.position ?? 'left',
        });
        current = parent;
      } else {
        break;
      }
    }
    return chain;
  }

  private async findBuyerSideForAncestor(
    buyer: User,
    ancestor: User,
  ): Promise<'left' | 'right'> {
    const chain = await this.buildParentChainForUser(buyer);
    return this.findBuyerSideFromChain(ancestor.id, chain);
  }

  private findBuyerSideFromChain(
    ancestorId: string,
    chain: Array<{ user: User; childPosition: 'left' | 'right' }>,
  ): 'left' | 'right' {
    const entry = chain.find((item) => item.user.id === ancestorId);
    return entry?.childPosition ?? 'left';
  }

  // Address Methods
  async getAddresses(userId: string) {
    return this.addressRepository.find({ where: { userId } });
  }

  async addAddress(userId: string, data: any) {
    const address = this.addressRepository.create({ ...data, userId });
    // If default, unset others first? Or handle in frontend? Ideally backend constraint.
    if (data.isDefault) {
      await this.addressRepository.update({ userId }, { isDefault: false });
    }
    return this.addressRepository.save(address);
  }

  async updateAddress(userId: string, addressId: string, data: any) {
    if (data.isDefault) {
      await this.addressRepository.update({ userId }, { isDefault: false });
    }
    const updateResult = await this.addressRepository.update(
      { id: addressId, userId },
      data,
    );
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Address with ID ${addressId} not found`);
    }
    return this.addressRepository.findOne({ where: { id: addressId } });
  }

  async deleteAddress(userId: string, addressId: string) {
    return this.addressRepository.delete({ id: addressId, userId });
  }

  /**
   * Count total users excluding admin users
   * Used to determine if this is the first user registration
   */
  async countNonAdminUsers(): Promise<number> {
    return this.userRepository.count({
      where: { isAdmin: false },
    });
  }
}
