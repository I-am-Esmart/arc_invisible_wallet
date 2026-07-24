import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTRACT_NAME = "VeloxPayRequests";
const NETWORK = "ARC-TESTNET";
const CHAIN_ID = 5_042_002;
const ABI_VERSION = "VeloxPayRequests.v1";
const REQUIRED_ENV = [
  "CIRCLE_API_KEY",
  "CIRCLE_ENTITY_SECRET",
  "VELOXPAY_ARC_TESTNET_DEPLOYER_WALLET_ID",
  "VELOXPAY_ARC_TESTNET_USDC_ADDRESS",
  "VELOXPAY_ARC_TESTNET_EURC_ADDRESS",
  "VELOXPAY_ARC_TESTNET_DEPLOY_IDEMPOTENCY_KEY",
  "VELOXPAY_ARC_TESTNET_USDC_APPROVAL_IDEMPOTENCY_KEY",
  "VELOXPAY_ARC_TESTNET_EURC_APPROVAL_IDEMPOTENCY_KEY"
];

const TERMINAL_TRANSACTION_STATES = new Set(["COMPLETE", "FAILED", "CANCELLED", "DENIED"]);
const TERMINAL_CONTRACT_STATUSES = new Set(["COMPLETE", "FAILED"]);
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.resolve(__dirname, "..");
const buildArtifactPath = path.join(contractsRoot, "deployments", "arc-testnet", `${CONTRACT_NAME}.build.json`);
const defaultDeploymentArtifactPath = path.join(
  contractsRoot,
  "deployments",
  "arc-testnet",
  `${CONTRACT_NAME}.deployment.json`
);

const args = new Set(process.argv.slice(2));
const force = args.has("--force") || process.env.VELOXPAY_ARC_TESTNET_DEPLOYMENT_OVERWRITE === "true";
const dryRun = args.has("--dry-run");
const deploymentArtifactPath = process.env.VELOXPAY_ARC_TESTNET_DEPLOYMENT_ARTIFACT
  ? path.resolve(process.env.VELOXPAY_ARC_TESTNET_DEPLOYMENT_ARTIFACT)
  : defaultDeploymentArtifactPath;

main().catch((error) => {
  console.error(`Arc Testnet deployment failed: ${publicErrorMessage(error)}`);
  process.exitCode = 1;
});

