import Web3 from 'web3';

export interface IEthereumTxService {
  // Getters
  isEthereumAvailable: boolean;
  getMainAddress: () => Promise<string>;

  // Permissions
  // TODO : ORL : Update to a better name&signature
  requestConnectionPermissions: () => Promise<boolean>;

  // Event listeners
  onMainAddressChange: (onChange: (mainAddress: string) => void) => void;
  onIsMainNetworkChange: (onChange: (mainAddress: string) => void) => void;
}

export class EthereumTxService implements IEthereumTxService {
  private web3: Web3;
  private isAvailable: boolean;

  constructor(private ethereum: any) {
    this.web3 = new Web3(ethereum);
  }

  get isEthereumAvailable(): boolean {
    return this.isAvailable;
  }

  getMainAddress: () => Promise<string>;
  onIsMainNetworkChange: (onChange: (mainAddress: string) => void) => void;
  onMainAddressChange: (onChange: (mainAddress: string) => void) => void;
  requestConnectionPermissions: () => Promise<boolean>;
}
