# Wallet Connection Expansion Plan

Date: 2026-05-26
Branch: feature/walletconnect-reown-planning

## Goal

Expand wallet connectivity for the ORBS staking dapp while preserving the current web3.js/contracts-js interaction path. The target is to keep existing injected wallets working, add better browser wallet discovery, and support WalletConnect v2 wallets through Reown.

## Background

This update is driven by repeated demand from business partners and the ORBS community for broader wallet support. The current single-provider browser extension flow works for MetaMask-compatible injected wallets, but it limits users who prefer mobile wallets, WalletConnect-compatible wallets, or newer browser wallet discovery flows.

Expanding wallet support is expected to reduce onboarding friction, make staking accessible to more wallet users, and better align the dapp with partner and community expectations for a modern staking experience.

## Current State

- The app stores one active `provider` in `AppContext` and passes it into `initApp`.
- `initApp` calls `buildServices(provider, axios, chain)`, and services use `new Web3(provider)`.
- Wallet connection UI is in `src/sections/connect-wallet/index.tsx`.
- `src/services/web3modal/index.ts` uses `web3modal@1.x` with only injected/default and a custom ONTO connector.
- `@walletconnect/web3-provider` is present in `package.json`, but no WalletConnect option is configured in `web3Modal`.
- The project is old by wallet-library standards: React 16.13, TypeScript 3.8, webpack 4, Node 10 in `engines`.

Implication: the safest compatibility boundary is still an EIP-1193-like provider that web3.js 1.x can consume. Large wallet-library rewrites should be avoided unless dependency compatibility is proven first.

## Research Summary

- `web3modal` is deprecated on npm. The latest npm metadata checked during this planning pass was `web3modal@1.9.12`, marked no longer supported.
- `@walletconnect/web3-provider` is WalletConnect v1 and is deprecated. The latest npm metadata checked was `@walletconnect/web3-provider@1.8.0`, marked as a v1 SDK. WalletConnect v1 was shut down on 2023-06-28, so enabling the existing package is not a viable production path.
- Reown AppKit is the current WalletConnect-led wallet connection product. Current Reown docs position AppKit as the replacement for Web3Modal and WalletConnect modal UI. The latest npm metadata checked was `@reown/appkit@1.8.20`.
- `@walletconnect/ethereum-provider` is a WalletConnect v2 EIP-1193 provider. Reown docs explicitly say it can be passed to libraries such as web3.js. The latest npm metadata checked was `@walletconnect/ethereum-provider@2.23.9`.
- Reown AppKit default Ethers v5 mode can include WalletConnect, browser injected wallets, and Coinbase options. Its modal exposes `getWalletProvider()` and `subscribeProvider()`, which can feed the existing `AppContext.provider`.
- EIP-6963 is the finalized standard for discovering multiple injected browser providers, avoiding the current `window.ethereum` race between MetaMask, Rabby, Brave, etc.
- QuickSwap is useful as a UX reference: its docs list MetaMask, Trust Wallet, Phantom, Brave, Safe, Coinbase Wallet, WalletConnect, ZenGo, Venly, and BitKeep. Its implementation should not be copied blindly because this app has a much older stack and a narrower staking workflow.

## Implementation Update: Phase 0 Result

The dependency/build spike found that the current Reown AppKit packages are not a safe direct dependency for this repository's current React 16, TypeScript 3.8, and webpack 4 toolchain. The packages and their type/runtime output rely on newer JavaScript and TypeScript assumptions than the current stack can consume without a broader frontend upgrade.

To keep the wallet expansion shippable without a stack migration, the implementation uses the lower-risk fallback from the plan:

- keep the local wallet adapter boundary as the app integration point,
- preserve the existing `provider -> Web3 -> contracts-js` path,
- keep injected wallet support through the current Web3Modal v1 path,
- add minimal EIP-6963 injected-provider discovery,
- load the WalletConnect v2 EIP-1193 provider from a pinned UMD URL at runtime,
- require `REOWN_PROJECT_ID` or `WALLETCONNECT_PROJECT_ID` before opening WalletConnect.

