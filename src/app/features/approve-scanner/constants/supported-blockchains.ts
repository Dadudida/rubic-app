import { BLOCKCHAIN_NAME } from 'rubic-sdk';

export const supportedBlockchains = [
  BLOCKCHAIN_NAME.ETHEREUM,
  BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN,
  BLOCKCHAIN_NAME.POLYGON
] as const;

export type SupportedBlockchain = typeof supportedBlockchains[number];
