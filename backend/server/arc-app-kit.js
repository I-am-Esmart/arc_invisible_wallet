let runtime = null;

function getRuntime() {
  if (!runtime) {
    const { AppKit } = require("@circle-fin/app-kit");
    const { createCircleWalletsAdapter } = require("@circle-fin/adapter-circle-wallets");
    runtime = { AppKit, createCircleWalletsAdapter };
  }

  return runtime;
}

function createCircleAppKitAdapter({ apiKey, entitySecret, baseUrl }) {
  const { createCircleWalletsAdapter } = getRuntime();

  return createCircleWalletsAdapter({
    apiKey,
    entitySecret,
    baseUrl
  });
}

function createAppKit() {
  const { AppKit } = getRuntime();
  return new AppKit();
}

function buildDeveloperControlledContext({ adapter, chain, address }) {
  return {
    adapter,
    chain,
    address
  };
}

async function executeBridgeWithCircleWallets({
  apiKey,
  entitySecret,
  baseUrl,
  fromChain,
  toChain,
  fromAddress,
  toAddress,
  amount
}) {
  const adapter = createCircleAppKitAdapter({ apiKey, entitySecret, baseUrl });
  const kit = createAppKit();

  return kit.bridge({
    from: buildDeveloperControlledContext({ adapter, chain: fromChain, address: fromAddress }),
    to: buildDeveloperControlledContext({ adapter, chain: toChain, address: toAddress }),
    amount
  });
}

async function executeSwapWithCircleWallets({
  apiKey,
  entitySecret,
  baseUrl,
  kitKey,
  chain,
  address,
  tokenIn,
  tokenOut,
  amountIn
}) {
  const adapter = createCircleAppKitAdapter({ apiKey, entitySecret, baseUrl });
  const kit = createAppKit();

  return kit.swap({
    from: buildDeveloperControlledContext({ adapter, chain, address }),
    tokenIn,
    tokenOut,
    amountIn,
    config: kitKey ? { kitKey } : undefined
  });
}

async function getUnifiedBalanceWithCircleWallets({
  apiKey,
  entitySecret,
  baseUrl,
  chain,
  address,
  token = "USDC"
}) {
  const adapter = createCircleAppKitAdapter({ apiKey, entitySecret, baseUrl });
  const kit = createAppKit();

  return kit.unifiedBalance.getBalances({
    source: buildDeveloperControlledContext({ adapter, chain, address }),
    token
  });
}

module.exports = {
  createAppKit,
  createCircleAppKitAdapter,
  executeBridgeWithCircleWallets,
  executeSwapWithCircleWallets,
  getUnifiedBalanceWithCircleWallets
};
