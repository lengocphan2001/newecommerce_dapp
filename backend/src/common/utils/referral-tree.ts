/**
 * Helpers for the referral tree (`users.referralUserId`).
 *
 * Computing a per-user subtree total by running one traversal per user is
 * O(n^2) on a deep tree. These helpers do a single traversal and accumulate
 * every subtree in one reverse pass instead, which is O(n).
 */

export interface SubtreeAggregates {
  /** Sum of `valueOf` over the node and all of its descendants. */
  subtreeValue: Map<string, number>;
  /** Number of nodes in the branch, including the node itself. */
  subtreeCount: Map<string, number>;
  /**
   * Nodes that could not be reached from any root, meaning their parent chain
   * loops. Corrupt data; their aggregates are still produced but a cycle edge
   * is ignored so the traversal terminates.
   */
  cyclicNodeIds: string[];
}

/** Group nodes by parent id, skipping nodes that point at themselves. */
export function buildChildrenMap<T>(
  nodes: T[],
  getId: (node: T) => string,
  getParentId: (node: T) => string | null | undefined,
): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    const id = getId(node);
    const parentId = getParentId(node);
    if (!parentId || parentId === id) continue;
    const list = childrenMap.get(parentId);
    if (list) list.push(id);
    else childrenMap.set(parentId, [id]);
  }
  return childrenMap;
}

/**
 * Accumulate a value over every subtree in one pass.
 *
 * Depth-first pre-order puts a parent before all of its descendants, so
 * walking that order backwards guarantees every child is finished before its
 * parent is reached.
 */
export function computeSubtreeAggregates(
  nodeIds: string[],
  childrenMap: Map<string, string[]>,
  valueOf: (nodeId: string) => number,
): SubtreeAggregates {
  const childIds = new Set<string>();
  for (const children of childrenMap.values()) {
    for (const childId of children) childIds.add(childId);
  }

  const visited = new Set<string>();
  const order: string[] = [];
  const stack: string[] = [];

  const walkFrom = (rootId: string) => {
    if (visited.has(rootId)) return;
    stack.push(rootId);
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      order.push(currentId);
      const children = childrenMap.get(currentId);
      if (!children) continue;
      for (const childId of children) {
        if (!visited.has(childId)) stack.push(childId);
      }
    }
  };

  for (const nodeId of nodeIds) {
    if (!childIds.has(nodeId)) walkFrom(nodeId);
  }

  // Whatever is left sits in a referral cycle. Take each as its own root so
  // the aggregates still terminate, and report them to the caller.
  const cyclicNodeIds: string[] = [];
  for (const nodeId of nodeIds) {
    if (visited.has(nodeId)) continue;
    cyclicNodeIds.push(nodeId);
    walkFrom(nodeId);
  }

  const subtreeValue = new Map<string, number>();
  const subtreeCount = new Map<string, number>();

  for (let i = order.length - 1; i >= 0; i--) {
    const nodeId = order[i];
    let value = valueOf(nodeId);
    let count = 1;
    const children = childrenMap.get(nodeId);
    if (children) {
      for (const childId of children) {
        const childValue = subtreeValue.get(childId);
        // Undefined means the child is an ancestor reached through a cycle, or
        // points at a node outside `nodeIds`. Skip it either way.
        if (childValue === undefined) continue;
        value += childValue;
        count += subtreeCount.get(childId)!;
      }
    }
    subtreeValue.set(nodeId, value);
    subtreeCount.set(nodeId, count);
  }

  return { subtreeValue, subtreeCount, cyclicNodeIds };
}
