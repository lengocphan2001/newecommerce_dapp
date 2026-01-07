"use client";

import React from "react";

interface WalletStatusChipProps {
  walletAddress?: string;
  walletName?: string;
}

export default function WalletStatusChip({
  walletAddress,
  walletName = "SafePal",
}: WalletStatusChipProps) {
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-2)}`
    : "Not Connected";

  return (
    <div className="px-4 py-2">
      <div className="inline-flex items-center gap-x-2 rounded-full bg-[#23482f]/50 border border-[#13ec5b]/20 pl-2 pr-4 py-1">
        <span className="material-symbols-outlined text-[#13ec5b] text-sm">
          account_balance_wallet
        </span>
        <p className="text-[#13ec5b] text-xs font-medium">
          {walletName}: {shortAddress} {walletAddress ? "Connected" : ""}
        </p>
      </div>
    </div>
  );
}