This leaves a future Reown AppKit UI migration possible after the project upgrades its frontend build stack.

## Candidate Approaches

### Option A: Reown AppKit with Ethers v5 Adapter

Install:

- `@reown/appkit`
- `@reown/appkit-adapter-ethers5`
- `ethers@5`
- `@ethersproject/sha2`

Use `createAppKit(...)`, configure Ethereum/Polygon networks, open AppKit from the existing connect button, and set `AppContext.provider` from `modal.getWalletProvider()` or `modal.subscribeProvider(...)`.

Pros:

- Best wallet UX and widest coverage.
- Handles WalletConnect v2, injected wallets, Coinbase, QR/deep links, and wallet list UI.
- Official Reown migration path.

Cons:

- Highest dependency risk with this repo's old Node/TypeScript/webpack baseline.
- Introduces Reown UI/state concepts next to current MobX state.
- Needs a Reown project id and verified metadata URL per environment.

### Option B: WalletConnect v2 Provider Only

Install:

- `@walletconnect/ethereum-provider`

Add a separate `connectWalletConnect()` path that initializes `EthereumProvider` with `projectId`, `metadata`, `optionalChains`, and `rpcMap`, then passes the returned EIP-1193 provider into the existing `Web3Service` and contracts-js services.

Pros:

- Smaller conceptual change.
- Keeps existing injected wallet flow nearly unchanged.
- Maps cleanly to current web3.js provider boundary.

Cons:

- Reown docs describe `showQrModal` as deprecated in favor of AppKit.
- Less polished wallet selection UX than AppKit.
- Still needs WalletConnect v2 session lifecycle handling and project id.

### Option C: Wagmi/RainbowKit or Full Wallet Stack Rewrite

This would modernize wallet state and connection UX, but it would pull the app toward viem/wagmi patterns and likely force broader React/build upgrades.

Recommendation: do not choose this for the first wallet expansion. It is too invasive for the current objective.

## Target Approach

The target implementation is Option A: Reown AppKit with the Ethers v5 adapter.

The project should still start with a local wallet adapter boundary before wiring AppKit into the app. This keeps the current `provider -> Web3 -> contracts-js` path stable and gives us a controlled place to adapt Reown state/events into the app's existing MobX and React context model.

Option B, WalletConnect v2 provider only, is not the target. It remains a fallback only if the Reown AppKit Ethers v5 dependency spike fails against the current React 16, TypeScript 3.8, webpack 4, and Node 10 baseline.

## Recommendation

Use a gated strategy:

1. First run the Reown AppKit Ethers v5 dependency/build spike as a hard go/no-go gate.
2. If the spike passes, isolate the app's wallet boundary behind a small local adapter layer.
3. Then wire Reown AppKit through that adapter. If the spike fails because of build/runtime compatibility, pause Option A and decide whether to upgrade the build stack or temporarily switch to WalletConnect v2 Ethereum Provider while retaining the same adapter boundary.

This gives us a clean rollback path and prevents Reown-specific assumptions from leaking into staking, balance, guardian, and transaction flows.

## UI Target

The target connect flow is the Reown-style modal opened from the header connect button:

- Header button: `Connect`
- Modal title: `Connect Wallet`
- Primary options: WalletConnect, installed browser wallets such as MetaMask, and `All Wallets`
- WalletConnect QR-code entry available from the first screen
- Installed wallets should show installed status where AppKit can detect it
- The modal should keep the app page in the background and should not replace the current staking page layout
- Email and social login must be disabled. This dapp should connect existing wallets only and should not create embedded/social wallets.

The reference image includes Email and Google login, but those are intentionally out of scope. The AppKit configuration should explicitly disable email/social features where supported by the selected adapter/version.

