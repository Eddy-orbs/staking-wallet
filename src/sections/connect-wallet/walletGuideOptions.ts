import { IConnectWalletSectionTranslations } from '../../translations/translationsTypes';

export type WalletGuideIconVariant = 'metamask';

export type WalletGuideOption = {
  key: string;
  nameKey: keyof IConnectWalletSectionTranslations;
  descriptionKey: keyof IConnectWalletSectionTranslations;
  getUrl: string;
  iconVariant: WalletGuideIconVariant;
};

export const walletGuideOptions: WalletGuideOption[] = [
  {
    key: 'metamask',
    nameKey: 'metamask',
    descriptionKey: 'metamaskWalletDescription',
    getUrl: 'https://metamask.io/download/',
    iconVariant: 'metamask',
  },
];
