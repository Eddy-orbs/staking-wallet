import Web3 from 'web3';
import config from '../../../config';
import { DEFAULT_CHAIN } from '../../constants';
import { getSupportedChains } from '../../utils';
import { web3Modal } from '../web3modal';
import {
  disconnectReownAppKit,
  getReownAppKit,
  getReownChainId,
  getReownWalletName,
  isReownAppKitReady,
  isReownWalletConnect,
  switchReownNetwork,
  waitForReownRestoredConnection,
  waitForReownConnection,
} from './reownAppKit';
import { ConnectedWallet, ConnectWalletOptions, Eip1193Provider, InstalledWallet, WalletProviderType } from './types';

const WALLETCONNECT_UMD_URL = 'https://unpkg.com/@walletconnect/ethereum-provider@2.23.9/dist/index.umd.js';
const LAST_PROVIDER_KEY = 'orbs.walletConnection.lastProviderType';
const LAST_INJECTED_WALLET_KEY = 'orbs.walletConnection.lastInjectedWallet';
const WALLETCONNECT_SUPPORTED_CHAINS = [1, 137];
const WALLETCONNECT_CONNECT_TIMEOUT_MS = 120000;
const NETWORK_SWITCH_SETTLE_TIMEOUT_MS = 5000;

let walletConnectScriptLoading: Promise<void> | null = null;
let walletConnectProvider: Eip1193Provider | null = null;
const announcedProviders: any[] = [];
const installedWalletListeners: Array<(wallets: InstalledWallet[]) => void> = [];
let eip6963Listening = false;

type InjectedWalletPreference = {
  id?: string;
  rdns?: string;
  name?: string;
};

function isSameAnnouncedProvider(left: any, right: any) {
  if (!left || !right) {
    return false;
  }

  if (left.info && right.info && left.info.uuid && right.info.uuid) {
    return left.info.uuid === right.info.uuid;
  }

  if (left.info && right.info && left.info.rdns && right.info.rdns) {
    return left.info.rdns === right.info.rdns;
  }

  if (left.provider && right.provider && left.provider === right.provider) {
    return (
      (!left.info && !right.info) || (!!left.info && !!right.info && (left.info.name || '') === (right.info.name || ''))
    );
  }

  return false;
}

function requestEip6963Providers() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

function normalizeChainId(chainId: string | number | null | undefined): number | null {
  if (chainId === null || chainId === undefined) {
    return null;
  }

  if (typeof chainId === 'number') {
    return chainId;
  }

  return chainId.startsWith('0x') ? parseInt(chainId, 16) : Number(chainId);
}

function getProjectId() {
  return process.env.REOWN_PROJECT_ID || process.env.WALLETCONNECT_PROJECT_ID || '';
}

function getMetadata() {
  const origin = window.location.origin;

  return {
    name: 'ORBS Staking Wallet',
    description: 'ORBS staking wallet',
    url: origin,
    icons: [`${origin}/favicon.png`],
  };
}

function getWalletConnectChains(targetChainId?: number): number[] {
  const configuredChains = getSupportedChains();
  const supportedChains = WALLETCONNECT_SUPPORTED_CHAINS.filter((chainId) => {
    const network = config.networks[chainId];
    return network && network.rpcUrls && network.rpcUrls[0];
  });

  const chains = supportedChains.length ? supportedChains : configuredChains;
  const selectedChain = targetChainId && chains.includes(targetChainId) ? targetChainId : Number(DEFAULT_CHAIN);

  return [selectedChain, ...chains.filter((chainId) => chainId !== selectedChain)];
}

function getRpcMap() {
  return getWalletConnectChains().reduce((rpcMap, chainId) => {
    const network = config.networks[chainId];
    if (network && network.rpcUrls && network.rpcUrls[0]) {
      rpcMap[chainId] = network.rpcUrls[0];
    }

    return rpcMap;
  }, {} as { [chainId: number]: string });
}

