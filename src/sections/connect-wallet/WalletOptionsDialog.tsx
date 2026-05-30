import { Box, ButtonBase, Typography, useMediaQuery } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import AccountBalanceWalletOutlinedIcon from '@material-ui/icons/AccountBalanceWalletOutlined';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  ConnectWalletOptions,
  InstalledWallet,
  walletConnection,
  WalletProviderType,
} from '../../services/wallet-connection';
import { useConnectWalletSectionTranslations } from '../../translations/translationsHooks';
import { CommonDialog } from '../../components/modal/CommonDialog';
import useTheme from '@material-ui/core/styles/useTheme';
import { WalletGuideIconVariant, walletGuideOptions } from './walletGuideOptions';
import bitgetWalletLogo from '../../../assets/wallets/bitget-wallet.png';
import metaMaskWalletLogo from '../../../assets/wallets/MetaMask-icon-fox-with-margins.svg';

interface IProps {
  open: boolean;
  hasBrowserWallet: boolean;
  onClose: () => void;
  onSelect: (options: ConnectWalletOptions) => void;
}

type WalletOption = {
  key: string;
  labelKey: 'metamask' | 'walletConnect' | 'browserWallet' | 'bitgetWallet';
  providerType: WalletProviderType;
  icon: React.ReactNode;
  hidden?: boolean;
  provider?: InstalledWallet['provider'];
  walletName?: string;
  walletId?: string;
  walletRdns?: string;
  installUrl?: string;
};

type DialogView = 'wallet-info' | 'get-wallet';

const DialogFrame = styled(Box)(({ theme }) => ({
  width: 760,
  minHeight: 500,
  display: 'grid',
  gridTemplateColumns: '300px 1fr',
  background: '#17181d',
  color: '#f7f7f8',
  position: 'relative',
  overflow: 'hidden',

  [theme.breakpoints.down('sm')]: {
    width: 'calc(100vw - 16px)',
    minHeight: 'unset',
    gridTemplateColumns: '1fr',
  },
}));

const WalletPane = styled(Box)(({ theme }) => ({
  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
  padding: '28px 24px',

  [theme.breakpoints.down('sm')]: {
    borderRight: 0,
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '22px 18px',
  },
}));

const InfoPane = styled(Box)(({ theme }) => ({
  padding: '74px 54px 40px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',

  [theme.breakpoints.down('sm')]: {
    padding: '28px 22px 30px',
  },
}));

const WalletGuidePane = styled(Box)(({ theme }) => ({
  padding: '20px 24px 28px',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 500,

  [theme.breakpoints.down('sm')]: {
    minHeight: 420,
    padding: '18px 18px 24px',
  },
}));

const WalletGuideHeader = styled(Box)({
  minHeight: 34,
  display: 'grid',
  gridTemplateColumns: '34px 1fr 34px',
  alignItems: 'center',
});

const BackButton = styled.button(({ theme }) => ({
  width: 34,
  height: 34,
  border: 0,
  borderRadius: '50%',
  background: 'transparent',
  color: theme.palette.secondary.main,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',

  '&:hover': {
    background: 'rgba(255, 255, 255, 0.08)',
  },
}));

const CloseButton = styled.button({
  position: 'absolute',
  top: 18,
  right: 18,
  width: 34,
  height: 34,
  border: 0,
  borderRadius: '50%',
  background: 'rgba(255, 255, 255, 0.1)',
  color: '#c8c9d1',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
});

const SectionLabel = styled(Typography)({
  color: '#a6a8b2',
  fontSize: 13,
  fontWeight: 700,
  marginTop: 24,
  marginBottom: 10,
});

const WalletRow = styled(ButtonBase)({
  width: '100%',
  minHeight: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#f6f6f7',
  transition: 'background 160ms ease',
  textAlign: 'left',

  '&:hover': {
    background: 'rgba(255, 255, 255, 0.07)',
  },
});

const WalletIconImage = styled.img({
  width: 34,
  height: 34,
  borderRadius: 7,
  marginRight: 12,
  flex: '0 0 auto',
  objectFit: 'contain',
  background: 'rgba(255, 255, 255, 0.1)',
});

const WalletGuideIconImage = styled.img({
  width: 48,
  height: 48,
  borderRadius: 10,
  marginRight: 0,
  flex: '0 0 auto',
  objectFit: 'contain',
  background: 'transparent',
});

const WalletName = styled(Typography)({
  fontSize: 16,
  fontWeight: 700,
});

