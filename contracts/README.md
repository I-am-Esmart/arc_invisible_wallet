# VeloxPay Contracts

Foundry workspace for VeloxPay smart contracts, including the `VeloxPayRequests` programmable ERC-20 payment request contract.

## Layout

- `src/`: Solidity source files.
- `test/`: Foundry tests.
- `script/`: deployment and maintenance scripts.
- `deploy/`: Node.js deployment helpers for Circle Contracts.
- `deployments/`: checked-in deployment notes and network metadata.
- `foundry.toml`: compiler, paths, optimizer, and Arc Testnet RPC configuration.

## Setup

Install contract npm dependencies so OpenZeppelin imports resolve:

```bash
npm --prefix contracts install
```

Install Foundry if `forge` is not available:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Create a local env file when deployment work starts:

```bash
cp contracts/.env.arc-testnet.example contracts/.env
```

Never commit private keys, wallet credentials, Circle API keys, entity secrets, Redis credentials, or deployment `.env` files.

## Commands

From the repository root:

```bash
npm run contracts:fmt:check
npm run contracts:test
npm run contracts:build
npm run contracts:artifacts
```

`npm run contracts:build` compiles Solidity with Foundry and writes the full compiler artifact to:

- `contracts/out/VeloxPayRequests.sol/VeloxPayRequests.json`

`npm run contracts:artifacts` extracts the ABI, bytecode, ABI hash, bytecode hash, and ABI version to:

- `contracts/deployments/arc-testnet/VeloxPayRequests.build.json`

## Arc Testnet Deployment

VeloxPayRequests deploys on Arc Testnet through Circle Contracts using `@circle-fin/smart-contract-platform`. The script also uses the existing Circle developer-controlled wallet SDK to look up the deploying wallet address and submit post-deploy owner calls that whitelist Arc Testnet USDC and EURC.

The script uses Circle blockchain value `ARC-TESTNET` and records Arc Testnet chain ID `5042002`.

Required server-only environment variables:

- `CIRCLE_API_KEY`
- `CIRCLE_ENTITY_SECRET`
- `VELOXPAY_ARC_TESTNET_DEPLOYER_WALLET_ID`
- `VELOXPAY_ARC_TESTNET_USDC_ADDRESS`
- `VELOXPAY_ARC_TESTNET_EURC_ADDRESS`
- `VELOXPAY_ARC_TESTNET_DEPLOY_IDEMPOTENCY_KEY`
- `VELOXPAY_ARC_TESTNET_USDC_APPROVAL_IDEMPOTENCY_KEY`
- `VELOXPAY_ARC_TESTNET_EURC_APPROVAL_IDEMPOTENCY_KEY`

Optional environment variables:

- `CIRCLE_API_URL`
- `VELOXPAY_ARC_TESTNET_FEE_LEVEL`
- `VELOXPAY_ARC_TESTNET_POLL_INTERVAL_MS`
- `VELOXPAY_ARC_TESTNET_POLL_TIMEOUT_MS`
- `VELOXPAY_ARC_TESTNET_DEPLOYMENT_ARTIFACT`
- `VELOXPAY_ARC_TESTNET_DEPLOYMENT_OVERWRITE`

Deployment flow from the repository root:

```bash
npm --prefix contracts install
npm run contracts:fmt:check
npm run contracts:test
npm run contracts:build
npm run contracts:artifacts
copy contracts\.env.arc-testnet.example contracts\.env
npm run contracts:deploy:arc-testnet -- --dry-run
npm run contracts:deploy:arc-testnet
```

The deployment command will not call Circle unless all required environment variables are present. It never logs API keys, entity secrets, or idempotency keys.

The script polls the Circle deployment transaction until a terminal state, fetches the final contract address and Circle contract ID, then submits and polls `setSupportedToken(address,bool)` transactions for USDC and EURC.

On success it writes:

- `contracts/deployments/arc-testnet/VeloxPayRequests.deployment.json`

The deployment artifact includes the network, chain ID, contract address, Circle contract ID, deployment transaction ID, ABI version, deployment timestamp, deployer wallet ID, deployer address, whitelisted token addresses, and token approval transaction IDs.

The script refuses to overwrite an existing deployment artifact. To overwrite intentionally, pass `--force`:

```bash
npm run contracts:deploy:arc-testnet -- --force
```

or set:

```bash
VELOXPAY_ARC_TESTNET_DEPLOYMENT_OVERWRITE=true
```
