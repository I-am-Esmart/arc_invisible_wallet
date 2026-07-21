# Circle Gas Station On Arc Testnet

VeloxPay Smart Requests can use Circle Gas Station sponsorship for supported Arc Testnet transactions when the payer or actor wallet is an eligible Circle Smart Contract Account.

## Circle Console Configuration

In Circle Console:

- Enable developer-controlled wallets for the VeloxPay project.
- Create or use Smart Contract Account wallets for Arc Testnet users. EVM Gas Station sponsorship requires SCA/ERC-4337 wallets.
- Enable Gas Station for the project.
- Confirm Arc Testnet is available in the Gas Station policy view.
- Keep the testnet policy active and within its sponsored USDC limits.
- Monitor sponsored and failed transactions in the Gas Station policy activity dashboard.

Required backend environment:

```bash
CIRCLE_API_KEY=placeholder
CIRCLE_ENTITY_SECRET=placeholder
CIRCLE_WALLET_SET_ID=placeholder
CIRCLE_BLOCKCHAIN=ARC-TESTNET
CIRCLE_GAS_STATION_ENABLED=true
VELOXPAY_REQUESTS_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
```

Never expose these variables to `NEXT_PUBLIC_*` frontend configuration or client-side code.

## Runtime Behavior

VeloxPay preserves the existing Circle fee-estimation flow for Smart Request approvals and payments. Gas Station sponsorship is not labelled before execution because Circle applies sponsorship automatically only when the wallet, chain, token and policy qualify.

The backend records each Circle transaction response and only marks `gasSponsorship.confirmed=true` when Circle explicitly reports sponsorship on a completed transaction. The public checkout displays:

```text
Network fee sponsored by VeloxPay
```

only when that confirmed field is true. Unsupported wallets, disabled Gas Station configuration, policy misses, and missing sponsorship fields fall back to the standard Arc fee flow.

## References

- Circle Gas Station overview: https://developers.circle.com/wallets/gas-station
- Gasless transaction quickstart: https://developers.circle.com/wallets/gas-station/send-a-gasless-transaction
- Gas Station policy management: https://developers.circle.com/wallets/gas-station/policy-management
