"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import TreeNodeCard from "./TreeNodeCard";
import EmptySlot from "./EmptySlot";
import {
  BRANCH_COLOR,
  Branch,
  CARD_H,
  LEVEL_GAP,
  TreeNode,
  getChild,
  measureDepth,
  measureSubtree,
  shouldRenderSlots,
} from "./treeUtils";

interface Labels {
  you: string;
  emptySlot: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
  loadMore: string;
}

interface Props {
  root: TreeNode;
  maxLevel: number;
  highlightId?: string | null;
  labels: Labels;
  onNodeClick: (node: TreeNode) => void;
  onEmptySlotClick: (branch: Branch) => void;
  onDrillDown: (node: TreeNode) => void;
}

interface SubtreeProps extends Omit<Props, "root" | "maxLevel"> {
  node: TreeNode;
  level: number;
  maxLevel: number;
  isRoot: boolean;
  branch: Branch;
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 1.4;
const FIT_MIN_SCALE = 0.55;

function Subtree({
  node,
  level,
  maxLevel,
  isRoot,
  branch,
  highlightId,
  labels,
  onNodeClick,
  onEmptySlotClick,
  onDrillDown,
}: SubtreeProps) {
  const width = measureSubtree(node, level, maxLevel);
  const expand = shouldRenderSlots(node, level, maxLevel);
  const leftChild = getChild(node, "left");
  const rightChild = getChild(node, "right");
  const half = LEVEL_GAP / 2;

  const renderSlot = (child: TreeNode | null, side: Branch) => (
    <div className="flex w-1/2 justify-center">
      {child ? (
        <Subtree
          node={child}
          level={level + 1}
          maxLevel={maxLevel}
          isRoot={false}
          branch={isRoot ? side : branch}
          highlightId={highlightId}
          labels={labels}
          onNodeClick={onNodeClick}
          onEmptySlotClick={onEmptySlotClick}
          onDrillDown={onDrillDown}
        />
      ) : (
        <EmptySlot
          branch={side}
          label={labels.emptySlot}
          onClick={() => onEmptySlotClick(isRoot ? side : branch)}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center" style={{ width }}>
      <TreeNodeCard
        node={node}
        isRoot={isRoot}
        isHighlighted={highlightId === node.id}
        youLabel={labels.you}
        onClick={onNodeClick}
      />

      {/* Node ở cấp cuối nhưng vẫn còn tuyến dưới: mở cây con của chính node đó. */}
      {!expand && node.hasMoreChildren && (
        <button
          type="button"
          onClick={() => onDrillDown(node)}
          className="mt-1 flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 active:scale-95"
        >
          <span className="material-symbols-outlined text-[12px]">more_horiz</span>
          {labels.loadMore}
        </button>
      )}

      {expand && (
        <div className="relative flex w-full" style={{ paddingTop: LEVEL_GAP }}>
          {/* Thân nối từ node cha xuống thanh ngang */}
          <span
            className="absolute top-0 -translate-x-1/2 bg-slate-300"
            style={{ left: "50%", width: 2, height: half }}
          />
          {/* Thanh ngang, mỗi nửa mang màu của nhánh tương ứng */}
          <span
            className="absolute"
            style={{ left: "25%", top: half - 1, width: "25%", height: 2, background: BRANCH_COLOR.left }}
          />
          <span
            className="absolute"
            style={{ left: "50%", top: half - 1, width: "25%", height: 2, background: BRANCH_COLOR.right }}
          />
          {/* Thân nối xuống từng node con */}
          <span
            className="absolute -translate-x-1/2"
            style={{ left: "25%", top: half, width: 2, height: half, background: BRANCH_COLOR.left }}
          />
          <span
            className="absolute -translate-x-1/2"
            style={{ left: "75%", top: half, width: 2, height: half, background: BRANCH_COLOR.right }}
          />

          {renderSlot(leftChild, "left")}
          {renderSlot(rightChild, "right")}
        </div>
      )}
    </div>
  );
}

/**
 * Khung cuộn + thu phóng cho sơ đồ cây. Bề rộng cây được tính đối xứng nên
 * kích thước khung biết trước, không cần đo lại DOM.
 */
export default function TreeCanvas({
  root,
  maxLevel,
  highlightId,
  labels,
  onNodeClick,
  onEmptySlotClick,
  onDrillDown,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const width = measureSubtree(root, 0, maxLevel);
  const depth = measureDepth(root, 0, maxLevel);
  const height = depth * CARD_H + (depth - 1) * LEVEL_GAP + 48;

  const fitToWidth = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const available = container.clientWidth - 16;
    if (available <= 0) return;
    // Không thu nhỏ quá FIT_MIN_SCALE: dưới ngưỡng này chữ trên thẻ không còn
    // đọc được, cuộn ngang dễ chịu hơn.
    const next = Math.min(1, available / width);
    setScale(Math.max(FIT_MIN_SCALE, Number(next.toFixed(2))));
    // Cây rộng hơn khung thì canh giữa để người dùng thấy ngay node gốc.
    window.requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
    });
  }, [width]);

  useEffect(() => {
    fitToWidth();
  }, [fitToWidth]);

  const zoom = (delta: number) =>
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((s + delta).toFixed(2)))));

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="overflow-auto rounded-2xl border border-slate-100 bg-slate-50/60 p-2"
        style={{ maxHeight: "62vh" }}
      >
        <div style={{ width: width * scale, height: height * scale }} className="mx-auto">
          <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <Subtree
              node={root}
              level={0}
              maxLevel={maxLevel}
              isRoot
              branch="left"
              highlightId={highlightId}
              labels={labels}
              onNodeClick={onNodeClick}
              onEmptySlotClick={onEmptySlotClick}
              onDrillDown={onDrillDown}
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-full bg-white/90 p-1 shadow-md backdrop-blur">
        <button
          type="button"
          aria-label={labels.zoomIn}
          onClick={() => zoom(0.15)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 active:bg-slate-100"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
        <button
          type="button"
          aria-label={labels.zoomOut}
          onClick={() => zoom(-0.15)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 active:bg-slate-100"
        >
          <span className="material-symbols-outlined text-[18px]">remove</span>
        </button>
        <button
          type="button"
          aria-label={labels.reset}
          onClick={fitToWidth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 active:bg-slate-100"
        >
          <span className="material-symbols-outlined text-[18px]">fit_screen</span>
        </button>
      </div>
    </div>
  );
}
