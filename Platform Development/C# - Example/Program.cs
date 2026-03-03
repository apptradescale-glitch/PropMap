using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using RestSharp;

namespace PropTradingExample
{
    class Program
    {
        const string AUTH_URL = "https://authdxfeed.volumetricatrading.com/api/auth/token";
        const string AUTH_PLATFORM_KEY = "PLATFORM_SECRET_KEY";
        const bool CONNECT_ONLY_TRADING = false;

        //each user has its own username and password. Please for test purpose, replace it with the credential provided with the docs
        const string TEST_USERNAME = "test@dxdemo.com"; 
        const string TEST_PASSWORD = "testpsw";

        const string TEST_SYMBOL = "/ESZ25:XCME";

        static WebSocketSharp.WebSocket tradingWssClient;
        static ManualResetEvent loginSemaphore;
        static string loginMsg;
        static bool loginResponse;

        enum GettingTypeEnum { Accounts, OrdAndPos}
        static GettingTypeEnum gettingSnapType;
        static ManualResetEvent snapshotSemaphore;

        static Dictionary<long, Models.AccountHandle> accountHndDict;

        static long cumNegSymbID = -1;
        static long gettingContractId;
        static string gettingContracSymbName;
        static ManualResetEvent contractSemaphore;
        static Dictionary<string, long> symbToPropContrID;
        static Dictionary<long, string> propContrIdToSymb;

