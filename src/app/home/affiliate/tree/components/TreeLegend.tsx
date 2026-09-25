"use client";

import React from "react";
import { BRANCH_COLOR, ROOT_COLOR } from "./treeUtils";

interface Props {
  youLabel: string;
  team1Label: string;
  team2Label: string;
}

/** Chú thích màu nhánh, thay cho MiniMap kiểu admin. */
export default function TreeLegend({ youLabel, team1Label, team2Label }: Props) {
  const items = [
    { color: ROOT_COLOR, label: youLabel },
    { color: BRANCH_COLOR.left, label: team1Label },
    { color: BRANCH_COLOR.right, label: team2Label },
  ];

  return (
    <div className="flex items-center justify-center gap-4">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
