import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTRACT_NAME = "VeloxPayRequests";
const ABI_VERSION = "VeloxPayRequests.v1";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.resolve(__dirname, "..");
const foundryArtifactPath = path.join(contractsRoot, "out", `${CONTRACT_NAME}.sol`, `${CONTRACT_NAME}.json`);
const outputDir = path.join(contractsRoot, "deployments", "arc-testnet");
const outputPath = path.join(outputDir, `${CONTRACT_NAME}.build.json`);

if (!existsSync(foundryArtifactPath)) {
  throw new Error(`Missing Foundry artifact: ${foundryArtifactPath}. Run npm run contracts:build first.`);
}

const foundryArtifact = JSON.parse(readFileSync(foundryArtifactPath, "utf8"));
const bytecode = foundryArtifact?.bytecode?.object;

if (!Array.isArray(foundryArtifact.abi) || typeof bytecode !== "string" || !bytecode.startsWith("0x")) {
  throw new Error(`Invalid Foundry artifact for ${CONTRACT_NAME}.`);
}

const abiJson = JSON.stringify(foundryArtifact.abi);
const artifact = {
  contractName: CONTRACT_NAME,
  abiVersion: ABI_VERSION,
  compilerVersion: foundryArtifact?.metadata?.compiler?.version ?? "solc-0.8.24",
  abi: foundryArtifact.abi,
  bytecode,
  bytecodeHash: createHash("sha256").update(bytecode).digest("hex"),
  abiHash: createHash("sha256").update(abiJson).digest("hex"),
  sourceArtifact: path.relative(contractsRoot, foundryArtifactPath).replaceAll("\\", "/"),
  generatedAt: new Date().toISOString()
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);

console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