function getSwitchErrorCode(error: any): number | string | undefined {
  return error && (error.code || (error.data && error.data.originalError && error.data.originalError.code));
}

function getAddChainParams(targetChainId: number) {
  const chain = config.networks[targetChainId];

  if (!chain || !chain.nativeCurrency || !chain.rpcUrls || !chain.rpcUrls.length) {
    throw new Error(`Unsupported network ${targetChainId}`);
  }

  return {
    chainId: Web3.utils.toHex(targetChainId),
    chainName: chain.name,
    nativeCurrency: {
      name: chain.nativeCurrency.name,
      symbol: chain.nativeCurrency.symbol,
      decimals: chain.nativeCurrency.decimals,
    },
    rpcUrls: chain.rpcUrls,
    blockExplorerUrls: chain.blockExplorerUrl ? [chain.blockExplorerUrl] : [],
  };
}

function switchProviderNetwork(provider: Eip1193Provider, targetChainId: number) {
  return provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: Web3.utils.toHex(targetChainId) }],
  });
}

async function readAccounts(provider: Eip1193Provider): Promise<string[]> {
  if (provider.request) {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    return accounts || [];
  }

  if (provider.enable) {
    return provider.enable();
  }

  return [];
}

async function readConnectedAccounts(provider: Eip1193Provider): Promise<string[]> {
  if (provider.accounts && provider.accounts.length) {
    return provider.accounts;
  }

  if (provider.request) {
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (accounts && accounts.length) {
      return accounts;
    }
  }

  return readAccounts(provider);
}

async function readAuthorizedAccounts(provider: Eip1193Provider): Promise<string[]> {
  if (provider.accounts && provider.accounts.length) {
    return provider.accounts;
  }

  if (provider.request) {
    const accounts = await provider.request({ method: 'eth_accounts' });
    return accounts || [];
  }

  return [];
}

async function readChainId(provider: Eip1193Provider): Promise<number | null> {
  if (provider.request) {
    const chainId = await provider.request({ method: 'eth_chainId' });
    return normalizeChainId(chainId);
  }

  const providerChainId = normalizeChainId(provider.chainId);
  if (providerChainId) {
    return providerChainId;
  }

  const web3 = new Web3(provider as any);
  return web3.eth.getChainId();
}

function wait(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

async function waitForProviderChain(provider: Eip1193Provider, targetChainId: number): Promise<number | null> {
  const startedAt = Date.now();
  let chainId = await readChainId(provider);

  while (chainId !== targetChainId && Date.now() - startedAt < NETWORK_SWITCH_SETTLE_TIMEOUT_MS) {
    await wait(250);
    chainId = await readChainId(provider);
  }

  return chainId;
}

async function ensureProviderNetwork(provider: Eip1193Provider, targetChainId?: number): Promise<number | null> {
  let chainId = await readChainId(provider);

  if (!targetChainId || chainId === targetChainId) {
    return chainId;
  }

  try {
    await switchProviderNetwork(provider, targetChainId);
  } catch (error) {
    if (getSwitchErrorCode(error) !== 4902) {
      throw error;
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [getAddChainParams(targetChainId)],
    });
    await switchProviderNetwork(provider, targetChainId);
  }

  chainId = await waitForProviderChain(provider, targetChainId);
  return chainId;
}

function getLegacyInjectedProviders(): Eip1193Provider[] {
  const providers: Eip1193Provider[] = [];
  const ethereum = (window as any).ethereum;
  const onto = (window as any).onto;

  if (ethereum && Array.isArray(ethereum.providers)) {
    providers.push(...ethereum.providers);
  } else if (ethereum) {
    providers.push(ethereum);
  }

  if (onto) {
    providers.push(onto);
  }

  return providers;
}

function getInjectedWalletId(name: string, provider: Eip1193Provider, index: number) {
  return `${name.toLowerCase().replace(/\s+/g, '-')}-${provider.isMetaMask ? 'metamask' : index}`;
}

