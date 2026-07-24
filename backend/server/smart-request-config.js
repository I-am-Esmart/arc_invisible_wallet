const { ethers } = require("ethers");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function normalizeVeloxPayRequestsContractAddress(value) {
  const address = String(value || "").trim();

  if (!address) {
    return "";
  }

  if (!ethers.isAddress(address)) {
    return "";
  }

  const checksummed = ethers.getAddress(address);
  return checksummed === ZERO_ADDRESS ? "" : checksummed;
}

function buildSmartRequestContractConfig(value) {
  const contractAddress = normalizeVeloxPayRequestsContractAddress(value);

  return {
    available: Boolean(contractAddress),
    contractAddress,
    message: contractAddress
      ? "VeloxPay Smart Requests are configured for onchain settlement."
      : "Set VELOXPAY_REQUESTS_CONTRACT_ADDRESS to the deployed VeloxPayRequests contract address."
  };
}

function requireSmartRequestContractConfig(value) {
  const config = buildSmartRequestContractConfig(value);

  if (!config.available) {
    const error = new Error(config.message);
    error.statusCode = 503;
    error.code = "smart_request_contract_not_configured";
    throw error;
  }

  return config;
}

module.exports = {
  ZERO_ADDRESS,
  normalizeVeloxPayRequestsContractAddress,
  buildSmartRequestContractConfig,
  requireSmartRequestContractConfig
};
