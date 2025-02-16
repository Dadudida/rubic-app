import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { delay } from 'rxjs/operators';
import { TO_BACKEND_BLOCKCHAINS } from '@shared/constants/blockchain/backend-blockchains';
import { InstantTradesPostApi } from '@core/services/backend/instant-trades-api/models/instant-trades-post-api';
import { InstantTradesResponseApi } from '@core/services/backend/instant-trades-api/models/instant-trades-response-api';
import { InstantTradeBotRequest } from '@core/services/backend/instant-trades-api/models/instant-trades-bot-request';
import { WalletConnectorService } from '@core/services/wallets/wallet-connector-service/wallet-connector.service';
import { BOT_URL } from 'src/app/core/services/backend/constants/bot-url';
import {
  BlockchainName,
  NotWhitelistedProviderError,
  OnChainTrade,
  OnChainTradeType,
  Web3Pure
} from 'rubic-sdk';
import { TO_BACKEND_ON_CHAIN_PROVIDERS } from './constants/backend-providers';
import { toBackendWallet } from '@core/services/backend/instant-trades-api/constants/to-backend-wallet';
import { HttpService } from '@core/services/http/http.service';
import { AuthService } from '@core/services/auth/auth.service';
import { TradeParser } from '@features/trade/utils/trade-parser';
import { SessionStorageService } from '@core/services/session-storage/session-storage.service';
import { RubicError } from '@app/core/errors/models/rubic-error';

const onChainApiRoutes = {
  createData: (networkType: string) => `instant_trades/${networkType.toLowerCase()}`,
  editData: (networkType: string) => `instant_trades/${networkType.toLowerCase()}`,
  getData: (networkType: string) => `instant_trades/${networkType.toLowerCase()}`
};

@Injectable()
export class OnChainApiService {
  constructor(
    private readonly httpService: HttpService,
    private readonly walletConnectorService: WalletConnectorService,
    private readonly authService: AuthService,
    private readonly sessionStorage: SessionStorageService
  ) {}

  public notifyInstantTradesBot(body: {
    provider: OnChainTradeType;
    blockchain: BlockchainName;
    walletAddress: string;
    trade: OnChainTrade;
    txHash: string;
  }): Promise<void> {
    const { fromAmount, toAmount, fromSymbol, toSymbol, fromPrice, blockchain, type } =
      TradeParser.getItSwapParams(body.trade);
    const { txHash, walletAddress } = body;
    const req: InstantTradeBotRequest = {
      fromAmount: fromAmount.toNumber(),
      toAmount: toAmount.toNumber(),
      fromSymbol: fromSymbol,
      toSymbol: toSymbol,
      price: fromPrice,
      txHash,
      walletAddress,
      blockchain,
      provider: type
    };

    return this.httpService.post<void>(BOT_URL.INSTANT_TRADES, req).toPromise();
  }

  /**
   * Sends request to add trade.
   * @return InstantTradesResponseApi Instant trade object.
   */
  public createTrade(
    hash: string,
    provider: OnChainTradeType,
    trade: OnChainTrade,
    isSwapAndEarnSwap: boolean,
    fee?: number,
    promoCode?: string
  ): Observable<InstantTradesResponseApi> {
    const { blockchain, fromAmount, fromAddress, fromDecimals, toAmount, toDecimals, toAddress } =
      TradeParser.getItSwapParams(trade);
    const referral = this.sessionStorage.getItem('referral');
    const options = {
      blockchain: blockchain,
      fromAddress: fromAddress,
      fromAmount: Web3Pure.toWei(fromAmount, fromDecimals),
      toAddress: toAddress,
      toAmount: Web3Pure.toWei(toAmount, toDecimals)
    };
    let backendProvider = TO_BACKEND_ON_CHAIN_PROVIDERS[provider];

    const tradeInfo: InstantTradesPostApi = {
      network: TO_BACKEND_BLOCKCHAINS[options.blockchain],
      provider: backendProvider,
      from_token: options.fromAddress,
      to_token: options.toAddress,
      from_amount: options.fromAmount,
      to_amount: options.toAmount,
      user: this.authService.userAddress,
      fee,
      promocode: promoCode,
      hash,
      ...(referral && { influencer: referral })
    };

    const url = onChainApiRoutes.createData(toBackendWallet);
    return this.httpService
      .post<InstantTradesResponseApi>(`${url}?valid=${isSwapAndEarnSwap ?? false}`, tradeInfo)
      .pipe(delay(1000));
  }

  /**
   * Sends request to update trade's status.
   * @param hash Hash of transaction what we want to update.
   * @param success If true status is `completed`, otherwise `cancelled`.
   * @return InstantTradesResponseApi Instant trade object.
   */
  public async patchTrade(hash: string, success: boolean): Promise<InstantTradesResponseApi> {
    try {
      const body = {
        success,
        hash,
        user: this.authService.userAddress
      };

      const url = onChainApiRoutes.editData(toBackendWallet);
      const res = await firstValueFrom(this.httpService.patch<InstantTradesResponseApi>(url, body));

      return res;
    } catch (err) {
      throw new RubicError(err);
    }
  }

  public saveNotWhitelistedProvider(
    error: NotWhitelistedProviderError,
    blockchain: BlockchainName,
    tradeType: OnChainTradeType
  ): Observable<void> {
    return this.httpService.post(`info/new_provider`, {
      network: TO_BACKEND_BLOCKCHAINS[blockchain],
      title: tradeType,
      address: error.providerRouter + (error.providerGateway ? `_${error.providerGateway}` : ''),
      cause: error.cause
    });
  }
}