const WalletInstallList = styled(Box)({
  marginTop: 36,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

const WalletInstallRow = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '48px 1fr auto',
  gap: 16,
  alignItems: 'center',
});

const WalletInstallName = styled(Typography)({
  color: '#f7f7f8',
  fontSize: 16,
  fontWeight: 800,
});

const WalletInstallDescription = styled(Typography)({
  color: '#aaaeba',
  fontSize: 13,
  lineHeight: 1.4,
});

const WalletGetButton = styled.button(({ theme }) => ({
  border: 0,
  borderRadius: 5,
  background: '#26B47E',
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 800,
  padding: '8px 15px',
  cursor: 'pointer',

  '&:hover': {
    filter: 'brightness(1.08)',
  },
}));

const WalletGuideEmptyState = styled(Box)({
  marginTop: 'auto',
  textAlign: 'center',
  maxWidth: 320,
  alignSelf: 'center',
});

const IconBox = styled(Box)<{ variant: 'metamask' | 'walletconnect' | 'browser' | 'asset' }>(({ variant }) => {
  const backgrounds = {
    metamask: 'transparent',
    walletconnect: '#3b99fc',
    browser: '#1e5ad7',
    asset: 'linear-gradient(135deg, #6574ff 0%, #00d395 100%)',
  };

  return {
    width: 34,
    height: 34,
    borderRadius: 7,
    marginRight: 12,
    flex: '0 0 auto',
    background: backgrounds[variant],
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 15,
    boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.12) inset',
  };
});

const FeatureRow = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '54px 1fr',
  gap: 18,
  width: '100%',
  marginTop: 28,
});

const FeatureTitle = styled(Typography)({
  color: '#f7f7f8',
  fontSize: 15,
  fontWeight: 800,
  marginBottom: 4,
});

const FeatureDescription = styled(Typography)({
  color: '#aaaeba',
  fontSize: 13,
  lineHeight: 1.5,
});

const ImportButton = styled.button(({ theme }) => ({
  marginTop: 36,
  border: 0,
  borderRadius: 5,
  background: '#26B47E',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 800,
  padding: '11px 20px',
  cursor: 'pointer',
}));

const LearnMoreButton = styled.button(({ theme }) => ({
  marginTop: 14,
  border: 0,
  background: 'transparent',
  color: theme.palette.secondary.main,
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
}));

const AssetClusterIcon = () => (
  <IconBox variant='asset'>
    <AccountBalanceWalletOutlinedIcon style={{ fontSize: 21 }} />
  </IconBox>
);

const WalletGuideIcon = ({ icon, variant }: { icon?: string; variant: WalletGuideIconVariant }) => {
  if (variant === 'metamask') {
    return <WalletGuideIconImage src={metaMaskWalletLogo} alt='' />;
  }

  if (icon) {
    return <WalletGuideIconImage src={icon} alt='' />;
  }

  if (variant === 'bitget') {
    return <WalletGuideIconImage src={bitgetWalletLogo} alt='' />;
  }

  return null;
};

function getInstalledWalletByName(wallets: InstalledWallet[], name: string) {
  return wallets.find((wallet) => wallet.name.toLowerCase().includes(name.toLowerCase()));
}

