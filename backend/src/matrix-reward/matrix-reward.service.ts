import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { MatrixRewardTree } from './entities/matrix-reward-tree.entity';
import {
  MatrixRewardNode,
  MatrixNodeSide,
} from './entities/matrix-reward-node.entity';
import { MatrixRewardLedger } from './entities/matrix-reward-ledger.entity';
import { MatrixTreeExclusion } from './entities/matrix-tree-exclusion.entity';
import { MatrixRewardOrderProcessed } from './entities/matrix-reward-order-processed.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { User } from '../user/entities/user.entity';
import { SystemConfig } from '../admin/entities/system-config.entity';
import { PackagesService } from '../packages/packages.service';

const CFG_MIN_ORDER = 'matrixRewardMinOrderUsd';
const CFG_PER_SLOT = 'matrixRewardPerSlotUsd';
const CFG_MAX_EARN = 'matrixRewardMaxEarnPerTreeUsd';
const CFG_MAX_UPLINES = 'matrixRewardMaxUplines';
const CFG_PREV_TREE_QUALIFY_PERCENT = 'matrixRewardPrevTreeQualifyPercent';
const CFG_ENABLED = 'matrixRewardEnabled';

/** Kết quả chi tiết của processOrderIfEligible — dùng để thống kê backfill. */
type ProcessResult =
  | 'system_disabled'   // hệ thống matrix đang tắt
  | 'already_done'      // đã xử lý từ trước (idempotent)
  | 'already_in_tree'   // buyer đã có vị trí trong matrix -> bỏ qua
  | 'invalid_order'     // đơn không tồn tại / chưa CONFIRMED
  | 'below_min_order'   // giá trị đơn < minOrderUsd
  | 'prev_tree_not_met' // chưa đủ điều kiện cây trước (không mark processed)
  | 'placed_root'       // đặt thành root cây, chưa có upline để trả
  | 'paid'              // đặt node + trả hoa hồng cho ≥1 upline
  | 'placed_no_upline'; // đặt vào cây nhưng tất cả upline đã đạt maxEarn

function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function isDuplicateKeyError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '');
  const code = (err as any)?.code;
  if (code === 'ER_DUP_ENTRY' || code === '23505') return true;
  return /duplicate|unique constraint/i.test(msg);
}

@Injectable()
export class MatrixRewardService {
  private readonly logger = new Logger(MatrixRewardService.name);

  constructor(
    @InjectRepository(MatrixRewardTree)
    private readonly treeRepo: Repository<MatrixRewardTree>,
    @InjectRepository(MatrixRewardNode)
    private readonly nodeRepo: Repository<MatrixRewardNode>,
    @InjectRepository(MatrixRewardLedger)
    private readonly ledgerRepo: Repository<MatrixRewardLedger>,
    @InjectRepository(MatrixTreeExclusion)
    private readonly exclusionRepo: Repository<MatrixTreeExclusion>,
    @InjectRepository(MatrixRewardOrderProcessed)
    private readonly processedRepo: Repository<MatrixRewardOrderProcessed>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepo: Repository<SystemConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly packagesService: PackagesService,
    private readonly dataSource: DataSource,
  ) {}

  async getPublicConfig() {
    const [minOrder, perSlot, maxEarn, maxUplines, prevTreeQualifyPercent, enabled] =
      await Promise.all([
      this.getConfigNumber(CFG_MIN_ORDER, 100),
      this.getConfigNumber(CFG_PER_SLOT, 0.5),
      this.getConfigNumber(CFG_MAX_EARN, 1500),
      this.getConfigNumber(CFG_MAX_UPLINES, 11),
      this.getConfigNumber(CFG_PREV_TREE_QUALIFY_PERCENT, 100),
      this.getConfigBool(CFG_ENABLED, true),
      ]);
    return {
      minOrderUsd: minOrder,
      perSlotUsd: perSlot,
      maxEarnPerTreeUsd: maxEarn,
      maxUplines,
      prevTreeQualifyPercent,
      enabled,
    };
  }

