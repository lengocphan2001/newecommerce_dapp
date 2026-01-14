"use client";

import React from "react";

interface WalletStatusChipProps {
  walletAddress?: string;
  walletName?: string;
}

export default function WalletStatusChip({
  walletAddress,
  walletName = "SafePalMall",
}: WalletStatusChipProps) {
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-2)}`
    : "Not Connected";

  return (
    <div className="bg-white px-4 py-3 border-b border-gray-100">
      <div className="inline-flex items-center gap-x-2 rounded-full bg-green-50 border border-green-200 pl-2 pr-4 py-1.5 shadow-sm">
        <span className="material-symbols-outlined text-primary-dark text-sm">account_balance_wallet</span>
        <p className="text-primary-dark text-xs font-semibold">{walletName}: {shortAddress} {walletAddress ? "Connected" : ""}</p>
      </div>
    </div>
  );
}