async function main() {
  if (!existsSync(buildArtifactPath)) {
    throw new Error(`Missing build artifact: ${buildArtifactPath}. Run npm run contracts:artifacts first.`);
  }

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.log("Arc Testnet deployment skipped. Missing required server-only environment variables:");
    for (const name of missing) {
      console.log(`- ${name}`);
    }
    console.log("No Circle API calls were made.");
    return;
  }

  const usdcAddress = requireAddress("VELOXPAY_ARC_TESTNET_USDC_ADDRESS");
  const eurcAddress = requireAddress("VELOXPAY_ARC_TESTNET_EURC_ADDRESS");
  if (usdcAddress === eurcAddress) {
    throw new Error("VELOXPAY_ARC_TESTNET_USDC_ADDRESS and VELOXPAY_ARC_TESTNET_EURC_ADDRESS must be different Arc Testnet token contracts.");
  }

  if (dryRun) {
    console.log("Arc Testnet deployment dry run complete. Required environment variables are present.");
    console.log(`Network: ${NETWORK}`);
    console.log(`Chain ID: ${CHAIN_ID}`);
    console.log("Constructor parameters: [<deploying wallet address from VELOXPAY_ARC_TESTNET_DEPLOYER_WALLET_ID>]");
    console.log(`Supported tokens: USDC=${usdcAddress}, EURC=${eurcAddress}`);
    console.log("No Circle API calls were made because --dry-run was supplied.");
    return;
  }

  if (existsSync(deploymentArtifactPath) && !force) {
    throw new Error(
      `Deployment artifact already exists at ${deploymentArtifactPath}. Pass --force or set VELOXPAY_ARC_TESTNET_DEPLOYMENT_OVERWRITE=true to overwrite.`
    );
  }

  const walletId = process.env.VELOXPAY_ARC_TESTNET_DEPLOYER_WALLET_ID;
  const feeLevel = process.env.VELOXPAY_ARC_TESTNET_FEE_LEVEL || "MEDIUM";
  const buildArtifact = JSON.parse(readFileSync(buildArtifactPath, "utf8"));

  if (buildArtifact.abiVersion !== ABI_VERSION) {
    throw new Error(`Unexpected ABI version ${buildArtifact.abiVersion}; expected ${ABI_VERSION}.`);
  }

  const [{ initiateSmartContractPlatformClient }, { initiateDeveloperControlledWalletsClient }] = await Promise.all([
    import("@circle-fin/smart-contract-platform"),
    import("@circle-fin/developer-controlled-wallets")
  ]);

  const clientConfig = {
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    ...(process.env.CIRCLE_API_URL ? { baseUrl: process.env.CIRCLE_API_URL } : {})
  };
  const contractsClient = initiateSmartContractPlatformClient(clientConfig);
  const walletsClient = initiateDeveloperControlledWalletsClient(clientConfig);

  console.log(`Deploying ${CONTRACT_NAME} to ${NETWORK} with Circle Contracts.`);
  const wallet = await getDeployingWallet(walletsClient, walletId);
  if (wallet.blockchain && wallet.blockchain !== NETWORK) {
    throw new Error(`Deploying wallet is on ${wallet.blockchain}; expected ${NETWORK}.`);
  }
  if (!ADDRESS_PATTERN.test(wallet.address || "")) {
    throw new Error("Deploying wallet did not return a valid EVM owner address.");
  }

  const deployResponse = await contractsClient.deployContract({
    idempotencyKey: process.env.VELOXPAY_ARC_TESTNET_DEPLOY_IDEMPOTENCY_KEY,
    name: CONTRACT_NAME,
    description: "VeloxPay programmable payment requests for standard split and protected ERC20 payments",
    blockchain: NETWORK,
    walletId,
    abiJson: JSON.stringify(buildArtifact.abi),
    bytecode: buildArtifact.bytecode,
    constructorParameters: [wallet.address],
    fee: { type: "level", config: { feeLevel } },
    refId: `${CONTRACT_NAME}-${NETWORK}`
  });

  const circleContractId = deployResponse?.data?.contractId;
  const deploymentTransactionId = deployResponse?.data?.transactionId;
  if (!circleContractId || !deploymentTransactionId) {
    throw new Error("Circle deployment response did not include a contract ID and transaction ID.");
  }

  console.log(`Deployment submitted. Circle contract ID: ${circleContractId}`);
  console.log(`Deployment transaction ID: ${deploymentTransactionId}`);

  const deploymentTransaction = await pollTransaction(walletsClient, deploymentTransactionId, "deployment");
  if (deploymentTransaction.state !== "COMPLETE") {
    throw new Error(`Deployment transaction ended in ${deploymentTransaction.state}.`);
  }

  const contract = await pollContract(contractsClient, circleContractId);
  if (contract.status !== "COMPLETE" || !contract.contractAddress) {
    throw new Error(`Contract deployment did not complete. Current status: ${contract.status || "unknown"}.`);
  }

  console.log(`Contract address: ${contract.contractAddress}`);
  console.log(`Circle contract ID: ${circleContractId}`);

  const tokenApprovals = [];
  tokenApprovals.push(
    await approveSupportedToken({
      walletsClient,
      walletId,
      contractAddress: contract.contractAddress,
      tokenAddress: usdcAddress,
      symbol: "USDC",
      idempotencyKey: process.env.VELOXPAY_ARC_TESTNET_USDC_APPROVAL_IDEMPOTENCY_KEY,
      feeLevel
    })
  );
  tokenApprovals.push(
    await approveSupportedToken({
      walletsClient,
      walletId,
      contractAddress: contract.contractAddress,
      tokenAddress: eurcAddress,
      symbol: "EURC",
      idempotencyKey: process.env.VELOXPAY_ARC_TESTNET_EURC_APPROVAL_IDEMPOTENCY_KEY,
      feeLevel
    })
  );

  const deploymentArtifact = {
    contractName: CONTRACT_NAME,
    chain: NETWORK,
    network: NETWORK,
    chainId: CHAIN_ID,
    contractAddress: contract.contractAddress,
    circleContractId,
    deploymentTransactionId,
    deploymentTransactionHash: deploymentTransaction.txHash || "",
    abiVersion: ABI_VERSION,
    abiHash: buildArtifact.abiHash,
    bytecodeHash: buildArtifact.bytecodeHash,
    deployedAt: new Date().toISOString(),
    deployerWalletId: walletId,
    deployerAddress: wallet.address,
    supportedTokens: {
      USDC: usdcAddress,
      EURC: eurcAddress
    },
    supportedTokenTransactions: tokenApprovals
  };

  mkdirSync(path.dirname(deploymentArtifactPath), { recursive: true });
  writeFileSync(deploymentArtifactPath, `${JSON.stringify(deploymentArtifact, null, 2)}\n`);
  console.log(`Wrote deployment artifact: ${path.relative(process.cwd(), deploymentArtifactPath)}`);
}

