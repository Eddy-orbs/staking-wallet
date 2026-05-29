# ORBS Staking Wallet Wallet Connection Expansion Approval Report

Date: 2026-05-27
Branch: `feature/walletconnect-reown-planning`

## 1. Background

Business partners and the ORBS community have repeatedly requested broader wallet support for the staking wallet.

The current dapp primarily supports a single browser-injected provider flow. This works for MetaMask-compatible extension wallets, but it limits users who prefer WalletConnect-compatible mobile wallets or modern multi-wallet connection flows.

## 2. Objective

Expand wallet connectivity while preserving the existing staking, approval, claim, and transaction signing architecture.

Key objectives:

- Support WalletConnect v2 compatible wallets
- Preserve compatibility with browser extension wallets such as MetaMask, Rabby, and Enkrypt
- Introduce a modern wallet selection modal through Reown AppKit
- Exclude Email, Google, social login, and embedded wallet creation

## 3. Proposed Approach

The target approach is **Reown AppKit with the Ethers v5 adapter**.

Before integrating Reown directly into the application, the project will introduce a local wallet adapter boundary. This allows the app to keep its existing `provider -> Web3 -> contracts-js` flow while adapting Reown AppKit wallet providers into the current React context and MobX-based application state.

This approach minimizes changes to staking transaction logic and keeps the implementation focused on the wallet connection layer.

## 4. Expected Benefits

- Broader staking accessibility for WalletConnect wallet users
- Better onboarding for mobile wallet users
- Direct response to partner and community demand
- Continued support for existing browser extension wallet users
- A cleaner foundation for future wallet support expansion

## 5. Timeline

Estimated duration: approximately **30 to 36 working days** after the Reown project id is available.

The schedule below reflects a 3x buffer from the initial engineering estimate.

| Phase | Duration | Key Output |
| --- | --- | --- |
| Phase 0 | 3-6 days | Reown AppKit Ethers v5 dependency and build compatibility spike |
| Phase 1 | 6 days | Local wallet adapter boundary |
| Phase 2 | 3 days | Improved browser extension wallet discovery |
| Phase 3 | 9 days | Reown AppKit and WalletConnect v2 integration |
| Phase 4 | 6 days | Connect UI and translation updates |
| Phase 5 | 6-9 days | Wallet QA and release preparation |

## 6. Key Risks and Mitigation

| Risk | Mitigation |
| --- | --- |
| Reown packages may not be fully compatible with the current legacy React/TypeScript/webpack stack | Run a dependency spike before full implementation |
| Wallets may differ in chain switching or transaction signing behavior | Run QA against MetaMask, Rabby, Enkrypt, and WalletConnect mobile wallets |
| WalletConnect session or network configuration may be incorrect | Align Ethereum and Polygon configuration with the existing app config and keep wrong-network validation |
| Existing staking flows may regress | Preserve the current `Web3(provider)` service path and verify approval/staking transactions before release |

## 7. Approval Request

Approval is requested for the following:

- Proceed with Reown AppKit + Ethers v5 adapter as the target wallet connection approach
- Implement the local wallet adapter boundary before wiring Reown AppKit into the app
- Create and configure the required Reown project id and production metadata
- Allocate approximately 30 to 36 working days for implementation, QA, and release preparation

