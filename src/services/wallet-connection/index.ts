import Web3 from 'web3';
import config from '../../../config';
import { DEFAULT_CHAIN } from '../../constants';
import { getSupportedChains } from '../../utils';
import { web3Modal } from '../web3modal';
import { ConnectedWallet, ConnectWalletOptions, Eip1193Provider, WalletProviderType } from './types';

const WALLETCONNECT_UMD_URL = 'https://unpkg.com/@walletconnect/ethereum-provider@2.23.9/dist/index.umd.js';
const LAST_PROVIDER_KEY = 'orbs.walletConnection.lastProviderType';
const WALLETCONNECT_SUPPORTED_CHAINS = [1, 137];
const WALLETCONNECT_CONNECT_TIMEOUT_MS = 120000;

let walletConnectScriptLoading: Promise<void> | null = null;
let walletConnectProvider: Eip1193Provider | null = null;
const announcedProviders: any[] = [];
let eip6963Listening = false;

function listenForEip6963Providers() {
  if (eip6963Listening) {
    return;
  }

  eip6963Listening = true;
  window.addEventListener('eip6963:announceProvider', ((event: CustomEvent) => {
    const detail = event.detail;
    if (
      detail &&
      detail.provider &&
      !announcedProviders.find((item) => item.info && detail.info && item.info.uuid === detail.info.uuid)
    ) {
      announcedProviders.push(detail);
    }
  }) as EventListener);
}

function discoverEip6963Providers(): Promise<any[]> {
  listenForEip6963Providers();
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  return new Promise((resolve) => {
    setTimeout(() => resolve(announcedProviders), 150);
  });
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

function getRpcMap() {
  return getWalletConnectChains().reduce((rpcMap, chainId) => {
    const network = config.networks[chainId];
    if (network && network.rpcUrls && network.rpcUrls[0]) {
      rpcMap[chainId] = network.rpcUrls[0];
    }

    return rpcMap;
  }, {} as { [chainId: number]: string });
}

function getWalletConnectChains(targetChainId?: number): number[] {
  const configuredChains = getSupportedChains();
  const supportedChains = WALLETCONNECT_SUPPORTED_CHAINS.filter((chainId) => {
    const network = config.networks[chainId];
    return network && network.rpcUrls && network.rpcUrls[0];
  });

  const chains = supportedChains.length ? supportedChains : configuredChains;
  const selectedChain =
    targetChainId && chains.includes(targetChainId) ? targetChainId : Number(DEFAULT_CHAIN);

  return [selectedChain, ...chains.filter((chainId) => chainId !== selectedChain)];
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

async function readChainId(provider: Eip1193Provider): Promise<number | null> {
  const providerChainId = normalizeChainId(provider.chainId);
  if (providerChainId) {
    return providerChainId;
  }

  if (provider.request) {
    const chainId = await provider.request({ method: 'eth_chainId' });
    return normalizeChainId(chainId);
  }

  const web3 = new Web3(provider as any);
  return web3.eth.getChainId();
}

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

function getInjectedWalletName(provider: Eip1193Provider): string {
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
    return providerType === 'walletconnect' || providerType === 'injected' ? providerType : null;
  } catch (error) {
    return null;
  }
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

async function connectInjected(): Promise<ConnectedWallet> {
  let provider: Eip1193Provider;
  let walletName: string | null = null;

  if (!(window as any).ethereum && !(window as any).onto) {
    const eip6963Providers = await discoverEip6963Providers();
    const selected = eip6963Providers[0];
    if (!selected) {
      throw new Error('No browser wallet provider found');
    }

    provider = selected.provider;
    walletName = selected.info && selected.info.name;
  } else {
    provider = await web3Modal.connect();
  }

  const accounts = await readAccounts(provider);
  const chainId = await readChainId(provider);

  setLastProvider('injected');

  return {
    provider,
    address: accounts[0] || null,
    chainId,
    providerType: 'injected',
    walletName: walletName || getInjectedWalletName(provider),
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
  const chainId = await readChainId(provider);

  return {
    provider,
    address: accounts[0] || null,
    chainId,
    providerType: 'walletconnect',
    walletName: 'WalletConnect',
    isWalletConnect: true,
  };
}

export const walletConnection = {
  async connect(options: ConnectWalletOptions = {}): Promise<ConnectedWallet> {
    const providerType =
      options.providerType || ((window as any).ethereum || (window as any).onto ? 'injected' : 'walletconnect');

    return providerType === 'walletconnect' ? connectWalletConnect(options.targetChainId) : connectInjected();
  },

  async restore(options: ConnectWalletOptions = {}): Promise<ConnectedWallet | null> {
    if (web3Modal.cachedProvider) {
      return connectInjected();
    }

    return restoreWalletConnect(options.targetChainId);
  },

  async disconnect(): Promise<void> {
    try {
      if (walletConnectProvider && walletConnectProvider.disconnect) {
        await walletConnectProvider.disconnect();
      }
    } catch (error) {}

    web3Modal.clearCachedProvider();
    setLastProvider(null);
    walletConnectProvider = null;
  },

  clearCachedProvider(): void {
    web3Modal.clearCachedProvider();
    setLastProvider(null);
  },

  async switchNetwork(provider: Eip1193Provider, targetChainId: number): Promise<void> {
    if (!provider || !provider.request) {
      throw new Error('Connected wallet does not support network switching');
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
  },
};

export * from './types';
