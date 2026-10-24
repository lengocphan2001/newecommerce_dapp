"use client";

import React from "react";
import { BRANCH_COLOR, Branch, CARD_H, CARD_W } from "./treeUtils";

interface Props {
  branch: Branch;
  label: string;
  onClick: () => void;
}

/** Vị trí còn trống trong cây — bấm vào để lấy link mời đúng nhánh. */
export default function EmptySlot({ branch, label, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: CARD_W, height: CARD_H, borderColor: `${BRANCH_COLOR[branch]}66` }}
      className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-white/60 px-1 transition-transform active:scale-95"
    >
      <span
        className="material-symbols-outlined text-[20px]"
        style={{ color: BRANCH_COLOR[branch] }}
      >
        person_add
      </span>
      <span
        className="text-[9px] font-bold leading-tight"
        style={{ color: BRANCH_COLOR[branch] }}
      >
        {label}
      </span>
    </button>
  );
}