function getInjectedWalletName(provider: Eip1193Provider): string {
  if (provider.isEnkrypt) {
    return 'Enkrypt';
  }

  if (provider.isRabby) {
    return 'Rabby Wallet';
  }

  if (provider.isBraveWallet) {
    return 'Brave Wallet';
  }

  if (provider.isCoinbaseWallet) {
    return 'Coinbase Wallet';
  }

  if (provider.isMetaMask) {
    return 'MetaMask';
  }

  if (provider.isTrust) {
    return 'Trust Wallet';
  }

  if (provider.isImToken) {
    return 'ImToken';
  }

  return 'Browser Wallet';
}

function addInstalledWallet(wallets: InstalledWallet[], wallet: InstalledWallet) {
  const alreadyExists = wallets.some((item) => {
    if (item.id === wallet.id || (item.rdns && wallet.rdns && item.rdns === wallet.rdns)) {
      return true;
    }

    if (item.provider !== wallet.provider) {
      return false;
    }

    return item.name === wallet.name || (!item.rdns && !wallet.rdns);
  });

  if (!alreadyExists) {
    wallets.push(wallet);
  }
}

function getInstalledWalletsSnapshot(): InstalledWallet[] {
  const wallets: InstalledWallet[] = [];

  announcedProviders.forEach((item, index) => {
    if (!item.provider || !item.info) {
      return;
    }

    const name = item.info.name || getInjectedWalletName(item.provider);
    addInstalledWallet(wallets, {
      id: item.info.uuid || item.info.rdns || getInjectedWalletId(name, item.provider, index),
      name,
      icon: item.info.icon,
      provider: item.provider,
      rdns: item.info.rdns,
    });
  });

  getLegacyInjectedProviders().forEach((provider, index) => {
    const name = getInjectedWalletName(provider);
    addInstalledWallet(wallets, {
      id: getInjectedWalletId(name, provider, index),
      name,
      provider,
    });
  });

  return wallets;
}

function notifyInstalledWalletListeners() {
  const wallets = getInstalledWalletsSnapshot();
  installedWalletListeners.forEach((listener) => listener(wallets));
}

function listenForEip6963Providers() {
  if (typeof window === 'undefined') {
    return;
  }

  if (eip6963Listening) {
    return;
  }

  eip6963Listening = true;
  window.addEventListener('eip6963:announceProvider', ((event: CustomEvent) => {
    const detail = event.detail;
    if (detail && detail.provider && !announcedProviders.find((item) => isSameAnnouncedProvider(item, detail))) {
      announcedProviders.push(detail);
      notifyInstalledWalletListeners();
    }
  }) as EventListener);
}

function discoverEip6963Providers(): Promise<any[]> {
  listenForEip6963Providers();
  requestEip6963Providers();

  return new Promise((resolve) => {
    setTimeout(() => resolve(announcedProviders), 150);
  });
}

async function discoverInstalledWallets(): Promise<InstalledWallet[]> {
  await discoverEip6963Providers();

  return getInstalledWalletsSnapshot();
}

function subscribeInstalledWallets(listener: (wallets: InstalledWallet[]) => void) {
  installedWalletListeners.push(listener);
  listenForEip6963Providers();

  const emitSnapshot = () => listener(getInstalledWalletsSnapshot());
  const requestAndEmitSnapshot = () => {
    requestEip6963Providers();
    emitSnapshot();
  };

  requestAndEmitSnapshot();
  const timers = [100, 300, 750, 1500].map((delay) => setTimeout(requestAndEmitSnapshot, delay));
  const interval = setInterval(requestAndEmitSnapshot, 1000);

  return () => {
    const index = installedWalletListeners.indexOf(listener);
    if (index >= 0) {
      installedWalletListeners.splice(index, 1);
    }

    timers.forEach((timer) => clearTimeout(timer));
    clearInterval(interval);
  };
}

function initializeInstalledWalletDiscovery() {
  if (typeof window === 'undefined') {
    return;
  }

  listenForEip6963Providers();
  requestEip6963Providers();
  [100, 500, 1500].forEach((delay) => setTimeout(requestEip6963Providers, delay));
}