Current implementation note: the existing `Header` only displays the network indicator, language selector, and connected wallet address. It does not currently own a wallet connect trigger. The implementation scope must therefore include adding a header-level connect action, not only replacing the existing `ConnectWalletSection` button.

## Proposed Design

Add a local wallet connection module, for example:

- `src/services/wallet-connection/types.ts`
- `src/services/wallet-connection/injected.ts`
- `src/services/wallet-connection/reownAppKit.ts`
- `src/services/wallet-connection/index.ts`

The module should expose:

- `connect(): Promise<ConnectedWallet>`
- `disconnect(): Promise<void>`
- `getProvider(): Eip1193Provider | null`
- `getAddress(): string | null`
- `getChainId(): number | null`
- `subscribe(callback): unsubscribe`

`ConnectedWallet` should include:

- `provider`
- `address`
- `chainId`
- `providerType`
- `walletName`
- `isWalletConnect`

Then update only these app integration points:

- `AppContext`: store `provider` plus wallet metadata.
- `Header`: add the target header connect button/action that opens the wallet connector modal when the user is disconnected.
- `ConnectWalletSection`: call the new connector instead of `web3Modal.connect()`.
- `useWeb3`: call the new disconnect path; keep `Web3Service(provider)` as-is.
- `CryptoWalletConnectionStore`: stop relying on global `hasInjectedProvider` for "can connect"; WalletConnect should be connectable even when no extension is installed.
- Analytics: record wallet name/provider type instead of only MetaMask/Trust/ImToken.

## Compatibility Rules

- Keep `new Web3(provider)` working for all connected wallets.
- Keep the wrong-network popup before setting the provider into `AppContext`.
- Apply the same wrong-network validation to every provider injection path, including manual connect, cached/eager reconnect, and restored WalletConnect/Reown sessions. No provider should be written into `AppContext` until its chain has been checked against the selected app chain.
- Prefer `optionalChains` for WalletConnect so wallets that only support one configured chain are not blocked unnecessarily.
- Production networks should start with Ethereum mainnet and Polygon. Ropsten is deprecated and should not be part of a production WalletConnect proposal.
- Local development networks should stay injected-only unless a separate WalletConnect-compatible RPC and chain definition is explicitly needed.
- Never auto-connect to a different injected wallet just because `window.ethereum` changed. Use selected provider metadata where available.

## Implementation Phases

### Phase 0: Dependency Spike

Schedule: 3-6 working days

- Add only the candidate Reown dependencies.
- Configure a minimal AppKit instance in an isolated file.
- Verify `npm run type-check` and `npm run build-dev`.
- Confirm `modal.getWalletProvider()` can be passed into `new Web3(provider)` and `eth.getChainId()`.

Exit criteria: build works and a connected provider can read chain id/accounts.

Gate: this phase is a hard go/no-go decision for Option A. Do not proceed with the AppKit implementation if the current React 16, TypeScript 3.8, webpack 4, and Node 10 stack cannot build and run the isolated AppKit Ethers v5 integration. If the gate fails, either schedule a build-stack upgrade first or switch to the WalletConnect v2 provider-only fallback.

### Phase 1: Local Wallet Adapter

Schedule: 6 working days

- Introduce wallet connection types and adapter boundary.
- Move current web3modal/injected/ONTO logic behind the adapter.
- Preserve current UI behavior and tests before adding new wallets.

Exit criteria: existing MetaMask/Rabby/Enkrypt/ONTO behavior remains unchanged.

### Phase 2: Injected Wallet Discovery

Schedule: 3 working days

- Add EIP-6963 discovery for multiple browser extension wallets.
- Fall back to `window.ethereum` and `window.onto` for older wallets.
- Show installed browser wallets as explicit choices if using custom UI, or let AppKit handle browser wallet listing if AppKit is selected.

Exit criteria: users with multiple extensions can choose the intended wallet.

### Phase 3: WalletConnect v2 / Reown

Schedule: 9 working days

