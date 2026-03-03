
namespace PropTradingProtocol {
    export interface PingMsg {
        Connected?: boolean;
        // if it is sent, it is returned on PongMsg as response
        AckValue?: number;
    }

    export interface PongMsg {
        Connected?: boolean;
        // if it is sent on PingMsg, it is returned the same value
        AckValue?: number;
    }

    export enum SymbolCategoryEnum {
        Future = 1,
        Forex = 2,
        Index = 3,
        Option = 4,
        Stock = 5,
        CryptoPerpetual = 6,
        Spot = 7,
        Etf = 8,
        CryptoSpot = 9,
    }

    export enum SymbolSpreadTypeEnum {
        Native = 0,
        BidDifference = 1,
        AskDifference = 2,
        PercentualSpread = 3,
    }

    export interface ContractRequestWrapperMsg {
        RequestId?: number;
        Contracts?: ContractReqMsg[];
    }

    // Request of contract id and detail based on FeedSymbol or ContractId
    export interface ContractReqMsg {
        // Symbol of which the id must be returned. E.g.: /ESZ22.XCME
        // The symbol root is the same of market data
        FeedSymbol?: string;
        // It is optional for this scenario
        Category?: SymbolCategoryEnum;
        // If "FeedSymbol" is setted, this field is ignored by the server
        ContractId?: number;
        // Not used in this scenario
        Isin?: string;
        RequestId?: number;
    }

    export interface ContractResponseWrapperMsg {
        RequestId?: number;
        Contracts?: ContractRespMsg[];
    }

    export interface ContractRespMsg {
        FeedSymbol?: string;
        Category?: SymbolCategoryEnum;
        // the contract id of the symbol requested. It should be stored inside the application and used for various message like order insert, daily pl request and so on
        ContractId?: number;
        // some detail about the contract
        contractInfo?: ContractInfoMsg;
        // it is -1 if the msg does not come from a client request
        RequestId?: number;
        // if it is from a request, it indicates that it is the last message of the response
        IsFinal?: boolean;
    }

    export interface ContractInfoMsg {
        ContractName?: string;
        Symbol?: string;
        Exchange?: string;
        Description?: string;
        TickSize?: number;
        TickValue?: number;
        IsStock?: boolean;
        FeedSymbol?: string;
        // default is 1.
        // On crypto, since the minimum tradable volume is under 1, can be different.
        // Example: 10 means that it is possible to buy/sell 1 / 10 of contract (0.1), 100 is 1 / 100 (0.01) and so on
        // Furthermore, the volume of the quantity received for this contract are multiplied accorindgly and same for the order submission
        TradableQuantityFractionable?: number;
        // it returns already 1 / TradableQuantityFractionable;
        TradableQuantityMultiplier?: number;
        ContractId?: number;
        SymbolId?: number;
        QuoteCurrency?: string;
        // optional - filled only on forex symbol
        BaseCurrency?: string;
        // In some circustances, it can be different compared to the TradableQuantityFractionable
        TradableQuantityMinimum?: number;
        // In some circustances, it can be different compared to 1
        TradableQuantityMultiple?: number;
        BaseFlagIconUrl?: string;
        QuoteFlagIconUrl?: string;
        Category?: SymbolCategoryEnum;
        DataBridgeId?: number;
    }

    export interface AccountTradingSymbolMultiReqMsg {
        RequestId?: number;
        AccountId?: number;
        Symbols?: TradingSymbolParamReqMsg[];
    }

    export interface TradingSymbolParamReqMsg {
        // Symbol of which the id must be returned. E.g.: /ESZ22.XCME
        // The symbol root is the same of market data
        FeedSymbol?: string;
        // If "FeedSymbol" is setted, this field is ignored by the server
        ContractId?: number;
    }

    export interface AccountTradingSymbolMultiRespMsg {
        RequestId?: number;
        Success?: boolean;
        Reason?: string;
        Infos?: AccountTradingSymbolInfoMsg[];
    }

    export interface AccountTradingSymbolInfoReqMsg {
        RequestId?: number;
        AccountId?: number;
        // Symbol of which the id must be returned. E.g.: /ESZ22.XCME
        // The symbol root is the same of market data
        FeedSymbol?: string;
        // If "FeedSymbol" is setted, this field is ignored by the server
        ContractId?: number;
    }

    export interface AccountTradingSymbolInfoRespMsg {
        RequestId?: number;
        Success?: boolean;
        Reason?: string;
        Info?: AccountTradingSymbolInfoMsg;
    }

    export interface AccountTradingSymbolInfoMsg {
        AccountId?: number;
        SymbolId?: number;
        Commissions?: number;
        Margin?: number;
        Leverage?: number;
        SpreadType?: SymbolSpreadTypeEnum;
        SpreadTickValue?: number;
        // default is 1.
        // On crypto, since the minimum tradable volume is under 1, can be different.
        // Example: 10 means that it is possible to buy/sell 1 / 10 of contract (0.1), 100 is 1 / 100 (0.01) and so on
        TradableQuantityFractionable?: number;
        TradableQuantityMultiplier?: number;
        QuoteCurrency?: string;
        // optional - filled only on forex symbol
        BaseCurrency?: string;
        ContractId?: number;
        FeedSymbol?: string;
    }

    export interface DailyPlReqMsg {
        ContractId?: number;
        AccNumber?: number;
        RequestId?: number;
    }