  async getAdminConfig() {
    const rows = await this.systemConfigRepo.find({
      where: [
        { key: CFG_MIN_ORDER },
        { key: CFG_PER_SLOT },
        { key: CFG_MAX_EARN },
        { key: CFG_MAX_UPLINES },
        { key: CFG_PREV_TREE_QUALIFY_PERCENT },
        { key: CFG_ENABLED },
      ],
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      minOrderUsd: Number(map.get(CFG_MIN_ORDER) ?? 100),
      perSlotUsd: Number(map.get(CFG_PER_SLOT) ?? 0.5),
      maxEarnPerTreeUsd: Number(map.get(CFG_MAX_EARN) ?? 1500),
      maxUplines: Number(map.get(CFG_MAX_UPLINES) ?? 11),
      prevTreeQualifyPercent: Number(map.get(CFG_PREV_TREE_QUALIFY_PERCENT) ?? 100),
      enabled: (map.get(CFG_ENABLED) ?? 'true') !== 'false',
    };
  }

  async setAdminConfig(body: {
    minOrderUsd?: number;
    perSlotUsd?: number;
    maxEarnPerTreeUsd?: number;
    maxUplines?: number;
    prevTreeQualifyPercent?: number;
    enabled?: boolean;
  }) {
    const entries: Array<{ key: string; value: string }> = [];
    if (body.minOrderUsd != null)
      entries.push({ key: CFG_MIN_ORDER, value: String(body.minOrderUsd) });
    if (body.perSlotUsd != null)
      entries.push({ key: CFG_PER_SLOT, value: String(body.perSlotUsd) });
    if (body.maxEarnPerTreeUsd != null)
      entries.push({ key: CFG_MAX_EARN, value: String(body.maxEarnPerTreeUsd) });
    if (body.maxUplines != null)
      entries.push({ key: CFG_MAX_UPLINES, value: String(body.maxUplines) });
    if (body.prevTreeQualifyPercent != null)
      entries.push({ key: CFG_PREV_TREE_QUALIFY_PERCENT, value: String(body.prevTreeQualifyPercent) });
    if (body.enabled != null)
      entries.push({ key: CFG_ENABLED, value: body.enabled ? 'true' : 'false' });
    for (const e of entries) {
      let row = await this.systemConfigRepo.findOne({ where: { key: e.key } });
      if (!row) {
        row = this.systemConfigRepo.create({ key: e.key, value: e.value });
      } else {
        row.value = e.value;
      }
      await this.systemConfigRepo.save(row);
    }
    return this.getAdminConfig();
  }

  private async getConfigNumber(
    key: string,
    defaultVal: number,
  ): Promise<number> {
    const row = await this.systemConfigRepo.findOne({ where: { key } });
    if (!row?.value) return defaultVal;
    const n = Number(row.value);
    return Number.isFinite(n) ? n : defaultVal;
  }

  private async getConfigBool(key: string, defaultVal: boolean): Promise<boolean> {
    const row = await this.systemConfigRepo.findOne({ where: { key } });
    if (!row?.value) return defaultVal;
    return row.value !== 'false';
  }


  /**
   * Gọi khi đơn CONFIRMED. Idempotent theo orderId.
   * Trả về kết quả chi tiết để backfill có thể thống kê đúng.
   */
  async processOrderIfEligible(orderId: string): Promise<ProcessResult> {
    // Kiểm tra cờ bật/tắt toàn hệ thống matrix
    const enabled = await this.getConfigBool(CFG_ENABLED, true);
    if (!enabled) return 'system_disabled';

    const done = await this.processedRepo.findOne({ where: { orderId } });
    if (done) return 'already_done';

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.CONFIRMED || !order.userId) {
      return 'invalid_order';
    }

    const minOrder = await this.getConfigNumber(CFG_MIN_ORDER, 100);
    const orderTotal = roundMoney(Number(order.totalAmount));
    if (!Number.isFinite(orderTotal) || orderTotal < minOrder) {
      await this.safeMarkProcessed(orderId);
      return 'below_min_order';
    }

    const perSlot = await this.getConfigNumber(CFG_PER_SLOT, 0.5);
    const maxEarn = await this.getConfigNumber(CFG_MAX_EARN, 1500);
    const maxUplines = Math.max(
      1,
      Math.floor(await this.getConfigNumber(CFG_MAX_UPLINES, 11)),
    );

    let result: ProcessResult = 'placed_no_upline';

    try {
      await this.dataSource.transaction(async (manager) => {
        let claimed = false;
        try {
          await manager.insert(MatrixRewardOrderProcessed, { orderId });
          claimed = true;
        } catch (e) {
          if (isDuplicateKeyError(e)) {
            result = 'already_done';
            return;
          }
          throw e;
        }

        try {
          const buyerId = order.userId;
          const alreadyPlaced = await manager
            .getRepository(MatrixRewardNode)
            .findOne({
              where: { userId: buyerId },
              select: ['id'],
            });
          if (alreadyPlaced) {
            result = 'already_in_tree';
            return;
          }

          const nextLevel = await this.computeNextTreeLevel(buyerId, manager);
          const tree = await this.getOrCreateTree(nextLevel, manager);
          const treeId = tree.id;

          const placement = await this.findBfsPlacement(manager, treeId);

          // Root: không có parent → không có upline → không trả tiền ngay
          if (placement.parentNodeId === null) {
            result = 'placed_root';
          }

          const node = manager.create(MatrixRewardNode, {
            treeId,
            userId: buyerId,
            parentNodeId: placement.parentNodeId,
            side: placement.side,
            placementOrderId: orderId,
          });
          await manager.save(MatrixRewardNode, node);

          const uplines = await this.collectUplines(
            manager,
            treeId,
            node.id,
            maxUplines,
          );

          let paidCount = 0;
          for (const uplineNode of uplines) {
            const paid = await this.payUplineAndMaybeRemove({
              manager,
              treeId,
              treeLevel: tree.treeLevel,
              beneficiaryUserId: uplineNode.userId,
              sourceNodeId: node.id,
              orderId,
              perSlot,
              maxEarn,
            });
            if (paid) paidCount++;
          }

          if (paidCount > 0) {
            result = 'paid';
          } else if (placement.parentNodeId !== null) {
            // Có parent nhưng tất cả upline đã đạt maxEarn
            result = 'placed_no_upline';
          }
        } catch (inner) {
          if (claimed) {
            await manager.delete(MatrixRewardOrderProcessed, { orderId });
          }
          throw inner;
        }
      });
    } catch (err: any) {
      if (isDuplicateKeyError(err)) {
        this.logger.warn(`[MATRIX] duplicate skip order=${orderId}`);
        return 'already_done';
      }
      this.logger.error(
        `[MATRIX] processOrderIfEligible failed order=${orderId}: ${err?.message}`,
        err?.stack,
      );
      throw err;
    }

    return result;
  }