- Add `REOWN_PROJECT_ID`/metadata configuration.
- Configure Ethereum and Polygon networks from existing `config.networks`.
- Connect through Reown AppKit Ethers v5.
- Store the returned active provider in `AppContext`.
- Validate the connected or restored provider's chain before storing it in `AppContext`.
- Implement disconnect and session cleanup.
- Disable Email and social login.

Exit criteria: QR/deep-link wallet connects, chain validation works, staking transaction prompts reach the wallet.

### Phase 4: UI and Copy

Schedule: 6 working days

- Add the disconnected-state header `Connect` action that opens the wallet modal without replacing the staking page layout.
- Replace the binary "install/connect" behavior with a connect wallet action.
- Keep the legal agreement gating before opening the modal.
- Keep install links as secondary help when no browser wallet exists, but do not block WalletConnect.
- Update translations for the generic wallet wording.

Exit criteria: desktop extension, desktop QR, mobile deep link, and mobile in-app browser flows are understandable.

### Phase 5: QA and Rollout

Schedule: 6-9 working days

Test matrix:

- MetaMask extension
- Rabby extension
- Enkrypt extension
- Brave wallet
- ONTO if still required
- Coinbase Wallet
- Trust Wallet through WalletConnect
- Safe if relevant to staking flows
- Wrong network on Ethereum/Polygon
- Account change
- Chain change
- Disconnect/reconnect
- Page refresh with cached session

Verification:

- `npm run type-check`
- `npm run test`
- `npm run build-dev`
- Manual staking approval and staking transaction on a non-production/local or staging environment

## Schedule Summary

Estimated duration: 30 to 36 working days after a Reown project id is available.

The schedule below reflects a 3x buffer from the initial engineering estimate.

| Phase | Target | Duration | Output |
| --- | --- | --- | --- |
| Phase 0 | Reown dependency spike | 3-6 days | Go/no-go for AppKit Ethers v5 on the current stack |
| Phase 1 | Local wallet adapter | 6 days | Stable app-owned wallet boundary |
| Phase 2 | Injected wallet discovery | 3 days | Better browser wallet detection/selection |
| Phase 3 | Reown AppKit integration | 9 days | WalletConnect v2 and AppKit wallet modal connected to app state |
| Phase 4 | UI/copy polish | 6 days | Header connect flow and translations updated |
| Phase 5 | QA/rollout prep | 6-9 days | Tested wallet matrix and release notes |

Dependencies and gates:

- Reown project id must be created before Phase 3 can be completed.
- If Phase 0 fails because of toolchain incompatibility, pause Option A and decide whether to upgrade the build stack or temporarily switch to Option B.
- Production rollout should not start until at least one successful staking approval and staking transaction has been verified through a WalletConnect wallet on a safe environment.

## Open Decisions

- Reown project id ownership and dashboard setup.
- Whether ONTO remains a first-class custom connector or becomes a legacy fallback.
- Whether to keep `web3modal@1` during the transition or remove it once AppKit is stable.
- Whether the project should upgrade Node/TypeScript/webpack first if Reown packages are incompatible with the current toolchain.
- Which non-production chain should replace Ropsten for wallet QA, if any.

## Sources

- Reown AppKit React installation: https://docs.reown.com/appkit/react/core/installation
- Reown Ethereum Provider docs: https://docs.reown.com/advanced/providers/ethereum
- Reown AppKit Ethers v5 migration docs: https://docs.reown.com/appkit/upgrade/to-reown-appkit-ethers5-web
- Reown WalletConnect Modal migration docs: https://docs.reown.com/appkit/upgrade/wcm
- WalletConnect v1 shutdown notice: https://walletconnect.com/blog/walletconnect-v1-0-has-now-been-shut-down
- EIP-6963: https://eips.ethereum.org/EIPS/eip-6963
- QuickSwap supported wallets: https://docs.quickswap.exchange/networks-and-wallets/supported-wallets
