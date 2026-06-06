export type WalletBalances = Record<
  string,
  {
    symbol: string;
    address: string;
    balance: string;
  }
>;

export type WalletUser = {
  email: string;
  address: string;
  arcKeyId: string;
  walletId?: string | null;
  displayName?: string;
  username?: string;
  balances?: WalletBalances;
  network?: string;
  custodyType?: string;
  accountType?: string;
  gasMode?: string;
  sessionToken?: string;
};

export type WalletLoginChallenge = {
  challengeId: string;
  email: string;
  message: string;
};

export type WalletTransaction = {
  id?: string;
  hash: string;
  transactionHash?: string;
  from: string;
  to: string;
  amount: string;
  symbol?: string;
  token?: string;
  currency?: string;
  status: string;
  explorer?: string;
  explorerUrl?: string;
  timestamp: string;
  paidAt?: string;
};
