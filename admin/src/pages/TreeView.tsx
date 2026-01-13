import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Select, message, Spin, Tag, Space, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminService } from '../services/adminService';
import { userService } from '../services/userService';
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

interface TreeNode {
  id: string;
  username: string | null;
  fullName: string;
  email: string;
  packageType: 'NONE' | 'CTV' | 'NPP';
  avatar?: string;
  leftBranchTotal: number;
  rightBranchTotal: number;
  totalPurchaseAmount: number;
  createdAt: string;
  position?: 'left' | 'right';
  children?: TreeNode[];
}

// Custom Node Component
interface CustomNodeData extends Record<string, unknown> {
  node: TreeNode;
}

const CustomNode = ({ data }: { data: CustomNodeData }) => {
  const { node } = data;
  const borderColor = 
    node.position === 'left' ? '#1890ff' : 
    node.position === 'right' ? '#52c41a' : 
    '#722ed1';

  const getPackageColor = (packageType: 'NONE' | 'CTV' | 'NPP') => {
    switch (packageType) {
      case 'NPP':
        return 'gold';
      case 'CTV':
        return 'blue';
      default:
        return 'default';
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

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
      {/* Source Handle (bottom) */}
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        style={{ background: borderColor, width: '8px', height: '8px' }}
      />
      {/* Target Handle (top) */}
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        style={{ background: borderColor, width: '8px', height: '8px' }}
      />
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>
          <Tag color={getPackageColor(node.packageType)} style={{ marginBottom: 4, fontSize: '11px' }}>
            {node.packageType}
          </Tag>
        </div>
        <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: '13px', color: '#262626' }}>
          {node.fullName || node.username || 'N/A'}
        </div>
        {node.username && (
          <div style={{ fontSize: '11px', color: '#595959', marginBottom: 4 }}>
            @{node.username}
          </div>
        )}
        <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 8, wordBreak: 'break-all' }}>
          {node.email}
        </div>
        <div style={{ fontSize: '11px', marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: '#8c8c8c' }}>Purchase: </span>
            <strong style={{ color: '#262626' }}>${formatPrice(node.totalPurchaseAmount)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <Tooltip title="Left Branch Volume">
              <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '10px' }}>
                L: ${formatPrice(node.leftBranchTotal)}
              </span>
            </Tooltip>
            <Tooltip title="Right Branch Volume">
              <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: '10px' }}>
                R: ${formatPrice(node.rightBranchTotal)}
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const TreeView: React.FC = () => {
  const [rootUserId, setRootUserId] = useState<string>('');
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [maxDepth, setMaxDepth] = useState<number>(5);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; username: string; fullName: string }>>([]);
  const reactFlowContainerRef = React.useRef<HTMLDivElement>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await userService.getAll();
      const users = Array.isArray(response.data) ? response.data : [];
      setAllUsers(users.map((u: any) => ({ id: u.id, username: u.username, fullName: u.fullName || u.email })));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchTree = async () => {
    if (!rootUserId) {
      message.warning('Please select a user first');
      return;
    }

    setLoading(true);
    try {
      const response = await adminService.getFullTree(rootUserId, maxDepth);
      const data = (response as any)?.data || response;
      setTreeData(data as TreeNode);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Failed to fetch tree data');
    } finally {
      setLoading(false);
    }
  };

  // Convert tree data to React Flow nodes and edges
  const convertTreeToFlow = useCallback((tree: TreeNode, x: number = 0, y: number = 0, level: number = 0): { nodes: Node[], edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeSpacing = { x: 300, y: 150 };
    const levelHeight = 200;

    const processNode = (node: TreeNode, posX: number, posY: number, parentId?: string): void => {
      const nodeId = node.id;
      
      // Create node
      nodes.push({
        id: nodeId,
        type: 'custom',
        position: { x: posX, y: posY },
        data: { node } as CustomNodeData as Record<string, unknown>,
      });

      // Create edge from parent
      if (parentId) {
        edges.push({
          id: `e${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          sourceHandle: 'source-bottom',
          targetHandle: 'target-top',
          type: 'smoothstep',
          animated: true,
          style: { stroke: node.position === 'left' ? '#1890ff' : '#52c41a', strokeWidth: 2 },
        });
      }

      // Process children
      if (node.children && node.children.length > 0) {
        const leftChild = node.children.find((c) => c.position === 'left');
        const rightChild = node.children.find((c) => c.position === 'right');

        // Calculate positions for children
        const childY = posY + levelHeight;
        let leftX = posX;
        let rightX = posX;

        if (leftChild && rightChild) {
          // Both children: spread them
          leftX = posX - nodeSpacing.x / 2;
          rightX = posX + nodeSpacing.x / 2;
        } else if (leftChild) {
          // Only left child: center it
          leftX = posX - nodeSpacing.x / 4;
        } else if (rightChild) {
          // Only right child: center it
          rightX = posX + nodeSpacing.x / 4;
        }

        if (leftChild) {
          processNode(leftChild, leftX, childY, nodeId);
        }
        if (rightChild) {
          processNode(rightChild, rightX, childY, nodeId);
        }
      }
    };

    processNode(tree, x, y);
    return { nodes, edges };
  }, []);

  // Update nodes and edges when tree data changes
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

  // Ensure container has width and height
  useEffect(() => {
    if (reactFlowContainerRef.current) {
      const container = reactFlowContainerRef.current;
      if (!container.style.width || !container.style.height) {
        container.style.width = '100%';
        container.style.height = '75vh';
        container.style.minHeight = '600px';
      }
    }
  }, [treeData]);

  const onInit = useCallback((reactFlowInstance: any) => {
    // Fit view when tree is loaded
    if (nodes.length > 0) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
      }, 100);
    }
  }, [nodes.length]);

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Card
        title="Binary Tree View"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchTree} loading={loading}>
              Refresh
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap>
            <Select
              showSearch
              placeholder="Select root user"
              style={{ width: 300 }}
              value={rootUserId}
              onChange={setRootUserId}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={allUsers.map((user) => ({
                value: user.id,
                label: `${user.fullName || user.username} (${user.username || 'N/A'})`,
              }))}
            />
            <Select
              style={{ width: 150 }}
              value={maxDepth}
              onChange={setMaxDepth}
              options={[
                { value: 3, label: 'Depth: 3' },
                { value: 4, label: 'Depth: 4' },
                { value: 5, label: 'Depth: 5' },
                { value: 6, label: 'Depth: 6' },
                { value: 7, label: 'Depth: 7' },
              ]}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={fetchTree} loading={loading}>
              Load Tree
            </Button>
          </Space>
        </Space>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && (
        <Card bodyStyle={{ padding: 0 }}>
          <ReactFlowProvider>
            <div 
              ref={reactFlowContainerRef}
              style={{ 
                width: '100%', 
                height: '75vh', 
                minHeight: '600px',
                position: 'relative'
              }}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                fitView
                onInit={onInit}
                attributionPosition="bottom-left"
              >
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  const data = (node.data as CustomNodeData)?.node;
                  if (data && 'position' in data) {
                    if (data.position === 'left') return '#1890ff';
                    if (data.position === 'right') return '#52c41a';
                  }
                  return '#722ed1';
                }}
                maskColor="rgba(0, 0, 0, 0.1)"
              />
              <Panel position="top-right">
                <Space direction="vertical" size="small">
                  <div style={{ background: 'white', padding: '8px', borderRadius: '4px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <div><strong>Controls:</strong></div>
                    <div>• Drag to pan</div>
                    <div>• Scroll to zoom</div>
                    <div>• Drag nodes to reposition</div>
                  </div>
                </Space>
              </Panel>
              </ReactFlow>
            </div>
          </ReactFlowProvider>
        </Card>
      )}

      {!loading && !treeData && rootUserId && (
        <Card>
          <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
            Click "Load Tree" to view the binary tree structure
          </div>
        </Card>
      )}

      {!loading && !treeData && !rootUserId && (
        <Card>
          <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
            Please select a user to view their binary tree
          </div>
        </Card>
      )}
    </div>
  );
};

export default TreeView;