        static ManualResetEvent orderSentSemaphore;
        static long sentClientId = 0;
        static long sentServerIdReceived = -1;
        static void Main(string[] args)
        {
            try
            {
                RestSharp.RestClient restClient = new RestSharp.RestClient();
                RestSharp.RestRequest restReq = new RestSharp.RestRequest(AUTH_URL, RestSharp.Method.Post);
                restReq.AddHeader("PltfKey", AUTH_PLATFORM_KEY);

                Models.LoginInfoClass loginReq = new Models.LoginInfoClass()
                {
                    login = TEST_USERNAME,
                    password = TEST_PASSWORD,
                    environment = 1,
                    withDetails = true,
                    connectOnlyTrading = CONNECT_ONLY_TRADING
                };
                restReq.AddJsonBody(loginReq);
                var respResp = restClient.Execute<Models.LoginResponseClass>(restReq);

                bool connectionSuccessfully = false;

                string token = null; //this token must be used both on the dxFeed Data Api in order to get the market data and also for the trading API
                string tradingHostWss = null;
                if (respResp.StatusCode == System.Net.HttpStatusCode.OK)
                {
                    if (respResp.Data.status != "OK")
                        throw new Exception($"Login failed: " + respResp.Data.reason);
                    else
                    {
                        connectionSuccessfully = true;
                        token = respResp.Data.token;
                        tradingHostWss = respResp.Headers.Where(x => x.Name.ToLower() == "wss").Select(x => x.Value).FirstOrDefault().ToString();
                    }
                }
                else if (respResp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    throw new Exception($"Login failed: " + respResp.Content);

                if (!connectionSuccessfully)
                    return;

                //example of token usage for market data API. DX_DATA_URL must be appropriately setted based if we are on staging or production 
                //com.dxfeed.native.NativeConnection dxDataConn = new com.dxfeed.native.NativeConnection(DX_DATA_URL, token, null, null);
                //market data API can be managed as always, so we skip market data exemple and we will only see the trading API


                loginSemaphore = new ManualResetEvent(false);
                cumNegSymbID = -1;
                contractSemaphore = new ManualResetEvent(false);
                symbToPropContrID = new Dictionary<string, long>();
                propContrIdToSymb = new Dictionary<long, string>();
                accountHndDict = new Dictionary<long, Models.AccountHandle>();
                orderSentSemaphore = new ManualResetEvent(false);
                
                //connecting to web socket at the uri provided in the first POST call
                tradingWssClient = new WebSocketSharp.WebSocket(tradingHostWss);
                tradingWssClient.OnMessage += TradingWssClient_OnMessage;
                tradingWssClient.OnClose += TradingWssClient_OnClose;

                tradingWssClient.Connect();
                
                //once the trading connection is opened, the FIRST thing to do is to send the following message with the token got on the first POST call
                SendMessageToTradingServer(new PropTradingProtocol.ClientRequestMsg
                {
                    LoginReq = new PropTradingProtocol.LoginRequestMsg
                    {
                        Token = token
                    }
                });
                if (!loginSemaphore.WaitOne(30000))
                    throw new Exception("Connection timeout. Check credential or connection");
                else if (!loginResponse)
                    throw new Exception(loginMsg);

                //we need to get the initial snapshot once logged in
                GetAccountsAndOrdersSnapshot();

                //once the snapshot has been received, we can start submitting orders
                InsertOrder(accountHndDict.Keys.First(), GetContractId(TEST_SYMBOL), 1, PropTradingProtocol.OrderTypeEnum.Limit, 1, 3900);
                //waiting for order callback received in order to have server id
                orderSentSemaphore.WaitOne();
                //removing the order just inserted
                RemoveOrder(accountHndDict.Keys.First(), sentServerIdReceived);
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex.Message);
            }

            Console.ReadLine();
        }
        private static void GetAccountsAndOrdersSnapshot()
        {
            snapshotSemaphore = new ManualResetEvent(false);
            
            //getting trading acconut list
            var newMsg = new PropTradingProtocol.ClientRequestMsg();
            newMsg.InfoReq = new PropTradingProtocol.InfoReqMsg()
            {
                Mode = PropTradingProtocol.InfoModeEnum.Account
            };
            gettingSnapType = GettingTypeEnum.Accounts;
            SendMessageToTradingServer(newMsg);
            snapshotSemaphore.WaitOne();

            snapshotSemaphore.Reset();
            //getting open positions and pending orders for the trading accounts
            gettingSnapType = GettingTypeEnum.OrdAndPos;
            newMsg.InfoReq.Mode = PropTradingProtocol.InfoModeEnum.OrdAndPos;
            SendMessageToTradingServer(newMsg);
            snapshotSemaphore.WaitOne();
        }
        /// <summary>
        /// Since orders must be sent using the contract id, we use this method in order to retrieve it
        /// </summary>
        /// <param name="feedSymbol">dxFeed symbol root</param>
        /// <returns></returns>
        private static long GetContractId(string feedSymbol)
        {
            if (!symbToPropContrID.TryGetValue(feedSymbol, out var propContrId))
            {
                contractSemaphore.Reset();
                gettingContractId = -1;
                gettingContracSymbName = feedSymbol;
                PropTradingProtocol.ClientRequestMsg clientMsg = new PropTradingProtocol.ClientRequestMsg()
                {
                    ContractReq = new PropTradingProtocol.ContractReqMsg
                    {
                        FeedSymbol = feedSymbol
                    }
                };
                SendMessageToTradingServer(clientMsg);
                
                contractSemaphore.WaitOne();
                if (gettingContractId == -1)
                {
                    //symbol not found
                    symbToPropContrID[feedSymbol] = cumNegSymbID--;
                }
                else
                {
                    //symbol found so we store the contract id
                    symbToPropContrID[feedSymbol] = gettingContractId;
                }

                return symbToPropContrID[feedSymbol];
            }
            else
            {
                return propContrId;
            }
        }
        private static void SendMessageToTradingServer(PropTradingProtocol.ClientRequestMsg msg)
        {
            try
            {
                byte[] serverMessageRaw;
                using (var memoryStream = new System.IO.MemoryStream())
                {
                    ProtoBuf.Serializer.Serialize(memoryStream, msg);
                    serverMessageRaw = memoryStream.ToArray();
                }
                tradingWssClient.Send(serverMessageRaw);
            }
            catch (System.Exception ex)
            {
                throw new Exception("Message sending error " + ex.Message);
            }
        }
        private static void TradingWssClient_OnClose(object sender, WebSocketSharp.CloseEventArgs e)
        {
            Console.WriteLine("Connection closed");
        }

