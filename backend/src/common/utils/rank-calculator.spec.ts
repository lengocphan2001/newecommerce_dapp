import { buildChildrenMap } from './referral-tree';
import {
  baseRankOf,
  computeRankFromF1Ranks,
  computeRanksMap,
  isRankAtLeast,
  RankSourceUser,
} from './rank-calculator';

interface TestUser extends RankSourceUser {
  id: string;
  referralUserId?: string | null;
}

const ranksOf = (users: TestUser[]) =>
  computeRanksMap(
    users,
    buildChildrenMap(
      users,
      (u) => u.id,
      (u) => u.referralUserId,
    ),
  );

/** Đại lý: mua đủ $600 trọn đời, không có tuyến dưới nào cần thiết. */
const daiLy = (id: string, referralUserId?: string | null): TestUser => ({
  id,
  referralUserId: referralUserId ?? null,
  totalPurchaseAmount: 600,
});

describe('computeRanksMap', () => {
  it('ranks a user DAILY only once lifetime purchases reach the threshold', () => {
    const ranks = ranksOf([
      { id: 'a', totalPurchaseAmount: 599 },
      { id: 'b', totalPurchaseAmount: 600 },
    ]);

    expect(ranks.get('a')).toBe('C0');
    expect(ranks.get('b')).toBe('DAILY');
  });

  it('promotes to C1 on three DAILY F1s', () => {
    const ranks = ranksOf([
      daiLy('root'),
      daiLy('f1a', 'root'),
      daiLy('f1b', 'root'),
      daiLy('f1c', 'root'),
    ]);

    expect(ranks.get('root')).toBe('C1');
  });

  it('does not promote on two DAILY F1s', () => {
    const ranks = ranksOf([
      daiLy('root'),
      daiLy('f1a', 'root'),
      daiLy('f1b', 'root'),
    ]);

    expect(ranks.get('root')).toBe('DAILY');
  });

  it('propagates promotions up the tree regardless of row order', () => {
    // root -> 3 branches, each branch head needs 3 DAILY F1s to become C1,
    // which then makes root a C2.
    const users: TestUser[] = [daiLy('root')];
    for (const branch of ['x', 'y', 'z']) {
      users.push(daiLy(branch, 'root'));
      for (const leaf of ['1', '2', '3']) {
        users.push(daiLy(`${branch}${leaf}`, branch));
      }
    }

    const ranks = ranksOf(users);
    expect(ranks.get('x')).toBe('C1');
    expect(ranks.get('root')).toBe('C2');

    // Đảo ngược thứ tự dòng trả về của DB không được đổi kết quả.
    const reversed = ranksOf([...users].reverse());
    expect(reversed.get('root')).toBe('C2');
  });

  it('lets a manual rank win over the computed one', () => {
    const ranks = ranksOf([
      { id: 'a', totalPurchaseAmount: 0, manualRank: 'C4' },
      { id: 'b', totalPurchaseAmount: 0, manualRank: 'NONE' },
    ]);

    expect(ranks.get('a')).toBe('C4');
    expect(ranks.get('b')).toBe('C0');
  });

  it('terminates on a referral cycle', () => {
    const ranks = ranksOf([
      { id: 'a', referralUserId: 'b', totalPurchaseAmount: 600 },
      { id: 'b', referralUserId: 'a', totalPurchaseAmount: 600 },
    ]);

    expect(ranks.get('a')).toBe('DAILY');
    expect(ranks.get('b')).toBe('DAILY');
  });
});

describe('isRankAtLeast', () => {
  it('treats a higher rank as covering every rank below it', () => {
    expect(isRankAtLeast('C5', 'C1')).toBe(true);
    expect(isRankAtLeast('C5', 'C5')).toBe(true);
    expect(isRankAtLeast('C5', 'C6')).toBe(false);
    expect(isRankAtLeast('DAILY', 'C1')).toBe(false);
    expect(isRankAtLeast('C0', 'C1')).toBe(false);
  });
});

describe('computeRankFromF1Ranks', () => {
  const buyer: RankSourceUser = { id: 'u', totalPurchaseAmount: 600 };

  it('keeps DAILY when the F1 ranks are not enough', () => {
    expect(computeRankFromF1Ranks(buyer, ['DAILY', 'DAILY'])).toBe('DAILY');
  });

  it('promotes on three DAILY F1s', () => {
    expect(computeRankFromF1Ranks(buyer, ['DAILY', 'DAILY', 'DAILY'])).toBe(
      'C1',
    );
  });

  it('counts a higher F1 rank toward a lower requirement', () => {
    expect(computeRankFromF1Ranks(buyer, ['C3', 'C1', 'DAILY'])).toBe('C1');
    expect(computeRankFromF1Ranks(buyer, ['C1', 'C1', 'C1'])).toBe('C2');
  });

  it('picks the highest satisfied rank when the rules are not nested', () => {
    // C9 chỉ cần 3×C7, trong khi C8 cần 2×C7 và 3×C6.
    expect(computeRankFromF1Ranks(buyer, ['C7', 'C7', 'C7'])).toBe('C9');
  });

  it('drops back down when the F1 ranks no longer qualify', () => {
    expect(computeRankFromF1Ranks(buyer, ['DAILY'])).toBe('DAILY');
    expect(
      computeRankFromF1Ranks({ id: 'u', totalPurchaseAmount: 0 }, []),
    ).toBe('C0');
  });

  it('lets a manual rank override the F1 ranks in both directions', () => {
    const manual: RankSourceUser = {
      id: 'u',
      totalPurchaseAmount: 600,
      manualRank: 'C2',
    };
    expect(computeRankFromF1Ranks(manual, [])).toBe('C2');
    expect(computeRankFromF1Ranks(manual, ['C7', 'C7', 'C7'])).toBe('C2');
  });

  it('agrees with the whole-tree calculation', () => {
    const users = [
      { id: 'root', referralUserId: null, totalPurchaseAmount: 600 },
      { id: 'a', referralUserId: 'root', totalPurchaseAmount: 600 },
      { id: 'b', referralUserId: 'root', totalPurchaseAmount: 600 },
      { id: 'c', referralUserId: 'root', totalPurchaseAmount: 600 },
    ];
    const whole = ranksOf(users);
    const perUser = computeRankFromF1Ranks(
      users[0],
      users.slice(1).map((f1) => whole.get(f1.id) as string),
    );

    expect(perUser).toBe(whole.get('root'));
  });
});

describe('baseRankOf', () => {
  it('ignores the downline entirely', () => {
    expect(baseRankOf({ id: 'a', totalPurchaseAmount: 600 })).toBe('DAILY');
    expect(baseRankOf({ id: 'a', totalPurchaseAmount: 10 })).toBe('C0');
    expect(
      baseRankOf({ id: 'a', totalPurchaseAmount: 0, manualRank: 'C3' }),
    ).toBe('C3');
  });
});
