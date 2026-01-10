// USDT Contract Addresses on different chains
const USDT_CONTRACTS: Record<string, string> = {
  "0x1": "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum Mainnet
  "0x38": "0x55d398326f99059fF775485246999027B3197955", // BSC
  "0x89": "0xc2132D05D31c914a87C6611C10748AaCBdA1D28", // Polygon
  "0xa": "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // Optimism
  "0xa4b1": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum
  "0xa86a": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", // Avalanche C-Chain (USDT.e)
};

// ERC-20 ABI for balanceOf function
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
];

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
};

export async function getUSDTBalance(
  provider: Eip1193Provider,
  walletAddress: string,
  chainId: string
): Promise<{ balance: string; decimals: number } | null> {
  try {
    // Get USDT contract address for the current chain
    const usdtAddress = USDT_CONTRACTS[chainId.toLowerCase()];
    if (!usdtAddress) {
      return null;
    }

    // Get decimals (USDT usually has 6 decimals, but let's check)
    const decimalsHex = await provider.request({
      method: "eth_call",
      params: [
        {
          to: usdtAddress,
          data: "0x313ce567", // decimals() function selector
        },
        "latest",
      ],
    }) as string;

    const decimals = decimalsHex ? parseInt(decimalsHex, 16) : 6;

    // Get balance using balanceOf function
    // balanceOf(address) function selector: 0x70a08231
    // Pad address to 32 bytes (64 hex chars)
    const addressParam = walletAddress.slice(2).padStart(64, "0");
    const data = "0x70a08231" + addressParam;

    const balanceHex = await provider.request({
      method: "eth_call",
      params: [
        {
          to: usdtAddress,
          data: data,
        },
        "latest",
      ],
    }) as string;

    if (!balanceHex || balanceHex === "0x") {
      return { balance: "0", decimals };
    }

    const balance = BigInt(balanceHex);
    return { balance: balance.toString(), decimals };
  } catch (error) {
    return null;
  }
}

export function formatUSDT(balance: string, decimals: number): string {
  if (!balance || balance === "0") return "0";
  
  const balanceBigInt = BigInt(balance);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = balanceBigInt / base;
  const fraction = balanceBigInt % base;
  
  // Format with proper decimal places
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fractionStr ? `${whole.toString()}.${fractionStr}` : whole.toString();
}