    export interface DailyPlRespMsg {
        ContractId?: number;
        AccNumber?: number;
        DailyPl?: number;
        FeedSymbol?: string;
        // it is -1 for snapshot message, while it is the same of DailyPlReqMsg for daily pl request
        RequestId?: number;
        DailyNetPl?: number;
        // not used in this scenario
        Isin?: string;
        ConvertedDailyPl?: number;
        ConvertedDailyNetPl?: number;
    }

    export enum InfoModeEnum {
        // used to get trading account list(AccountHeaderMsg)
        Account = 1,
        // used to get a snapshot of the portfolio and pending orders. It will populates orderList field and you will also receive an initial snapshot of open positions as orders infos and then order update,
        // so it means that you have to build portfolio with the order udpates.
        // IMPORTANT: if account is on HEDGING mode, since it is not possible to track positions based on order executions, it must be requested also position info mode
        OrdAndPos = 2,
        // used to get position. It will populates PositionList field and in this scenario you may use this field to show portfolio, without updating it with the order executions
        Positions = 3,
        // used to get the trading symbol information for all accounts. Heavy call, so it should be AVOIDED. Please request just the requied one through AccountTradingSymbolInfoReq
        AccountTradingSymbols = 4,
    }
    export enum AccountModeEnum {
        EVALUATION = 0,
        SIM_FUNDED = 1,
        FUNDED = 2,
        LIVE = 3,
        TRIAL = 4,
        CONTEST = 5,
        TRAINING = 100
    }
    export enum AccountStatusEnum {
        ALL = -1,
        INITIALIZED = 0,
        ENABLED = 1,
        SUCCESS = 2,
        FAILED = 4,
        DISABLED = 8,
    }

    export enum AccountPermissionEnum {
        // Trading is enabled if the account is enabled
        Trading = 0,
        // Account is on readonly, so user cannot place trade. It is also flatten if any position is open
        ReadOnly = 1,
        // Account is paused by risk engine and it will be automatically enabled again (after session close or week close)
        RiskPause = 2,
        // Account is liquidate only
        LiquidateOnly = 3,
    }

    export interface InfoReqMsg {
        // ignored if 'Modes" field is populated
        Mode?: InfoModeEnum;
        RequestId?: number;
        // system connection only. For user, only active accounts are returned. -1 is ALL, othwerwise X_OR combination can be used
        AccountListFilterStatus?: AccountStatusEnum;
        // ignore if the socket is not using "IsManualAccountSubscribe"
        Accounts?: number[];
        // if it is needed more information on the same response
        Modes?: InfoModeEnum[];
    }

    export interface InfoRespMsg {
        AccountList?: AccountHeaderMsg[];
        OrderList?: OrderInfoMsg[];
        RequestId?: number;
        // It works different based on account mode:
        // Netting (default): one position received for each contract with PositionId setted to -1
        // Hedging: multiple and opposite positions received. In order to close it, it must be sent an explicit position close message with the position id
        PositionList?: PositionInfoMsg[];
        BracketList?: BracketInfoMsg[];
        AccountTradingSymbolList?: AccountTradingSymbolInfoMsg[];
    }

    export interface AccountHeaderMsg {
        // this field should be used on various message and it also identifies the account updates sent by the server
        accountNumber?: number;
        // header is only for user display purpose
        accountHeader?: string;
        // custom field which can be setted from the propfirm
        accountDescription?: string;
        // balance of the account
        Balance?: BalanceMsg;
        IsEnabled?: boolean;
        // more detailed status compared to 'IsTradingEnabled'
        Status?: AccountStatusEnum;
        IsTradingEnabled?: boolean;
        // as default and standard usage, accounts are on netting mode (normal future broker behaviour), so it means that
        // same account can only have one position per instrument. However on some scenario, they can also be setted to work on
        // netting mode, so where you can have multiple and opposite positions at the same time
        IsHedging?: boolean;
        // GUID account reference id for Admin API
        AccountReferenceId?: string;
        // trading global permission on the account, (it is not sent the user level permission)
        Permission?: AccountPermissionEnum;
        // currency of the account
        Currency?: string;
        Archived?: boolean;
        // User can edit and set an its own rule (AccountUserRiskRuleSetReqMsg) for the account
        UserRiskRuleEnabled?: boolean;
        // User can edit and execute a daily lockout (AccountDailyLockoutReqMsg) for the account
        UserDailyLockoutEnabled?: boolean;
        IsTradeCopierAllowed?: boolean;
        OrganizationId?: number;
        OrganizationName?: string;
        Mode: AccountModeEnum;
    }

    // If the socket is using "IsManualAccountSubscribe", all accounts are automatically subscribe, so this message is not needed.
    export interface AccountSubscribeReqMsg {
        RequestId?: number;
        Accounts?: number[];
    }

    export interface AccountSubscribeRespMsg {
        RequestId?: number;
        Success?: boolean;
        Reason?: string;
    }

    // IMPORTANT: Each order message can contain only a filled field. It cannot have setted for exemple both "OrderInsert" and "OrderRemove".
    // Use the list on the "ClientRequestMsg" if you want to submit multiple orders at once
    export interface OrderMsg {
        // Insert a new order
        OrderInsert?: OrderInsertMsg;
        // Remove an order
        OrderRemove?: OrderRemoveMsg;
        // Modify an order
        OrderModify?: OrderModifyMsg;
        // Attach or Replace a bracket/OCO strategy to a pending order.
        BracketStrategyInsert?: BracketStrageyInsertMsg;
        // Modify the price of an existing bracket
        BracketModify?: BracketModifyMsg;
        // Create an oco group of existing pending orders. Important: orders must not be linked to other OcoGroups/Order
        OcoGroupCreate?: OcoGroupCreateMsg;
        // Remove an oco group. Important: Orders linked in this oco group are NOT removed, they are just unlinked
        OcoGroupRemove?: OcoGroupRemoveMsg;
        // hedging account only - used to flat a specific position
        PositionFlatMsg?: PositionFlatMsg;
        // Attach a bracket to a pending order
        BracketInsert?: BracketInsertMsg;
        // Remove a bracket from a pending order
        BracketRemove?: BracketRemoveMsg;
    }