async function approveSupportedToken({ walletsClient, walletId, contractAddress, tokenAddress, symbol, idempotencyKey, feeLevel }) {
  console.log(`Submitting ${symbol} supported-token update.`);
  const response = await walletsClient.createContractExecutionTransaction({
    idempotencyKey,
    walletId,
    contractAddress,
    abiFunctionSignature: "setSupportedToken(address,bool)",
    abiParameters: [tokenAddress, true],
    fee: { type: "level", config: { feeLevel } },
    refId: `${CONTRACT_NAME}-${NETWORK}-${symbol}-supported`
  });

  const transactionId = response?.data?.id;
  if (!transactionId) {
    throw new Error(`Circle did not return a transaction ID for ${symbol} token support.`);
  }

  const transaction = await pollTransaction(walletsClient, transactionId, `${symbol} approval`);
  if (transaction.state !== "COMPLETE") {
    throw new Error(`${symbol} supported-token transaction ended in ${transaction.state}.`);
  }

  return {
    symbol,
    tokenAddress,
    transactionId,
    transactionHash: transaction.txHash || "",
    state: transaction.state
  };
}

async function getDeployingWallet(walletsClient, walletId) {
  const response = await walletsClient.getWallet({ id: walletId });
  const wallet = response?.data?.wallet;
  if (!wallet?.address) {
    throw new Error("Circle deploying wallet lookup did not return an address.");
  }
  return wallet;
}

async function pollTransaction(walletsClient, transactionId, label) {
  const intervalMs = Number(process.env.VELOXPAY_ARC_TESTNET_POLL_INTERVAL_MS || 5_000);
  const timeoutMs = Number(process.env.VELOXPAY_ARC_TESTNET_POLL_TIMEOUT_MS || 600_000);
  const startedAt = Date.now();
  let transaction;

  while (Date.now() - startedAt <= timeoutMs) {
    const response = await walletsClient.getTransaction({ id: transactionId });
    transaction = response?.data?.transaction;

    if (transaction?.state) {
      console.log(`${label} transaction state: ${transaction.state}`);
      if (TERMINAL_TRANSACTION_STATES.has(transaction.state)) {
        return transaction;
      }
    }

    await sleep(intervalMs);
  }

  throw new Error(`${label} transaction polling timed out after ${timeoutMs}ms.`);
}

async function pollContract(contractsClient, contractId) {
  const intervalMs = Number(process.env.VELOXPAY_ARC_TESTNET_POLL_INTERVAL_MS || 5_000);
  const timeoutMs = Number(process.env.VELOXPAY_ARC_TESTNET_POLL_TIMEOUT_MS || 600_000);
  const startedAt = Date.now();
  let contract;

  while (Date.now() - startedAt <= timeoutMs) {
    const response = await contractsClient.getContract({ id: contractId });
    contract = response?.data?.contract;

    if (contract?.status) {
      console.log(`contract status: ${contract.status}`);
      if (TERMINAL_CONTRACT_STATUSES.has(contract.status)) {
        return contract;
      }
    }

    await sleep(intervalMs);
  }

  throw new Error(`Contract polling timed out after ${timeoutMs}ms.`);
}

function requireAddress(name) {
  const value = process.env[name];
  if (!ADDRESS_PATTERN.test(value || "")) {
    throw new Error(`${name} must be a 20-byte EVM address.`);
  }
  if (/^0x0{40}$/i.test(value)) {
    throw new Error(`${name} must not be the zero address.`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function publicErrorMessage(error) {
  if (!error) {
    return "unknown error";
  }
  const details = [];
  if (error.code) {
    details.push(`code=${error.code}`);
  }
  if (error.status) {
    details.push(`status=${error.status}`);
  }
  if (error.response?.data?.code) {
    details.push(`code=${error.response.data.code}`);
  }
  if (error.response?.status) {
    details.push(`status=${error.response.status}`);
  }
  if (error.error?.response?.data?.code) {
    details.push(`wrappedCode=${error.error.response.data.code}`);
  }
  if (error.error?.response?.status) {
    details.push(`wrappedStatus=${error.error.response.status}`);
  }
  if (error.error?.response?.data?.errors) {
    details.push(`errors=${JSON.stringify(error.error.response.data.errors)}`);
  }
  if (error.error?.response?.data?.details) {
    details.push(`details=${JSON.stringify(error.error.response.data.details)}`);
  }
  if (error.response?.data?.message) {
    return [error.response.data.message, ...details].join(" ");
  }
  if (error.response?.data?.error) {
    return [error.response.data.error, ...details].join(" ");
  }
  if (error.error?.response?.data?.message) {
    return [error.error.response.data.message, ...details].join(" ");
  }
  if (error.error?.response?.data?.error) {
    return [error.error.response.data.error, ...details].join(" ");
  }
  return [error.message || String(error), ...details].join(" ");
}
