"use client";

import React from "react";
import { formatAmount } from "@/app/utils/format";
import { getMemberTag, getMemberTagClass } from "./treeUtils";

export interface ListMember {
  id: string;
  username: string;
  fullName: string;
  avatar?: string;
  packageType: string;
  position: "left" | "right";
  totalPurchaseAmount: number;
  depth: number;
}

export interface ListBranch {
  members: ListMember[];
  volume: number;
  count: number;
}

interface Props {
  left: ListBranch;
  right: ListBranch;
  labels: {
    left: string;
    right: string;
    members: string;
    addMember: string;
  };
  highlightId?: string | null;
  onInvite: (branch: "left" | "right") => void;
}

function formatVolume(volume: number) {
  return formatAmount(volume, 4, 4);
}

/**
 * Hai cột thành viên theo nhánh. Giữ lại vì nhiều người dùng đã quen cách xem
 * này và nó đọc nhanh hơn sơ đồ khi tuyến dưới dài.
 */
export default function BranchListView({ left, right, labels, highlightId, onInvite }: Props) {
  const columns: Array<{ side: "left" | "right"; title: string; data: ListBranch }> = [
    { side: "left", title: labels.left, data: left },
    { side: "right", title: labels.right, data: right },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {columns.map((column) => (
        <div key={column.side} className="flex flex-col gap-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-[10px] font-bold uppercase text-gray-400">{column.title}</p>
            <div className="flex flex-col">
              <span className="text-base font-bold text-text-dark">
                ${formatVolume(column.data.volume)}
              </span>
              <span className="text-[10px] text-gray-500">
                {column.data.count} {labels.members}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {column.data.members.map((member) => (
              <div
                key={member.id}
                id={`tree-list-${member.id}`}
                className={`relative flex items-center gap-2 overflow-hidden rounded-xl border bg-white p-2 ${
                  highlightId === member.id ? "ring-2 ring-amber-400" : ""
                }`}
                style={{
                  marginLeft: `${member.depth > 1 ? (member.depth - 1) * 8 : 0}px`,
                  borderColor: member.depth > 1 ? "#e2e8f0" : "#135bec20",
                }}
              >
                {member.depth > 1 && <div className="absolute bottom-0 left-0 top-0 w-1 bg-slate-100" />}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="material-symbols-outlined text-sm text-primary">
                    {member.packageType === "NONE" ? "person" : "workspace_premium"}
                  </span>
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-[11px] font-bold text-text-dark">
                    {member.fullName || member.username}
                  </p>
                  <p className="font-mono text-[9px] uppercase text-gray-400">{member.username}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className={`rounded px-1 text-[8px] font-bold ${getMemberTagClass(member)}`}>
                      {getMemberTag(member)}
                    </span>
                    {member.totalPurchaseAmount > 0 && (
                      <p className="text-[9px] font-bold text-emerald-600">
                        ${formatAmount(member.totalPurchaseAmount, 2, 2)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => onInvite(column.side)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary bg-blue-50 p-3 transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-xl text-primary">add_circle</span>
              <span className="text-[10px] font-bold uppercase text-primary">{labels.addMember}</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