    export enum OrderTypeEnum {
        Market = 0,
        Limit = 1,
        Stop = 2,
        StopLimit = 3,
    }

    export enum OrderExpireEnum {
        Never = 1,
        TillDay = 2,
    }

    export enum RequestSourceEnum {
        // Backward compatibility
        Unknown = 0,
        // Order sourced by a manual user operation
        Manual = 1,
        // Order sourced by an automatic bot / trading system
        Automatic = 2,
        // Order sourced by a copy trading tool
        Copy = 3,
    }

    export enum OrderQuantityModeEnum {
        // Quantity defined on the order
        Fixed = 0,
        // All - quantity of the order is related the open portfolio quantity
        // Usefull if you want to put SL or TP linked to the portfolio, independently of the quantity
        All = 1,
        // Countervalue to buy / sell on the account currency
        AccountCountervalue = 2,
    }

    export interface OrderInsertMsg {
        // Contract id of the intrsument where the order should be placed
        ContractId?: number;
        // This id should be filled for tracking the order on realtime server updates. It has to be unique for each session
        // Default value is -1
        SeqClientId?: number;
        // Quantity of the order. Use negative numbers for sell orders
        Quantity?: number;
        // Limit price for limit orders, Trigger Price for Stop/Stop Limit orders
        Price?: number;
        // order type
        OrderType?: OrderTypeEnum;
        // account number
        AccNumber?: number;
        // Limit execution for stop limit orders
        LimitPrice?: number;
        // optional - stop and/or targets to be linked with the entry order
        BracketStrategy?: BracketStrategyParam;
        // Hedging only - position which the order has to close
        RefPositionId?: number;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
        // optional - usefull for stop all and take all
        QuantityMode?: OrderQuantityModeEnum;
    }

    export interface OrderModifyMsg {
        // Contract id of the intrument where the order should be placed
        ContractId?: number;
        // Orgin server id. It can be retrieved from "OrderInfoMsg" message
        OrgServerId?: number;
        // This id should be filled for tracking the order on realtime server updates. It has to be unique for each session
        // Default value is -1
        NewSeqClientId?: number;
        // All below fields are same as OrderInsertMsg
        // If brackets orders are linked, quantity can only decrease
        Quantity?: number;
        Price?: number;
        AccNumber?: number;
        LimitPrice?: number;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
    }

    export interface OrderRemoveMsg {
        // Orgin server id. It can be retrieved from "OrderInfoMsg" message
        OrgServerId?: number;
        AccNumber?: number;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
    }

    export interface BracketStrategyParam {
        Type?: BracketStrategyParam_TypeEnum;
        Stops?: BracketParam[];
        Targets?: BracketParam[];
        // N/A at the moment
        TrailingMode?: BracketStrategyParam_StopTrailingModeEnum;
        // N/A at the moment
        TrailingTicks?: number;
        // N/A at the moment
        TrailingMinOffsetTicks?: number;
    }

    // Static means that the insert price of the order is calculated based on the insert price of the parent order,
    // otherwise it will be based on the exeuction price
    export enum BracketStrategyParam_TypeEnum {
        STOP_AND_TARGET = 0,
        STOP_AND_TARGET_STATIC = 1,
        STOP = 2,
        STOP_STATIC = 3,
        TARGET = 4,
        TARGET_STATIC = 5,
    }

    export enum BracketStrategyParam_StopTrailingModeEnum {
        None = 0,
        Breakeven = 1,
        Trailing = 2,
    }

    export interface BracketParam {
        // Must be ABS value. The side is taken based the quantity of the parent order
        Quantity?: number;
        PriceMode?: BracketParam_PriceModeEnum;
        // required if PriceMode = Ticks, otherwise price param is used and required
        TicksOffset?: number;
        // required if PriceMode = Price or PriceMode = PriceOffset
        Price?: number;
    }

    export enum BracketParam_PriceModeEnum {
        Ticks = 0,
        Price = 1,
        // in this mode the price of the bracket is auto calculated based on this offset from entry order
        PriceOffset = 2,
    }

    export interface BracketStrageyInsertMsg {
        RequestId?: number;
        // Order id to which the strategy should be attached
        ParentOrderId?: number;
        BracketStrategy?: BracketStrategyParam;
        AccNumber?: number;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
        // if you want to replace an existing strategy already attached, set it to true
        IsReplace?: boolean;
    }

    export interface BracketInsertMsg {
        RequestId?: number;
        // Parent order id of which the bracket is attached
        ParentOrderId?: number;
        IsTarget?: boolean;
        BracketParam?: BracketParam;
        // This can be filled to track the bracket on realtime server updates. It has to be unique for each session
        // Default value is -1
        ClientId?: number;
        AccNumber?: number;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
    }

    export interface BracketModifyMsg {
        // Parent order id of which the bracket is attached
        ParentOrderId?: number;
        BracketId?: number;
        // Quantity is ingnored in this case. Quantity cannot be changed
        BracketParam?: BracketParam;
        // This can be filled to track the bracket on realtime server updates. It has to be unique for each session
        // Default value is -1
        ClientId?: number;
        AccNumber?: number;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
    }

