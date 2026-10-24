export interface TreeNode {
  id: string;
  username: string | null;
  fullName: string | null;
  avatar?: string | null;
  packageType: string;
  position?: 'left' | 'right' | null;
  leftBranchTotal: number;
  rightBranchTotal: number;
  totalPurchaseAmount: number;
  createdAt?: string;
  hasMoreChildren?: boolean;
  children?: TreeNode[];
}

export interface TreeResponse {
  maxDepth: number;
  isSelfRoot: boolean;
  tree: TreeNode;
}

/** Nhánh gốc mà một node thuộc về, dùng để dựng link mời đúng team. */
export type Branch = 'left' | 'right';

/** Kích thước dùng chung giữa phần đo bề rộng và phần render. */
export const SLOT_W = 116;
export const CARD_W = 104;
export const CARD_H = 78;
export const LEVEL_GAP = 44;

export const BRANCH_COLOR: Record<Branch, string> = {
  left: '#2563eb',
  right: '#10b981',
};

export const ROOT_COLOR = '#7c3aed';

/**
 * Cấp bậc hiển thị. Giữ đúng quy tắc đang dùng ở màn affiliate và ở admin:
 * mua từ 600 trở lên là Đại lý, còn lại xét theo gói.
 */
export function getMemberTag(node: Pick<TreeNode, 'packageType' | 'totalPurchaseAmount'>): string {
  const total = Number(node.totalPurchaseAmount) || 0;
  if (total >= 600) return 'Đại lý';
  const type = String(node.packageType || '').toUpperCase();
  if (type === 'NPP' || type === 'DT') return 'Đối Tác';
  if (type === 'CTV') return 'CTV';
  if (type === 'TV') return 'Thành Viên';
  return type === 'NONE' || !type ? 'User' : type;
}

export function getMemberTagClass(node: Pick<TreeNode, 'packageType' | 'totalPurchaseAmount'>): string {
  const total = Number(node.totalPurchaseAmount) || 0;
  if (total >= 600) return 'bg-amber-500 text-white';
  const type = String(node.packageType || '').toUpperCase();
  if (type === 'NONE' || !type) return 'bg-slate-100 text-slate-600';
  return 'bg-purple-100 text-purple-700';
}

export function getChild(node: TreeNode, position: Branch): TreeNode | null {
  return (node.children || []).find((c) => c.position === position) || null;
}

/**
 * Có hiển thị hai ô con của node này không.
 * - Đã có ít nhất một con: hiện cả hai ô để thấy rõ vị trí còn trống.
 * - Chưa có con nào: chỉ hiện ô trống ở hai cấp trên cùng, tránh cây phình ngang
 *   vì hàng loạt ô trống ở cấp sâu.
 */
export function shouldRenderSlots(node: TreeNode, level: number, maxLevel: number): boolean {
  if (level >= maxLevel) return false;
  if (node.hasMoreChildren) return true;
  const hasAnyChild = (node.children || []).length > 0;
  return hasAnyChild || level < 2;
}

/**
 * Bề rộng của cây con, tính đối xứng (hai nhánh luôn bằng nhau) để đường nối
 * bằng CSS phần trăm luôn khớp tâm node cha, kể cả khi cây lệch.
 */
export function measureSubtree(node: TreeNode | null, level: number, maxLevel: number): number {
  if (!node) return SLOT_W;
  if (!shouldRenderSlots(node, level, maxLevel)) return SLOT_W;
  const left = measureSubtree(getChild(node, 'left'), level + 1, maxLevel);
  const right = measureSubtree(getChild(node, 'right'), level + 1, maxLevel);
  return 2 * Math.max(left, right);
}

/** Số cấp thực sự được render, để tính chiều cao khung cây. */
export function measureDepth(node: TreeNode | null, level: number, maxLevel: number): number {
  if (!node) return 1;
  if (!shouldRenderSlots(node, level, maxLevel)) return 1;
  const left = measureDepth(getChild(node, 'left'), level + 1, maxLevel);
  const right = measureDepth(getChild(node, 'right'), level + 1, maxLevel);
  return 1 + Math.max(left, right);
}

/** Đếm số thành viên thật (không tính ô trống, không tính chính mình). */
export function countMembers(node: TreeNode | null): number {
  if (!node) return 0;
  return (node.children || []).reduce((sum, c) => sum + 1 + countMembers(c), 0);
}

export function initialsOf(node: Pick<TreeNode, 'fullName' | 'username'>): string {
  const source = (node.fullName || node.username || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatJoinDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}
