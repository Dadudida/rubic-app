import { STAKING_CONFIG_DEVELOP } from './constants/staking';

export const ENVIRONMENT = {
  environmentName: 'dev2',
  production: false,

  apiBaseUrl: '//dev2-api.rubic.exchange/api',
  apiTokenUrl: 'https://dev-tokens.rubic.exchange/api',
  websocketBaseUrl: 'wss://dev-api.rubic.exchange/ws',

  staking: STAKING_CONFIG_DEVELOP,

  zrxAffiliateAddress: undefined as string,
  onramperApiKey: 'pk_prod_01GYYB6KDFQCKYG23MHZ8QK5GC'
};