    export interface BracketRemoveMsg {
        // Parent order id of which the bracket is attached
        ParentOrderId?: number;
        BracketId?: number;
        AccNumber?: number;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
    }

    export interface OcoGroupCreateMsg {
        RequestId?: number;
        AccNumber?: number;
        Type?: OcoGroupCreateMsg_GroupTypeEnum;
        // Orders' id of the linked orders
        OcoLinkedOrderIds?: number[];
        OrderPlace?: OcoGroupCreateMsg_OcoOrdersPlaceEnum;
        OrderInsert?: OrderInsertMsg[];
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
    }

    export enum OcoGroupCreateMsg_GroupTypeEnum {
        STOPS_LIMITS = 0,
        OPPOSITE_QTY = 1,
    }

    export enum OcoGroupCreateMsg_OcoOrdersPlaceEnum {
        // it must be populated the OcoLinkedOrderIds field
        EXISTING = 0,
        // it must be populated the OrderInsert field
        INSERT = 1,
    }

    export interface OcoGroupRemoveMsg {
        RequestId?: number;
        AccNumber?: number;
        OcoGroupId?: number;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
    }

    // response to OcoGroupCreateMsg or OcoGroupRemoveMsg
    export interface OcoGroupReportMsg {
        RequestId?: number;
        Success?: boolean;
        // if success, otherwise -1
        OcoGroupId?: number;
        // If success = false, here there is the reason
        Reason?: string;
    }

    export interface PositionFlatMsg {
        // Position server id. It can be retrieved from "PositionInfoMsg" message
        PositionId?: number;
        AccNumber?: number;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
    }

    export interface OrderInfoMsg {
        // Contract id of the intrument where the order has been placed
        ContractId?: number;
        // Orgin server id. It persists for the whole lifetime of the orders
        OrgServerId?: number;
        // Client id setted on OrderInsertMsg with the "SeqClientId" parameter
        OrgClientId?: number;
        // Sequence server id. It is the same the first time, but it changes on order modify
        SeqServerId?: number;
        // It is the same for the first status received, while it is equal to the id setted "OrderModifyMsg" with the "NewSeqClientId" parameter for order mdoify
        SeqClientId?: number;
        // Price of the order
        OrderPrice?: number;
        // Not null only for STOP LIMIT orders. It is the stop limit price
        OrderLimitPrice?: number;
        // Pending quantity of the order. Negative numbers mean that it is a sell order
        PendingQty?: number;
        // Filled quantity of the order. Negative numbers mean that it is a sell order
        FilledQty?: number;
        // Order type
        OrderType?: OrderTypeEnum;
        OrderState?: OrderInfoMsg_OrderStateEnum;
        // average price of last executed filled quantity
        AvgPrice?: number;
        SnapType?: OrderInfoMsg_SnapTypeEnum;
        // Account number
        AccNumber?: number;
        // It is setted for "Error" or "ErrorModify" status. It describes the reason of the error
        Reason?: string;
        FeedSymbol?: string;
        // Not used in this scenario
        Isin?: string;
        // Oco Group Id. Multiple order can have the same Oco Group Id. It can be usefull for get the linked orders
        OcoLinkedGroupId?: number;
        // Linked order to this order. It means for example that if this order is removed, every linked order is removed too
        OcoLinkedOrderIds?: number[];
        // The parent order from where this order has been generated
        OcoParentOrderId?: number;
        // Hedging only - order which the position is linked to (close order), othwerwise -1
        PositionLinkId?: number;
        IsGeneratedFromBracket?: boolean;
        // optional - usefull for stop all and take all
        QuantityMode?: OrderQuantityModeEnum;
        // UNIX milliseconds
        InsertUtc?: number;
        // UNIX milliseconds
        ExeuctionUtc?: number;
        // ip of the order used for submission
        Ip?: string;
        // information about the source of the order (platform for example)
        Source?: string;
        // ********************RESERVED FIELDS*************************
        OrgClientSessionId?: number;
        SeqClientSessionId?: number;
        IsValidationError?: boolean;
    }

    export enum OrderInfoMsg_OrderStateEnum {
        // Received for pending orders, modified orders, partial executed and fully executed orders
        Submitted = 0,
        // Order has been removed
        Canceled = 1,
        // An error occurs with the order. It is it received, it means that the order is not pending anymore
        Error = 2,
        // An error occur on the modify of the order. The order IS STILL pending at the old price and old quantities
        ErrorModify = 3,
    }

    export enum OrderInfoMsg_SnapTypeEnum {
        // Snapshot status of the order. Filled quantity in this case must not be included/added on the portfolio. Look the example for better clarity
        Historical = 1,
        // Realtime update
        RealTime = 2,
        // Portfolio snapshot
        HistPos = 3,
    }

