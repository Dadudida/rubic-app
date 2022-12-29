import { Injectable } from '@angular/core';
import { HttpService } from 'src/app/core/services/http/http.service';

import {
  BlockchainName,
  CrossChainTrade,
  CrossChainTradeType,
  NotWhitelistedProviderError,
  Web3Pure
} from 'rubic-sdk';
import { TO_BACKEND_BLOCKCHAINS } from '@app/shared/constants/blockchain/backend-blockchains';
import { Observable } from 'rxjs';
import { TO_BACKEND_CROSS_CHAIN_PROVIDERS } from './constants/to-backend-cross-chain-providers';
import { InstantTradesResponseApi } from '@core/services/backend/instant-trades-api/models/instant-trades-response-api';
import { TradeParser } from '@features/swaps/features/instant-trade/services/instant-trade-service/utils/trade-parser';
import { delay } from 'rxjs/operators';
import { AuthService } from '@core/services/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class CrossChainApiService {
  private readonly apiEndpoint = 'crosschain_trades/trade';

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService
  ) {}

  public saveNotWhitelistedProvider(
    error: NotWhitelistedProviderError,
    blockchain: BlockchainName,
    tradeType: CrossChainTradeType
  ): Observable<void> {
    return this.httpService.post(`info/new_provider`, {
      network: TO_BACKEND_BLOCKCHAINS[blockchain],
      title: TO_BACKEND_CROSS_CHAIN_PROVIDERS[tradeType],
      address: error.providerRouter + (error.providerGateway ? `_${error.providerGateway}` : ''),
      cause: error.cause
    });
  }

  /**
   * Sends request to add trade.
   * @return InstantTradesResponseApi Instant trade object.
   */
  public createTrade(hash: string, trade: CrossChainTrade): Observable<void> {
    const {
      fromBlockchain,
      toBlockchain,
      fromAmount,
      fromAddress,
      fromDecimals,
      toAmount,
      toDecimals,
      toAddress
    } = TradeParser.getCrossChainSwapParams(trade);
    const tradeInfo = {
      from_network: TO_BACKEND_BLOCKCHAINS[fromBlockchain],
      to_network: TO_BACKEND_BLOCKCHAINS[toBlockchain],
      provider: trade.type,
      from_token: fromAddress,
      to_token: toAddress,
      from_amount: Web3Pure.toWei(fromAmount, fromDecimals),
      to_amount: Web3Pure.toWei(toAmount, toDecimals),
      user: this.authService.userAddress,
      tx_hash: hash
    };

    return this.httpService.post<void>(this.apiEndpoint, tradeInfo).pipe(delay(1000));
  }

  /**
   * Sends request to update trade's status.
   * @param hash Hash of transaction what we want to update.
   * @param success If true status is `completed`, otherwise `cancelled`.
   * @return InstantTradesResponseApi Instant trade object.
   */
  public patchTrade(hash: string, success: boolean): Observable<InstantTradesResponseApi> {
    const body = {
      success,
      hash,
      user: this.authService.userAddress
    };
    return this.httpService.patch(this.apiEndpoint, body);
  }
}
