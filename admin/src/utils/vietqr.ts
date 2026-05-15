/** Build VietQR image URL (https://img.vietqr.io). */
export function buildVietQrImageUrl(params: {
  bankId: string;
  accountNumber: string;
  amountVnd?: number;
  accountName?: string;
  addInfo?: string;
}): string | null {
  const bankId = params.bankId?.trim();
  const accountNumber = params.accountNumber?.trim().replace(/\s/g, '');
  if (!bankId || !accountNumber) return null;

  const template = 'compact2';
  const base = `https://img.vietqr.io/image/${bankId}-${accountNumber}-${template}.png`;
  const search = new URLSearchParams();
  if (params.amountVnd != null && params.amountVnd > 0) {
    search.set('amount', String(Math.round(params.amountVnd)));
  }
  const addInfo = (params.addInfo || '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .slice(0, 25)
    .trim();
  if (addInfo) search.set('addInfo', addInfo);
  const accountName = (params.accountName || '').trim();
  if (accountName) search.set('accountName', accountName);
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}