    export interface BracketInfoMsg {
        // Contract id of the intrument where the order has been placed
        ContractId?: number;
        // Server order id of the order where this bracket is attached
        ParentOrderId?: number;
        // Multiple stops and/or targets have the same value. Usefull for rebuild linked brackets
        OcoGroupId?: number;
        // Bracket id. It persists for the whole lifetime of the bracket
        BracketId?: number;
        // It is the same for the first status received, while it is equal to the id setted "OrderModifyMsg" with the "NewSeqClientId" parameter for order mdoify
        SeqClientId?: number;
        // Price of the order
        Price?: number;
        // -1 if not used
        Ticks?: number;
        CalculatedPrice?: number;
        // Total original quantity of the bracket. Negative numbers mean that it is a sell bracket
        TotalQty?: number;
        // Resting quantity of the bracket. Negative numbers mean that it is a sell bracket
        ReleasedQty?: number;
        IsTarget?: boolean;
        BracketState?: BracketInfoMsg_BracketStateEnum;
        SnapType?: BracketInfoMsg_SnapTypeEnum;
        // Account number
        AccNumber?: number;
        // It is setted for "Error" status. It describes the reason of the error
        Reason?: string;
        FeedSymbol?: string;
        // Not used in this scenario
        Isin?: string;
        // ********************RESERVED FIELDS*************************
        ClientSessionId?: number;
        IsValidationError?: boolean;
    }

    export enum BracketInfoMsg_BracketStateEnum {
        // Bracket is waiting to be converted to an order
        Waiting = 0,
        // Bracket has been fully converted to an order. Rest quantity is always 0 in this case
        Submitted = 1,
        // Bracket has been removed. It means that the parent order has been cancelled
        Cancelled = 2,
        // Error. The modify requested for the broker has not been successfull
        Error = 3,
    }

    export enum BracketInfoMsg_SnapTypeEnum {
        // Snapshot status of the order. Filled quantity in this case must not be included/added on the portfolio. Look the example for better clarity
        Historical = 1,
        // Realtime update
        RealTime = 2,
    }

    export interface LogInfoMsg {
        Msg?: string;
        // it could be -1 if it is a generic message and it is not related to any account
        AccNumber?: number;
    }

    export interface PositionInfoMsg {
        // Contract id of the intrument where the order has been placed
        ContractId?: number;
        OpenQuantity?: number;
        OpenPrice?: number;
        MarginUsed?: number;
        DailyBought?: number;
        DailySold?: number;
        DailyPl?: number;
        HasOpenPl?: boolean;
        OpenPl?: number;
        DailyCommissions?: number;
        SnapType?: PositionInfoMsg_SnapTypeEnum;
        // Account number
        AccNumber?: number;
        FeedSymbol?: string;
        // Not used in this scenario
        Isin?: string;
        // it used only on hedging account mode, otherwise it is setted to -1
        PositionId?: number;
        // UNIX milliseconds of last execution which generates the position
        Utc?: number;
        ConvertedDailyPl?: number;
        ConvertedDailyCommissions?: number;
        ConvertedOpenPl?: number;
        // it used only on hedging account mode, otherwise it is setted to -1
        EntryOrderId?: number;
    }

    export enum PositionInfoMsg_SnapTypeEnum {
        // Snapshot status of the order. Filled quantity in this case must not be included/added on the portfolio. Look the example for better clarity
        Historical = 1,
        // Realtime update
        RealTime = 2,
    }

    // Balance update sent by the server for the user's accounts. It is sent at the begninng for a snapshot and then it is only sent when a trade is closed.
    export interface BalanceMsg {
        Balance?: number;
        AccNumber?: number;
        // it is always empty. It is not used for this situation
        Description?: string;
        // Currently margin used by opened positions/orders
        MarginUsed?: number;
        // Optional - if the challenge has a stop drawdown setted, this is the trigger balance, otherwise -1
        StopDrawdownOverall?: number;
        // Optional - if the challenge has a stop intraday drawdown setted, this is the trigger balance, otherwise -1
        StopDrawdownIntraday?: number;
        // Optional - if the challenge has a profit target, this is the trigger balance, otherwise -1
        ProfitTarget?: number;
        // Margin available
        MarginAvailable?: number;
        // Optional - if the challenge has a stop weekly drawdown setted, this is the trigger balance, otherwise -1
        StopDrawdownWeekly?: number;
        Equity?: number;
        DailyPl?: number;
        DailyNetPl?: number;
        // this field is not updated on message triggered by equity / open pnl update.
        Details?: BalanceDetailedMsg;
    }

    export interface BalanceDetailedMsg {
        // if there is no any risk param associated, this field is true, so it can be ingored the other fields.
        Empty?: boolean;
        // Optional - if the challenge has a stop drawdown setted, this is the trigger balance, otherwise -1
        StopDrawdownOverallValue?: number;
        // Optional - if the challenge has a stop intraday drawdown setted, this is the trigger balance, otherwise -1
        StopDrawdownIntradayValue?: number;
        // Optional - if the challenge has a profit target, this is the trigger balance, otherwise -1
        ProfitTargetValue?: number;
        // Optional - if the challenge has a stop weekly drawdown setted, this is the trigger balance, otherwise -1
        StopDrawdownWeeklyValue?: number;
        UserDrawdownDailyBalance?: number;
        UserDrawdownWeeklyBalance?: number;
        UserProfitDailyBalance?: number;
        UserProfitWeeklyBalance?: number;
        UserDrawdownDailyValue?: number;
        UserDrawdownWeeklyValue?: number;
        UserProfitDailyValue?: number;
        UserProfitWeeklyValue?: number;
        SessionsNumber?: number;
        SessionsNumberTarget?: number;
        StartBalance?: number;
    }

    export interface SymbolLookupReqMsg {
        RequestId?: number;
        // optional - may be also null
        Filter?: string;
    }

    export interface SymbolLookupRespMsg {
        RequestId?: number;
        Symbols?: SymbolLookupInfo[];
    }

