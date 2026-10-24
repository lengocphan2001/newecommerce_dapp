"use client";

import React from "react";
import {
  BRANCH_COLOR,
  CARD_H,
  CARD_W,
  ROOT_COLOR,
  TreeNode,
  getMemberTag,
  getMemberTagClass,
  initialsOf,
} from "./treeUtils";

interface Props {
  node: TreeNode;
  isRoot?: boolean;
  isHighlighted?: boolean;
  youLabel: string;
  onClick: (node: TreeNode) => void;
}

/**
 * Thẻ một thành viên trên sơ đồ. Cố tình gọn: chỉ tên, tài khoản và cấp bậc.
 * Số liệu doanh số đầy đủ nằm ở bảng chi tiết khi bấm vào thẻ.
 */
export default function TreeNodeCard({ node, isRoot, isHighlighted, youLabel, onClick }: Props) {
  const color = isRoot
    ? ROOT_COLOR
    : node.position === "right"
      ? BRANCH_COLOR.right
      : BRANCH_COLOR.left;

  return (
    <button
      id={`tree-node-${node.id}`}
      type="button"
      onClick={() => onClick(node)}
      style={{ width: CARD_W, height: CARD_H, borderColor: color }}
      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 bg-white px-1.5 shadow-sm transition-transform active:scale-95 ${
        isHighlighted ? "ring-2 ring-amber-400 ring-offset-1" : ""
      }`}
    >
      {isRoot && (
        <span
          className="absolute -top-2 rounded-full px-1.5 py-px text-[8px] font-bold uppercase text-white"
          style={{ background: ROOT_COLOR }}
        >
          {youLabel}
        </span>
      )}

      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white"
        style={{ background: color }}
      >
        {node.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsOf(node)
        )}
      </span>

      <span className="w-full truncate text-[10px] font-bold leading-tight text-slate-800">
        {node.fullName || node.username || "—"}
      </span>
      {node.username && (
        <span className="w-full truncate font-mono text-[8px] leading-tight text-slate-400">
          @{node.username}
        </span>
      )}
      <span className={`rounded px-1 text-[8px] font-bold leading-tight ${getMemberTagClass(node)}`}>
        {getMemberTag(node)}
      </span>
    </button>
  );
}
