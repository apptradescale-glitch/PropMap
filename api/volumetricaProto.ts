import protobuf from 'protobufjs';

// Inline protobuf JSON descriptor for Volumetrica PropTradingProtocol.
// Vercel serverless functions don't bundle .proto files, so we define the
// schema programmatically and cache the compiled types.

type LoadedProto = {
  ClientRequestMsg: protobuf.Type;
  ServerResponseMsg: protobuf.Type;
};

let cached: LoadedProto | null = null;

export async function loadProto(): Promise<LoadedProto> {
  if (cached) return cached;

  const root = protobuf.Root.fromJSON({
    nested: {
      PropTradingProtocol: {
        nested: {
          // ── enums ──
          SymbolCategoryEnum: { values: { Future: 1, Forex: 2, Index: 3, Option: 4, Stock: 5, CryptoPerpetual: 6, Spot: 7, Etf: 8, CryptoSpot: 9 } },
          SymbolSpreadTypeEnum: { values: { Native: 0, BidDifference: 1, AskDifference: 2, PercentualSpread: 3 } },
          InfoModeEnum: { values: { Account: 1, OrdAndPos: 2, Positions: 3, AccountTradingSymbols: 4 } },
          AccountModeEnum: { values: { EVALUATION: 0, SIM_FUNDED: 1, FUNDED: 2, LIVE: 3, TRIAL: 4, CONTEST: 5, TRAINING: 100 } },
          AccountStatusEnum: { values: { ALL: -1, INITIALIZED: 0, ENABLED: 1, SUCCESS: 2, FAILED: 4, DISABLED: 8 } },
          AccountPermissionEnum: { values: { Trading: 0, ReadOnly: 1, RiskPause: 2, LiquidateOnly: 3 } },
          AccountSubscriptionModeEnum: { values: { Undefined: 0, Manual: 1, Existing: 2, ExistingAndNew: 3 } },
          OrderTypeEnum: { values: { Market: 0, Limit: 1, Stop: 2, StopLimit: 3 } },
          OrderExpireEnum: { values: { Never: 1, TillDay: 2 } },
          RequestSourceEnum: { values: { Unknown: 0, Manual: 1, Automatic: 2, Copy: 3 } },
          OrderQuantityModeEnum: { values: { Fixed: 0, All: 1, AccountCountervalue: 2 } },
          OrderPositionFilterEnum: { values: { ALL: 0, BUY: 1, SELL: 2, WINNER: 3, LOOSER: 4 } },
          EntityActionEnum: { values: { SNAPSHOT: 0, ADD: 1, UPDATE: 2, REMOVE: 3 } },
          SubscribeModeEnum: { values: { SNAPSHOT: 0, SUBSCRIBE: 1, UNSUBSCRIBE: 2 } },
          LoginReasonsCodeEnum: { values: { CREDENTIALS: 0, CONCURRENT_SESSION: 1, UNEXPECTED_ERROR: 2 } },
          RiskUserLossModeEnum: { values: { TrailingMaxBalance: 0, StaticStartBalance: 1, TrailingMaxEquity: 2, StaticStartEquity: 3, StaticMininmumStartEquityBalance: 4 } },
          RiskUserTargetModeEnum: { values: { Balance: 0, Equity: 1 } },
          AccountHistoricalEntityEnum: { values: { All: 0, Orders: 1, Trades: 2, Fills: 3, FillTrades: 4 } },

          // ── messages ──
          PingMsg: { fields: { Connected: { type: 'bool', id: 1 }, AckValue: { type: 'sint64', id: 2 } } },
          PongMsg: { fields: { Connected: { type: 'bool', id: 1 }, AckValue: { type: 'sint64', id: 2 } } },
          LogInfoMsg: { fields: { Msg: { type: 'string', id: 1 }, AccNumber: { type: 'sint64', id: 2 } } },

          ContractReqMsg: { fields: { FeedSymbol: { type: 'string', id: 1 }, Category: { type: 'SymbolCategoryEnum', id: 2 }, ContractId: { type: 'sint64', id: 3 }, Isin: { type: 'string', id: 4 }, RequestId: { type: 'sint64', id: 5 } } },
          ContractRespMsg: { fields: { FeedSymbol: { type: 'string', id: 1 }, Category: { type: 'SymbolCategoryEnum', id: 2 }, ContractId: { type: 'sint64', id: 3 }, contractInfo: { type: 'ContractInfoMsg', id: 4 }, RequestId: { type: 'sint64', id: 5 }, IsFinal: { type: 'bool', id: 6 } } },
          ContractInfoMsg: { fields: { ContractName: { type: 'string', id: 1 }, Symbol: { type: 'string', id: 2 }, Exchange: { type: 'string', id: 3 }, Description: { type: 'string', id: 4 }, TickSize: { type: 'double', id: 5 }, TickValue: { type: 'double', id: 6 }, IsStock: { type: 'bool', id: 10 }, FeedSymbol: { type: 'string', id: 11 }, TradableQuantityFractionable: { type: 'sint32', id: 12 }, TradableQuantityMultiplier: { type: 'double', id: 13 }, ContractId: { type: 'sint64', id: 14 }, SymbolId: { type: 'sint64', id: 15 }, QuoteCurrency: { type: 'string', id: 16 }, BaseCurrency: { type: 'string', id: 17 }, TradableQuantityMinimum: { type: 'sint32', id: 18 }, TradableQuantityMultiple: { type: 'sint32', id: 19 }, BaseFlagIconUrl: { type: 'string', id: 20 }, QuoteFlagIconUrl: { type: 'string', id: 21 }, Category: { type: 'SymbolCategoryEnum', id: 22 }, DataBridgeId: { type: 'sint64', id: 23 } } },
          ContractRequestWrapperMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Contracts: { rule: 'repeated', type: 'ContractReqMsg', id: 2 } } },
          ContractResponseWrapperMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Contracts: { rule: 'repeated', type: 'ContractRespMsg', id: 2 } } },

          AccountTradingSymbolInfoReqMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, AccountId: { type: 'sint64', id: 2 }, FeedSymbol: { type: 'string', id: 3 }, ContractId: { type: 'sint64', id: 4 } } },
          AccountTradingSymbolInfoRespMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Success: { type: 'bool', id: 2 }, Reason: { type: 'string', id: 3 }, Info: { type: 'AccountTradingSymbolInfoMsg', id: 4 } } },
          AccountTradingSymbolInfoMsg: { fields: { AccountId: { type: 'sint64', id: 1 }, SymbolId: { type: 'sint64', id: 2 }, Commissions: { type: 'double', id: 3 }, Margin: { type: 'double', id: 4 }, Leverage: { type: 'sint32', id: 5 }, SpreadType: { type: 'SymbolSpreadTypeEnum', id: 6 }, SpreadTickValue: { type: 'int32', id: 7 }, TradableQuantityFractionable: { type: 'sint32', id: 8 }, TradableQuantityMultiplier: { type: 'double', id: 9 }, QuoteCurrency: { type: 'string', id: 10 }, BaseCurrency: { type: 'string', id: 11 }, ContractId: { type: 'sint64', id: 12 }, FeedSymbol: { type: 'string', id: 13 } } },
          TradingSymbolParamReqMsg: { fields: { FeedSymbol: { type: 'string', id: 3 }, ContractId: { type: 'sint64', id: 4 } } },
          AccountTradingSymbolMultiReqMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, AccountId: { type: 'sint64', id: 2 }, Symbols: { rule: 'repeated', type: 'TradingSymbolParamReqMsg', id: 3 } } },
          AccountTradingSymbolMultiRespMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Success: { type: 'bool', id: 2 }, Reason: { type: 'string', id: 3 }, Infos: { rule: 'repeated', type: 'AccountTradingSymbolInfoMsg', id: 4 } } },

          DailyPlReqMsg: { fields: { ContractId: { type: 'sint64', id: 1 }, AccNumber: { type: 'sint64', id: 2 }, RequestId: { type: 'sint64', id: 3 } } },
          DailyPlRespMsg: { fields: { ContractId: { type: 'sint64', id: 1 }, AccNumber: { type: 'sint64', id: 2 }, DailyPl: { type: 'double', id: 3 }, FeedSymbol: { type: 'string', id: 4 }, RequestId: { type: 'sint64', id: 5 }, DailyNetPl: { type: 'double', id: 6 }, Isin: { type: 'string', id: 7 }, ConvertedDailyPl: { type: 'double', id: 8 }, ConvertedDailyNetPl: { type: 'double', id: 9 } } },

          InfoReqMsg: { fields: { Mode: { type: 'InfoModeEnum', id: 1 }, RequestId: { type: 'sint64', id: 2 }, AccountListFilterStatus: { type: 'AccountStatusEnum', id: 3 }, Accounts: { rule: 'repeated', type: 'sint64', id: 4 }, Modes: { rule: 'repeated', type: 'InfoModeEnum', id: 5 } } },
          InfoRespMsg: { fields: { AccountList: { rule: 'repeated', type: 'AccountHeaderMsg', id: 1 }, OrderList: { rule: 'repeated', type: 'OrderInfoMsg', id: 2 }, RequestId: { type: 'sint64', id: 3 }, PositionList: { rule: 'repeated', type: 'PositionInfoMsg', id: 4 }, BracketList: { rule: 'repeated', type: 'BracketInfoMsg', id: 5 }, AccountTradingSymbolList: { rule: 'repeated', type: 'AccountTradingSymbolInfoMsg', id: 6 } } },

          BalanceDetailedMsg: { fields: { Empty: { type: 'bool', id: 1 }, StopDrawdownOverallValue: { type: 'double', id: 2 }, StopDrawdownIntradayValue: { type: 'double', id: 3 }, ProfitTargetValue: { type: 'double', id: 4 }, StopDrawdownWeeklyValue: { type: 'double', id: 5 }, UserDrawdownDailyBalance: { type: 'double', id: 6 }, UserDrawdownWeeklyBalance: { type: 'double', id: 7 }, UserProfitDailyBalance: { type: 'double', id: 8 }, UserProfitWeeklyBalance: { type: 'double', id: 9 }, UserDrawdownDailyValue: { type: 'double', id: 10 }, UserDrawdownWeeklyValue: { type: 'double', id: 11 }, UserProfitDailyValue: { type: 'double', id: 12 }, UserProfitWeeklyValue: { type: 'double', id: 13 }, SessionsNumber: { type: 'sint32', id: 14 }, SessionsNumberTarget: { type: 'sint32', id: 15 }, StartBalance: { type: 'double', id: 16 } } },
          BalanceMsg: { fields: { Balance: { type: 'double', id: 1 }, AccNumber: { type: 'sint64', id: 2 }, Description: { type: 'string', id: 3 }, MarginUsed: { type: 'double', id: 4 }, StopDrawdownOverall: { type: 'double', id: 5 }, StopDrawdownIntraday: { type: 'double', id: 6 }, ProfitTarget: { type: 'double', id: 7 }, MarginAvailable: { type: 'double', id: 8 }, StopDrawdownWeekly: { type: 'double', id: 9 }, Equity: { type: 'double', id: 10 }, DailyPl: { type: 'double', id: 11 }, DailyNetPl: { type: 'double', id: 12 }, Details: { type: 'BalanceDetailedMsg', id: 13 } } },

          AccountHeaderMsg: { fields: { accountNumber: { type: 'sint64', id: 1 }, accountHeader: { type: 'string', id: 2 }, accountDescription: { type: 'string', id: 3 }, Balance: { type: 'BalanceMsg', id: 4 }, IsEnabled: { type: 'bool', id: 5 }, Status: { type: 'AccountStatusEnum', id: 6 }, IsTradingEnabled: { type: 'bool', id: 7 }, IsHedging: { type: 'bool', id: 8 }, AccountReferenceId: { type: 'string', id: 9 }, Permission: { type: 'AccountPermissionEnum', id: 10 }, Currency: { type: 'string', id: 11 }, Archived: { type: 'bool', id: 12 }, UserRiskRuleEnabled: { type: 'bool', id: 13 }, UserDailyLockoutEnabled: { type: 'bool', id: 14 }, IsTradeCopierAllowed: { type: 'bool', id: 15 }, OrganizationId: { type: 'sint64', id: 16 }, OrganizationName: { type: 'string', id: 17 }, Mode: { type: 'AccountModeEnum', id: 18 } } },
          AccountSubscribeReqMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Accounts: { rule: 'repeated', type: 'sint64', id: 2 } } },
          AccountSubscribeRespMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Success: { type: 'bool', id: 2 }, Reason: { type: 'string', id: 3 } } },
          AccountStatusUpdateMsg: { fields: { AccountId: { type: 'sint64', id: 1 }, Action: { type: 'EntityActionEnum', id: 2 }, Info: { type: 'AccountHeaderMsg', id: 3 } } },

          OrderInsertMsg: { fields: { ContractId: { type: 'sint64', id: 1 }, SeqClientId: { type: 'int32', id: 2 }, Quantity: { type: 'int32', id: 3 }, Price: { type: 'double', id: 4 }, OrderType: { type: 'OrderTypeEnum', id: 5 }, AccNumber: { type: 'sint64', id: 6 }, LimitPrice: { type: 'double', id: 7 }, BracketStrategy: { type: 'BracketStrategyParam', id: 8 }, RefPositionId: { type: 'sint64', id: 9 }, Source: { type: 'RequestSourceEnum', id: 10 }, QuantityMode: { type: 'OrderQuantityModeEnum', id: 11 } } },
          OrderModifyMsg: { fields: { ContractId: { type: 'sint64', id: 1 }, OrgServerId: { type: 'sint64', id: 2 }, NewSeqClientId: { type: 'int32', id: 3 }, Quantity: { type: 'int32', id: 4 }, Price: { type: 'double', id: 5 }, AccNumber: { type: 'sint64', id: 6 }, LimitPrice: { type: 'double', id: 7 }, Source: { type: 'RequestSourceEnum', id: 8 } } },
          OrderRemoveMsg: { fields: { OrgServerId: { type: 'sint64', id: 1 }, AccNumber: { type: 'sint64', id: 2 }, Source: { type: 'RequestSourceEnum', id: 3 } } },
          BracketStrategyParam: {
            fields: { Type: { type: 'TypeEnum', id: 1 }, Stops: { rule: 'repeated', type: 'BracketParam', id: 2 }, Targets: { rule: 'repeated', type: 'BracketParam', id: 3 }, TrailingMode: { type: 'StopTrailingModeEnum', id: 4 }, TrailingTicks: { type: 'int32', id: 5 }, TrailingMinOffsetTicks: { type: 'int32', id: 6 } },
            nested: {
              TypeEnum: { values: { STOP_AND_TARGET: 0, STOP_AND_TARGET_STATIC: 1, STOP: 2, STOP_STATIC: 3, TARGET: 4, TARGET_STATIC: 5 } },
              StopTrailingModeEnum: { values: { None: 0, Breakeven: 1, Trailing: 2 } },
            },
          },
          BracketParam: {
            fields: { Quantity: { type: 'sint64', id: 1 }, PriceMode: { type: 'PriceModeEnum', id: 2 }, TicksOffset: { type: 'int32', id: 3 }, Price: { type: 'double', id: 4 } },
            nested: { PriceModeEnum: { values: { Ticks: 0, Price: 1, PriceOffset: 2 } } },
          },
          BracketStrageyInsertMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, ParentOrderId: { type: 'sint64', id: 2 }, BracketStrategy: { type: 'BracketStrategyParam', id: 3 }, AccNumber: { type: 'sint64', id: 4 }, Source: { type: 'RequestSourceEnum', id: 5 }, IsReplace: { type: 'bool', id: 6 } } },
          BracketInsertMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, ParentOrderId: { type: 'sint64', id: 2 }, IsTarget: { type: 'bool', id: 3 }, BracketParam: { type: 'BracketParam', id: 4 }, ClientId: { type: 'sint64', id: 5 }, AccNumber: { type: 'sint64', id: 6 }, Source: { type: 'RequestSourceEnum', id: 7 } } },
          BracketModifyMsg: { fields: { ParentOrderId: { type: 'sint64', id: 1 }, BracketId: { type: 'sint64', id: 2 }, BracketParam: { type: 'BracketParam', id: 3 }, ClientId: { type: 'sint64', id: 4 }, AccNumber: { type: 'sint64', id: 5 }, Source: { type: 'RequestSourceEnum', id: 6 } } },
          BracketRemoveMsg: { fields: { ParentOrderId: { type: 'sint64', id: 1 }, BracketId: { type: 'sint64', id: 2 }, AccNumber: { type: 'sint64', id: 3 }, Source: { type: 'RequestSourceEnum', id: 4 } } },
          OrderMsg: { fields: { OrderInsert: { type: 'OrderInsertMsg', id: 1 }, OrderRemove: { type: 'OrderRemoveMsg', id: 2 }, OrderModify: { type: 'OrderModifyMsg', id: 3 }, BracketStrategyInsert: { type: 'BracketStrageyInsertMsg', id: 4 }, BracketModify: { type: 'BracketModifyMsg', id: 5 }, OcoGroupCreate: { type: 'OcoGroupCreateMsg', id: 6 }, OcoGroupRemove: { type: 'OcoGroupRemoveMsg', id: 7 }, PositionFlatMsg: { type: 'PositionFlatMsg', id: 8 }, BracketInsert: { type: 'BracketInsertMsg', id: 9 }, BracketRemove: { type: 'BracketRemoveMsg', id: 10 } } },

          OcoGroupCreateMsg: {
            fields: { RequestId: { type: 'sint64', id: 1 }, AccNumber: { type: 'sint64', id: 2 }, Type: { type: 'GroupTypeEnum', id: 3 }, OcoLinkedOrderIds: { rule: 'repeated', type: 'sint64', id: 4 }, OrderPlace: { type: 'OcoOrdersPlaceEnum', id: 5 }, OrderInsert: { rule: 'repeated', type: 'OrderInsertMsg', id: 6 }, Source: { type: 'RequestSourceEnum', id: 7 } },
            nested: {
              GroupTypeEnum: { values: { STOPS_LIMITS: 0, OPPOSITE_QTY: 1 } },
              OcoOrdersPlaceEnum: { values: { EXISTING: 0, INSERT: 1 } },
            },
          },
          OcoGroupRemoveMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, AccNumber: { type: 'sint64', id: 2 }, OcoGroupId: { type: 'sint64', id: 3 }, Source: { type: 'RequestSourceEnum', id: 4 } } },
          OcoGroupReportMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Success: { type: 'bool', id: 2 }, OcoGroupId: { type: 'sint64', id: 3 }, Reason: { type: 'string', id: 4 } } },
          PositionFlatMsg: { fields: { PositionId: { type: 'sint64', id: 1 }, AccNumber: { type: 'sint64', id: 2 }, Source: { type: 'RequestSourceEnum', id: 3 } } },

          OrderInfoMsg: {
            fields: { ContractId: { type: 'sint64', id: 1 }, OrgServerId: { type: 'sint64', id: 2 }, OrgClientId: { type: 'sint64', id: 3 }, SeqServerId: { type: 'int64', id: 4 }, SeqClientId: { type: 'sint64', id: 5 }, OrderPrice: { type: 'double', id: 6 }, OrderLimitPrice: { type: 'double', id: 7 }, PendingQty: { type: 'sint64', id: 8 }, FilledQty: { type: 'sint64', id: 9 }, OrderType: { type: 'OrderTypeEnum', id: 10 }, OrderState: { type: 'OrderStateEnum', id: 11 }, AvgPrice: { type: 'double', id: 12 }, SnapType: { type: 'SnapTypeEnum', id: 13 }, AccNumber: { type: 'sint64', id: 14 }, Reason: { type: 'string', id: 15 }, FeedSymbol: { type: 'string', id: 16 }, Isin: { type: 'string', id: 17 }, OcoLinkedGroupId: { type: 'sint64', id: 18 }, OcoLinkedOrderIds: { rule: 'repeated', type: 'sint64', id: 19 }, OcoParentOrderId: { type: 'sint64', id: 20 }, PositionLinkId: { type: 'sint64', id: 21 }, IsGeneratedFromBracket: { type: 'bool', id: 22 }, QuantityMode: { type: 'OrderQuantityModeEnum', id: 23 }, InsertUtc: { type: 'sint64', id: 24 }, ExeuctionUtc: { type: 'sint64', id: 25 }, Ip: { type: 'string', id: 26 }, Source: { type: 'string', id: 27 }, OrgClientSessionId: { type: 'sint64', id: 100 }, SeqClientSessionId: { type: 'sint64', id: 101 }, IsValidationError: { type: 'bool', id: 102 }, MessageTimestamp: { type: 'sint64', id: 103 } },
            nested: {
              OrderStateEnum: { values: { Submitted: 0, Canceled: 1, Error: 2, ErrorModify: 3, PendingRequest: 100, PendingModify: 101, PendingCancel: 102 } },
              SnapTypeEnum: { values: { Historical: 1, RealTime: 2, HistPos: 3 } },
            },
          },

          BracketInfoMsg: {
            fields: { ContractId: { type: 'sint64', id: 1 }, ParentOrderId: { type: 'sint64', id: 2 }, OcoGroupId: { type: 'sint64', id: 3 }, BracketId: { type: 'sint64', id: 4 }, SeqClientId: { type: 'sint64', id: 5 }, Price: { type: 'double', id: 6 }, Ticks: { type: 'sint32', id: 7 }, CalculatedPrice: { type: 'double', id: 8 }, TotalQty: { type: 'sint64', id: 9 }, ReleasedQty: { type: 'sint64', id: 10 }, IsTarget: { type: 'bool', id: 11 }, BracketState: { type: 'BracketStateEnum', id: 12 }, SnapType: { type: 'SnapTypeEnum', id: 13 }, AccNumber: { type: 'sint64', id: 14 }, Reason: { type: 'string', id: 15 }, FeedSymbol: { type: 'string', id: 16 }, Isin: { type: 'string', id: 17 }, ClientSessionId: { type: 'sint64', id: 101 }, IsValidationError: { type: 'bool', id: 102 } },
            nested: {
              BracketStateEnum: { values: { Waiting: 0, Submitted: 1, Cancelled: 2, Error: 3, Pending: 100 } },
              SnapTypeEnum: { values: { Historical: 1, RealTime: 2 } },
            },
          },

          PositionInfoMsg: {
            fields: { ContractId: { type: 'sint64', id: 1 }, OpenQuantity: { type: 'sint64', id: 2 }, OpenPrice: { type: 'double', id: 3 }, MarginUsed: { type: 'double', id: 4 }, DailyBought: { type: 'sint64', id: 5 }, DailySold: { type: 'sint64', id: 6 }, DailyPl: { type: 'double', id: 7 }, HasOpenPl: { type: 'bool', id: 8 }, OpenPl: { type: 'double', id: 9 }, DailyCommissions: { type: 'double', id: 10 }, SnapType: { type: 'SnapTypeEnum', id: 11 }, AccNumber: { type: 'sint64', id: 12 }, FeedSymbol: { type: 'string', id: 13 }, Isin: { type: 'string', id: 14 }, PositionId: { type: 'sint64', id: 15 }, Utc: { type: 'sint64', id: 16 }, ConvertedDailyPl: { type: 'double', id: 17 }, ConvertedDailyCommissions: { type: 'double', id: 18 }, ConvertedOpenPl: { type: 'double', id: 19 }, EntryOrderId: { type: 'sint64', id: 20 } },
            nested: { SnapTypeEnum: { values: { Historical: 1, RealTime: 2 } } },
          },

          SymbolLookupReqMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Filter: { type: 'string', id: 2 } } },
          SymbolLookupRespMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Symbols: { rule: 'repeated', type: 'SymbolLookupInfo', id: 2 } } },
          SymbolLookupInfo: { fields: { Symbol: { type: 'string', id: 1 }, Description: { type: 'string', id: 2 }, Exchange: { type: 'string', id: 3 }, TickSize: { type: 'double', id: 4 }, OrderCommission: { type: 'double', id: 5 }, Category: { type: 'SymbolCategoryEnum', id: 6 }, DataFeedProduct: { type: 'string', id: 7 }, ContractId: { type: 'sint64', id: 8 }, TradingInhibited: { type: 'bool', id: 9 }, TradableQuantityFractionable: { type: 'sint32', id: 10 }, TradableQuantityMinimum: { type: 'sint32', id: 11 } } },

          CancelFlatReqMsg: {
            fields: { RequestId: { type: 'sint64', id: 1 }, AccNumber: { type: 'sint64', id: 2 }, ContractsId: { rule: 'repeated', type: 'sint64', id: 3 }, Action: { type: 'ActionEnum', id: 4 }, Source: { type: 'RequestSourceEnum', id: 5 }, Filter: { type: 'OrderPositionFilterEnum', id: 6 }, CancelExcludeOco: { type: 'bool', id: 7 } },
            nested: { ActionEnum: { values: { FLAT: 0, CANCEL: 1, FLAT_CANCEL: 2 } } },
          },
          CancelFlatRespMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, AccNumber: { type: 'sint64', id: 2 }, Errors: { rule: 'repeated', type: 'CancelFlatErrorDetail', id: 3 }, Items: { rule: 'repeated', type: 'CancelFlatItemDetail', id: 4 } } },
          CancelFlatItemDetail: { fields: { IsPosition: { type: 'bool', id: 1 }, FeedSymbol: { type: 'string', id: 2 }, ContractId: { type: 'sint64', id: 3 }, PositionId: { type: 'sint64', id: 4 }, OrderId: { type: 'sint64', id: 5 } } },
          CancelFlatErrorDetail: { fields: { ContractId: { type: 'sint64', id: 1 }, Error: { type: 'string', id: 2 } } },

          CancelReverseReqMsg: {
            fields: { RequestId: { type: 'sint64', id: 1 }, AccNumber: { type: 'sint64', id: 2 }, ContractId: { type: 'sint64', id: 3 }, Action: { type: 'ActionEnum', id: 4 }, Source: { type: 'RequestSourceEnum', id: 5 } },
            nested: { ActionEnum: { values: { REVERSE: 0, CANCEL: 1, REVERSE_CANCEL: 2 } } },
          },
          CancelReverseRespMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Success: { type: 'bool', id: 2 }, Error: { type: 'string', id: 3 } } },

          BracketInsertReportMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Success: { type: 'bool', id: 2 }, Reason: { type: 'string', id: 3 } } },

          FillReportMsg: { fields: { AccountId: { type: 'sint64', id: 1 }, FillId: { type: 'sint64', id: 2 }, ContractId: { type: 'sint64', id: 3 }, FeedSymbol: { type: 'string', id: 4 }, Utc: { type: 'sint64', id: 5 }, Price: { type: 'double', id: 6 }, Quantity: { type: 'sint64', id: 7 }, Commissions: { type: 'double', id: 8 }, SourceOrderId: { type: 'sint64', id: 9 }, SourceOrderIp: { type: 'string', id: 10 } } },
          TradeReportMsg: {
            fields: { AccountId: { type: 'sint64', id: 1 }, TradeId: { type: 'sint64', id: 2 }, ContractId: { type: 'sint64', id: 3 }, FeedSymbol: { type: 'string', id: 4 }, Quantity: { type: 'sint64', id: 5 }, EntryUtc: { type: 'sint64', id: 6 }, ExitUtc: { type: 'sint64', id: 7 }, OpenPrice: { type: 'double', id: 8 }, ClosePrice: { type: 'double', id: 9 }, GrossPL: { type: 'double', id: 10 }, Commissions: { type: 'double', id: 11 }, Unaccounted: { type: 'bool', id: 12 }, Flags: { rule: 'repeated', type: 'Flag', id: 13 } },
            nested: { Flag: { values: { SCALP: 1, CLOSED_TOO_CLOSE_TO_ENTRY: 2, TRADING_NEWS: 4 } } },
          },
          FillTradeReportMsg: {
            fields: { FillType: { type: 'FillTradeTypeEnum', id: 1 }, AccountId: { type: 'sint64', id: 2 }, PositionId: { type: 'sint64', id: 3 }, OrderId: { type: 'sint64', id: 4 }, ContractId: { type: 'sint64', id: 5 }, FeedSymbol: { type: 'string', id: 6 }, Quantity: { type: 'sint64', id: 7 }, EntryUtc: { type: 'sint64', id: 8 }, ExitUtc: { type: 'sint64', id: 9 }, OpenPrice: { type: 'double', id: 10 }, ClosePrice: { type: 'double', id: 11 }, ConvertedGrossPL: { type: 'double', id: 12 }, ConvertedCommissions: { type: 'double', id: 13 } },
            nested: { FillTradeTypeEnum: { values: { OPEN: 0, CLOSE: 1 } } },
          },

          UserSessionLogMsg: { fields: { SessionId: { type: 'string', id: 1 }, UserId: { type: 'string', id: 2 }, StartUtc: { type: 'sint64', id: 3 }, EndUtc: { type: 'sint64', id: 4 }, Ip: { type: 'string', id: 5 }, Source: { type: 'string', id: 6 }, ClientSessionId: { type: 'sint64', id: 7 } } },

          CurrencyRatesReqMsg: { fields: { Mode: { type: 'SubscribeModeEnum', id: 1 } } },
          CurrencyRateInfoMsg: { fields: { BaseCurrency: { type: 'string', id: 1 }, QuoteCurrency: { type: 'string', id: 2 }, Rate: { type: 'double', id: 3 }, DataBridgeId: { type: 'sint64', id: 4 } } },

          AccountUserRiskRule: { fields: { AccountId: { type: 'sint64', id: 4 }, IsScheduled: { type: 'bool', id: 5 }, SetAsDefaultForAccountTradingRule: { type: 'bool', id: 6 }, InhibitChangesUntilNextSession: { type: 'bool', id: 7 }, DailyLossLimitEnabled: { type: 'bool', id: 8 }, DailyLossLimitMode: { type: 'RiskUserLossModeEnum', id: 9 }, DailyLossLimitValue: { type: 'double', id: 10 }, DailyLossLimitPercentage: { type: 'double', id: 11 }, DailyProfitLimitEnabled: { type: 'bool', id: 12 }, DailyProfitLimitMode: { type: 'RiskUserTargetModeEnum', id: 13 }, DailyProfitLimitValue: { type: 'double', id: 14 }, DailyProfitLimitPercentage: { type: 'double', id: 15 }, WeeklyLossLimitEnabled: { type: 'bool', id: 16 }, WeeklyLossLimitMode: { type: 'RiskUserLossModeEnum', id: 17 }, WeeklyLossLimitValue: { type: 'double', id: 18 }, WeeklyLossLimitPercentage: { type: 'double', id: 19 }, WeeklyProfitLimitEnabled: { type: 'bool', id: 20 }, WeeklyProfitLimitMode: { type: 'RiskUserTargetModeEnum', id: 21 }, WeeklyProfitLimitValue: { type: 'double', id: 22 }, WeeklyProfitLimitPercentage: { type: 'double', id: 23 } } },
          AccountUserRiskRuleInfoReqMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, AccountId: { type: 'sint64', id: 2 } } },
          AccountUserRiskRuleInfoRespMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Success: { type: 'bool', id: 2 }, Error: { type: 'string', id: 3 }, Rule: { type: 'AccountUserRiskRule', id: 4 } } },
          AccountUserRiskRuleSetReqMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Rule: { type: 'AccountUserRiskRule', id: 2 } } },
          AccountUserRiskRuleSetRespMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Success: { type: 'bool', id: 2 }, Errors: { rule: 'repeated', type: 'string', id: 3 } } },
          AccountDailyLockoutReqMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, AccountId: { type: 'sint64', id: 2 } } },
          AccountDailyLockoutRespMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Success: { type: 'bool', id: 2 }, Error: { type: 'string', id: 3 } } },

          AccountHistoricalSessionReqMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, AccountIds: { rule: 'repeated', type: 'sint64', id: 2 }, Entity: { type: 'AccountHistoricalEntityEnum', id: 3 } } },
          AccountHistoricalSessionRespMsg: { fields: { RequestId: { type: 'sint64', id: 1 }, Fills: { rule: 'repeated', type: 'FillReportMsg', id: 2 }, Trades: { rule: 'repeated', type: 'TradeReportMsg', id: 3 }, Orders: { rule: 'repeated', type: 'OrderInfoMsg', id: 4 }, FillTrades: { rule: 'repeated', type: 'FillTradeReportMsg', id: 5 }, IsPartial: { type: 'bool', id: 6 } } },

          LoginRequestMsg: { fields: { Token: { type: 'string', id: 1 }, OtpCode: { type: 'string', id: 2 }, IsManualAccountSubscribe: { type: 'bool', id: 3 }, KeepConcurrentSessionOn: { type: 'bool', id: 4 }, AccountSubscriptionMode: { type: 'AccountSubscriptionModeEnum', id: 5 } } },
          LoginResponseMsg: { fields: { Success: { type: 'bool', id: 1 }, Reason: { type: 'string', id: 2 }, ReasonCode: { type: 'LoginReasonsCodeEnum', id: 3 }, Version: { type: 'sint64', id: 4 } } },
          LoggedOffMsg: { fields: { Reason: { type: 'string', id: 1 } } },

          // ── top-level request/response wrappers ──
          ClientRequestMsg: { fields: { LoginReq: { type: 'LoginRequestMsg', id: 1 }, Ping: { type: 'PingMsg', id: 2 }, InfoReq: { type: 'InfoReqMsg', id: 3 }, ContractReq: { type: 'ContractReqMsg', id: 4 }, DailyPls: { rule: 'repeated', type: 'DailyPlReqMsg', id: 5 }, Order: { rule: 'repeated', type: 'OrderMsg', id: 6 }, LogMsg: { type: 'LogInfoMsg', id: 7 }, SymbolLookup: { type: 'SymbolLookupReqMsg', id: 8 }, CancelFlatReq: { type: 'CancelFlatReqMsg', id: 9 }, AccountSubscribeReq: { type: 'AccountSubscribeReqMsg', id: 10 }, CancelReverseReq: { type: 'CancelReverseReqMsg', id: 11 }, CurrenyRatesReq: { type: 'CurrencyRatesReqMsg', id: 12 }, AccountTradingSymbolInfoReq: { type: 'AccountTradingSymbolInfoReqMsg', id: 13 }, AccountUserRiskRuleInfoReq: { type: 'AccountUserRiskRuleInfoReqMsg', id: 14 }, AccountUserRiskRuleSetReq: { type: 'AccountUserRiskRuleSetReqMsg', id: 15 }, AccountDailyLockoutReq: { type: 'AccountDailyLockoutReqMsg', id: 16 }, AccountHistoricalSessionReq: { type: 'AccountHistoricalSessionReqMsg', id: 17 }, ContractsReqs: { type: 'ContractRequestWrapperMsg', id: 18 }, AccountTradingSymbolMultiReq: { type: 'AccountTradingSymbolMultiReqMsg', id: 19 } } },
          ServerResponseMsg: { fields: { LoginMsg: { type: 'LoginResponseMsg', id: 1 }, Pong: { type: 'PongMsg', id: 2 }, InfoMsg: { type: 'InfoRespMsg', id: 3 }, BalanceInfo: { rule: 'repeated', type: 'BalanceMsg', id: 4 }, ContractMsg: { type: 'ContractRespMsg', id: 5 }, DailyPls: { rule: 'repeated', type: 'DailyPlRespMsg', id: 6 }, OrderInfo: { rule: 'repeated', type: 'OrderInfoMsg', id: 7 }, LoggedOff: { type: 'LoggedOffMsg', id: 8 }, LogMsg: { type: 'LogInfoMsg', id: 9 }, SymbolLookup: { type: 'SymbolLookupRespMsg', id: 10 }, PositionInfo: { rule: 'repeated', type: 'PositionInfoMsg', id: 11 }, CancelFlatMsg: { type: 'CancelFlatRespMsg', id: 12 }, BracketInfo: { rule: 'repeated', type: 'BracketInfoMsg', id: 13 }, BracketStrategyInsertReport: { type: 'BracketInsertReportMsg', id: 14 }, AccountSubscribeResp: { type: 'AccountSubscribeRespMsg', id: 15 }, AccountStatusUpdates: { rule: 'repeated', type: 'AccountStatusUpdateMsg', id: 16 }, OcoGroupReport: { type: 'OcoGroupReportMsg', id: 17 }, FillReports: { rule: 'repeated', type: 'FillReportMsg', id: 18 }, TradeReports: { rule: 'repeated', type: 'TradeReportMsg', id: 19 }, FillTradeReports: { rule: 'repeated', type: 'FillTradeReportMsg', id: 20 }, CancelReverseMsg: { type: 'CancelReverseRespMsg', id: 21 }, UserSessionLogs: { rule: 'repeated', type: 'UserSessionLogMsg', id: 22 }, AccountTradingSymbolInfoUpdate: { rule: 'repeated', type: 'AccountTradingSymbolInfoMsg', id: 23 }, CurrencyRates: { rule: 'repeated', type: 'CurrencyRateInfoMsg', id: 24 }, AccountTradingSymbolInfoResp: { type: 'AccountTradingSymbolInfoRespMsg', id: 25 }, AccountUserRiskRuleInfoResp: { type: 'AccountUserRiskRuleInfoRespMsg', id: 26 }, AccountUserRiskRuleSetResp: { type: 'AccountUserRiskRuleSetRespMsg', id: 27 }, AccountDailyLockoutResp: { type: 'AccountDailyLockoutRespMsg', id: 28 }, AccountHistoricalSessionResp: { type: 'AccountHistoricalSessionRespMsg', id: 29 }, ContractsResps: { type: 'ContractResponseWrapperMsg', id: 30 }, AccountTradingSymbolMultiResp: { type: 'AccountTradingSymbolMultiRespMsg', id: 31 } } },
        },
      },
    },
  });

  const ClientRequestMsg = root.lookupType('PropTradingProtocol.ClientRequestMsg');
  const ServerResponseMsg = root.lookupType('PropTradingProtocol.ServerResponseMsg');

  cached = { ClientRequestMsg, ServerResponseMsg };
  return cached;
}