    export interface SymbolLookupInfo {
        Symbol?: string;
        Description?: string;
        Exchange?: string;
        TickSize?: number;
        OrderCommission?: number;
        Category?: SymbolCategoryEnum;
        DataFeedProduct?: string;
        ContractId?: number;
        TradingInhibited?: boolean;
        // default is 1.
        // On crypto, since the minimum tradable volume is under 1, can be different.
        // Example: 10 means that it is possible to buy/sell 1 / 10 of contract (0.1), 100 is 1 / 100 (0.01) and so on
        // Furthermore, the volume of the quantity received for this contract are multiplied accorindgly and same for the order submission
        TradableQuantityFractionable?: number;
        // In some circustances, it can be different compared to the TradableQuantityFractionable
        TradableQuantityMinimum?: number;
    }

    export enum OrderPositionFilterEnum {
        ALL = 0,
        BUY = 1,
        SELL = 2,
        WINNER = 3,
        LOOSER = 4,
    }

    export interface CancelFlatReqMsg {
        RequestId?: number;
        AccNumber?: number;
        // if empty, it means that the action is taken on all the contracts for the account
        ContractsId?: number[];
        Action?: CancelFlatReqMsg_ActionEnum;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
        Filter?: OrderPositionFilterEnum;
        CancelExcludeOco?: boolean;
    }

    export enum CancelFlatReqMsg_ActionEnum {
        // Flat position, if any, opened
        FLAT = 0,
        // Cancel all orders
        CANCEL = 1,
        // Cancel orders and flat positions
        FLAT_CANCEL = 2,
    }

    export interface CancelFlatRespMsg {
        RequestId?: number;
        AccNumber?: number;
        // if empty, all request has been correclty executed
        Errors?: CancelFlatErrorDetail[];
        Items?: CancelFlatItemDetail[];
    }

    export interface CancelFlatItemDetail {
        IsPosition?: boolean;
        FeedSymbol?: string;
        ContractId?: number;
        // if it is not on hedging, it is setted -1
        PositionId?: number;
        // ***********ORDER***************
        OrderId?: number;
    }

    export interface CancelFlatErrorDetail {
        ContractId?: number;
        Error?: string;
    }

    export interface CancelReverseReqMsg {
        RequestId?: number;
        AccNumber?: number;
        ContractId?: number;
        Action?: CancelFlatReqMsg_ActionEnum;
        // required field if it is possible, it helps for analysis and debug / diagnostic
        Source?: RequestSourceEnum;
    }

    export enum CancelReverseReqMsg_ActionEnum {
        // Reverse position, if any, opened
        REVERSE = 0,
        // Cancel all orders
        CANCEL = 1,
        // Cancel orders and reverse position
        REVERSE_CANCEL = 2,
    }

    export interface CancelReverseRespMsg {
        RequestId?: number;
        Success?: boolean;
        Error?: string;
    }

    export interface BracketInsertReportMsg {
        // Request id sent to the server from client
        RequestId?: number;
        Success?: boolean;
        // If success = false, here there is the reason
        Reason?: string;
    }

    export enum EntityActionEnum {
        SNAPSHOT = 0,
        // New account has been created
        ADD = 1,
        // account status update
        UPDATE = 2,
        // Account has been removed
        REMOVE = 3,
    }

    export interface AccountStatusUpdateMsg {
        AccountId?: number;
        Action?: EntityActionEnum;
        Info?: AccountHeaderMsg;
    }

    export interface FillReportMsg {
        AccountId?: number;
        FillId?: number;
        ContractId?: number;
        FeedSymbol?: string;
        // UNIX milliseconds
        Utc?: number;
        Price?: number;
        Quantity?: number;
        Commissions?: number;
        SourceOrderId?: number;
        SourceOrderIp?: string;
    }

    export interface TradeReportMsg {
        AccountId?: number;
        TradeId?: number;
        ContractId?: number;
        FeedSymbol?: string;
        Quantity?: number;
        // UNIX milliseconds
        EntryUtc?: number;
        // UNIX milliseconds
        ExitUtc?: number;
        OpenPrice?: number;
        ClosePrice?: number;
        GrossPL?: number;
        Commissions?: number;
        // In some situation, the trade pnl could not be accounted due to the trading rule
        Unaccounted?: boolean;
        Flags?: TradeReportMsg_Flag[];
    }

    export enum TradeReportMsg_Flag {
        SCALP = 1,
        CLOSED_TOO_CLOSE_TO_ENTRY = 2,
        TRADING_NEWS = 4,
    }

    export interface FillTradeReportMsg {
        FillType?: FillTradeReportMsg_FillTradeTypeEnum;
        AccountId?: number;
        PositionId?: number;
        OrderId?: number;
        ContractId?: number;
        FeedSymbol?: string;
        Quantity?: number;
        // UNIX milliseconds
        EntryUtc?: number;
        // UNIX milliseconds
        ExitUtc?: number;
        OpenPrice?: number;
        ClosePrice?: number;
        ConvertedGrossPL?: number;
        ConvertedCommissions?: number;
    }

    export enum FillTradeReportMsg_FillTradeTypeEnum {
        // fill to open a new position
        OPEN = 0,
        // fill to close an existing position
        CLOSE = 1,
    }

    export interface UserSessionLogMsg {
        SessionId?: string;
        UserId?: string;
        // UNIX milliseconds
        StartUtc?: number;
        // UNIX milliseconds, -1 if session is still open
        EndUtc?: number;
        Ip?: string;
        Source?: string;
        ClientSessionId?: number;
    }

    export enum SubscribeModeEnum {
        // it just request the current snapshot
        SNAPSHOT = 0,
        // it is sent a snapshot and it is also subscribed to the updates
        SUBSCRIBE = 1,
        // it is unsubscribed
        UNSUBSCRIBE = 2,
    }

