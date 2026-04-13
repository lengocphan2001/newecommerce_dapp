import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Select,
  message,
  Spin,
  Tag,
  Space,
  Tooltip,
  Form,
  InputNumber,
  Typography,
  Alert,
  Input,
  Modal,
  Switch,
  Popconfirm,
  Table,
  Statistic,
} from 'antd';
import { ReloadOutlined, SearchOutlined, SaveOutlined, PoweroffOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminService } from '../services/adminService';
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const { Title, Text } = Typography;

interface MatrixTreeNode {
  id: string;
  userId: string;
  username: string | null;
  fullName: string;
  email: string;
  packageType: string;
  matrixEarnedOnTree: number;
  position?: 'left' | 'right';
  children?: MatrixTreeNode[];
}

interface CustomNodeData extends Record<string, unknown> {
  node: MatrixTreeNode;
}

interface MatrixLedgerItem {
  id: string;
  createdAt: string;
  treeId: string;
  orderId: string;
  beneficiaryUserId: string;
  beneficiaryUsername: string | null;
  beneficiaryEmail: string | null;
  sourceNodeId: string;
  amount: number;
}

interface MatrixLedgerSummary {
  totalCreditAmount: number;
  totalDebitAmount: number;
  netAmount: number;
  creditCount: number;
  debitCount: number;
  outstandingPairCount: number;
}

const MatrixCustomNode = ({ data }: { data: CustomNodeData }) => {
  const { node } = data;
  const borderColor =
    node.position === 'left' ? '#1890ff' : node.position === 'right' ? '#52c41a' : '#722ed1';

  return (
    <div
      style={{
        background: '#fff',
        border: `2px solid ${borderColor}`,
        borderRadius: '8px',
        padding: '12px',
        minWidth: '200px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        position: 'relative',
      }}
    >
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        style={{ background: borderColor, width: '8px', height: '8px' }}
      />
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        style={{ background: borderColor, width: '8px', height: '8px' }}
      />
      <div style={{ textAlign: 'center' }}>
        <Tag color="purple" style={{ marginBottom: 4, fontSize: '10px' }}>
          Matrix pool
        </Tag>
        {node.username && (
          <div style={{ fontSize: '10px', color: '#595959', marginBottom: 2, fontWeight: 'bold' }}>
            @{node.username}
          </div>
        )}
        <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: '13px', color: '#262626' }}>
          {node.fullName || node.username || 'N/A'}
        </div>
        <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 6, wordBreak: 'break-all' }}>
          {node.email}
        </div>
        <div style={{ fontSize: '11px', color: '#389e0d', fontWeight: 700 }}>
          Earned: ${Number(node.matrixEarnedOnTree || 0).toFixed(2)}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = { custom: MatrixCustomNode };

