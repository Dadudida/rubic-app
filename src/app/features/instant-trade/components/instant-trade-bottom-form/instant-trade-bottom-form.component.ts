import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ProviderControllerData } from 'src/app/shared/components/provider-panel/provider-panel.component';
import { SwapFormService } from 'src/app/features/swaps/services/swaps-form-service/swap-form.service';
import { InstantTradeService } from 'src/app/features/instant-trade/services/instant-trade-service/instant-trade.service';
import { BLOCKCHAIN_NAME } from 'src/app/shared/models/blockchain/BLOCKCHAIN_NAME';
import { INSTANT_TRADES_STATUS } from 'src/app/features/swaps-page-old/instant-trades/models/instant-trades-trade-status';
import { SwapForm } from 'src/app/features/swaps/models/SwapForm';
import { ControlsValue } from '@ngneat/reactive-forms/lib/types';
import { INSTANT_TRADE_PROVIDERS } from 'src/app/features/instant-trade/constants/providers';
import { ErrorsService } from 'src/app/core/errors/errors.service';
import BigNumber from 'bignumber.js';
import { RubicError } from 'src/app/shared/models/errors/RubicError';
import NoSelectedProviderError from 'src/app/shared/models/errors/instant-trade/no-selected-provider.error';

@Component({
  selector: 'app-instant-trade-bottom-form',
  templateUrl: './instant-trade-bottom-form.component.html',
  styleUrls: ['./instant-trade-bottom-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstantTradeBottomFormComponent implements OnInit {
  public get allowAnalyse(): boolean {
    return Boolean(this.swapFormService.commonTrade.controls.input.value.fromToken);
  }

  public get allowTrade(): boolean {
    const form = this.swapFormService.commonTrade.controls.input.value;
    return Boolean(
      form.fromBlockchain && form.fromToken && form.toBlockchain && form.toToken && form.fromAmount
    );
  }

  public providerControllers: ProviderControllerData[];

  private currentBlockchain: BLOCKCHAIN_NAME;

  constructor(
    private readonly swapFormService: SwapFormService,
    private readonly instantTradeService: InstantTradeService,
    private readonly cdr: ChangeDetectorRef,
    private readonly errorService: ErrorsService
  ) {
    const formValue = this.swapFormService.commonTrade.value;
    this.currentBlockchain = formValue.input.toBlockchain;
    this.initiateProviders(this.currentBlockchain);
    this.conditionalCalculate(formValue);
  }

  public ngOnInit(): void {
    this.swapFormService.commonTrade.valueChanges.subscribe(form => {
      this.conditionalCalculate(form);
      if (
        this.currentBlockchain !== form.input.fromBlockchain &&
        form.input.fromBlockchain === form.input.toBlockchain
      ) {
        this.currentBlockchain = form.input.fromBlockchain;
        this.initiateProviders(this.currentBlockchain);
      }
    });
  }

  private async conditionalCalculate(form: ControlsValue<SwapForm>): Promise<void> {
    if (
      form.input.fromToken &&
      form.input.toToken &&
      form.input.fromBlockchain &&
      form.input.fromAmount &&
      form.input.toBlockchain
    ) {
      await this.calculateTrades();
    }
  }

  public async calculateTrades(): Promise<void> {
    this.providerControllers = this.providerControllers.map(controller => ({
      ...controller,
      tradeState: INSTANT_TRADES_STATUS.CALCULATION
    }));
    const tradeData = (await this.instantTradeService.calculateTrades()) as any[];
    const bestProviderIndex = this.calculateBestRate(tradeData);
    this.providerControllers = this.providerControllers.map((controller, index) => ({
      ...controller,
      trade: tradeData[index]?.value,
      isBestRate: false,
      tradeState:
        tradeData[index]?.status === 'fulfilled'
          ? INSTANT_TRADES_STATUS.APPROVAL
          : INSTANT_TRADES_STATUS.ERROR
    }));
    this.providerControllers[bestProviderIndex].isBestRate = true;
    this.cdr.detectChanges();
  }

  public async createTrade(): Promise<void> {
    const providerIndex = this.providerControllers.findIndex(el => el.isSelected);
    const provider = this.providerControllers[providerIndex];
    if (providerIndex !== -1) {
      this.providerControllers[providerIndex] = {
        ...this.providerControllers[providerIndex],
        tradeState: INSTANT_TRADES_STATUS.TX_IN_PROGRESS
      };
      this.cdr.detectChanges();
      await this.instantTradeService.createTrade(provider.tradeProviderInfo.value, provider.trade);
      this.providerControllers[providerIndex] = {
        ...this.providerControllers[providerIndex],
        tradeState: INSTANT_TRADES_STATUS.COMPLETED
      };
      this.cdr.detectChanges();
    } else {
      this.errorService.catch$(new NoSelectedProviderError());
    }
  }

  private initiateProviders(blockchain: BLOCKCHAIN_NAME) {
    switch (blockchain) {
      case BLOCKCHAIN_NAME.ETHEREUM:
        this.providerControllers = INSTANT_TRADE_PROVIDERS[BLOCKCHAIN_NAME.ETHEREUM];
        break;
      case BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN:
        this.providerControllers = INSTANT_TRADE_PROVIDERS[BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN];
        break;
      case BLOCKCHAIN_NAME.POLYGON:
        this.providerControllers = INSTANT_TRADE_PROVIDERS[BLOCKCHAIN_NAME.POLYGON];
        break;
      default:
        this.errorService.catch$(new RubicError());
    }
  }

  // public collapseProvider(providerNumber: number, isCollapsed: boolean): void {
  //   const newProviders = [...this.providerControllers];
  //   newProviders[providerNumber] = {
  //     ...newProviders[providerNumber],
  //     isCollapsed
  //   };
  //   this.providerControllers = newProviders;
  // }

  public selectProvider(providerNumber: number): void {
    const newProviders = this.providerControllers.map(provider => {
      return {
        ...provider,
        isSelected: false
      };
    });
    newProviders[providerNumber] = {
      ...newProviders[providerNumber],
      isSelected: true
    };
    this.providerControllers = newProviders;
  }

  private calculateBestRate(tradeData: any): number {
    const newTradeData = tradeData.map(tradeController => ({
      ...tradeController,
      isBestRate: false
    }));

    let bestRateProviderIndex;
    let bestRateProviderProfit = new BigNumber(-Infinity);
    newTradeData.forEach((tradeController, index) => {
      if (tradeController.value) {
        const { gasFeeInUsd, to } = tradeController.value;
        const amountInUsd = to.amount?.multipliedBy(to.token.price);

        if (amountInUsd && gasFeeInUsd) {
          const profit = amountInUsd.minus(gasFeeInUsd);
          if (profit.gt(bestRateProviderProfit)) {
            bestRateProviderProfit = profit;
            bestRateProviderIndex = index;
          }
        }
      }
    });

    return bestRateProviderIndex || 0;
  }

  // public getAnalytic() {
  //   const token = this.swapFormService.commonTrade.get('fromToken').value as IToken;
  //   window.open(`https://keks.app/t/${token.address}`, '_blank').focus();
  // }
}
