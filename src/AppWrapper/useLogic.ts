import { useCallback, useEffect, useState } from 'react';
import { uiConfig } from '../../config/ui-config';
import useNetwork from '../hooks/useNetwork';
import defaultFavicon from '../../assets/favicons/tet.png';
import { DEFAULT_CHAIN } from '../constants';
import { useAppContext } from '../context/app-context';
import { walletConnection } from '../services/wallet-connection';

function useLogic() {
  const { chain, forcedChain, chainLoaded } = useNetwork();
  const { setConnectedWallet } = useAppContext();
  const [providerLoading, setProviderLoading] = useState(false);
  const selected = forcedChain || chain || DEFAULT_CHAIN;

  const eagerConnect = useCallback(async () => {
    setProviderLoading(true);
    try {
      const connectedWallet = await walletConnection.restore({ targetChainId: selected });
      if (connectedWallet && connectedWallet.chainId === Number(selected)) {
        setConnectedWallet(connectedWallet);
      } else if (connectedWallet) {
        await walletConnection.disconnect();
      }
    } catch (error) {
      walletConnection.clearCachedProvider();
    } finally {
      setProviderLoading(false);
    }
  }, [selected, setConnectedWallet]);

  useEffect(() => {
    eagerConnect();
  }, [eagerConnect]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    const faviconImage = (uiConfig[selected] && uiConfig[selected].favicon) || defaultFavicon;
    const favicon: any = document.getElementById('favicon');
    favicon.href = faviconImage;
  }, [selected]);

  return {
    isLoading: !chainLoaded || providerLoading,
    chain: selected,
  };
}

export default useLogic;