    export interface CurrencyRatesReqMsg {
        Mode?: SubscribeModeEnum;
    }

    export interface CurrencyRateInfoMsg {
        BaseCurrency?: string;
        QuoteCurrency?: string;
        Rate?: number;
        DataBridgeId?: number;
    }

    export enum LoginReasonsCodeEnum {
        CREDENTIALS = 0,
        CONCURRENT_SESSION = 1,
        UNEXPECTED_ERROR = 2,
    }

    export enum RiskUserLossModeEnum {
        TrailingMaxBalance = 0,
        StaticStartBalance = 1,
        TrailingMaxEquity = 2,
        StaticStartEquity = 3,
        StaticMininmumStartEquityBalance = 4,
    }

    export enum RiskUserTargetModeEnum {
        Balance = 0,
        Equity = 1,
    }

    export interface AccountUserRiskRule {
        AccountId?: number;
        IsScheduled?: boolean;
        SetAsDefaultForAccountTradingRule?: boolean;
        InhibitChangesUntilNextSession?: boolean;
        DailyLossLimitEnabled?: boolean;
        DailyLossLimitMode?: RiskUserLossModeEnum;
        // -1 if it is not setted
        DailyLossLimitValue?: number;
        // -1 if it is not setted
        DailyLossLimitPercentage?: number;
        DailyProfitLimitEnabled?: boolean;
        DailyProfitLimitMode?: RiskUserTargetModeEnum;
        // -1 if it is not setted
        DailyProfitLimitValue?: number;
        // -1 if it is not setted
        DailyProfitLimitPercentage?: number;
        WeeklyLossLimitEnabled?: boolean;
        WeeklyLossLimitMode?: RiskUserLossModeEnum;
        // -1 if it is not setted
        WeeklyLossLimitValue?: number;
        // -1 if it is not setted
        WeeklyLossLimitPercentage?: number;
        WeeklyProfitLimitEnabled?: boolean;
        WeeklyProfitLimitMode?: RiskUserTargetModeEnum;
        // -1 if it is not setted
        WeeklyProfitLimitValue?: number;
        // -1 if it is not setted
        WeeklyProfitLimitPercentage?: number;
    }

    export interface AccountUserRiskRuleInfoReqMsg {
        RequestId?: number;
        AccountId?: number;
    }

    export interface AccountUserRiskRuleInfoRespMsg {
        RequestId?: number;
        Success?: boolean;
        Error?: string;
        Rule?: AccountUserRiskRule;
    }

    export interface AccountUserRiskRuleSetReqMsg {
        RequestId?: number;
        Rule?: AccountUserRiskRule;
    }

    export interface AccountUserRiskRuleSetRespMsg {
        RequestId?: number;
        Success?: boolean;
        Errors?: string[];
    }

    export interface AccountDailyLockoutReqMsg {
        RequestId?: number;
        AccountId?: number;
    }

    export interface AccountDailyLockoutRespMsg {
        RequestId?: number;
        Success?: boolean;
        Error?: string;
    }

    export enum AccountHistoricalEntityEnum {
        All = 0,
        Orders = 1,
        Trades = 2,
        Fills = 3,
        FillTrades = 4,
    }

    export interface AccountHistoricalSessionReqMsg {
        RequestId?: number;
        // optional - if it is not setted, it means that all the accounts are requested
        AccountIds?: number[];
        // optional - if it is not setted, it means that all the entities are requested
        Entity?: AccountHistoricalEntityEnum;
    }

    export interface AccountHistoricalSessionRespMsg {
        RequestId?: number;
        Fills?: FillReportMsg[];
        Trades?: TradeReportMsg[];
        Orders?: OrderInfoMsg[];
        FillTrades?: FillTradeReportMsg[];
        // if true, it means that it is not returned the full respone yet
        IsPartial?: boolean;
    }
    // The ONLY message that can be sent to the trading server
    export interface ClientRequestMsg {
        // Login with the provided token
        LoginReq?: LoginRequestMsg;
        // ping message to send to the server. A ping message should be sent each 45 seconds
        Ping?: PingMsg;
        // Request of account list and orders/positions snapshot
        InfoReq?: InfoReqMsg;
        // Contract id request
        ContractReq?: ContractReqMsg;
        // Request of daily pl for instruments
        DailyPls?: DailyPlReqMsg[];
        // order submission: Insert, Modify, Remove
        Order?: OrderMsg[];
        // message sent from client to the server for logging reason - it is not used on this scenario
        LogMsg?: LogInfoMsg;
        // request of available tradable symbols. It always return the front month contract and the next contract if the expirations is closer
        SymbolLookup?: SymbolLookupReqMsg;
        // request for cancel orders or flat a positions for a specific contract or all account
        CancelFlatReq?: CancelFlatReqMsg;
        // used only if "IsManualAccountSubscribe" = true, othwerwise all accounts are automatically subscribed.
        // IMPORTANT: in order to keep consistency, please request it together with InfoReqMsg
        AccountSubscribeReq?: AccountSubscribeReqMsg;
        // request for cancel orders or reverse a positions for a specific contract
        CancelReverseReq?: CancelReverseReqMsg;
        // request for currency rates - usefull on FX / Crypto to calculate the PnL
        CurrenyRatesReq?: CurrencyRatesReqMsg;
        // request for symbol trading info (spread, margin, commissions) for a specific account and symbol
        AccountTradingSymbolInfoReq?: AccountTradingSymbolInfoReqMsg;
        // if available, it returns the user risk rule for the account
        AccountUserRiskRuleInfoReq?: AccountUserRiskRuleInfoReqMsg;
        // if available, it sets the user risk rule parameters for the account
        AccountUserRiskRuleSetReq?: AccountUserRiskRuleSetReqMsg;
        // if available, it requests the daily lockout for the account
        AccountDailyLockoutReq?: AccountDailyLockoutReqMsg;
        // request for historical session data (order, fills and trades)
        AccountHistoricalSessionReq?: AccountHistoricalSessionReqMsg;
        // Multiple Contract ids requests
        ContractsReqs?: ContractRequestWrapperMsg;
        // request for multiple symbol trading info (spread, margin, commissions) for a specific account
        AccountTradingSymbolMultiReq?: AccountTradingSymbolMultiReqMsg;
    }

