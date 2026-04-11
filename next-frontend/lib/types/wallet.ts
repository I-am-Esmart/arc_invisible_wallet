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
  displayName?: string;
  username?: string;
  balances?: WalletBalances;
  network?: string;
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