initializeInstalledWalletDiscovery();

function waitForWalletConnectEvent(provider: Eip1193Provider, eventName: string): Promise<void> {
  return new Promise((resolve) => {
    if (!provider.on) {
      return;
    }

    provider.on(eventName, () => resolve());
  });
}

async function connectWalletConnectSession(provider: Eip1193Provider, targetChainId?: number): Promise<void> {
  if (provider.session) {
    return;
  }

  const walletConnectChains = getWalletConnectChains(targetChainId);
  const connectAction = provider.connect
    ? provider.connect({ chains: walletConnectChains })
    : provider.enable
    ? provider.enable()
    : Promise.resolve();

  await Promise.race([
    Promise.resolve(connectAction).then(() => undefined),
    waitForWalletConnectEvent(provider, 'connect'),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('WalletConnect connection timed out')), WALLETCONNECT_CONNECT_TIMEOUT_MS),
    ),
  ]);
}

function setLastProvider(providerType: WalletProviderType | null) {
  try {
    if (providerType) {
      window.localStorage.setItem(LAST_PROVIDER_KEY, providerType);
    } else {
      window.localStorage.removeItem(LAST_PROVIDER_KEY);
    }
  } catch (error) {}
}

function getLastProvider(): WalletProviderType | null {
  try {
    const providerType = window.localStorage.getItem(LAST_PROVIDER_KEY);
    return providerType === 'walletconnect' || providerType === 'injected' || providerType === 'reown'
      ? providerType
      : null;
  } catch (error) {
    return null;
  }
}

function setLastInjectedWallet(options: ConnectWalletOptions, provider: Eip1193Provider, walletName?: string | null) {
  try {
    const matchedWallet = getInstalledWalletsSnapshot().find((wallet) => wallet.provider === provider);
    const preference: InjectedWalletPreference = {
      id: options.walletId || (matchedWallet && matchedWallet.id),
      rdns: options.walletRdns || (matchedWallet && matchedWallet.rdns),
      name: walletName || options.walletName || (matchedWallet && matchedWallet.name),
    };

    window.localStorage.setItem(LAST_INJECTED_WALLET_KEY, JSON.stringify(preference));
  } catch (error) {}
}

function getLastInjectedWallet(): InjectedWalletPreference | null {
  try {
    const preference = window.localStorage.getItem(LAST_INJECTED_WALLET_KEY);
    return preference ? JSON.parse(preference) : null;
  } catch (error) {
    return null;
  }
}

function clearLastInjectedWallet() {
  try {
    window.localStorage.removeItem(LAST_INJECTED_WALLET_KEY);
  } catch (error) {}
}

function findPreferredInjectedWallet(
  wallets: InstalledWallet[],
  preference: InjectedWalletPreference | null,
): InstalledWallet | null {
  if (!preference) {
    return null;
  }

  return (
    wallets.find((wallet) => preference.id && wallet.id === preference.id) ||
    wallets.find((wallet) => preference.rdns && wallet.rdns === preference.rdns) ||
    wallets.find((wallet) => preference.name && wallet.name === preference.name) ||
    null
  );
}

async function waitForPreferredInjectedWallet(
  preference: InjectedWalletPreference | null,
): Promise<InstalledWallet | null> {
  if (!preference) {
    return null;
  }

  listenForEip6963Providers();

  for (const delay of [0, 100, 300, 750, 1500]) {
    if (delay) {
      await wait(delay);
    }

    requestEip6963Providers();

    const wallet = findPreferredInjectedWallet(getInstalledWalletsSnapshot(), preference);
    if (wallet) {
      return wallet;
    }
  }

  return null;
}