    // Message received by the server
    export interface ServerResponseMsg {
        // Login response
        LoginMsg?: LoginResponseMsg;
        // Pong response to Ping msg. The PONG should be received within about 5 seconds
        Pong?: PongMsg;
        // Response to snapshot request
        InfoMsg?: InfoRespMsg;
        // updates for accounts' balance
        BalanceInfo?: BalanceMsg[];
        // response for contract request
        ContractMsg?: ContractRespMsg;
        // response for daily pl requested or it is sent for daily pl snapshot on OrdAndPos info request msg
        DailyPls?: DailyPlRespMsg[];
        // realtime update for orders' status
        OrderInfo?: OrderInfoMsg[];
        // server close for current session
        LoggedOff?: LoggedOffMsg;
        // message from server that should be shown to the user
        LogMsg?: LogInfoMsg;
        // response to symbol lookup request
        SymbolLookup?: SymbolLookupRespMsg;
        // realtime update for positions
        PositionInfo?: PositionInfoMsg[];
        // response to CancelFlatReq
        CancelFlatMsg?: CancelFlatRespMsg;
        // realtime update for brackets' status
        BracketInfo?: BracketInfoMsg[];
        // response to BracketInsert Request
        BracketStrategyInsertReport?: BracketInsertReportMsg;
        // response to Account subscribe request
        AccountSubscribeResp?: AccountSubscribeRespMsg;
        // realtime updates on new accounts or status changed
        AccountStatusUpdates?: AccountStatusUpdateMsg[];
        // response to OcoGroupCreateMsg or OcoGroupRemoveMsg
        OcoGroupReport?: OcoGroupReportMsg;
        // it should be used only report/metrics
        FillReports?: FillReportMsg[];
        // it should be used only report/metrics
        TradeReports?: TradeReportMsg[];
        // it should be used only report/metrics
        FillTradeReports?: FillTradeReportMsg[];
        // response to CancelReverseReqMsg
        CancelReverseMsg?: CancelReverseRespMsg;
        // system user - notification of new user session
        UserSessionLogs?: UserSessionLogMsg[];
        // realtime update for account trading symbol info
        AccountTradingSymbolInfoUpdate?: AccountTradingSymbolInfoMsg[];
        // response to currency rates request and updates if subscribed
        CurrencyRates?: CurrencyRateInfoMsg[];
        // response to AccountTradingSymbolInfoReq
        AccountTradingSymbolInfoResp?: AccountTradingSymbolInfoRespMsg;
        // response to AccountUserRiskRuleInfoReq
        AccountUserRiskRuleInfoResp?: AccountUserRiskRuleInfoRespMsg;
        // response to AccountUserRiskRuleSetReq
        AccountUserRiskRuleSetResp?: AccountUserRiskRuleSetRespMsg;
        // response to AccountDailyLockoutReq
        AccountDailyLockoutResp?: AccountDailyLockoutRespMsg;
        // response to AccountHistoricalSessionReq
        AccountHistoricalSessionResp?: AccountHistoricalSessionRespMsg;
        // response to ContractsReqs
        ContractsResps?: ContractResponseWrapperMsg;
        // response to AccountTradingSymbolMultiReqMsg
        AccountTradingSymbolMultiResp?: AccountTradingSymbolMultiRespMsg;
    }

    export enum AccountSubscriptionModeEnum {
        // we just keep this for backward compatibility
        Undefined = 0,
        // all accounts must be manually subcribed to be received through the InfoReqMsg
        Manual = 1,
        // accounts must to be subscribed through the InfoReqMsg, but it is not necessary
        // to specify the list of the accounts, since all user's accounts are automatically returned and subscribed
        Existing = 2,
        // as above, but it is also sent the new accounts of the user through AccountStatusUpdateMsg.
        // This mode must be used in order to show new accounts on the terminal without the need of a new login / restart
        ExistingAndNew = 3,
    }

    export interface LoginRequestMsg {
        // token retrieved from auth post request
        Token?: string;
        // it is not used for this scenario
        OtpCode?: string;
        // default is false. It is used on system connection for selective accounts load/subscribe
        // (obsolete) - use AccountSubscriptionMode instead
        IsManualAccountSubscribe?: boolean;
        // default is false, so if there is a concurrent session, it is dropped
        KeepConcurrentSessionOn?: boolean;
        AccountSubscriptionMode?: AccountSubscriptionModeEnum;
    }

    export interface LoginResponseMsg {
        Success?: boolean;
        // Empty if success = true
        Reason?: string;
        ReasonCode?: LoginReasonsCodeEnum;
        Version?: number;
    }

    export interface LoggedOffMsg {
        // Reason why the session has been closed. E.g.: concurrent session opened
        Reason?: string;
    }
}
  