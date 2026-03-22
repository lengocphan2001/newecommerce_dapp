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
} from 'antd';
import { ReloadOutlined, SearchOutlined, SaveOutlined } from '@ant-design/icons';
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
        <Tooltip title="Tổng nhận từ pool trên cây này (USD)">
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#722ed1' }}>
            Earned: ${Number(node.matrixEarnedOnTree || 0).toFixed(2)}
          </div>
        </Tooltip>
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
  const [form] = Form.useForm();
  const reactFlowContainerRef = React.useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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
      });
    } catch (e: any) {
      message.error(e?.message || 'Failed to load matrix config');
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    loadLevels();
    loadConfig();
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

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Card title="Matrix reward pool — cấu hình" style={{ marginBottom: 16 }} loading={configLoading}>
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
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              Save
            </Button>
          </Form.Item>
        </Form>
        <Text type="secondary">
          Đơn CONFIRMED ≥ min order → user vào cây BFS theo level; mỗi upline (tối đa N) nhận per-slot; đủ trần → xóa
          node + loại khỏi cây đó.
        </Text>
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
