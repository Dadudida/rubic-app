import { ChangeDetectionStrategy, Component, Inject, Injector } from '@angular/core';
import { SwapsStateService } from '@features/trade/services/swaps-state/swaps-state.service';
import { combineLatestWith } from 'rxjs';
import { debounceTime, map, startWith } from 'rxjs/operators';
import { WalletConnectorService } from '@core/services/wallets/wallet-connector-service/wallet-connector.service';
import { TradePageService } from '@features/trade/services/trade-page/trade-page.service';
import { TRADE_STATUS } from '@shared/models/swaps/trade-status';
import { ModalService } from '@core/modals/services/modal.service';
import { PreviewSwapService } from '@features/trade/services/preview-swap/preview-swap.service';
import { TargetNetworkAddressService } from '@features/trade/services/target-network-address-service/target-network-address.service';
import { BlockchainsInfo, ChangenowCrossChainTrade } from 'rubic-sdk';

@Component({
  selector: 'app-action-button',
  templateUrl: './action-button.component.html',
  styleUrls: ['./action-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionButtonComponent {
  public readonly buttonState$ = this.tradeState.tradeState$.pipe(
    combineLatestWith(
      this.tradeState.wrongBlockchain$,
      this.tradeState.notEnoughBalance$,
      this.walletConnector.addressChange$,
      this.targetNetworkAddressService.isAddressValid$,
      this.targetNetworkAddressService.isAddressRequired$,
      this.targetNetworkAddressService.address$
    ),
    debounceTime(25),
    map(
      ([
        currentTrade,
        wrongBlockchain,
        notEnoughBalance,
        address,
        isReceiverValid,
        isAddressRequired,
        receiverAddress
      ]) => {
        if (currentTrade.error) {
          return {
            type: 'error',
            text: currentTrade.error.message,
            action: () => {}
          };
        }

        if (!address) {
          return {
            type: 'action',
            text: 'Connect wallet',
            action: this.connectWallet.bind(this)
          };
        }
        if (notEnoughBalance) {
          return {
            type: 'error',
            text: 'Insufficient balance',
            action: () => {}
          };
        }
        const isCnFromNonEvm =
          currentTrade.trade instanceof ChangenowCrossChainTrade &&
          !BlockchainsInfo.isEvmBlockchainName(currentTrade.trade.from.blockchain);

        if (
          currentTrade.status === TRADE_STATUS.READY_TO_SWAP ||
          currentTrade.status === TRADE_STATUS.READY_TO_APPROVE ||
          (currentTrade.trade && wrongBlockchain)
        ) {
          // Handle Non EVM trade
          if (isAddressRequired) {
            const trulyAddress = Boolean(receiverAddress);

            if (isReceiverValid && trulyAddress) {
              if (isCnFromNonEvm) {
                return {
                  type: 'action',
                  text: 'Preview swap',
                  action: this.swapCn.bind(this)
                };
              }
              return {
                type: 'action',
                text: 'Preview swap',
                action: this.swap.bind(this)
              };
            }
            return {
              type: 'error',
              text: 'Enter receiver address',
              action: () => {}
            };
          } else {
            return {
              type: 'action',
              text: 'Preview swap',
              action: this.swap.bind(this)
            };
          }
        }
        if (currentTrade.status === TRADE_STATUS.LOADING) {
          return {
            type: 'error',
            text: 'Calculating',
            action: () => {}
          };
        }
        if (currentTrade.status === TRADE_STATUS.NOT_INITIATED) {
          return {
            type: 'error',
            text: 'Select tokens',
            action: () => {}
          };
        }
        return {
          type: 'error',
          text: 'Trade is not available',
          action: () => {}
        };
      }
    ),
    startWith({
      type: 'error',
      text: 'Select tokens',
      action: () => {}
    })
  );

  constructor(
    private readonly tradeState: SwapsStateService,
    private readonly walletConnector: WalletConnectorService,
    private readonly tradePageService: TradePageService,
    private readonly modalService: ModalService,
    @Inject(Injector) private readonly injector: Injector,
    private readonly previewSwapService: PreviewSwapService,
    private readonly targetNetworkAddressService: TargetNetworkAddressService
  ) {}

  private swap(): void {
    this.tradePageService.setState('preview');
  }

  private swapCn(): void {
    this.tradePageService.setState('cnPreview');
  }

  private connectWallet(): void {
    this.modalService.openWalletModal(this.injector).subscribe();
  }
}
