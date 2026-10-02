/**
 * Default split of a reward between the user's wallets, used when
 * `system_config` has no `commissionWithdrawWalletPercent` /
 * `commissionDepositWalletPercent` row yet.
 *
 * Whatever is left over (100% - withdraw - reconsumption) is tax/VAT: it is
 * deducted from the reward and never credited to any wallet.
 *
 * Commission payouts and agent pool payouts both read these, so keep the
 * numbers here rather than duplicating them per module.
 */
export const DEFAULT_WITHDRAW_WALLET_PERCENT = 70;
export const DEFAULT_RECONSUMPTION_WALLET_PERCENT = 20;