const MatrixPool: React.FC = () => {
  const [treeLevel, setTreeLevel] = useState<number>(1);
  const [levels, setLevels] = useState<number[]>([1]);
  const [treeData, setTreeData] = useState<MatrixTreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [matrixEnabled, setMatrixEnabled] = useState(true);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [form] = Form.useForm();
  const reactFlowContainerRef = React.useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [rootUserId, setRootUserId] = useState('');
  const [settingRoot, setSettingRoot] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [clearingAll, setClearingAll] = useState(false);
  const [prepareMaxLevel, setPrepareMaxLevel] = useState<number>(10);
  const [preparingTrees, setPreparingTrees] = useState(false);
  const [backfillLimit, setBackfillLimit] = useState<number>(500);
  const [backfillingOrders, setBackfillingOrders] = useState(false);
  const [reverseUserId, setReverseUserId] = useState('');
  const [reverseOrderId, setReverseOrderId] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [reversingReward, setReversingReward] = useState(false);
  const [reversingAll, setReversingAll] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<MatrixLedgerItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyUserId, setHistoryUserId] = useState('');
  const [historyOrderId, setHistoryOrderId] = useState('');
  const [historyType, setHistoryType] = useState<'all' | 'credit' | 'debit'>('all');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [ledgerSummary, setLedgerSummary] = useState<MatrixLedgerSummary>({
    totalCreditAmount: 0,
    totalDebitAmount: 0,
    netAmount: 0,
    creditCount: 0,
    debitCount: 0,
    outstandingPairCount: 0,
  });
  const [userPreview, setUserPreview] = useState<{
    id: string;
    username?: string | null;
    fullName?: string;
    email?: string;
  } | null>(null);

  const loadLevels = async () => {
    try {
      const res = await adminService.getMatrixRewardLevels();
      const data = (res as any)?.data ?? res;
      const arr = Array.isArray(data) ? data : [];
      const merged = Array.from(new Set([1, ...arr])).sort((a, b) => a - b);
      setLevels(merged);
    } catch {
      setLevels([1]);
    }
  };

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      const res = await adminService.getMatrixRewardConfig();
      const c = (res as any)?.data ?? res;
      form.setFieldsValue({
        minOrderUsd: c.minOrderUsd,
        perSlotUsd: c.perSlotUsd,
        maxEarnPerTreeUsd: c.maxEarnPerTreeUsd,
        maxUplines: c.maxUplines,
        prevTreeQualifyPercent: c.prevTreeQualifyPercent,
      });
      setMatrixEnabled(c.enabled !== false);
    } catch (e: any) {
      message.error(e?.message || 'Failed to load matrix config');
    } finally {
      setConfigLoading(false);
    }
  };

  const toggleMatrixEnabled = async (newEnabled: boolean) => {
    try {
      setTogglingEnabled(true);
      await adminService.updateMatrixRewardConfig({ enabled: newEnabled });
      setMatrixEnabled(newEnabled);
      message.success(
        newEnabled
          ? '✅ Đã bật hệ thống Matrix Pool — đơn CONFIRMED sẽ được xử lý.'
          : '🔴 Đã tắt hệ thống Matrix Pool — đơn mới sẽ không vào matrix.',
      );
    } catch (e: any) {
      message.error(e?.message || 'Không thể thay đổi trạng thái Matrix Pool');
    } finally {
      setTogglingEnabled(false);
    }
  };

  useEffect(() => {
    loadLevels();
    loadConfig();
  }, []);

  const loadLedgerHistory = async (page = historyPage, limit = historyLimit) => {
    try {
      setHistoryLoading(true);
      const res = await adminService.getMatrixRewardLedgerHistory({
        page,
        limit,
        userId: historyUserId.trim() || undefined,
        orderId: historyOrderId.trim() || undefined,
        type: historyType,
      });
      const data = (res as any)?.data ?? res;
      setHistoryRows(Array.isArray(data?.items) ? data.items : []);
      setHistoryTotal(Number(data?.total ?? 0));
      setHistoryPage(Number(data?.page ?? page));
      setHistoryLimit(Number(data?.limit ?? limit));
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Không thể tải lịch sử matrix');
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadLedgerSummary = async () => {
    try {
      setSummaryLoading(true);
      const res = await adminService.getMatrixRewardLedgerSummary({
        userId: historyUserId.trim() || undefined,
        orderId: historyOrderId.trim() || undefined,
      });
      const data = (res as any)?.data ?? res;
      setLedgerSummary({
        totalCreditAmount: Number(data?.totalCreditAmount ?? 0),
        totalDebitAmount: Number(data?.totalDebitAmount ?? 0),
        netAmount: Number(data?.netAmount ?? 0),
        creditCount: Number(data?.creditCount ?? 0),
        debitCount: Number(data?.debitCount ?? 0),
        outstandingPairCount: Number(data?.outstandingPairCount ?? 0),
      });
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || 'Không thể tải tổng hợp matrix');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadLedgerHistory(1, historyLimit);
    loadLedgerSummary();
  }, []);

  const fetchTree = async () => {
    setLoading(true);
    try {
      const res = await adminService.getMatrixRewardTreeView(treeLevel);
      const data = (res as any)?.data ?? res;
      setTreeData(data?.root ?? null);
      if (!data?.root) {
        message.info(`Tree level ${treeLevel} is empty or not created yet.`);
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to fetch matrix tree');
      setTreeData(null);
    } finally {
      setLoading(false);
    }
  };

  const convertTreeToFlow = useCallback((tree: MatrixTreeNode): { nodes: Node[]; edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeWidth = 220;
    const horizontalSpacing = 350;
    const verticalSpacing = 250;

    const getSubtreeWidth = (node: MatrixTreeNode): number => {
      if (!node.children || node.children.length === 0) return nodeWidth;
      const leftChild = node.children.find((c) => c.position === 'left');
      const rightChild = node.children.find((c) => c.position === 'right');
      let leftWidth = 0;
      let rightWidth = 0;
      if (leftChild) leftWidth = getSubtreeWidth(leftChild);
      if (rightChild) rightWidth = getSubtreeWidth(rightChild);
      return Math.max(
        nodeWidth,
        leftWidth + rightWidth + (leftChild && rightChild ? horizontalSpacing : 0),
      );
    };

    const processNode = (node: MatrixTreeNode, posX: number, posY: number, parentId?: string) => {
      const nodeId = node.id;
      nodes.push({
        id: nodeId,
        type: 'custom',
        position: { x: posX, y: posY },
        data: { node } as CustomNodeData as Record<string, unknown>,
      });
      if (parentId) {
        edges.push({
          id: `e${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          sourceHandle: 'source-bottom',
          targetHandle: 'target-top',
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: node.position === 'left' ? '#1890ff' : '#52c41a',
            strokeWidth: 2,
          },
        });
      }
      if (node.children && node.children.length > 0) {
        const leftChild = node.children.find((c) => c.position === 'left');
        const rightChild = node.children.find((c) => c.position === 'right');
        const childY = posY + verticalSpacing;
        let leftX = posX;
        let rightX = posX;
        if (leftChild && rightChild) {
          const leftWidth = getSubtreeWidth(leftChild);
          const rightWidth = getSubtreeWidth(rightChild);
          const totalWidth = leftWidth + rightWidth + horizontalSpacing;
          const startX = posX - totalWidth / 2 + leftWidth / 2;
          leftX = startX - leftWidth / 2;
          rightX = startX + leftWidth + horizontalSpacing + rightWidth / 2;
        } else if (leftChild) {
          leftX = posX - getSubtreeWidth(leftChild) / 2;
        } else if (rightChild) {
          rightX = posX + getSubtreeWidth(rightChild) / 2;
        }
        if (leftChild) processNode(leftChild, leftX, childY, nodeId);
        if (rightChild) processNode(rightChild, rightX, childY, nodeId);
      }
    };

    const rootWidth = getSubtreeWidth(tree);
    const startX = rootWidth / 2 - nodeWidth / 2;
    processNode(tree, startX, 50);

    if (nodes.length > 0) {
      const minX = Math.min(...nodes.map((n) => n.position.x));
      const maxX = Math.max(...nodes.map((n) => n.position.x));
      const centerX = (minX + maxX) / 2;
      const offsetX = 0 - centerX;
      nodes.forEach((n) => {
        n.position.x += offsetX;
      });
    }
    return { nodes, edges };
  }, []);

  useEffect(() => {
    if (treeData) {
      const { nodes: flowNodes, edges: flowEdges } = convertTreeToFlow(treeData);
      setNodes(flowNodes);
      setEdges(flowEdges);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [treeData, convertTreeToFlow, setNodes, setEdges]);

  useEffect(() => {
    if (reactFlowContainerRef.current) {
      const container = reactFlowContainerRef.current;
      container.style.width = '100%';
      container.style.height = '75vh';
      container.style.minHeight = '600px';
    }
  }, [treeData]);

  const onInit = useCallback(
    (reactFlowInstance: any) => {
      if (nodes.length > 0) {
        setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 400 }), 100);
      }
    },
    [nodes.length],
  );

  const lookupUser = async () => {
    const id = rootUserId.trim();
    if (!id) {
      setUserPreview(null);
      return;
    }
    try {
      const res = await adminService.getUserDetail(id);
      const data = (res as any)?.data ?? res;
      const u = data?.user;
      if (u?.id) {
        setUserPreview({
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          email: u.email,
        });
      } else {
        setUserPreview(null);
      }
    } catch {
      setUserPreview(null);
      message.warning('Không tìm thấy user với ID này');
    }
  };

  const setTreeRoot = () => {
    const uid = rootUserId.trim();
    if (!uid) {
      message.warning('Nhập User ID (UUID)');
      return;
    }
    Modal.confirm({
      title: `Đặt gốc cây Matrix — Tree ${treeLevel}?`,
      content:
        'Chỉ thành công khi cây đang trống hoặc chỉ có một node gốc chưa có nhánh con. Nếu cây đã có người xếp BFS, hãy dùng cây level khác hoặc liên hệ kỹ thuật.',
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      onOk: async () => {
        setSettingRoot(true);
        try {
          await adminService.setMatrixRewardTreeRoot(treeLevel, uid);
          message.success('Đã đặt gốc cây');
          setRootUserId('');
          setUserPreview(null);
          await fetchTree();
          await loadLevels();
        } catch (e: any) {
          const msg =
            e?.response?.data?.message ||
            e?.message ||
            'Không thể đặt gốc (kiểm tra điều kiện cây / user)';
          message.error(Array.isArray(msg) ? msg.join(', ') : msg);
          throw e;
        } finally {
          setSettingRoot(false);
        }
      },
    });
  };

  const addUserToTree = async () => {
    const uid = addUserId.trim();
    if (!uid) {
      message.warning('Nhập User ID cần thêm');
      return;
    }
    try {
      setAddingUser(true);
      await adminService.addUserToMatrixRewardTree(treeLevel, {
        userId: uid,
      });
      message.success('Đã thêm user vào cây');
      setAddUserId('');
      await fetchTree();
      await loadLevels();
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ||
          e?.message ||
          'Không thể thêm user vào cây',
      );
    } finally {
      setAddingUser(false);
    }
  };

  const clearAllTreesAndRewards = () => {
    Modal.confirm({
      title: 'Xóa toàn bộ cây Matrix + bản ghi hoa hồng?',
      content:
        'Sẽ xóa TẤT CẢ cây, node, ledger, exclusion, processed records của Matrix Pool. Không thể hoàn tác.',
      okText: 'Xóa toàn bộ',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          setClearingAll(true);
          const res = await adminService.clearAllMatrixRewardTreesAndRewards();
          const data = (res as any)?.data ?? res;
          message.success(
            `Đã xóa: trees=${data?.treesDeleted ?? 0}, nodes=${data?.nodesDeleted ?? 0}, ledger=${data?.ledgersDeleted ?? 0}`,
          );
          setTreeData(null);
          await loadLevels();
          await loadLedgerHistory(1, historyLimit);
          await loadLedgerSummary();
        } catch (e: any) {
          message.error(
            e?.response?.data?.message ||
              e?.message ||
              'Không thể xóa toàn bộ cây matrix',
          );
          throw e;
        } finally {
          setClearingAll(false);
        }
      },
    });
  };

  const saveConfig = async () => {
    try {
      const v = await form.validateFields();
      await adminService.updateMatrixRewardConfig(v);
      message.success('Matrix config saved');
      loadConfig();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || 'Save failed');
    }
  };

  const prepareTrees = async () => {
    if (!prepareMaxLevel || prepareMaxLevel < 1) {
      message.warning('Nhập max level hợp lệ (>= 1)');
      return;
    }
    try {
      setPreparingTrees(true);
      const res = await adminService.prepareMatrixRewardTrees(prepareMaxLevel);
      const data = (res as any)?.data ?? res;
      const created = Array.isArray(data?.createdLevels)
        ? data.createdLevels.length
        : 0;
      message.success(`Đã chuẩn bị cây tới level ${prepareMaxLevel} (tạo mới ${created} cây)`);
      await loadLevels();
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || e?.message || 'Không thể tạo sẵn cây matrix',
      );
    } finally {
      setPreparingTrees(false);
    }
  };

  const backfillOrders = async () => {
    try {
      setBackfillingOrders(true);
      const res = await adminService.backfillMatrixRewardOrders({
        maxOrders: backfillLimit,
        onlyUnprocessed: true,
      });
          const data = (res as any)?.data ?? res;
      if (data?.systemDisabled) {
        message.warning('Hệ thống Matrix Pool đang TẮT — bật lại trước khi backfill.');
        return;
      }
      const paid = data?.paid ?? 0;
      const root = data?.placedRoot ?? 0;
      const noUpline = data?.placedNoUpline ?? 0;
      const notMet = data?.prevTreeNotMet ?? 0;
      const alreadyInTree = data?.alreadyInTree ?? 0;
      const failed = data?.failed ?? 0;
      if (paid > 0) {
        message.success(
          `Backfill xong: ${paid} đơn tạo hoa hồng cho upline` +
          (root ? `, ${root} node gốc (chưa có upline)` : '') +
          (noUpline ? `, ${noUpline} upline đã đạt trần` : '') +
          (notMet ? `, ${notMet} chưa đủ điều kiện cây trước` : '') +
          (alreadyInTree ? `, ${alreadyInTree} user đã ở trong cây` : '') +
          (failed ? `, ${failed} lỗi` : ''),
        );
      } else {
        message.warning(
          `Backfill xong nhưng chưa có hoa hồng: ` +
          `scanned=${data?.scanned ?? 0}` +
          (root ? `, placed_root=${root} (user đầu tiên vào cây, chưa có upline)` : '') +
          (noUpline ? `, no_upline=${noUpline} (upline đạt maxEarn)` : '') +
          (notMet ? `, prev_tree_not_met=${notMet} (chưa đủ điều kiện cây trước)` : '') +
          (alreadyInTree ? `, already_in_tree=${alreadyInTree} (buyer đã có vị trí trong matrix)` : '') +
          (data?.alreadyDone ? `, already_done=${data.alreadyDone}` : '') +
          (failed ? `, failed=${failed}` : ''),
        );
      }
      await loadLevels();
    } catch (e: any) {
      message.error(
        e?.response?.data?.message || e?.message || 'Backfill orders thất bại',
      );
    } finally {
      setBackfillingOrders(false);
    }
  };

  const reverseRewardByOrder = async () => {
    const userId = reverseUserId.trim();
    const orderId = reverseOrderId.trim();
    if (!userId || !orderId) {
      message.warning('Nhập đủ User ID và Order ID để hoàn tác');
      return;
    }

    Modal.confirm({
      title: 'Xác nhận trừ lại tiền Matrix đã cộng ví?',
      content:
        'Hệ thống sẽ trừ phần matrix còn net dương của user theo orderId này, đồng thời ghi ledger âm để audit.',
      okText: 'Xác nhận trừ',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          setReversingReward(true);
          const res = await adminService.reverseMatrixRewardByOrder({
            userId,
            orderId,
            reason: reverseReason.trim() || undefined,
          });
          const data = (res as any)?.data ?? res;
          const reversed = Number(data?.reversedAmount ?? 0);
          if (reversed > 0) {
            message.success(
              `Đã trừ ${reversed.toFixed(2)} USDT. Số dư: ${Number(
                data?.balanceBefore ?? 0,
              ).toFixed(2)} -> ${Number(data?.balanceAfter ?? 0).toFixed(2)}`,
            );
          } else {
            message.info(data?.note || 'Không còn số dư matrix dương để trừ cho order này.');
          }
        } catch (e: any) {
          const msg =
            e?.response?.data?.message || e?.message || 'Không thể hoàn tác matrix reward';
          message.error(Array.isArray(msg) ? msg.join(', ') : msg);
          throw e;
        } finally {
          setReversingReward(false);
        }
      },
    });
  };

  const reverseAllOutstandingRewards = async () => {
    Modal.confirm({
      title: 'Xác nhận hoàn tác toàn bộ Matrix cho tất cả user?',
      content:
        'Hệ thống sẽ quét tất cả khoản matrix còn dương và trừ lại theo từng user + order. Thao tác này có thể mất thời gian.',
      okText: 'Xác nhận hoàn tác tất cả',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          setReversingAll(true);
          const res = await adminService.reverseAllMatrixRewardOutstanding();
          const data = (res as any)?.data ?? res;
          message.success(
            `Bulk reverse xong: scanned=${data?.scanned ?? 0}, reversed=${data?.reversed ?? 0}, total=${Number(
              data?.totalReversedAmount ?? 0,
            ).toFixed(2)} USDT, failed=${data?.failed ?? 0}`,
          );
          if (Number(data?.failed ?? 0) > 0) {
            message.warning('Có một số bản ghi không thể trừ (thường do ví không đủ). Xem chi tiết ở response API/log backend.');
          }
          await loadLedgerHistory(1, historyLimit);
        } catch (e: any) {
          const msg =
            e?.response?.data?.message || e?.message || 'Không thể hoàn tác toàn bộ matrix reward';
          message.error(Array.isArray(msg) ? msg.join(', ') : msg);
          throw e;
        } finally {
          setReversingAll(false);
        }
      },
    });
  };

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Card
        title={
          <Space>
            <PoweroffOutlined style={{ color: matrixEnabled ? '#52c41a' : '#ff4d4f' }} />
            Matrix reward pool — cấu hình
            <Tag color={matrixEnabled ? 'success' : 'error'}>
              {matrixEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {matrixEnabled ? 'Tắt hệ thống matrix:' : 'Bật hệ thống matrix:'}
            </Text>
            <Popconfirm
              title={
                matrixEnabled
                  ? 'Tắt Matrix Pool?'
                  : 'Bật Matrix Pool?'
              }
              description={
                matrixEnabled
                  ? 'Các đơn CONFIRMED sau khi tắt sẽ không được xử lý vào matrix. Backfill vẫn bị chặn.'
                  : 'Hệ thống matrix sẽ hoạt động trở lại. Dùng "Quét đơn cũ" để xử lý các đơn bị bỏ qua.'
              }
              okText={matrixEnabled ? 'Xác nhận tắt' : 'Xác nhận bật'}
              okType={matrixEnabled ? 'danger' : 'primary'}
              cancelText="Hủy"
              onConfirm={() => toggleMatrixEnabled(!matrixEnabled)}
            >
              <Switch
                checked={matrixEnabled}
                loading={togglingEnabled}
                checkedChildren="BẬT"
                unCheckedChildren="TẮT"
              />
            </Popconfirm>
          </Space>
        }
        style={{ marginBottom: 16 }}
        loading={configLoading}
      >
        {!matrixEnabled && (
          <Alert
            type="error"
            showIcon
            message="Hệ thống Matrix Pool đang TẮT"
            description="Các đơn hàng CONFIRMED sẽ không được xử lý vào matrix. Bật lại để hệ thống hoạt động bình thường."
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={form} layout="inline" onFinish={saveConfig}>
          <Form.Item name="minOrderUsd" label="Min đơn (USDT)" rules={[{ required: true }]}>
            <InputNumber min={1} step={1} />
          </Form.Item>
          <Form.Item name="perSlotUsd" label="$ / upline / lần" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.1} />
          </Form.Item>
          <Form.Item name="maxEarnPerTreeUsd" label="Trần / cây (USDT)" rules={[{ required: true }]}>
            <InputNumber min={1} step={1} />
          </Form.Item>
          <Form.Item name="maxUplines" label="Max upline" rules={[{ required: true }]}>
            <InputNumber min={1} max={50} step={1} />
          </Form.Item>
          <Form.Item
            name="prevTreeQualifyPercent"
            label="% đạt cây trước"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} max={500} step={1} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              Save
            </Button>
          </Form.Item>
        </Form>
        <Text type="secondary">
          Đơn CONFIRMED ≥ min order → user vào cây BFS theo level; mỗi upline (tối đa N) nhận per-slot; đủ trần → xóa
          node + loại khỏi cây đó. Với cây từ level 2 trở lên, user chỉ được vào nếu hoa hồng ở cây trước đạt ngưỡng
          (% cấu hình) × max effective threshold.
        </Text>
      </Card>

      <Card title="Đặt gốc cây Matrix (admin)" style={{ marginBottom: 16 }}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Khi nào dùng"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Cây trống: tạo node gốc cho user chỉ định (đơn hàng sau sẽ BFS từ gốc này).</li>
              <li>Chỉ có một node gốc, chưa có trái/phải: đổi user đứng đầu.</li>
              <li>Đã có nhánh con: không đổi gốc qua đây — cần can thiệp DB hoặc cây level mới.</li>
            </ul>
          }
        />
        <Space align="end" wrap style={{ width: '100%', marginBottom: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
              Tạo sẵn cây đến level
            </div>
            <InputNumber
              min={1}
              max={1000}
              step={1}
              value={prepareMaxLevel}
              onChange={(v) => setPrepareMaxLevel(Number(v || 1))}
            />
          </div>
          <Button loading={preparingTrees} onClick={prepareTrees}>
            Tạo sẵn cây
          </Button>
        </Space>
        <Space align="end" wrap style={{ width: '100%', marginBottom: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
              Backfill đơn CONFIRMED (tối đa)
            </div>
            <InputNumber
              min={1}
              max={5000}
              step={50}
              value={backfillLimit}
              onChange={(v) => setBackfillLimit(Number(v || 1))}
            />
          </div>
          <Tooltip title={!matrixEnabled ? 'Bật Matrix Pool trước khi backfill' : ''}>
            <Button
              loading={backfillingOrders}
              onClick={backfillOrders}
              disabled={!matrixEnabled}
            >
              Quét đơn cũ vào matrix
            </Button>
          </Tooltip>
        </Space>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Hoàn tác Matrix đã cộng vào ví"
          description="Dùng khi cần thu hồi thưởng matrix đã cộng nhầm. Nhập đúng User ID + Order ID để trừ phần net dương còn lại của order đó."
        />
        <Space style={{ marginBottom: 12 }}>
          <Button danger loading={reversingAll} onClick={reverseAllOutstandingRewards}>
            Hoàn tác tất cả user (bulk)
          </Button>
          <Text type="secondary">
            Chỉ trừ các khoản còn net dương; bản ghi thiếu số dư ví sẽ được báo failed.
          </Text>
        </Space>
        <Space align="end" wrap style={{ width: '100%', marginBottom: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>User ID (nhận thưởng)</div>
            <Input
              style={{ width: 280 }}
              placeholder="UUID user nhận matrix"
              value={reverseUserId}
              onChange={(e) => setReverseUserId(e.target.value)}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Order ID cần hoàn tác</div>
            <Input
              style={{ width: 280 }}
              placeholder="UUID order"
              value={reverseOrderId}
              onChange={(e) => setReverseOrderId(e.target.value)}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Lý do (optional)</div>
            <Input
              style={{ width: 300 }}
              placeholder="vd: cộng nhầm / cần rollback"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </div>
          <Button danger loading={reversingReward} onClick={reverseRewardByOrder}>
            Trừ lại Matrix theo order
          </Button>
        </Space>
        <Space wrap align="start" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>Cây (level)</div>
            <Select
              style={{ width: 160 }}
              value={treeLevel}
              onChange={setTreeLevel}
              options={levels.map((l) => ({ value: l, label: `Tree ${l}` }))}
            />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>User ID (UUID)</div>
            <Space.Compact style={{ width: '100%', maxWidth: 420 }}>
              <Input
                placeholder="Dán UUID từ chi tiết user"
                value={rootUserId}
                onChange={(e) => {
                  setRootUserId(e.target.value);
                  setUserPreview(null);
                }}
                onPressEnter={lookupUser}
              />
              <Button onClick={lookupUser}>Kiểm tra</Button>
            </Space.Compact>
            {userPreview && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {userPreview.fullName || userPreview.username || userPreview.id}
                {userPreview.email ? ` · ${userPreview.email}` : ''}
              </Text>
            )}
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <Button type="primary" loading={settingRoot} onClick={setTreeRoot}>
              Đặt làm gốc
            </Button>
          </div>
        </Space>
        <Space align="end" wrap style={{ width: '100%', marginBottom: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#666' }}>
              User ID thêm vào cây
            </div>
            <Input
              style={{ width: 280 }}
              placeholder="UUID user"
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
            />
          </div>
          <Button type="primary" loading={addingUser} onClick={addUserToTree}>
            Thêm user vào cây
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={clearingAll}
            onClick={clearAllTreesAndRewards}
          >
            Xóa toàn bộ cây + hoa hồng
          </Button>
        </Space>
      </Card>

      <Card
        title="Matrix tree view (theo cây số)"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadLevels()}>
              Refresh levels
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchTree} loading={loading}>
              Load tree
            </Button>
          </Space>
        }
      >
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 160 }}
            value={treeLevel}
            onChange={setTreeLevel}
            options={levels.map((l) => ({ value: l, label: `Tree ${l}` }))}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchTree} loading={loading}>
            Load
          </Button>
        </Space>
      </Card>

      <Card
        title="Lịch sử cộng / trừ hoa hồng Matrix Pool"
        style={{ marginTop: 16 }}
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadLedgerHistory(historyPage, historyLimit);
              loadLedgerSummary();
            }}
          >
            Refresh lịch sử
          </Button>
        }
      >
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            style={{ width: 260 }}
            placeholder="Lọc theo User ID"
            value={historyUserId}
            onChange={(e) => setHistoryUserId(e.target.value)}
          />
          <Input
            style={{ width: 260 }}
            placeholder="Lọc theo Order ID"
            value={historyOrderId}
            onChange={(e) => setHistoryOrderId(e.target.value)}
          />
          <Select
            style={{ width: 160 }}
            value={historyType}
            onChange={(v) => setHistoryType(v)}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'credit', label: 'Chỉ cộng (+)' },
              { value: 'debit', label: 'Chỉ trừ (-)' },
            ]}
          />
          <Button
            type="primary"
            onClick={() => {
              loadLedgerHistory(1, historyLimit);
              loadLedgerSummary();
            }}
          >
            Lọc
          </Button>
          <Button onClick={() => loadLedgerSummary()}>Tính tổng hợp</Button>
        </Space>
        <Space wrap size="large" style={{ marginBottom: 16 }}>
          <Statistic
            title="Tổng dòng cộng (+)"
            value={ledgerSummary.creditCount}
            loading={summaryLoading}
          />
          <Statistic
            title="Tổng dòng trừ (-)"
            value={ledgerSummary.debitCount}
            loading={summaryLoading}
          />
          <Statistic
            title="Tổng tiền cộng"
            value={ledgerSummary.totalCreditAmount}
            precision={2}
            suffix="USDT"
            loading={summaryLoading}
          />
          <Statistic
            title="Tổng tiền trừ"
            value={ledgerSummary.totalDebitAmount}
            precision={2}
            suffix="USDT"
            loading={summaryLoading}
          />
          <Statistic
            title="Net (cộng + trừ)"
            value={ledgerSummary.netAmount}
            precision={2}
            suffix="USDT"
            loading={summaryLoading}
            valueStyle={{ color: ledgerSummary.netAmount > 0 ? '#cf1322' : '#389e0d' }}
          />
          <Statistic
            title="Cặp user+order còn dương"
            value={ledgerSummary.outstandingPairCount}
            loading={summaryLoading}
            valueStyle={{ color: ledgerSummary.outstandingPairCount > 0 ? '#cf1322' : '#389e0d' }}
          />
        </Space>

        <Table<MatrixLedgerItem>
          rowKey="id"
          loading={historyLoading}
          dataSource={historyRows}
          size="small"
          scroll={{ x: 1200 }}
          columns={[
            {
              title: 'Thời gian',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 180,
              render: (v: string) => (v ? new Date(v).toLocaleString('vi-VN') : '-'),
            },
            {
              title: 'User nhận',
              key: 'beneficiary',
              width: 260,
              render: (_: unknown, r: MatrixLedgerItem) => (
                <div>
                  <div>{r.beneficiaryUsername ? `@${r.beneficiaryUsername}` : r.beneficiaryUserId}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {r.beneficiaryEmail || r.beneficiaryUserId}
                  </Text>
                </div>
              ),
            },
            {
              title: 'Số tiền',
              dataIndex: 'amount',
              key: 'amount',
              width: 140,
              render: (v: number) => (
                <Text style={{ color: v >= 0 ? '#389e0d' : '#cf1322', fontWeight: 600 }}>
                  {v >= 0 ? '+' : ''}
                  {Number(v || 0).toFixed(2)} USDT
                </Text>
              ),
            },
            { title: 'Order ID', dataIndex: 'orderId', key: 'orderId', width: 260 },
            { title: 'Tree ID', dataIndex: 'treeId', key: 'treeId', width: 260 },
            { title: 'Source Node', dataIndex: 'sourceNodeId', key: 'sourceNodeId', width: 260 },
          ]}
          pagination={{
            current: historyPage,
            pageSize: historyLimit,
            total: historyTotal,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (p, s) => loadLedgerHistory(p, s),
          }}
        />
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 50 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && treeData && (
        <Card style={{ marginTop: 16 }}>
          <Title level={5}>Level {treeLevel}</Title>
          <div ref={reactFlowContainerRef} style={{ width: '100%', height: '75vh' }}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                fitView
                onInit={onInit}
                minZoom={0.05}
                maxZoom={1.5}
              >
                <Controls />
                <MiniMap />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                <Panel position="top-left">
                  <Tag color="blue">Left</Tag>
                  <Tag color="green">Right</Tag>
                </Panel>
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </Card>
      )}
    </div>
  );
};

export default MatrixPool;