  private async checkPrevTreeEligibility(opts: {
    manager: EntityManager;
    userId: string;
    nextTreeLevel: number;
    prevTreeQualifyPercent: number;
  }): Promise<boolean> {
    const { manager, userId, nextTreeLevel, prevTreeQualifyPercent } = opts;

    // Tree đầu tiên luôn cho vào nếu đơn đủ điều kiện.
    if (nextTreeLevel <= 1) return true;

    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'packageType', 'totalPurchaseAmount'],
    });
    if (!user) return false;

    if (!user.packageType || user.packageType === 'NONE') {
      return false;
    }

    const pkg = await this.packagesService.findByCode(user.packageType);
    if (!pkg) return false;

    const maxEffectiveThreshold = this.packagesService.getEffectiveThreshold(
      Number(user.totalPurchaseAmount),
      pkg,
    );
    const requiredEarnOnPrevTree = roundMoney(
      (Math.max(0, Number(prevTreeQualifyPercent) || 0) / 100) *
        maxEffectiveThreshold,
    );

    const prevTree = await manager
      .getRepository(MatrixRewardTree)
      .findOne({ where: { treeLevel: nextTreeLevel - 1 } });
    if (!prevTree) {
      return false;
    }

    const earnedOnPrevTree = await this.sumLedgerForUserTree(
      manager,
      userId,
      prevTree.id,
    );
    return earnedOnPrevTree >= requiredEarnOnPrevTree;
  }

  /** Đánh dấu đã xử lý khi không đủ ngưỡng — tránh quét lại vô hạn. */
  private async safeMarkProcessed(orderId: string) {
    try {
      await this.processedRepo.save(
        this.processedRepo.create({ orderId }),
      );
    } catch {
      // duplicate OK
    }
  }

  private async computeNextTreeLevel(
    userId: string,
    manager: EntityManager,
  ): Promise<number> {
    const nodeRepo = manager.getRepository(MatrixRewardNode);
    const exRepo = manager.getRepository(MatrixTreeExclusion);

    const nodes = await nodeRepo.find({
      where: { userId },
      relations: ['tree'],
    });
    const activeLevels = nodes
      .map((n) => n.tree?.treeLevel)
      .filter((l): l is number => typeof l === 'number');
    const maxLevel = activeLevels.length > 0 ? Math.max(...activeLevels) : 0;
    const exclusions = await exRepo.find({
      where: { userId },
      select: ['treeLevel'],
    });
    const excludedLevels = new Set(exclusions.map((entry) => entry.treeLevel));
    let candidate = maxLevel + 1;
    for (let i = 0; i < 500; i++) {
      if (!excludedLevels.has(candidate)) return candidate;
      candidate++;
    }
    throw new Error('matrix tree level overflow');
  }

  private async getOrCreateTree(
    treeLevel: number,
    manager: EntityManager,
  ): Promise<MatrixRewardTree> {
    const repo = manager.getRepository(MatrixRewardTree);
    let t = await repo.findOne({ where: { treeLevel } });
    if (!t) {
      t = repo.create({ treeLevel });
      await repo.save(t);
    }
    return t;
  }

  private async findBfsPlacement(
    manager: EntityManager,
    treeId: string,
  ): Promise<{
    parentNodeId: string | null;
    side: MatrixNodeSide | null;
  }> {
    const nodeRepo = manager.getRepository(MatrixRewardNode);
    const nodes = await nodeRepo.find({
      where: { treeId },
      order: { createdAt: 'ASC' },
    });
    if (nodes.length === 0) {
      return { parentNodeId: null, side: null };
    }

    const childrenMap = new Map<
      string,
      { left?: MatrixRewardNode; right?: MatrixRewardNode }
    >();
    for (const n of nodes) {
      if (n.parentNodeId) {
        if (!childrenMap.has(n.parentNodeId)) {
          childrenMap.set(n.parentNodeId, {});
        }
        const slot = childrenMap.get(n.parentNodeId)!;
        if (n.side === MatrixNodeSide.LEFT) slot.left = n;
        if (n.side === MatrixNodeSide.RIGHT) slot.right = n;
      }
    }

    const root = nodes.find((n) => n.parentNodeId === null);
    if (!root) {
      throw new Error('Invalid matrix tree: missing root');
    }

    const queue: MatrixRewardNode[] = [root];
    while (queue.length) {
      const cur = queue.shift()!;
      const slot = childrenMap.get(cur.id) ?? {};
      if (!slot.left) {
        return { parentNodeId: cur.id, side: MatrixNodeSide.LEFT };
      }
      if (!slot.right) {
        return { parentNodeId: cur.id, side: MatrixNodeSide.RIGHT };
      }
      queue.push(slot.left);
      queue.push(slot.right);
    }
    throw new Error('No BFS placement found');
  }

  private async collectUplines(
    manager: EntityManager,
    treeId: string,
    fromNodeId: string,
    max: number,
  ): Promise<MatrixRewardNode[]> {
    const nodeRepo = manager.getRepository(MatrixRewardNode);
    const result: MatrixRewardNode[] = [];
    const allNodes = await nodeRepo.find({ where: { treeId } });
    const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
    let cur = nodeMap.get(fromNodeId);
    while (cur?.parentNodeId && result.length < max) {
      const parent = nodeMap.get(cur.parentNodeId);
      if (!parent) break;
      result.push(parent);
      cur = parent;
    }
    return result;
  }

  private async sumLedgerForUserTree(
    manager: EntityManager,
    beneficiaryUserId: string,
    treeId: string,
  ): Promise<number> {
    const raw = await manager
      .getRepository(MatrixRewardLedger)
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.amount),0)', 's')
      .where('l.beneficiaryUserId = :uid', { uid: beneficiaryUserId })
      .andWhere('l.treeId = :tid', { tid: treeId })
      .getRawOne();
    return roundMoney(Number(raw?.s ?? 0));
  }

  /** Dùng ngoài transaction (admin / user view). */
  private async sumLedgerForUserTreeExternal(
    beneficiaryUserId: string,
    treeId: string,
  ): Promise<number> {
    const raw = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.amount),0)', 's')
      .where('l.beneficiaryUserId = :uid', { uid: beneficiaryUserId })
      .andWhere('l.treeId = :tid', { tid: treeId })
      .getRawOne();
    return roundMoney(Number(raw?.s ?? 0));
  }

  private async payUplineAndMaybeRemove(opts: {
    manager: EntityManager;
    treeId: string;
    treeLevel: number;
    beneficiaryUserId: string;
    sourceNodeId: string;
    orderId: string;
    perSlot: number;
    maxEarn: number;
  }): Promise<boolean> {
    const {
      manager,
      treeId,
      treeLevel,
      beneficiaryUserId,
      sourceNodeId,
      orderId,
      perSlot,
      maxEarn,
    } = opts;

    const current = await this.sumLedgerForUserTree(
      manager,
      beneficiaryUserId,
      treeId,
    );
    if (current >= maxEarn) {
      return false;
    }
    const room = roundMoney(maxEarn - current);
    const pay = roundMoney(Math.min(perSlot, room));
    if (pay <= 0) return false;

    const userRepo = manager.getRepository(User);
    const u = await userRepo.findOne({
      where: { id: beneficiaryUserId },
      select: [
        'id',
        'withdrawWalletBalance',
        'packageType',
        'totalPurchaseAmount',
        'totalCommissionReceived',
      ],
    });
    if (!u) return false;
    const eligible = await this.isMatrixPayoutEligible(u);
    if (!eligible) {
      return false;
    }

    const bal = roundMoney(Number(u.withdrawWalletBalance ?? 0));
    await userRepo.update(beneficiaryUserId, {
      withdrawWalletBalance: bal + pay,
    });

    await manager.save(
      MatrixRewardLedger,
      manager.create(MatrixRewardLedger, {
        treeId,
        beneficiaryUserId,
        amount: pay,
        sourceNodeId,
        orderId,
      }),
    );

    const newTotal = roundMoney(current + pay);
    if (newTotal >= maxEarn) {
      await this.removeUserFromTreeAndExclude(
        manager,
        treeId,
        treeLevel,
        beneficiaryUserId,
      );
    }
    return true;
  }

  private async isMatrixPayoutEligible(
    user: Pick<
      User,
      'packageType' | 'totalPurchaseAmount' | 'totalCommissionReceived'
    >,
  ): Promise<boolean> {
    if (!user.packageType || user.packageType === 'NONE') return false;
    const pkg = await this.packagesService.findByCode(user.packageType);
    if (!pkg) return false;
    const effectiveThreshold = this.packagesService.getEffectiveThreshold(
      Number(user.totalPurchaseAmount || 0),
      pkg,
    );
    return Number(user.totalCommissionReceived || 0) < effectiveThreshold;
  }

  private async removeUserFromTreeAndExclude(
    manager: EntityManager,
    treeId: string,
    treeLevel: number,
    userId: string,
  ): Promise<void> {
    const nodeRepo = manager.getRepository(MatrixRewardNode);
    const node = await nodeRepo.findOne({ where: { treeId, userId } });
    if (!node) return;

    await this.removeNodeRestructure(manager, treeId, node.id);

    const exRepo = manager.getRepository(MatrixTreeExclusion);
    const exists = await exRepo.findOne({ where: { userId, treeLevel } });
    if (!exists) {
      await manager.save(
        MatrixTreeExclusion,
        exRepo.create({ userId, treeLevel }),
      );
    }
  }

  /**
   * Xóa node: ưu tiên đưa con trái lên; con phải gắn vào ô trống đầu tiên (BFS) dưới subtree sau khi promote.
   */
  private async removeNodeRestructure(
    manager: EntityManager,
    treeId: string,
    nodeId: string,
  ): Promise<void> {
    const nodeRepo = manager.getRepository(MatrixRewardNode);
    const n = await nodeRepo.findOne({ where: { id: nodeId, treeId } });
    if (!n) return;

    const left = await nodeRepo.findOne({
      where: {
        treeId,
        parentNodeId: nodeId,
        side: MatrixNodeSide.LEFT,
      },
    });
    const right = await nodeRepo.findOne({
      where: {
        treeId,
        parentNodeId: nodeId,
        side: MatrixNodeSide.RIGHT,
      },
    });

    const parentNodeId = n.parentNodeId;
    const side = n.side;

    if (!left && !right) {
      await nodeRepo.delete({ id: nodeId, treeId });
      return;
    }

    if (left && !right) {
      await nodeRepo.update(
        { id: left.id },
        { parentNodeId, side: side ?? null },
      );
      await nodeRepo.delete({ id: nodeId, treeId });
      return;
    }

    if (!left && right) {
      await nodeRepo.update(
        { id: right.id },
        { parentNodeId, side: side ?? null },
      );
      await nodeRepo.delete({ id: nodeId, treeId });
      return;
    }

    // both
    await nodeRepo.update(
      { id: left!.id },
      { parentNodeId, side: side ?? null },
    );
    await nodeRepo.delete({ id: nodeId, treeId });

    const attach = await this.findFirstEmptyUnder(manager, treeId, left!.id);
    if (attach) {
      await nodeRepo.update(
        { id: right!.id },
        {
          parentNodeId: attach.parentNodeId,
          side: attach.side,
        },
      );
    }
  }

  private async findFirstEmptyUnder(
    manager: EntityManager,
    treeId: string,
    rootId: string,
  ): Promise<{ parentNodeId: string; side: MatrixNodeSide } | null> {
    const nodeRepo = manager.getRepository(MatrixRewardNode);
    const nodes = await nodeRepo.find({ where: { treeId } });
    const childrenByParent = new Map<string, { left?: string; right?: string }>();
    for (const node of nodes) {
      if (!node.parentNodeId) continue;
      if (!childrenByParent.has(node.parentNodeId)) {
        childrenByParent.set(node.parentNodeId, {});
      }
      const slot = childrenByParent.get(node.parentNodeId)!;
      if (node.side === MatrixNodeSide.LEFT) slot.left = node.id;
      if (node.side === MatrixNodeSide.RIGHT) slot.right = node.id;
    }
    const queue: string[] = [rootId];
    while (queue.length) {
      const id = queue.shift()!;
      const slot = childrenByParent.get(id) ?? {};
      if (!slot.left) return { parentNodeId: id, side: MatrixNodeSide.LEFT };
      if (!slot.right) return { parentNodeId: id, side: MatrixNodeSide.RIGHT };
      queue.push(slot.left);
      queue.push(slot.right);
    }
    return null;
  }

  async getTreeViewForLevel(treeLevel: number) {
    const tree = await this.treeRepo.findOne({ where: { treeLevel } });
    if (!tree) {
      return { treeLevel, root: null, nodeCount: 0 };
    }
    const nodes = await this.nodeRepo.find({
      where: { treeId: tree.id },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    const userIds = [...new Set(nodes.map((node) => node.userId))];
    const earnedByUser = new Map<string, number>();
    if (userIds.length > 0) {
      const ledgerRows = await this.ledgerRepo
        .createQueryBuilder('l')
        .select('l.beneficiaryUserId', 'beneficiaryUserId')
        .addSelect('COALESCE(SUM(l.amount),0)', 'total')
        .where('l.treeId = :treeId', { treeId: tree.id })
        .andWhere('l.beneficiaryUserId IN (:...userIds)', { userIds })
        .groupBy('l.beneficiaryUserId')
        .getRawMany<{ beneficiaryUserId: string; total: string }>();
      for (const row of ledgerRows) {
        earnedByUser.set(row.beneficiaryUserId, roundMoney(Number(row.total) || 0));
      }
    }

    const byId = new Map(nodes.map((x) => [x.id, x]));
    const childrenByParent = new Map<
      string,
      { left?: MatrixRewardNode; right?: MatrixRewardNode }
    >();
    for (const node of nodes) {
      if (!node.parentNodeId) continue;
      if (!childrenByParent.has(node.parentNodeId)) {
        childrenByParent.set(node.parentNodeId, {});
      }
      const slot = childrenByParent.get(node.parentNodeId)!;
      if (node.side === MatrixNodeSide.LEFT) slot.left = node;
      if (node.side === MatrixNodeSide.RIGHT) slot.right = node;
    }
    const build = (id: string): any => {
      const node = byId.get(id)!;
      const u = node.user;
      const slot = childrenByParent.get(id) ?? {};
      const left = slot.left;
      const right = slot.right;
      const children: any[] = [];
      if (left) {
        children.push({
          ...build(left.id),
          position: 'left',
        });
      }
      if (right) {
        children.push({
          ...build(right.id),
          position: 'right',
        });
      }
      return {
        id: node.id,
        userId: node.userId,
        username: u?.username ?? null,
        fullName: u?.fullName ?? u?.email ?? '',
        email: u?.email ?? '',
        packageType: (u?.packageType as string) || 'NONE',
        matrixEarnedOnTree: earnedByUser.get(node.userId) ?? 0,
        avatar: u?.avatar,
        leftBranchTotal: 0,
        rightBranchTotal: 0,
        totalPurchaseAmount: Number(u?.totalPurchaseAmount ?? 0),
        createdAt: node.createdAt?.toISOString?.() ?? '',
        position:
          node.side === MatrixNodeSide.LEFT
            ? 'left'
            : node.side === MatrixNodeSide.RIGHT
              ? 'right'
              : undefined,
        children: children.length ? children : undefined,
      };
    };

    const root = nodes.find((n) => n.parentNodeId === null);
    return {
      treeLevel,
      treeId: tree.id,
      nodeCount: nodes.length,
      root: root ? build(root.id) : null,
    };
  }

  async listTreeLevels(): Promise<number[]> {
    const trees = await this.treeRepo.find({ order: { treeLevel: 'ASC' } });
    return trees.map((t) => t.treeLevel);
  }

  async getLedgerHistory(params?: {
    page?: number;
    limit?: number;
    userId?: string;
    orderId?: string;
    type?: 'all' | 'credit' | 'debit';
  }): Promise<{
    items: Array<{
      id: string;
      createdAt: Date;
      treeId: string;
      orderId: string;
      beneficiaryUserId: string;
      beneficiaryUsername: string | null;
      beneficiaryEmail: string | null;
      sourceNodeId: string;
      amount: number;
    }>;
    page: number;
    limit: number;
    total: number;
  }> {
    const page = Math.max(1, Math.floor(Number(params?.page ?? 1)));
    const limit = Math.max(1, Math.min(200, Math.floor(Number(params?.limit ?? 20))));
    const userId = (params?.userId || '').trim();
    const orderId = (params?.orderId || '').trim();
    const type = params?.type ?? 'all';

    const qb = this.ledgerRepo
      .createQueryBuilder('l')
      .leftJoin(User, 'u', 'u.id = l.beneficiaryUserId')
      .select([
        'l.id AS id',
        'l.createdAt AS createdAt',
        'l.treeId AS treeId',
        'l.orderId AS orderId',
        'l.beneficiaryUserId AS beneficiaryUserId',
        'u.username AS beneficiaryUsername',
        'u.email AS beneficiaryEmail',
        'l.sourceNodeId AS sourceNodeId',
        'l.amount AS amount',
      ])
      .orderBy('l.createdAt', 'DESC')
      .addOrderBy('l.id', 'DESC');

    if (userId) qb.andWhere('l.beneficiaryUserId = :userId', { userId });
    if (orderId) qb.andWhere('l.orderId = :orderId', { orderId });
    if (type === 'credit') qb.andWhere('l.amount > 0');
    if (type === 'debit') qb.andWhere('l.amount < 0');

    const total = await qb.getCount();
    const rows = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<{
        id: string;
        createdAt: Date;
        treeId: string;
        orderId: string;
        beneficiaryUserId: string;
        beneficiaryUsername: string | null;
        beneficiaryEmail: string | null;
        sourceNodeId: string;
        amount: string;
      }>();

    return {
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        treeId: row.treeId,
        orderId: row.orderId,
        beneficiaryUserId: row.beneficiaryUserId,
        beneficiaryUsername: row.beneficiaryUsername ?? null,
        beneficiaryEmail: row.beneficiaryEmail ?? null,
        sourceNodeId: row.sourceNodeId,
        amount: roundMoney(Number(row.amount ?? 0)),
      })),
      page,
      limit,
      total,
    };
  }

  async getLedgerSummary(params?: {
    userId?: string;
    orderId?: string;
  }): Promise<{
    totalCreditAmount: number;
    totalDebitAmount: number;
    netAmount: number;
    creditCount: number;
    debitCount: number;
    outstandingPairCount: number;
  }> {
    const userId = (params?.userId || '').trim();
    const orderId = (params?.orderId || '').trim();

    const baseQb = this.ledgerRepo.createQueryBuilder('l');
    if (userId) baseQb.andWhere('l.beneficiaryUserId = :userId', { userId });
    if (orderId) baseQb.andWhere('l.orderId = :orderId', { orderId });

    const totals = await baseQb
      .clone()
      .select('COALESCE(SUM(CASE WHEN l.amount > 0 THEN l.amount ELSE 0 END),0)', 'credit')
      .addSelect('COALESCE(SUM(CASE WHEN l.amount < 0 THEN l.amount ELSE 0 END),0)', 'debit')
      .addSelect('COALESCE(SUM(l.amount),0)', 'net')
      .getRawOne<{ credit: string; debit: string; net: string }>();

    const counts = await baseQb
      .clone()
      .select('COALESCE(SUM(CASE WHEN l.amount > 0 THEN 1 ELSE 0 END),0)', 'creditCount')
      .addSelect('COALESCE(SUM(CASE WHEN l.amount < 0 THEN 1 ELSE 0 END),0)', 'debitCount')
      .getRawOne<{ creditCount: string; debitCount: string }>();

    const pairQb = this.ledgerRepo
      .createQueryBuilder('l')
      .select('l.beneficiaryUserId', 'userId')
      .addSelect('l.orderId', 'orderId')
      .groupBy('l.beneficiaryUserId')
      .addGroupBy('l.orderId')
      .having('COALESCE(SUM(l.amount),0) > 0');

    if (userId) pairQb.andWhere('l.beneficiaryUserId = :userId', { userId });
    if (orderId) pairQb.andWhere('l.orderId = :orderId', { orderId });
    // getCount() on grouped query can return base-row count in some TypeORM versions.
    // Count raw grouped rows to get the true number of outstanding (userId, orderId) pairs.
    const outstandingPairs = await pairQb.getRawMany<{ userId: string; orderId: string }>();
    const outstandingPairCount = outstandingPairs.length;

    return {
      totalCreditAmount: roundMoney(Number(totals?.credit ?? 0)),
      totalDebitAmount: roundMoney(Number(totals?.debit ?? 0)),
      netAmount: roundMoney(Number(totals?.net ?? 0)),
      creditCount: Number(counts?.creditCount ?? 0),
      debitCount: Number(counts?.debitCount ?? 0),
      outstandingPairCount,
    };
  }

  /**
   * Admin: quét lại đơn CONFIRMED cũ và chạy matrix theo thứ tự thời gian.
   * Dùng để backfill dữ liệu trước khi có module matrix.
   */
  async backfillConfirmedOrders(options?: {
    maxOrders?: number;
    fromDate?: string;
    onlyUnprocessed?: boolean;
  }): Promise<{
    scanned: number;
    processed: number;
    failed: number;
    skipped: number;
    paid: number;
    placedRoot: number;
    placedNoUpline: number;
    prevTreeNotMet: number;
    alreadyDone: number;
    alreadyInTree: number;
    failedOrderIds: string[];
    systemDisabled: boolean;
  }> {
    const maxOrders = Math.max(
      1,
      Math.min(5000, Math.floor(Number(options?.maxOrders ?? 500))),
    );
    const onlyUnprocessed = options?.onlyUnprocessed !== false;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoin(MatrixRewardOrderProcessed, 'p', 'p.orderId = o.id')
      .where('o.status IN (:...statuses)', {
        statuses: [
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ],
      })
      .orderBy('o.createdAt', 'ASC')
      .addOrderBy('o.id', 'ASC')
      // Dùng limit() thay vì take() để tránh TypeORM sinh subquery DISTINCT
      // khiến ORDER BY o_createdAt lỗi ER_BAD_FIELD_ERROR khi chỉ SELECT o.id
      .limit(maxOrders);

    if (options?.fromDate) {
      const from = new Date(options.fromDate);
      if (!Number.isNaN(from.getTime())) {
        qb.andWhere('o.createdAt >= :from', { from: from.toISOString() });
      }
    }

    if (onlyUnprocessed) {
      qb.andWhere('p.orderId IS NULL');
    }

    const orders = await qb.select(['o.id', 'o.createdAt']).getMany();

    // Nếu hệ thống matrix đang tắt, không cần quét từng đơn
    const matrixEnabled = await this.getConfigBool(CFG_ENABLED, true);
    if (!matrixEnabled) {
      return {
        scanned: 0,
        processed: 0,
        failed: 0,
        skipped: 0,
        paid: 0,
        placedRoot: 0,
        placedNoUpline: 0,
        prevTreeNotMet: 0,
        alreadyDone: 0,
        alreadyInTree: 0,
        failedOrderIds: [],
        systemDisabled: true,
      };
    }

    let processed = 0;
    let failed = 0;
    let paid = 0;
    let placedRoot = 0;
    let placedNoUpline = 0;
    let prevTreeNotMet = 0;
    let alreadyDone = 0;
    let alreadyInTree = 0;
    const failedOrderIds: string[] = [];

    for (const order of orders) {
      try {
        const result = await this.processOrderIfEligible(order.id);
        processed += 1;
        if (result === 'paid') paid++;
        else if (result === 'placed_root') placedRoot++;
        else if (result === 'placed_no_upline') placedNoUpline++;
        else if (result === 'prev_tree_not_met') prevTreeNotMet++;
        else if (result === 'already_done') alreadyDone++;
        else if (result === 'already_in_tree') alreadyInTree++;
      } catch (error) {
        failed += 1;
        failedOrderIds.push(order.id);
        this.logger.error(
          `[MATRIX] backfill failed order=${order.id}: ${(error as any)?.message}`,
        );
      }
    }

    return {
      scanned: orders.length,
      processed,
      failed,
      skipped: Math.max(0, orders.length - processed - failed),
      paid,
      placedRoot,
      placedNoUpline,
      prevTreeNotMet,
      alreadyDone,
      alreadyInTree,
      failedOrderIds,
      systemDisabled: false,
    };
  }

  /**
   * Admin: tạo sẵn cây matrix từ level 1..maxLevel (idempotent).
   */
  async ensureTreesUpTo(maxLevel: number): Promise<{
    requestedMaxLevel: number;
    createdLevels: number[];
    existingLevels: number[];
  }> {
    const target = Math.floor(Number(maxLevel));
    if (!Number.isFinite(target) || target < 1) {
      throw new BadRequestException('maxLevel must be >= 1');
    }
    if (target > 1000) {
      throw new BadRequestException('maxLevel too large (max 1000)');
    }

    const existing = await this.treeRepo.find({ order: { treeLevel: 'ASC' } });
    const existingSet = new Set(existing.map((tree) => tree.treeLevel));
    const createdLevels: number[] = [];
    const existingLevels: number[] = [];

    for (let level = 1; level <= target; level++) {
      if (existingSet.has(level)) {
        existingLevels.push(level);
        continue;
      }
      const tree = this.treeRepo.create({ treeLevel: level });
      await this.treeRepo.save(tree);
      createdLevels.push(level);
    }

    return {
      requestedMaxLevel: target,
      createdLevels,
      existingLevels,
    };
  }

  /**
   * Admin: đặt user làm gốc cây matrix theo treeLevel.
   * Chỉ cho phép khi cây trống hoặc chỉ có một node gốc (chưa có con) — tránh phá cấu trúc BFS đã hình thành.
   */
  async setAdminTreeRoot(
    treeLevel: number,
    userId: string,
  ): Promise<{
    treeLevel: number;
    treeId: string;
    rootNodeId: string;
    userId: string;
  }> {
    const uid = (userId || '').trim();
    if (!uid) {
      throw new BadRequestException('userId is required');
    }

    const user = await this.userRepo.findOne({
      where: { id: uid },
      select: ['id'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.dataSource.transaction(async (manager) => {
      const treeRepo = manager.getRepository(MatrixRewardTree);
      const nodeRepo = manager.getRepository(MatrixRewardNode);

      let tree = await treeRepo.findOne({ where: { treeLevel } });
      if (!tree) {
        tree = treeRepo.create({ treeLevel });
        await treeRepo.save(tree);
      }

      const treeId = tree.id;
      const nodes = await nodeRepo.find({ where: { treeId } });

      if (nodes.length === 0) {
        const node = manager.create(MatrixRewardNode, {
          treeId,
          userId: uid,
          parentNodeId: null,
          side: null,
          placementOrderId: null,
        });
        await manager.save(MatrixRewardNode, node);
        this.logger.log(
          `[MATRIX] Admin set root: treeLevel=${treeLevel} userId=${uid} (new root)`,
        );
        return {
          treeLevel,
          treeId,
          rootNodeId: node.id,
          userId: uid,
        };
      }

      const root = nodes.find((n) => n.parentNodeId === null);
      if (!root) {
        throw new BadRequestException(
          'Invalid matrix tree: missing root node; contact support.',
        );
      }

      const children = nodes.filter((n) => n.parentNodeId === root.id);
      if (children.length > 0) {
        throw new BadRequestException(
          'Chỉ đặt gốc khi cây trống hoặc chỉ có một node gốc (chưa có nhánh con).',
        );
      }

      if (root.userId === uid) {
        return {
          treeLevel,
          treeId,
          rootNodeId: root.id,
          userId: uid,
        };
      }

      const duplicateUser = nodes.find(
        (n) => n.userId === uid && n.id !== root.id,
      );
      if (duplicateUser) {
        throw new BadRequestException(
          'User đã có vị trí khác trên cây này; không thể đặt làm gốc.',
        );
      }

      await nodeRepo.update(root.id, { userId: uid });
      this.logger.log(
        `[MATRIX] Admin changed root user: treeLevel=${treeLevel} rootNodeId=${root.id} userId=${uid}`,
      );

      return {
        treeLevel,
        treeId,
        rootNodeId: root.id,
        userId: uid,
      };
    });
  }

  async addUserToTree(
    treeLevel: number,
    userId: string,
  ): Promise<{
    treeLevel: number;
    treeId: string;
    nodeId: string;
    userId: string;
    parentNodeId: string | null;
    side: 'left' | 'right' | null;
  }> {
    const uid = (userId || '').trim();
    if (!uid) throw new BadRequestException('userId is required');
    const user = await this.userRepo.findOne({ where: { id: uid }, select: ['id'] });
    if (!user) throw new NotFoundException('User not found');

    return this.dataSource.transaction(async (manager) => {
      const treeRepo = manager.getRepository(MatrixRewardTree);
      const nodeRepo = manager.getRepository(MatrixRewardNode);
      let tree = await treeRepo.findOne({ where: { treeLevel } });
      if (!tree) {
        tree = treeRepo.create({ treeLevel });
        await treeRepo.save(tree);
      }
      const treeId = tree.id;

      const existed = await nodeRepo.findOne({ where: { treeId, userId: uid } });
      if (existed) {
        throw new BadRequestException('User đã tồn tại trên cây này');
      }

      const placement = await this.findBfsPlacement(manager, treeId);

      const node = manager.create(MatrixRewardNode, {
        treeId,
        userId: uid,
        parentNodeId: placement.parentNodeId,
        side: placement.side,
        placementOrderId: null,
      });
      await manager.save(MatrixRewardNode, node);
      return {
        treeLevel,
        treeId,
        nodeId: node.id,
        userId: uid,
        parentNodeId: placement.parentNodeId,
        side:
          placement.side === MatrixNodeSide.LEFT
            ? 'left'
            : placement.side === MatrixNodeSide.RIGHT
              ? 'right'
              : null,
      };
    });
  }

  async clearAllTreesAndRewards(): Promise<{
    treesDeleted: number;
    nodesDeleted: number;
    ledgersDeleted: number;
    exclusionsDeleted: number;
    processedDeleted: number;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const treeRepo = manager.getRepository(MatrixRewardTree);
      const nodeRepo = manager.getRepository(MatrixRewardNode);
      const ledgerRepo = manager.getRepository(MatrixRewardLedger);
      const exclusionRepo = manager.getRepository(MatrixTreeExclusion);
      const processedRepo = manager.getRepository(MatrixRewardOrderProcessed);

      const treesDeleted = await treeRepo.count();
      const nodesDeleted = await nodeRepo.count();
      const ledgersDeleted = await ledgerRepo.count();
      const exclusionsDeleted = await exclusionRepo.count();
      const processedDeleted = await processedRepo.count();

      await manager.createQueryBuilder().delete().from(MatrixRewardLedger).execute();
      await manager.createQueryBuilder().delete().from(MatrixRewardNode).execute();
      await manager.createQueryBuilder().delete().from(MatrixTreeExclusion).execute();
      await manager.createQueryBuilder().delete().from(MatrixRewardOrderProcessed).execute();
      await manager.createQueryBuilder().delete().from(MatrixRewardTree).execute();

      this.logger.warn(
        `[MATRIX] Admin cleared all trees and rewards: trees=${treesDeleted}, nodes=${nodesDeleted}, ledgers=${ledgersDeleted}`,
      );

      return {
        treesDeleted,
        nodesDeleted,
        ledgersDeleted,
        exclusionsDeleted,
        processedDeleted,
      };
    });
  }

  async getMySummary(userId: string) {
    const nodes = await this.nodeRepo.find({
      where: { userId },
      relations: ['tree'],
    });
    const out: Array<{
      treeLevel: number;
      treeId: string;
      nodeId: string;
      earnedOnTreeUsd: number;
    }> = [];
    const treeIds = [...new Set(nodes.map((node) => node.treeId))];
    const earnedByTree = new Map<string, number>();
    if (treeIds.length > 0) {
      const rows = await this.ledgerRepo
        .createQueryBuilder('l')
        .select('l.treeId', 'treeId')
        .addSelect('COALESCE(SUM(l.amount),0)', 'total')
        .where('l.beneficiaryUserId = :userId', { userId })
        .andWhere('l.treeId IN (:...treeIds)', { treeIds })
        .groupBy('l.treeId')
        .getRawMany<{ treeId: string; total: string }>();
      for (const row of rows) {
        earnedByTree.set(row.treeId, roundMoney(Number(row.total) || 0));
      }
    }

    for (const n of nodes) {
      const tid = n.treeId;
      out.push({
        treeLevel: n.tree?.treeLevel ?? 0,
        treeId: tid,
        nodeId: n.id,
        earnedOnTreeUsd: earnedByTree.get(tid) ?? 0,
      });
    }
    out.sort((a, b) => a.treeLevel - b.treeLevel);
    const exclusions = await this.exclusionRepo.find({ where: { userId } });
    return {
      positions: out,
      excludedTreeLevels: exclusions.map((e) => e.treeLevel),
      config: await this.getPublicConfig(),
    };
  }

  /**
   * Admin: hoàn tác (trừ lại) tiền matrix đã cộng vào ví user theo orderId.
   * Idempotent theo (userId, orderId): chỉ trừ phần còn "net dương" chưa reverse.
   */
  async reverseRewardByOrder(params: {
    userId: string;
    orderId: string;
    reason?: string;
  }): Promise<{
    userId: string;
    orderId: string;
    reversedAmount: number;
    balanceBefore: number;
    balanceAfter: number;
    note: string;
  }> {
    const userId = (params.userId || '').trim();
    const orderId = (params.orderId || '').trim();
    const reason = (params.reason || '').trim();
    if (!userId) throw new BadRequestException('userId is required');
    if (!orderId) throw new BadRequestException('orderId is required');

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const ledgerRepo = manager.getRepository(MatrixRewardLedger);

      const user = await userRepo.findOne({
        where: { id: userId },
        select: ['id', 'withdrawWalletBalance'],
      });
      if (!user) throw new NotFoundException('User not found');

      const sumRaw = await ledgerRepo
        .createQueryBuilder('l')
        .select('COALESCE(SUM(l.amount),0)', 's')
        .where('l.beneficiaryUserId = :userId', { userId })
        .andWhere('l.orderId = :orderId', { orderId })
        .getRawOne<{ s: string }>();

      const netAmount = roundMoney(Number(sumRaw?.s ?? 0));
      if (netAmount <= 0) {
        return {
          userId,
          orderId,
          reversedAmount: 0,
          balanceBefore: roundMoney(Number(user.withdrawWalletBalance ?? 0)),
          balanceAfter: roundMoney(Number(user.withdrawWalletBalance ?? 0)),
          note: 'No positive matrix amount left to reverse for this order',
        };
      }

      const anchor = await ledgerRepo
        .createQueryBuilder('l')
        .where('l.beneficiaryUserId = :userId', { userId })
        .andWhere('l.orderId = :orderId', { orderId })
        .andWhere('l.amount > 0')
        .orderBy('l.createdAt', 'ASC')
        .getOne();

      if (!anchor) {
        throw new BadRequestException('No matrix reward ledger found for this user/order');
      }

      const balanceBefore = roundMoney(Number(user.withdrawWalletBalance ?? 0));
      if (balanceBefore < netAmount) {
        throw new BadRequestException(
          `Insufficient withdraw wallet balance to reverse. Required=${netAmount}, current=${balanceBefore}`,
        );
      }

      const balanceAfter = roundMoney(balanceBefore - netAmount);
      await userRepo.update(userId, { withdrawWalletBalance: balanceAfter });

      const note = reason
        ? `MATRIX_REVERSE:${reason}`
        : 'MATRIX_REVERSE:admin_manual_adjustment';
      await manager.save(
        MatrixRewardLedger,
        manager.create(MatrixRewardLedger, {
          treeId: anchor.treeId,
          beneficiaryUserId: userId,
          amount: -netAmount,
          sourceNodeId: anchor.sourceNodeId,
          orderId,
        }),
      );
      this.logger.warn(
        `[MATRIX] reverse reward user=${userId} order=${orderId} amount=${netAmount} note=${note}`,
      );

      return {
        userId,
        orderId,
        reversedAmount: netAmount,
        balanceBefore,
        balanceAfter,
        note,
      };
    });
  }

  /**
   * Admin: hoàn tác hàng loạt toàn bộ khoản matrix còn net dương.
   * Theo từng cặp (beneficiaryUserId, orderId) để giữ tính audit và idempotent.
   */
  async reverseAllOutstandingRewards(): Promise<{
    scanned: number;
    reversed: number;
    totalReversedAmount: number;
    skipped: number;
    failed: number;
    failures: Array<{ userId: string; orderId: string; reason: string }>;
  }> {
    const grouped = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('l.beneficiaryUserId', 'userId')
      .addSelect('l.orderId', 'orderId')
      .addSelect('COALESCE(SUM(l.amount),0)', 'netAmount')
      .groupBy('l.beneficiaryUserId')
      .addGroupBy('l.orderId')
      .having('COALESCE(SUM(l.amount),0) > 0')
      .orderBy('l.beneficiaryUserId', 'ASC')
      .addOrderBy('l.orderId', 'ASC')
      .getRawMany<{ userId: string; orderId: string; netAmount: string }>();

    let reversed = 0;
    let skipped = 0;
    let failed = 0;
    let totalReversedAmount = 0;
    const failures: Array<{ userId: string; orderId: string; reason: string }> = [];

    for (const row of grouped) {
      const userId = row.userId;
      const orderId = row.orderId;
      try {
        const result = await this.reverseRewardByOrder({
          userId,
          orderId,
          reason: 'bulk_reverse_all',
        });
        if (result.reversedAmount > 0) {
          reversed += 1;
          totalReversedAmount = roundMoney(totalReversedAmount + result.reversedAmount);
        } else {
          skipped += 1;
        }
      } catch (e: any) {
        failed += 1;
        failures.push({
          userId,
          orderId,
          reason: e?.response?.data?.message || e?.message || 'Unknown error',
        });
      }
    }

    return {
      scanned: grouped.length,
      reversed,
      totalReversedAmount,
      skipped,
      failed,
      failures,
    };
  }
}
