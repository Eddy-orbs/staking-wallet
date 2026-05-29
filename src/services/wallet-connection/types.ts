export type WalletProviderType = 'injected' | 'walletconnect';

export type Eip1193Provider = {
  request?: (args: { method: string; params?: any[] }) => Promise<any>;
  enable?: () => Promise<string[]>;
  connect?: (options?: any) => Promise<any>;
  on?: (eventName: string, callback: (...args: any[]) => void) => void;
  disconnect?: () => Promise<void>;
  accounts?: string[];
  chainId?: string | number;
  session?: any;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isImToken?: boolean;
  isWalletConnect?: boolean;
};

export type ConnectedWallet = {
  provider: Eip1193Provider;
  address: string | null;
  chainId: number | null;
  providerType: WalletProviderType;
  walletName: string;
  isWalletConnect: boolean;
};

export type ConnectWalletOptions = {
  providerType?: WalletProviderType;
  targetChainId?: number;
};
