import { SqlWriter, buildRewardLedger, LedgerFilter } from './reward-ledger.sql';
import { RewardSource, REWARD_SOURCES } from './reward-report.types';
import { assembleSummary, bucketsBetween } from './reward-report.util';
import {
  parseDistributedNote,
  splitCommissionAmount,
} from '../affiliate/commission-wallet-split';

const filter = (over: Partial<LedgerFilter> = {}): LedgerFilter => ({
  from: new Date(2026, 8, 1),
  toExclusive: new Date(2026, 9, 1),
  fromMonth: '2026-09',
  toMonth: '2026-09',
  sources: REWARD_SOURCES as RewardSource[],
  ...over,
});

describe('buildRewardLedger', () => {
  it('numbers Postgres params in the order they appear', () => {
    const w = new SqlWriter('postgres');
    const { ledger, where } = buildRewardLedger(
      w,
      filter({ userIds: ['u1'], statuses: ['paid'] }),
    );
    const sql = `${ledger} ${where}`;
    const used = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    expect(used).toEqual(used.map((_, i) => i + 1));
    expect(used.length).toBe(w.params.length);
    expect(sql.split(' UNION ALL ')).toHaveLength(6);
    expect(sql).toContain('t."createdAt"');
    expect(sql).not.toContain('`');
  });

  it('uses ? placeholders and backticks for MySQL', () => {
    const w = new SqlWriter('mysql');
    const { ledger } = buildRewardLedger(w, filter({ sources: [RewardSource.SALARY] }));
    expect(ledger).toContain('t.`month` >= ?');
    expect(ledger).not.toContain('"');
    expect(w.params).toEqual(['2026-09', '2026-09']);
  });

  it('matches nothing for an empty user list', () => {
    const w = new SqlWriter('postgres');
    const { ledger } = buildRewardLedger(
      w,
      filter({ sources: [RewardSource.HEAP], userIds: [] }),
    );
    expect(ledger).toContain('1 = 0');
  });

  it('only queries the requested sources', () => {
    const w = new SqlWriter('postgres');
    const { ledger } = buildRewardLedger(
      w,
      filter({ sources: [RewardSource.MATRIX, RewardSource.AGENT_POOL] }),
    );
    expect(ledger).toContain('FROM matrix_reward_ledger');
    expect(ledger).toContain('FROM agent_pool_histories');
    expect(ledger).not.toContain('FROM commissions');
  });
});

describe('bucketsBetween', () => {
  it('lists months across a year boundary', () => {
    expect(bucketsBetween('2025-11-15', '2026-02-03', 'month')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('lists days inclusively', () => {
    expect(bucketsBetween('2026-02-27', '2026-03-02', 'day')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
  });
});

describe('assembleSummary', () => {
  it('adds up statuses into sub types, sources and totals', () => {
    const summary = assembleSummary(
      '2026-09-01',
      '2026-09-30',
      ['commission', 'heap'],
      [
        { source: 'commission', sub_type: 'direct', status: 'paid', amount: '10', withdraw_amount: '7', reconsumption_amount: '2', tax_amount: '1', cnt: '2' },
        { source: 'commission', sub_type: 'direct', status: 'pending', amount: '5', withdraw_amount: '0', reconsumption_amount: '0', tax_amount: '0', cnt: '1' },
        { source: 'heap', sub_type: 'pool_500', status: 'paid', amount: '3', withdraw_amount: '3', reconsumption_amount: '0', tax_amount: '0', cnt: 1 },
      ],
      [{ source: 'commission', sub_type: 'direct', users: '2' }, { source: 'heap', sub_type: 'pool_500', users: 1 }],
      [{ source: 'commission', users: '2' }, { source: 'heap', users: '1' }],
      3,
    );

    expect(summary.totals).toMatchObject({ amount: 18, withdrawAmount: 10, count: 4, users: 3 });
    expect(summary.totals.byStatus).toEqual({
      paid: { amount: 13, count: 3 },
      pending: { amount: 5, count: 1 },
    });
    const commission = summary.sources[0];
    expect(commission).toMatchObject({ source: 'commission', amount: 15, users: 2 });
    expect(commission.subTypes[0]).toMatchObject({ subType: 'direct', amount: 15, count: 3, users: 2 });
    expect(summary.sources[1]).toMatchObject({ source: 'heap', amount: 3, users: 1 });
  });

  it('keeps requested sources without rows at zero', () => {
    const summary = assembleSummary('2026-09-01', '2026-09-30', ['salary'], [], [], [], 0);
    expect(summary.sources).toEqual([
      expect.objectContaining({ source: 'salary', amount: 0, subTypes: [] }),
    ]);
  });
});

describe('commission wallet split', () => {
  it('reads the percentages from the payout note', () => {
    expect(
      parseDistributedNote(
        'Product direct; Distributed: withdraw wallet (70%), reconsumption wallet (20%), tax (10%)',
      ),
    ).toEqual({ withdrawPercent: 70, reconsumptionPercent: 20 });
    expect(parseDistributedNote('Direct commission')).toBeNull();
    expect(parseDistributedNote(null)).toBeNull();
  });

  it('puts the rounding remainder in tax so parts add up', () => {
    const split = splitCommissionAmount(3.33, 70, 20);
    expect(split).toEqual({ withdrawAmount: 2.33, reconsumptionAmount: 0.67, taxAmount: 0.33 });
    expect(split.withdrawAmount + split.reconsumptionAmount + split.taxAmount).toBeCloseTo(3.33, 8);
  });
});