function loadWalletConnectScript(): Promise<void> {
  if ((window as any)['@walletconnect/ethereum-provider']) {
    return Promise.resolve();
  }

  if (walletConnectScriptLoading) {
    return walletConnectScriptLoading;
  }

  walletConnectScriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = WALLETCONNECT_UMD_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load WalletConnect provider'));
    document.head.appendChild(script);
  });

  return walletConnectScriptLoading;
}

async function createWalletConnectProvider(targetChainId?: number): Promise<Eip1193Provider> {
  const projectId = getProjectId();

  if (!projectId) {
    throw new Error('Missing REOWN_PROJECT_ID or WALLETCONNECT_PROJECT_ID');
  }

  await loadWalletConnectScript();

  const walletConnect = (window as any)['@walletconnect/ethereum-provider'];
  const EthereumProvider = walletConnect && (walletConnect.EthereumProvider || walletConnect.default);

  if (!EthereumProvider || !EthereumProvider.init) {
    throw new Error('WalletConnect provider was not loaded correctly');
  }

  const walletConnectChains = getWalletConnectChains(targetChainId);

  walletConnectProvider = await EthereumProvider.init({
    projectId,
    metadata: getMetadata(),
    chains: walletConnectChains,
    optionalChains: [],
    rpcMap: getRpcMap(),
    showQrModal: true,
  });

  return walletConnectProvider;
}

async function connectInjected(options: ConnectWalletOptions = {}): Promise<ConnectedWallet> {
  let provider: Eip1193Provider;
  let walletName: string | null = options.walletName || null;

  if (options.provider) {
    provider = options.provider;
  } else if (!(window as any).ethereum && !(window as any).onto) {
    const installedWallets = await discoverInstalledWallets();
    const selected = installedWallets[0];
    if (!selected) {
      throw new Error('No browser wallet provider found');
    }

    provider = selected.provider;
    walletName = selected.name;
  } else {
    provider = await web3Modal.connect();
  }

  const accounts = await readAccounts(provider);
  const chainId = await readChainId(provider);

  setLastProvider('injected');
  setLastInjectedWallet(options, provider, walletName);

  return {
    provider,
    address: accounts[0] || null,
    chainId,
    providerType: 'injected',
    walletName: walletName || getInjectedWalletName(provider),
    isWalletConnect: false,
  };
}

async function restoreInjected(targetChainId?: number): Promise<ConnectedWallet | null> {
  if (getLastProvider() !== 'injected') {
    return null;
  }

  const selected = await waitForPreferredInjectedWallet(getLastInjectedWallet());

  if (!selected) {
    if (web3Modal.cachedProvider) {
      return connectInjected();
    }

    return null;
  }

  const accounts = await readAuthorizedAccounts(selected.provider);

  if (!accounts.length) {
    return null;
  }

  const chainId = await ensureProviderNetwork(selected.provider, targetChainId);

  setLastProvider('injected');
  setLastInjectedWallet(
    { walletId: selected.id, walletRdns: selected.rdns, walletName: selected.name },
    selected.provider,
    selected.name,
  );

  return {
    provider: selected.provider,
    address: accounts[0] || null,
    chainId,
    providerType: 'injected',
    walletName: selected.name,
    isWalletConnect: false,
  };
}

async function connectWalletConnect(targetChainId?: number): Promise<ConnectedWallet> {
  const provider = await createWalletConnectProvider(targetChainId);
  await connectWalletConnectSession(provider, targetChainId);
  const accounts = await readConnectedAccounts(provider);
  const chainId = await readChainId(provider);

  setLastProvider('walletconnect');

  return {
    provider,
    address: accounts[0] || null,
    chainId,
    providerType: 'walletconnect',
    walletName: 'WalletConnect',
    isWalletConnect: true,
  };
}

async function restoreWalletConnect(targetChainId?: number): Promise<ConnectedWallet | null> {
  if (getLastProvider() !== 'walletconnect') {
    return null;
  }

  const provider = await createWalletConnectProvider(targetChainId);

  if (!(provider as any).session) {
    return null;
  }

  const accounts = provider.request ? await provider.request({ method: 'eth_accounts' }) : [];
  const chainId = await ensureProviderNetwork(provider, targetChainId);

  return {
    provider,
    address: accounts[0] || null,
    chainId,
    providerType: 'walletconnect',
    walletName: 'WalletConnect',
    isWalletConnect: true,
  };
}

