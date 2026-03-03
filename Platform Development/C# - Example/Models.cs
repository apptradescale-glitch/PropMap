using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace PropTradingExample.Models
{
    public class LoginInfoClass
    {
        /**********************SAME FOR DATAFEED**********************/
        public string login { get; set; }
        public string password { get; set; }
        public bool withDetails { get; set; }
        /**********************ADDED FIELDS**********************/
        /// <summary>
        /// Current api version. Now it is v3
        /// </summary>
        public int version { get; set; } = 3;
        /// <summary>
        /// 0 - Production
        /// 1 - Staging
        /// </summary>
        public int environment { get; set; }
        /// <summary>
        /// False - for connecting both datafeed and trading
        /// True - connection only to trading API
        /// 
        /// As you know, a user can open only one concurrent session with market data, while he can opens till 5 session with trading only
        /// </summary>
        public bool connectOnlyTrading { get; set; }
    }
    /// <summary>
    /// Same response provided by get.dxfeed.com services
    /// </summary>
    public class LoginResponseClass
    {
        public string status { get; set; }
        public string reason { get; set; }
        public string token { get; set; }
        public List<string> details { get; set; }
    }
    public class AccountHandle
    {
        public string Header { get; private set; }
        public long AccNumber { get; private set; }

        public Dictionary<long, OrderHandle> OrderDict;
        public Dictionary<long, PositionHandle> Portfolio;
        public AccountHandle(string p_Header, long p_Number)
        {
            Header = p_Header;
            AccNumber = p_Number;
            OrderDict = new Dictionary<long, OrderHandle>();
        }
        public PositionHandle GetPositionForContract(long contractId)
        {
            if(!Portfolio.TryGetValue(contractId, out var posHnd))
            {
                posHnd = new PositionHandle(contractId);
                Portfolio.Add(contractId, posHnd);
            }
            return posHnd;
        }
    }
    public class PositionHandle
    {
        public long ContractId { get; private set; }
        public int Quantity { get; private set; } 
        public double Price { get; private set; } 
        public PositionHandle(long p_ContractId)
        {
            ContractId = p_ContractId;
        }
        public void Update(int filledQty, double filledPrice)
        {
            int remQty = filledQty;
            if(Quantity != 0 && (filledQty > 0 != Quantity > 0))
            {
                if (Quantity > 0)
                {
                    int closedQty = -Math.Min(Quantity, -filledQty);
                    remQty -= closedQty;
                    Quantity += closedQty;
                }
                else
                {
                    int closedQty = -Math.Max(Quantity, -filledQty);
                    remQty -= closedQty;
                    Quantity += closedQty;
                }
                if (Quantity == 0)
                    Price = 0;
            }
            if(remQty != 0)
            {
                Price = (Quantity * Price) + (filledPrice * remQty) / (Quantity + remQty);
                Quantity += remQty;
            }
        }
    }
    public class OrderHandle
    {
        /// <summary>
        /// The server id for the order. It persists for the whole life of the order.
        /// </summary>
        public long OrginServerId { get; private set; }
        /// <summary>
        /// The client id for the order sent when submitting the order. If it is a snapshot or the order has not been sent from the client, it is equal to -1
        /// </summary>
        public long OrginClientId { get; private set; }
        /// <summary>
        /// Server id for the sequence. It is equal to the orgin id at the beggning, but it changes if the order has been modified
        /// </summary>
        public long SeqServerId { get; private set; }
        /// <summary>
        /// Client id for the sequence server id if any, otherwise -1
        /// </summary>
        public long SeqClientId { get; private set; }
        public double Price { get; private set; }
        public int PendingQuantity { get; private set; }
        public int FilledQuantity { get; private set; }
        public OrderHandle(long p_OrgServerId, long p_OrgClientId, long p_SeqServerId, long p_SeqClientId, double p_Price, int p_PendingQty)
        {
            OrginServerId = p_OrgServerId;
            OrginClientId = p_OrgClientId;
            SeqServerId = p_SeqServerId;
            SeqClientId = p_SeqClientId;
            Price = p_Price;
            PendingQuantity = p_PendingQty;
        }
        public void OrderModified(long p_NewServerId, long p_NewClientId, double p_NewPrice, int p_NewPendingQty)
        {
            SeqServerId = p_NewServerId;
            SeqClientId = p_NewClientId;
            Price = p_NewPrice;
            PendingQuantity = p_NewPendingQty;
        }
        public int GetNewFilledQuantity(int p_FilledQty)
        {
            int diffQty = p_FilledQty - FilledQuantity;
            FilledQuantity = p_FilledQty;
            return diffQty;
        }
    }
}