function WalletIcon({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return icon ? <WalletIconImage src={icon} alt='' /> : <>{children}</>;
}

function WalletConnectGlyph() {
  return (
    <svg width='24' height='16' viewBox='0 0 24 16' aria-hidden='true'>
      <path
        d='M5.1 5.2c3.8-3.7 9.9-3.7 13.8 0l.5.5c.2.2.2.5 0 .7l-1.7 1.7c-.1.1-.4.1-.5 0l-.7-.7c-2.5-2.4-6.5-2.4-9 0l-.7.7c-.1.1-.4.1-.5 0L4.6 6.4c-.2-.2-.2-.5 0-.7l.5-.5Zm17.1 3.7 1.5 1.5c.2.2.2.5 0 .7l-6.7 6.5c-.2.2-.5.2-.7 0l-4.7-4.6c-.1-.1-.3-.1-.4 0l-4.7 4.6c-.2.2-.5.2-.7 0L.1 11.1c-.2-.2-.2-.5 0-.7l1.5-1.5c.2-.2.5-.2.7 0l4.7 4.6c.1.1.3.1.4 0l4.7-4.6c.2-.2.5-.2.7 0l4.7 4.6c.1.1.3.1.4 0l4.7-4.6c.1-.2.4-.2.6 0Z'
        fill='currentColor'
      />
    </svg>
  );
}

function BrowserWalletGlyph() {
  return (
    <svg width='22' height='18' viewBox='0 0 22 18' aria-hidden='true'>
      <rect x='1' y='3' width='20' height='14' rx='2' fill='none' stroke='currentColor' strokeWidth='2' />
      <path d='M1 7h20' stroke='currentColor' strokeWidth='2' />
      <circle cx='5' cy='5' r='1' fill='currentColor' />
      <circle cx='8' cy='5' r='1' fill='currentColor' />
    </svg>
  );
}

function WalletOptionsDialog({ open, hasBrowserWallet, onClose, onSelect }: IProps) {
  const connectWalletSectionTranslations = useConnectWalletSectionTranslations();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const [view, setView] = useState<DialogView>('wallet-info');
  const [installedWallets, setInstalledWallets] = useState<InstalledWallet[]>([]);
  const openWalletGuide = () => window.open('https://ethereum.org/wallets/', '_blank');

  useEffect(() => {
    if (!open) {
      return;
    }

    setView('wallet-info');
    return walletConnection.subscribeInstalledWallets(setInstalledWallets);
  }, [open]);

  const handleClose = () => {
    setView('wallet-info');
    onClose();
  };

  const openWalletInstallPage = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const connectWallet = (wallet: WalletOption) => {
    if (wallet.installUrl && !wallet.provider) {
      openWalletInstallPage(wallet.installUrl);
      return;
    }

    onSelect({
      providerType: wallet.providerType,
      provider: wallet.provider,
      walletName: wallet.walletName || (wallet.labelKey && connectWalletSectionTranslations(wallet.labelKey)),
      walletId: wallet.walletId,
      walletRdns: wallet.walletRdns,
    });
  };

  const metaMaskWallet = getInstalledWalletByName(installedWallets, 'MetaMask');
  const bitgetWallet = getInstalledWalletByName(installedWallets, 'Bitget');
  const popularWallets: WalletOption[] = [
    {
      key: 'metamask',
      labelKey: 'metamask',
      providerType: 'injected',
      provider: metaMaskWallet && metaMaskWallet.provider,
      walletName: 'MetaMask',
      walletId: metaMaskWallet && metaMaskWallet.id,
      walletRdns: metaMaskWallet && metaMaskWallet.rdns,
      installUrl: metaMaskWallet ? undefined : 'https://metamask.io/download/',
      icon: <WalletIconImage src={metaMaskWalletLogo} alt='' />,
    },
    {
      key: 'walletconnect',
      labelKey: 'walletConnect',
      providerType: 'reown',
      icon: (
        <IconBox variant='walletconnect'>
          <WalletConnectGlyph />
        </IconBox>
      ),
    },
    {
      key: 'bitget',
      labelKey: 'bitgetWallet',
      providerType: 'injected',
      provider: bitgetWallet && bitgetWallet.provider,
      walletName: 'Bitget Wallet',
      walletId: bitgetWallet && bitgetWallet.id,
      walletRdns: bitgetWallet && bitgetWallet.rdns,
      installUrl: bitgetWallet ? undefined : 'https://web3.bitget.com/wallet-download',
      icon: <WalletIconImage src={bitgetWallet && bitgetWallet.icon ? bitgetWallet.icon : bitgetWalletLogo} alt='' />,
    },
    {
      key: 'browser-wallet',
      labelKey: 'browserWallet',
      providerType: 'injected',
      hidden: !hasBrowserWallet,
      icon: (
        <IconBox variant='browser'>
          <BrowserWalletGlyph />
        </IconBox>
      ),
    },
  ];

  return (
    <CommonDialog open={open} onClose={handleClose}>
      <DialogFrame>
        <CloseButton onClick={handleClose} aria-label={connectWalletSectionTranslations('closeWalletDialog')}>
          <CloseIcon style={{ fontSize: 20 }} />
        </CloseButton>

        <WalletPane>
          <Typography variant='h6' style={{ fontWeight: 800, fontSize: 20 }}>
            {connectWalletSectionTranslations('selectWallet')}
          </Typography>

          {!!installedWallets.length && (
            <>
              <SectionLabel style={{ color: theme.palette.secondary.main }}>
                {connectWalletSectionTranslations('installedWallets')}
              </SectionLabel>

              {installedWallets.map((wallet) => (
                <WalletRow
                  key={wallet.id}
                  data-testid={`button-connect-installed-${wallet.id}`}
                  onClick={() =>
                    onSelect({
                      providerType: 'injected',
                      provider: wallet.provider,
                      walletName: wallet.name,
                      walletId: wallet.id,
                      walletRdns: wallet.rdns,
                    })
                  }
                >
                  <WalletIcon icon={wallet.icon}>
                    <IconBox variant='browser'>
                      <BrowserWalletGlyph />
                    </IconBox>
                  </WalletIcon>
                  <WalletName>{wallet.name}</WalletName>
                </WalletRow>
              ))}
            </>
          )}

          <SectionLabel>{connectWalletSectionTranslations('popularWallets')}</SectionLabel>
          {popularWallets
            .filter((wallet) => !wallet.hidden)
            .map((wallet) => (
              <WalletRow
                key={wallet.key}
                data-testid={`button-connect-${wallet.key}`}
                onClick={() => connectWallet(wallet)}
              >
                {wallet.icon}
                <WalletName>{connectWalletSectionTranslations(wallet.labelKey)}</WalletName>
              </WalletRow>
            ))}
        </WalletPane>

        {view === 'wallet-info' ? (
          <InfoPane>
            <Typography variant='h6' style={{ fontWeight: 800, fontSize: isSmall ? 18 : 20, textAlign: 'center' }}>
              {connectWalletSectionTranslations('whatIsWallet')}
            </Typography>

            <FeatureRow>
              <AssetClusterIcon />
              <Box>
                <FeatureTitle>{connectWalletSectionTranslations('walletOwnAssetsTitle')}</FeatureTitle>
                <FeatureDescription>
                  {connectWalletSectionTranslations('walletOwnAssetsDescription')}
                </FeatureDescription>
              </Box>
            </FeatureRow>

            <FeatureRow>
              <IconBox variant='asset'>ID</IconBox>
              <Box>
                <FeatureTitle>{connectWalletSectionTranslations('walletLoginTitle')}</FeatureTitle>
                <FeatureDescription>{connectWalletSectionTranslations('walletLoginDescription')}</FeatureDescription>
              </Box>
            </FeatureRow>

            <ImportButton onClick={() => setView('get-wallet')}>
              {connectWalletSectionTranslations('getWallet')}
            </ImportButton>
            <LearnMoreButton onClick={openWalletGuide}>{connectWalletSectionTranslations('learnMore')}</LearnMoreButton>
          </InfoPane>
        ) : (
          <WalletGuidePane>
            <WalletGuideHeader>
              <BackButton
                onClick={() => setView('wallet-info')}
                aria-label={connectWalletSectionTranslations('whatIsWallet')}
              >
                <ArrowBackIcon style={{ fontSize: 22 }} />
              </BackButton>
              <Typography variant='h6' style={{ fontWeight: 800, fontSize: isSmall ? 18 : 20, textAlign: 'center' }}>
                {connectWalletSectionTranslations('getWalletTitle')}
              </Typography>
              <span />
            </WalletGuideHeader>

            <WalletInstallList>
              {walletGuideOptions.map((wallet) => {
                const installedGuideWallet =
                  wallet.key === 'metamask' ? metaMaskWallet : wallet.key === 'bitget' ? bitgetWallet : undefined;

                return (
                  <WalletInstallRow key={wallet.key}>
                    <WalletGuideIcon
                      icon={installedGuideWallet && installedGuideWallet.icon}
                      variant={wallet.iconVariant}
                    />
                    <Box>
                      <WalletInstallName>{connectWalletSectionTranslations(wallet.nameKey)}</WalletInstallName>
                      <WalletInstallDescription>
                        {connectWalletSectionTranslations(wallet.descriptionKey)}
                      </WalletInstallDescription>
                    </Box>
                    <WalletGetButton onClick={() => openWalletInstallPage(wallet.getUrl)}>
                      {connectWalletSectionTranslations('get')}
                    </WalletGetButton>
                  </WalletInstallRow>
                );
              })}
            </WalletInstallList>

            <WalletGuideEmptyState>
              <FeatureTitle>{connectWalletSectionTranslations('walletGuideEmptyTitle')}</FeatureTitle>
              <FeatureDescription>{connectWalletSectionTranslations('walletGuideEmptyDescription')}</FeatureDescription>
            </WalletGuideEmptyState>
          </WalletGuidePane>
        )}
      </DialogFrame>
    </CommonDialog>
  );
}

export default WalletOptionsDialog;
