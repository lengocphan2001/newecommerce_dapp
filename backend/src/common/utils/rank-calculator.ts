/**
 * Agent rank (C0 / DAILY / C1..C9) computation over the referral tree.
 *
 * The rank of a user only depends on their lifetime purchase total and on the
 * ranks of their F1s, never on the sales of a given month, so the same routine
 * serves the monthly closing and the per-order agent pool sync.
 */

import {
  DAILY_RANK_MIN_PURCHASE,
  MONTHLY_RANK_ORDER,
  MONTHLY_RANK_PROMOTION_LOOP_LIMIT,
  MONTHLY_RANK_PROMOTION_ORDER,
  MONTHLY_RANK_RULES,
} from '../constants/ranks';

/** Minimum shape a user row needs for its rank to be computed. */
export interface RankSourceUser {
  id: string;
  manualRank?: string | null;
  totalPurchaseAmount?: number | string | null;
}

/** True when `rank` sits at or above `targetRank` in the rank ladder. */
export function isRankAtLeast(rank: string, targetRank: string): boolean {
  return (
    MONTHLY_RANK_ORDER.indexOf(rank || 'C0') >=
    MONTHLY_RANK_ORDER.indexOf(targetRank)
  );
}

/**
 * Rank every user in one pass.
 *
 * A manually assigned rank wins outright. Everyone else starts at DAILY or C0
 * depending on their lifetime purchases, then C1..C9 promotions are replayed
 * until nothing changes: a single pass is not enough because an F1 can reach
 * C1 only after its own upline was already examined, which would make the
 * result depend on the row order returned by the database. Ranks only ever go
 * up inside the loop, so it always terminates.
 *
 * @param onLoopLimit Called when the promotion loop hits
 *   MONTHLY_RANK_PROMOTION_LOOP_LIMIT, meaning the ranks did not converge and
 *   the referral tree is likely malformed.
 */
export function computeRanksMap(
  users: RankSourceUser[],
  f1Map: Map<string, string[]>,
  onLoopLimit?: (limit: number) => void,
): Map<string, string> {
  const ranksMap = new Map<string, string>();

  for (const u of users) {
    if (u.manualRank && u.manualRank !== 'NONE') {
      ranksMap.set(u.id, u.manualRank);
    } else {
      const isDaiLy = Number(u.totalPurchaseAmount) >= DAILY_RANK_MIN_PURCHASE;
      ranksMap.set(u.id, isDaiLy ? 'DAILY' : 'C0');
    }
  }

  const isAtLeastRank = (userId: string, targetRank: string): boolean =>
    isRankAtLeast(ranksMap.get(userId) || 'C0', targetRank);

  for (let pass = 0; ; pass++) {
    let changed = false;

    for (const r of MONTHLY_RANK_PROMOTION_ORDER) {
      const requirements = MONTHLY_RANK_RULES[r];
      for (const u of users) {
        const currentRank = ranksMap.get(u.id) || 'C0';
        if (isRankAtLeast(currentRank, r)) {
          // Đã bằng hoặc cao hơn r, xét tiếp chỉ có thể hạ cấp.
          continue;
        }

        const f1Ids = f1Map.get(u.id) || [];
        const isPromoted = requirements.every(
          (req) =>
            f1Ids.filter((id) => isAtLeastRank(id, req.rank)).length >=
            req.count,
        );

        if (isPromoted) {
          ranksMap.set(u.id, r);
          changed = true;
        }
      }
    }

    if (!changed) break;

    if (pass >= MONTHLY_RANK_PROMOTION_LOOP_LIMIT) {
      onLoopLimit?.(MONTHLY_RANK_PROMOTION_LOOP_LIMIT);
      break;
    }
  }

  return ranksMap;
}

/**
 * Cấp bậc của một người khi chưa xét tuyến dưới: cấp gán tay thắng tuyệt đối,
 * còn lại chỉ phụ thuộc tổng mua trọn đời.
 */
export function baseRankOf(user: RankSourceUser): string {
  if (user.manualRank && user.manualRank !== 'NONE') return user.manualRank;
  return Number(user.totalPurchaseAmount) >= DAILY_RANK_MIN_PURCHASE
    ? 'DAILY'
    : 'C0';
}

/**
 * Cấp bậc của đúng một người, tính từ cấp bậc đã biết của các F1.
 *
 * Dùng khi duyệt đơn: chỉ người mua và tuyến trên của họ mới có thể đổi cấp,
 * nên không cần xếp hạng lại cả cây — miễn là cấp của F1 đã được lưu sẵn.
 * Lấy cấp cao nhất thoả điều kiện, vì điều kiện các cấp không lồng nhau hoàn
 * toàn (C9 cần 3×C7, trong khi C8 cần 2×C7 và 3×C6).
 */
export function computeRankFromF1Ranks(
  user: RankSourceUser,
  f1Ranks: string[],
): string {
  if (user.manualRank && user.manualRank !== 'NONE') return user.manualRank;

  let rank = baseRankOf(user);

  for (const candidate of MONTHLY_RANK_PROMOTION_ORDER) {
    const satisfied = MONTHLY_RANK_RULES[candidate].every(
      (req) =>
        f1Ranks.filter((f1Rank) => isRankAtLeast(f1Rank, req.rank)).length >=
        req.count,
    );
    if (satisfied && !isRankAtLeast(rank, candidate)) rank = candidate;
  }

  return rank;
}

/**
 * Cấp bậc để hiển thị/xuất báo cáo cho một người.
 *
 * Cấp gán tay thắng, sau đó tới cấp đã đồng bộ (`users.agentRank`). Người chưa
 * từng được đồng bộ chỉ suy ra được cấp cơ bản từ tổng mua, nên chạy
 * `POST /admin/agent-pool/members/sync-all` một lần để mọi người có cấp thật.
 */
export function effectiveRankOf(
  user: RankSourceUser & { agentRank?: string | null },
): string {
  if (user.manualRank && user.manualRank !== 'NONE') return user.manualRank;
  return user.agentRank || baseRankOf(user);
}
