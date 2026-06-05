export type FeatureCapabilities = {
  network: {
    name: string;
    blockchain: string;
    explorerBaseUrl: string;
    finality: string;
    gasToken: string;
  };
  wallets: {
    developerControlled: boolean;
    userControlled: boolean;
    defaultAccountType: string;
    gasStation: boolean;
  };
  payments: {
    links: boolean;
    receipts: boolean;
    recurringRequests: boolean;
    batchTransfers: boolean;
    simulation: boolean;
    settlementReports: boolean;
  };
  appKit: {
    available: boolean;
    bridge: boolean;
    unifiedBalance: boolean;
    swaps: boolean;
  };
  tokens: string[];
};

export type FeatureStatus = {
  status: string;
  feature?: string;
  message?: string;
  nextStep?: string;
  [key: string]: unknown;
};