async function connectReown(targetChainId?: number): Promise<ConnectedWallet> {
  const appKit = getReownAppKit(targetChainId);

  await appKit.open({ view: 'Connect', namespace: 'eip155' });

  const account: any = await waitForReownConnection(appKit);
  const provider = appKit.getWalletProvider() as Eip1193Provider;

  if (!provider) {
    throw new Error('Reown wallet provider was not available after connection');
  }

  if (targetChainId) {
    await switchReownNetwork(targetChainId);
  }

  const providerChainId = normalizeChainId(getReownChainId(appKit)) || (await readChainId(provider));

  setLastProvider('reown');

  return {
    provider,
    address: account.address || null,
    chainId: providerChainId,
    providerType: 'reown',
    walletName: getReownWalletName(appKit),
    isWalletConnect: isReownWalletConnect(appKit),
  };
}

async function restoreReown(targetChainId?: number): Promise<ConnectedWallet | null> {
  if (getLastProvider() !== 'reown') {
    return null;
  }

  const appKit = getReownAppKit(targetChainId);
  const session = await waitForReownRestoredConnection(appKit);

  if (!session) {
    return null;
  }

  const { account, provider } = session;

  let chainId = normalizeChainId(getReownChainId(appKit)) || (await readChainId(provider));

  if (targetChainId && chainId !== targetChainId) {
    await switchReownNetwork(targetChainId);
    chainId = await waitForProviderChain(provider, targetChainId);
  }

  return {
    provider,
    address: account.address || null,
    chainId,
    providerType: 'reown',
    walletName: getReownWalletName(appKit),
    isWalletConnect: isReownWalletConnect(appKit),
  };
}

export const walletConnection = {
  async connect(options: ConnectWalletOptions = {}): Promise<ConnectedWallet> {
    const providerType =
      options.providerType || ((window as any).ethereum || (window as any).onto ? 'injected' : 'walletconnect');

    if (providerType === 'reown') {
      return connectReown(options.targetChainId);
    }

    return providerType === 'walletconnect' ? connectWalletConnect(options.targetChainId) : connectInjected(options);
  },

  async restore(options: ConnectWalletOptions = {}): Promise<ConnectedWallet | null> {
    const reownWallet = await restoreReown(options.targetChainId);

    if (reownWallet) {
      return reownWallet;
    }

    const injectedWallet = await restoreInjected(options.targetChainId);

    if (injectedWallet) {
      return injectedWallet;
    }

    return restoreWalletConnect(options.targetChainId);
  },

  async disconnect(): Promise<void> {
    try {
      await disconnectReownAppKit();
    } catch (error) {}

    try {
      if (walletConnectProvider && walletConnectProvider.disconnect) {
        await walletConnectProvider.disconnect();
      }
    } catch (error) {}

    web3Modal.clearCachedProvider();
    setLastProvider(null);
    clearLastInjectedWallet();
    walletConnectProvider = null;
  },

  clearCachedProvider(): void {
    web3Modal.clearCachedProvider();
    setLastProvider(null);
    clearLastInjectedWallet();
  },

  async switchNetwork(
    provider: Eip1193Provider,
    targetChainId: number,
    providerType?: WalletProviderType,
  ): Promise<void> {
    if (providerType === 'reown' && isReownAppKitReady()) {
      try {
        await switchReownNetwork(targetChainId);
        await waitForProviderChain(provider, targetChainId);
        return;
      } catch (error) {}
    }

    if (!provider || !provider.request) {
      throw new Error('Connected wallet does not support network switching');
    }

    await ensureProviderNetwork(provider, targetChainId);
  },

  discoverInstalledWallets,

  subscribeInstalledWallets,
};

export * from './types';
