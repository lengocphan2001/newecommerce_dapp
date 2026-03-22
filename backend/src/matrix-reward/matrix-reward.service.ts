import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
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

const CFG_MIN_ORDER = 'matrixRewardMinOrderUsd';
const CFG_PER_SLOT = 'matrixRewardPerSlotUsd';
const CFG_MAX_EARN = 'matrixRewardMaxEarnPerTreeUsd';
const CFG_MAX_UPLINES = 'matrixRewardMaxUplines';

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
    private readonly dataSource: DataSource,
  ) {}

  async getPublicConfig() {
    const [minOrder, perSlot, maxEarn, maxUplines] = await Promise.all([
      this.getConfigNumber(CFG_MIN_ORDER, 100),
      this.getConfigNumber(CFG_PER_SLOT, 0.5),
      this.getConfigNumber(CFG_MAX_EARN, 1500),
      this.getConfigNumber(CFG_MAX_UPLINES, 11),
    ]);
    return {
      minOrderUsd: minOrder,
      perSlotUsd: perSlot,
      maxEarnPerTreeUsd: maxEarn,
      maxUplines,
    };
  }

  async getAdminConfig() {
    const rows = await this.systemConfigRepo.find({
      where: [
        { key: CFG_MIN_ORDER },
        { key: CFG_PER_SLOT },
        { key: CFG_MAX_EARN },
        { key: CFG_MAX_UPLINES },
      ],
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return {
      minOrderUsd: Number(map.get(CFG_MIN_ORDER) ?? 100),
      perSlotUsd: Number(map.get(CFG_PER_SLOT) ?? 0.5),
      maxEarnPerTreeUsd: Number(map.get(CFG_MAX_EARN) ?? 1500),
      maxUplines: Number(map.get(CFG_MAX_UPLINES) ?? 11),
    };
  }

  async setAdminConfig(body: {
    minOrderUsd?: number;
    perSlotUsd?: number;
    maxEarnPerTreeUsd?: number;
    maxUplines?: number;
  }) {
    const entries: Array<{ key: string; value: string }> = [];
    if (body.minOrderUsd != null)
      entries.push({ key: CFG_MIN_ORDER, value: String(body.minOrderUsd) });
    if (body.perSlotUsd != null)
      entries.push({ key: CFG_PER_SLOT, value: String(body.perSlotUsd) });
    if (body.maxEarnPerTreeUsd != null)
      entries.push({
        key: CFG_MAX_EARN,
        value: String(body.maxEarnPerTreeUsd),
      });
    if (body.maxUplines != null)
      entries.push({ key: CFG_MAX_UPLINES, value: String(body.maxUplines) });
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

  /**
   * Gọi khi đơn CONFIRMED. Idempotent theo orderId.
   */
  async processOrderIfEligible(orderId: string): Promise<void> {
    const done = await this.processedRepo.findOne({ where: { orderId } });
    if (done) return;

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.CONFIRMED || !order.userId) {
      return;
    }

    const minOrder = await this.getConfigNumber(CFG_MIN_ORDER, 100);
    const orderTotal = roundMoney(Number(order.totalAmount));
    if (!Number.isFinite(orderTotal) || orderTotal < minOrder) {
      await this.safeMarkProcessed(orderId);
      return;
    }

    const perSlot = await this.getConfigNumber(CFG_PER_SLOT, 0.5);
    const maxEarn = await this.getConfigNumber(CFG_MAX_EARN, 1500);
    const maxUplines = Math.max(
      1,
      Math.floor(await this.getConfigNumber(CFG_MAX_UPLINES, 11)),
    );

    try {
      await this.dataSource.transaction(async (manager) => {
        let claimed = false;
        try {
          await manager.insert(MatrixRewardOrderProcessed, { orderId });
          claimed = true;
        } catch (e) {
          if (isDuplicateKeyError(e)) return;
          throw e;
        }

        try {
          const buyerId = order.userId;
          const nextLevel = await this.computeNextTreeLevel(buyerId, manager);
          const tree = await this.getOrCreateTree(nextLevel, manager);
          const treeId = tree.id;

          const placement = await this.findBfsPlacement(manager, treeId);
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

          for (const uplineNode of uplines) {
            await this.payUplineAndMaybeRemove({
              manager,
              treeId,
              treeLevel: tree.treeLevel,
              beneficiaryUserId: uplineNode.userId,
              sourceNodeId: node.id,
              orderId,
              perSlot,
              maxEarn,
            });
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
        return;
      }
      this.logger.error(
        `[MATRIX] processOrderIfEligible failed order=${orderId}: ${err?.message}`,
        err?.stack,
      );
      throw err;
    }
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
    let candidate = maxLevel + 1;
    for (let i = 0; i < 500; i++) {
      const ex = await exRepo.findOne({
        where: { userId, treeLevel: candidate },
      });
      if (!ex) return candidate;
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
    let cur = await nodeRepo.findOne({ where: { id: fromNodeId, treeId } });
    while (cur?.parentNodeId && result.length < max) {
      const parent = await nodeRepo.findOne({
        where: { id: cur.parentNodeId, treeId },
      });
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
  }): Promise<void> {
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
      return;
    }
    const room = roundMoney(maxEarn - current);
    const pay = roundMoney(Math.min(perSlot, room));
    if (pay <= 0) return;

    const userRepo = manager.getRepository(User);
    const u = await userRepo.findOne({
      where: { id: beneficiaryUserId },
      select: ['id', 'withdrawWalletBalance'],
    });
    if (!u) return;

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
    const queue: string[] = [rootId];
    while (queue.length) {
      const id = queue.shift()!;
      const left = await nodeRepo.findOne({
        where: { treeId, parentNodeId: id, side: MatrixNodeSide.LEFT },
      });
      const right = await nodeRepo.findOne({
        where: { treeId, parentNodeId: id, side: MatrixNodeSide.RIGHT },
      });
      if (!left) return { parentNodeId: id, side: MatrixNodeSide.LEFT };
      if (!right) return { parentNodeId: id, side: MatrixNodeSide.RIGHT };
      queue.push(left.id);
      queue.push(right.id);
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

    const earnedByUser = new Map<string, number>();
    for (const n of nodes) {
      const s = await this.sumLedgerForUserTreeExternal(n.userId, tree.id);
      earnedByUser.set(n.userId, s);
    }

    const byId = new Map(nodes.map((x) => [x.id, x]));
    const build = (id: string): any => {
      const node = byId.get(id)!;
      const u = node.user;
      const left = nodes.find(
        (c) =>
          c.parentNodeId === id && c.side === MatrixNodeSide.LEFT,
      );
      const right = nodes.find(
        (c) =>
          c.parentNodeId === id && c.side === MatrixNodeSide.RIGHT,
      );
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
    for (const n of nodes) {
      const tid = n.treeId;
      const earned = await this.sumLedgerForUserTreeExternal(userId, tid);
      out.push({
        treeLevel: n.tree?.treeLevel ?? 0,
        treeId: tid,
        nodeId: n.id,
        earnedOnTreeUsd: earned,
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
}
