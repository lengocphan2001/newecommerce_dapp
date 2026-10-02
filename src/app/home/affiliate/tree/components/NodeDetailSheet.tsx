"use client";

import React from "react";
import { formatAmount } from "@/app/utils/format";
import {
  BRANCH_COLOR,
  ROOT_COLOR,
  TreeNode,
  formatJoinDate,
  getMemberTag,
  getMemberTagClass,
  initialsOf,
} from "./treeUtils";

interface Props {
  node: TreeNode;
  isRoot: boolean;
  canDrillDown: boolean;
  labels: {
    title: string;
    joinedAt: string;
    personalVolume: string;
    team1Volume: string;
    team2Volume: string;
    viewMemberTree: string;
    close: string;
  };
  onClose: () => void;
  onViewTree: (node: TreeNode) => void;
}

/** Bảng chi tiết trượt lên từ đáy khi bấm vào một thành viên trên sơ đồ. */
export default function NodeDetailSheet({
  node,
  isRoot,
  canDrillDown,
  labels,
  onClose,
  onViewTree,
}: Props) {
  const color = isRoot
    ? ROOT_COLOR
    : node.position === "right"
      ? BRANCH_COLOR.right
      : BRANCH_COLOR.left;

  const rows: Array<{ label: string; value: string; color?: string }> = [
    { label: labels.personalVolume, value: `$${formatAmount(node.totalPurchaseAmount, 2, 2)}` },
    {
      label: labels.team1Volume,
      value: `$${formatAmount(node.leftBranchTotal, 2, 2)}`,
      color: BRANCH_COLOR.left,
    },
    {
      label: labels.team2Volume,
      value: `$${formatAmount(node.rightBranchTotal, 2, 2)}`,
      color: BRANCH_COLOR.right,
    },
  ];

  const joined = formatJoinDate(node.createdAt);
  if (joined) rows.unshift({ label: labels.joinedAt, value: joined });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={labels.close}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40"
      />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />

        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
            style={{ background: color }}
          >
            {node.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={node.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsOf(node)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-slate-900">
              {node.fullName || node.username || "—"}
            </p>
            {node.username && (
              <p className="truncate font-mono text-xs text-slate-400">@{node.username}</p>
            )}
          </div>
          <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${getMemberTagClass(node)}`}>
            {getMemberTag(node)}
          </span>
        </div>

        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-3 py-2.5">
              <span className="text-xs text-slate-500">{row.label}</span>
              <span className="text-sm font-bold" style={{ color: row.color || "#1f2937" }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {canDrillDown && (
          <button
            type="button"
            onClick={() => onViewTree(node)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">account_tree</span>
            {labels.viewMemberTree}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-slate-500 active:bg-slate-50"
        >
          {labels.close}
        </button>
      </div>
    </div>
  );
}