        private static void TradingWssClient_OnMessage(object sender, WebSocketSharp.MessageEventArgs e)
        {
            using (var mem = new System.IO.MemoryStream(e.RawData))
            {
                var serverResponse = new PropTradingProtocol.ServerResponseMsg();
                serverResponse = ProtoBuf.Serializer.Deserialize<PropTradingProtocol.ServerResponseMsg>(mem);

                if(serverResponse.LoginMsg != null)
                {
                    //login response
                    if (!serverResponse.LoginMsg.Success)
                        loginMsg = serverResponse.LoginMsg.Reason; //login failed, so we get the reason
                    else
                        loginResponse = true; //login success
                    loginSemaphore.Set();
                }
                //contract id got back from the request
                if (serverResponse.ContractMsg != null)
                {
                    if (gettingContracSymbName == serverResponse.ContractMsg.FeedSymbol)
                    {
                        gettingContractId = (int)serverResponse.ContractMsg.ContractId;
                        contractSemaphore.Set();
                    }
                }
                //message received for an initial snapshot of existing accounts, orders and positions
                if (serverResponse.InfoMsg != null)
                {
                    if(gettingSnapType == GettingTypeEnum.Accounts)
                    {
                        //receving account list associated to the user
                        foreach(var currAcc in serverResponse.InfoMsg.AccountLists)
                        {
                            Console.WriteLine($"Adding trading acconut {currAcc.accountHeader} with number: {currAcc.accountNumber}");
                            accountHndDict.Add(currAcc.accountNumber, new Models.AccountHandle(currAcc.accountHeader, currAcc.accountNumber));
                        }
                        snapshotSemaphore.Set();
                    }
                    else if(gettingSnapType == GettingTypeEnum.OrdAndPos)
                    {
                        //getting order and positions snapshot
                        foreach(var currOrd in serverResponse.InfoMsg.OrderLists)
                            if(currOrd.SnapType == PropTradingProtocol.OrderInfoMsg.SnapTypeEnum.HistPos)
                            {
                                //IMPORTANT: this message is only returned for the initial request in order to get the current portfolio, then it must be updated with the order status received in the real time
                                ElaborateHistPosition(currOrd);
                            }
                            else
                            {
                                //Order initial snapshots. IMPORTANT: you may receive in this list order with a filled quantity different from 0, but that quantites have already been added on the historical position,
                                //so you don't have use them to update the portfolio. They are only sent for partial executed pending orders and they are sent in order that you know how many quantity of the order
                                //has already been executed
                                ElaborateOrderStatus(currOrd);
                            } 
                        snapshotSemaphore.Set();
                    }
                }
                //realtime updates for orders
                if (serverResponse.OrderInfoes.Count > 0)
                    for (int indOrd = 0; indOrd < serverResponse.OrderInfoes.Count; indOrd++)
                        ElaborateOrderStatus(serverResponse.OrderInfoes[indOrd]);
                if(serverResponse.LoggedOff != null)
                {
                    Console.WriteLine("Disconnection. Reason: " + serverResponse.LoggedOff.Reason);
                }
            }
        }
        private static void StoreContractId(long propContrId, string feedSymbol)
        {
            if (!symbToPropContrID.TryGetValue(feedSymbol, out var retItem))
            {
                symbToPropContrID[feedSymbol] = propContrId;
                retItem = propContrId;
                propContrIdToSymb[propContrId] = feedSymbol;
            }
        }
        private static void ElaborateHistPosition(PropTradingProtocol.OrderInfoMsg currPos)
        {
            long contractId = currPos.ContractId;
            string symbol = currPos.FeedSymbol;

            //we store the symbol associated to the contract id for future usage
            StoreContractId(contractId, symbol);
            
            var accHnd = accountHndDict[currPos.AccNumber];
            var posHnd = accHnd.GetPositionForContract(contractId);

            //updating portfolio
            posHnd.Update(currPos.FilledQty, currPos.AvgPrice);
        }
        private static void ElaborateOrderStatus(PropTradingProtocol.OrderInfoMsg newStatus)
        {
            long contractId = newStatus.ContractId;
            string symbol = newStatus.FeedSymbol;
            StoreContractId(contractId, symbol);

            var accHnd = accountHndDict[newStatus.AccNumber];

            //order is is unique for ACCOUNT, so the tuple is (AccountNumber, OrderId)
            if (!accHnd.OrderDict.TryGetValue(newStatus.OrgServerId, out var ordHnd))
            {
                ordHnd = new Models.OrderHandle(newStatus.OrgServerId, newStatus.OrgClientId, newStatus.SeqServerId, newStatus.SeqClientId, newStatus.OrderPrice, newStatus.PendingQty);
                accHnd.OrderDict.Add(ordHnd.OrginServerId, ordHnd);
            }
            else if(ordHnd.SeqServerId != ordHnd.SeqServerId) //sequence id has changed, so it means that order has been modified. Quantity or price has changed
                ordHnd.OrderModified(newStatus.SeqServerId, newStatus.SeqClientId, newStatus.OrderPrice, newStatus.PendingQty);

            bool haveToRemove = false;
            switch (newStatus.OrderState)
            {
                case PropTradingProtocol.OrderInfoMsg.OrderStateEnum.Submitted:
                    //status received for submitted or modified order
                    break;
                case PropTradingProtocol.OrderInfoMsg.OrderStateEnum.Canceled:
                    //order cancelled
                    haveToRemove = true;
                    break;
                case PropTradingProtocol.OrderInfoMsg.OrderStateEnum.Error:
                    //error for the order. It means that the order IS NOT PENDING anymore
                    haveToRemove = true;
                    break;
                case PropTradingProtocol.OrderInfoMsg.OrderStateEnum.ErrorModify:
                    //error on order modification. Order IS STILL present but at the old price and old quantity
                    break;
            }
            if(newStatus.OrderState == PropTradingProtocol.OrderInfoMsg.OrderStateEnum.Submitted)
            {
                //we store the filled quantity and we get the difference with the previous status received in order to understnad how many quantities has been executed
                int newFillQty = ordHnd.GetNewFilledQuantity(newStatus.FilledQty); 
                if (newStatus.SnapType == PropTradingProtocol.OrderInfoMsg.SnapTypeEnum.RealTime && newFillQty != 0)
                {
                    //IMPORTANT: we update the porfolio only for realime stauts because snapshot status has already been recieved through the historical position
                    var posHnd = accHnd.GetPositionForContract(newStatus.ContractId);
                    posHnd.Update(newFillQty, newStatus.AvgPrice);
                }
            }
            if (haveToRemove)
                accHnd.OrderDict.Remove(ordHnd.OrginServerId);

            //we should also check the status, but we skip it on this example
            if (sentClientId == newStatus.SeqClientId)
            {
                sentServerIdReceived = newStatus.OrgServerId;
                orderSentSemaphore.Set();
            }
        }
        /// <summary>
        /// Insert of new order
        /// </summary>
        /// <param name="accountNumber"></param>
        /// <param name="contractId"></param>
        /// <param name="clientOrderId">Client id that will be returned back on the status' updates in order to track the order. Each order must have an unique client id inside the same session</param>
        /// <param name="ordType">Order type(Market, Limit, Stop, StopLimit)</param>
        /// <param name="quantity">Quantity of the order. Negative numbers must be used for sell orders</param>
        /// <param name="price">Limit price for limit orders, while it is trigger price for stop/stop limit order</param>
        /// <param name="limitPrice">Stop limit price execution</param>
        private static void InsertOrder(long accountNumber, long contractId, int clientOrderId, PropTradingProtocol.OrderTypeEnum ordType, int quantity, double price, double limitPrice = 0)
        {
            if (contractId >= 0)
            {
                PropTradingProtocol.OrderInsertMsg newOrd = new PropTradingProtocol.OrderInsertMsg();
                newOrd.AccNumber = accountNumber;
                newOrd.ContractId = contractId;
                newOrd.SeqClientId = clientOrderId;
                newOrd.OrderType = ordType;
                newOrd.Quantity = quantity;
                newOrd.Price = price;

                var reqMsg = new PropTradingProtocol.ClientRequestMsg();
                reqMsg.Orders.Add(new PropTradingProtocol.OrderMsg
                {
                    OrderInsert = newOrd
                });

                Console.WriteLine("Inserting new order");

                sentClientId = clientOrderId;
                orderSentSemaphore.Reset();
                SendMessageToTradingServer(reqMsg);
            }
            else
            {
                Console.WriteLine("Order error. Symbol not found");
            }
        }
        /// <summary>
        /// Modify of an existing order
        /// </summary>
        /// <param name="accountNumber"></param>
        /// <param name="contractId"></param>
        /// <param name="orginServerId">Orgin server id received via realtime status updates</param>
        /// <param name="newSeqClientId">New client id to associate with the modify in order to track the order</param>
        /// <param name="quantity">New quantity of the order</param>
        /// <param name="price"></param>
        /// <param name="limitPrice"></param>
        private static void ModifyOrder(long accountNumber, long contractId, long orginServerId, int newSeqClientId, int quantity, double price, double limitPrice = 0)
        {
            PropTradingProtocol.OrderModifyMsg modOrd = new PropTradingProtocol.OrderModifyMsg();
            modOrd.OrgServerId = orginServerId;
            modOrd.AccNumber = accountNumber;
            modOrd.ContractId = contractId;
            modOrd.NewSeqClientId = newSeqClientId;
            modOrd.Quantity = quantity;
            modOrd.Price = price;
            modOrd.LimitPrice = limitPrice;

            var reqMsg = new PropTradingProtocol.ClientRequestMsg();
            reqMsg.Orders.Add(new PropTradingProtocol.OrderMsg
            {
                OrderModify = modOrd
            });
            SendMessageToTradingServer(reqMsg);
        }
        /// <summary>
        /// Remove an order
        /// </summary>
        /// <param name="accountNumber"></param>
        /// <param name="orginServerID">Orgin server id of the order to remove</param>
        private static void RemoveOrder(long accountNumber, long orginServerID)
        {
            PropTradingProtocol.OrderRemoveMsg cancOrd = new PropTradingProtocol.OrderRemoveMsg();
            cancOrd.AccNumber = accountHndDict.Keys.First();
            cancOrd.OrgServerId = orginServerID;

            var reqMsg = new PropTradingProtocol.ClientRequestMsg();
            reqMsg.Orders.Add(new PropTradingProtocol.OrderMsg
            {
                OrderRemove = cancOrd
            });
            SendMessageToTradingServer(reqMsg);
        }

    }
}
