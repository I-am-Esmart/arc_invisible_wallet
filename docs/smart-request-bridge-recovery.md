# Smart Request Bridge Recovery

VeloxPay supports one optional cross-chain Smart Request route in this phase:

- Source: Ethereum Sepolia
- Destination: Arc Testnet
- Token: USDC only

EURC remains Arc-only.

## Normal Flow

1. Payer verifies email on the public Smart Request page.
2. VeloxPay checks the payer's Arc Testnet USDC balance.
3. If the Arc balance is insufficient and the payer chooses the bridge option, VeloxPay estimates the Circle App Kit bridge route.
4. The payer confirms the bridge.
5. Circle App Kit executes the CCTP flow and emits bridge steps.
6. VeloxPay persists the quote, events, step states, and transaction hashes on the Smart Request.
7. VeloxPay checks the Arc Testnet USDC balance again.
8. Only after the Arc balance is confirmed does VeloxPay continue into token approval and Smart Request contract payment.

## Persisted Bridge Data

Each Smart Request may contain a `bridge` object with:

- source and destination networks
- source amount and expected received amount
- fee estimate
- bridge status
- App Kit provider
- approve, burn, attestation, and mint events when emitted
- source-chain and Arc transaction hashes
- explorer links
- recoverable error details

## Recovery Cases

### Failed Approval Or Burn

If no source burn hash exists, the bridge did not move USDC out of the source chain. The payer can retry the bridge quote and execution from the Smart Request checkout page after resolving wallet balance, approval, or source-chain gas issues.

### Burn Completed, Attestation Pending Or Failed

If a source burn hash exists but no mint hash exists, USDC has left the source chain and the transfer must not be restarted blindly. Use the persisted burn transaction hash to recover through Circle CCTP/App Kit retry tooling or Circle Console support. Keep the Smart Request in `recovery_required` until attestation and mint complete.

### Mint Failed Or Pending

If the burn hash exists and the mint step is pending or failed, retry the mint/bridge recovery flow with the persisted App Kit result when available. If the Arc balance later appears, the `/smart-requests/:id/bridge/resume` endpoint marks the bridge successful and the payer can continue to approval and contract payment.

## Safety Rules

- Do not mark the Smart Request paid because the bridge was submitted.
- Do not start token approval or contract payment until the Arc Testnet USDC balance is confirmed.
- Do not bridge EURC in this phase.
- Do not add additional source networks until the Ethereum Sepolia path is fully verified.
- Never log Circle API keys, entity secrets, wallet credentials, or Redis credentials.
