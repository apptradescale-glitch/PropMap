import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import '../src/config/firebase-admin';

const db = getFirestore();

// ✅ Get TopstepX credentials from Firestore
async function getProjectXCreds(userId: string): Promise<{ userName: string; apiKey: string } | null> {
  try {
    const credsDocId = `${userId}_topstepx_creds`;
    const snap = await db.collection('projectXCreds').doc(credsDocId).get();
    if (!snap.exists) {
      return null;
    }
    const data = snap.data() as any;
    const userName = data?.userName ? String(data.userName) : '';
    const apiKey = data?.apiKey ? String(data.apiKey) : '';
    if (userName && apiKey) return { userName, apiKey };
    return null;
  } catch {
    return null;
  }
}

// ✅ Call TopstepX loginKey API to get fresh token
async function loginKeyTopstepX(userName: string, apiKey: string): Promise<string> {
  const base = 'https://api.topstepx.com';
  const authUrl = `${base}/api/Auth/loginKey`;
  const resp = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'accept': 'text/plain' },
    body: JSON.stringify({ userName, apiKey }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`loginKey failed (${resp.status}): ${text}`);
  }

  // Parse response and extract token
  try {
    const data = JSON.parse(text);
    const accessToken = data.token || data.accessToken || data.jwt || '';
    if (!accessToken) {
      throw new Error(`loginKey returned no token: ${text.slice(0, 200)}`);
    }
    return accessToken;
  } catch {
    const accessToken = text.trim();
    if (!accessToken) {
      throw new Error('loginKey returned empty token');
    }
    return accessToken;
  }
}

// Get valid TopstepX token (24h lifetime, with automatic refresh)
async function getValidToken(userId: string, accountId: string) {
  try {
    const tokenDocId = `${userId}_topstepx_token`;
    const tokSnap = await db.collection('projectXTokens').doc(tokenDocId).get();
    
    if (!tokSnap.exists) {
      return null;
    }
    
    const tokenData = tokSnap.data();
    const { access_token, expires_at } = tokenData!;
    
    if (!access_token) {
      return null;
    }

    const now = Date.now();
    const bufferMs = 60 * 1000; // 60-second buffer (same as projectx.ts)
    
    // Check if token is still valid (proactive refresh with buffer)
    const needsRefresh = !access_token || (expires_at != null && (now + bufferMs) >= expires_at);
    
    if (!needsRefresh) {
      return access_token;
    }

    // ✅ Token expired or expiring soon - try to refresh (same logic as projectx.ts)
    try {
      const creds = await getProjectXCreds(userId);
      if (!creds) {
        // No credentials stored, can't refresh
        await db.collection('projectXTokens').doc(tokenDocId).update({
          needs_reauth: true,
          last_error: 'Token expired and no credentials found to refresh'
        });
        return null;
      }

      // Get fresh token from TopstepX API
      const refreshedToken = await loginKeyTopstepX(creds.userName, creds.apiKey);
      const newExpiresAt = now + 24 * 60 * 60 * 1000;

      // Save new token to Firestore (same as projectx.ts)
      await db.collection('projectXTokens').doc(tokenDocId).set({
        userId,
        provider: 'TopstepX',
        access_token: refreshedToken,
        created_at: now,
        expires_at: newExpiresAt,
        // Scrub legacy secrets (same as projectx.ts)
        userName: admin.firestore.FieldValue.delete(),
        apiKey: admin.firestore.FieldValue.delete(),
      }, { merge: true });

      return refreshedToken;
    } catch (refreshError) {
      // Refresh failed, mark as needing reauth
      await db.collection('projectXTokens').doc(tokenDocId).update({
        needs_reauth: true,
        last_error: `Token refresh failed: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`
      });
      return null;
    }
    
  } catch {
    return null;
  }
}

// Map Tradovate order type strings to TopstepX integers
function mapOrderType(tradovateType: string): number {
  const typeMap: Record<string, number> = {
    'Limit': 1,
    'Market': 2,
    'Stop': 4,
    'StopLimit': 1, // TopstepX uses Limit with stopPrice for StopLimit
    'TrailingStop': 5,
    'JoinBid': 6,
    'JoinAsk': 7
  };
  return typeMap[tradovateType] || 2; // Default to Market
}

// Map Tradovate action strings to TopstepX side integers
function mapSide(tradovateAction: string): number {
  // TopstepX: 0 = Buy (Bid), 1 = Sell (Ask)
  return tradovateAction === 'Buy' ? 0 : 1;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, userId, accountId } = req.body;
    
    if (!userId || !accountId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing userId or accountId' });
    }

    // ✅ AUTH: Validate Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Missing or invalid auth token' });
    }

    const token = authHeader.substring(7);
    let authenticatedUserId: string;
    let decodedToken: any;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      authenticatedUserId = decodedToken.uid;
    } catch (error) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ error: 'Invalid or expired auth token' });
    }

    // ✅ VERIFY USER OWNERSHIP
    if (userId !== authenticatedUserId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ error: 'Unauthorized: userId does not match authenticated user' });
    }

    // ✅ VERIFY ACTIVE SUBSCRIPTION (Trade Copier is premium)
    const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map((uid: string) => uid.trim()).filter(Boolean);
    const isAdmin = decodedToken?.admin === true || ADMIN_UIDS.includes(authenticatedUserId);

    if (!isAdmin) {
      try {
        const subscriptionDoc = await db.collection('subscriptions').doc(authenticatedUserId).get();
        const subscription = subscriptionDoc.data();

        if (!subscription?.hasSubscription || 
            subscription?.subscriptionStatus !== 'complete' || 
            subscription?.paymentStatus !== 'paid') {
          res.setHeader('Content-Type', 'application/json');
          return res.status(403).json({ 
            error: 'Active subscription required to access this feature',
            requiresSubscription: true,
            source: 'subscription'
          });
        }

        // ✅ VERIFY TRADE COPIER ACCESS
        const hasTradecopierAccess = ['pro', 'proplus'].includes(subscription?.subscriptionType);
        if (!hasTradecopierAccess) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(403).json({ 
            error: 'Trade Copier subscription required. Please upgrade your plan.',
            requiresSubscription: true,
            currentPlan: subscription?.subscriptionType
          });
        }
      } catch {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: 'Failed to verify subscription status' });
      }
    }
    
    // Get valid TopstepX token
    const access_token = await getValidToken(userId, accountId);
    if (!access_token) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ 
        error: 'No valid TopstepX token',
        accountId: accountId,
        details: 'Token expired or missing. Please reconnect TopstepX account.'
      });
    }

    // Handle different actions
    switch (action) {
      case 'getContract':
        return await handleGetContract(req, res, access_token);
      case 'placeOrder':
        return await handlePlaceOrder(req, res, access_token);
      case 'cancelOrder':
        return await handleCancelOrder(req, res, access_token);
      case 'modifyOrder':
        return await handleModifyOrder(req, res, access_token);
      case 'flattenAllPositions':
        return await handleFlattenAllPositions(req, res, access_token);
      default:
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Invalid action' });
    }
    
  } catch (err: any) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      error: 'Server error', 
      details: err.message
    });
  }
}

type JsonOrText =
  | { isJson: true; data: any; text: string }
  | { isJson: false; data: null; text: string };

async function readJsonOrText(resp: Response): Promise<JsonOrText> {
  const text = await resp.text();
  try {
    return { isJson: true, data: JSON.parse(text), text };
  } catch {
    return { isJson: false, data: null, text };
  }
}

// ✅ Flatten: cancel all open orders + close all open positions
async function handleFlattenAllPositions(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { accountId } = req.body;
  if (!accountId) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing accountId' });
  }

  const acct = parseInt(String(accountId), 10);
  if (!Number.isFinite(acct)) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Invalid accountId' });
  }

  const base = 'https://api.topstepx.com';
  const headers = {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json',
    accept: 'application/json'
  };

  // 1) Cancel open orders
  const canceledOrders: any[] = [];
  const failedCancellations: any[] = [];
  try {
    const searchOpenOrdersRes = await fetch(`${base}/api/Order/searchOpen`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId: acct })
    });

    const parsed = await readJsonOrText(searchOpenOrdersRes);
    if (!searchOpenOrdersRes.ok || !parsed.isJson || parsed.data?.success === false) {
      failedCancellations.push({
        step: 'searchOpenOrders',
        status: searchOpenOrdersRes.status,
        response: parsed.isJson ? parsed.data : parsed.text
      });
    } else {
      const orders = Array.isArray(parsed.data?.orders) ? parsed.data.orders : [];
      const cancellations = await Promise.allSettled(
        orders.map(async (o: any) => {
          const orderId = o?.id;
          if (orderId === undefined || orderId === null) {
            throw new Error('Missing order id');
          }
          const cancelRes = await fetch(`${base}/api/Order/cancel`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ accountId: acct, orderId: Number(orderId) })
          });
          const cancelParsed = await readJsonOrText(cancelRes);
          if (!cancelRes.ok || !cancelParsed.isJson || cancelParsed.data?.success === false) {
            throw new Error(`Cancel failed: ${cancelParsed.isJson ? JSON.stringify(cancelParsed.data) : cancelParsed.text}`);
          }
          return { orderId: Number(orderId) };
        })
      );

      for (const r of cancellations) {
        if (r.status === 'fulfilled') {
          canceledOrders.push(r.value);
        } else {
          failedCancellations.push({ step: 'cancelOrder', error: String(r.reason) });
        }
      }
    }
  } catch (e: any) {
    failedCancellations.push({ step: 'cancelOpenOrders', error: e?.message || String(e) });
  }

  // 2) Close open positions
  const closedPositions: any[] = [];
  const failedClosures: any[] = [];
  try {
    const searchOpenPosRes = await fetch(`${base}/api/Position/searchOpen`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accountId: acct })
    });

    const parsed = await readJsonOrText(searchOpenPosRes);
    if (!searchOpenPosRes.ok || !parsed.isJson || parsed.data?.success === false) {
      failedClosures.push({
        step: 'searchOpenPositions',
        status: searchOpenPosRes.status,
        response: parsed.isJson ? parsed.data : parsed.text
      });
    } else {
      const positions = Array.isArray(parsed.data?.positions) ? parsed.data.positions : [];
      const closings = await Promise.allSettled(
        positions.map(async (p: any) => {
          const contractId = p?.contractId;
          if (!contractId) {
            throw new Error('Missing contractId');
          }
          const closeRes = await fetch(`${base}/api/Position/closeContract`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ accountId: acct, contractId: String(contractId) })
          });
          const closeParsed = await readJsonOrText(closeRes);
          if (!closeRes.ok || !closeParsed.isJson || closeParsed.data?.success === false) {
            throw new Error(`Close failed: ${closeParsed.isJson ? JSON.stringify(closeParsed.data) : closeParsed.text}`);
          }
          return { contractId: String(contractId) };
        })
      );

      for (const r of closings) {
        if (r.status === 'fulfilled') {
          closedPositions.push(r.value);
        } else {
          failedClosures.push({ step: 'closeContract', error: String(r.reason) });
        }
      }
    }
  } catch (e: any) {
    failedClosures.push({ step: 'closeOpenPositions', error: e?.message || String(e) });
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    success: failedCancellations.length === 0 && failedClosures.length === 0,
    cancelResult: {
      canceledOrders,
      failedCancellations
    },
    closeResult: {
      closedPositions,
      failedClosures
    }
  });
}

// ✅ Get contract information by symbol or ID
async function handleGetContract(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { symbol, contractId } = req.body;
  
  if (!symbol && !contractId) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing symbol or contractId' });
  }

  try {
    const base = 'https://api.topstepx.com';
    
    // If contractId provided, search by ID (TopstepX format: CON.F.US.ENQ.H25)
    if (contractId) {
      const contractRes = await fetch(`${base}/api/Contract/searchById`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({ contractId })
      });
      
      if (contractRes.ok) {
        const data = await contractRes.json();
        // Response format: { contract: {...}, success: true, errorCode: 0, errorMessage: null }
        if (data.success && data.contract) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).json(data.contract);
        }
      }
    }
    
    // Otherwise search by symbol using the search endpoint (same as market data server)
    if (symbol) {
      // Extract root symbol (e.g., "MESH6" -> "MES", "ENQ" -> "ENQ")
      // Tradovate uses symbols like "MESH6", TopstepX uses "F.US.MES"
      const root = symbol.replace(/\d+$/, ''); // Remove trailing numbers (H6, U5, etc.)
      const queries = [root]; // Just use the root symbol
      
      for (const searchText of queries) {
        for (const live of [true, false]) {
          try {
            const contractRes = await fetch(`${base}/api/Contract/search`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
              },
              body: JSON.stringify({ live, searchText })
            });
            
            if (contractRes.ok) {
              const data = await contractRes.json();
              // Response format: { contracts: [...], success: true, errorCode: 0, errorMessage: null }
              
              if (data.success && Array.isArray(data.contracts)) {
                const contracts = data.contracts;
                
                if (contracts.length > 0) {
                  // Find best match: active contract with matching symbolId
                  const pick = 
                    contracts.find((c: any) => c.activeContract && c.symbolId?.includes(root)) ||
                    contracts.find((c: any) => c.activeContract) ||
                    contracts[0]; // Fallback to first result
                  
                  if (pick?.id) {
                    res.setHeader('Content-Type', 'application/json');
                    return res.status(200).json(pick);
                  }
                }
              }
            } else {
              await contractRes.text();
            }
          } catch {
          }
        }
      }
      
      // Fallback: try available contracts endpoint
      for (const live of [true, false]) {
        try {
          const availRes = await fetch(`${base}/api/Contract/available`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json',
              'accept': 'application/json'
            },
            body: JSON.stringify({ live })
          });
          
          if (availRes.ok) {
            const data = await availRes.json();
            // Response format: { contracts: [...], success: true, errorCode: 0, errorMessage: null }
            
            if (data.success && Array.isArray(data.contracts)) {
              const contracts = data.contracts;
              
              // Find contract with matching symbolId
              const pick =
                contracts.find((c: any) => c.activeContract && c.symbolId?.includes(root)) ||
                contracts.find((c: any) => c.activeContract && c.name?.includes(root)) ||
                contracts.find((c: any) => c.symbolId?.includes(root)) ||
                null;
              
              if (pick?.id) {
                res.setHeader('Content-Type', 'application/json');
                return res.status(200).json(pick);
              }
            }
          }
        } catch {
        }
      }
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(404).json({ error: 'Contract not found', symbol, contractId });
    
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Error fetching contract info', 
      details: error.message
    });
  }
}

// ✅ Place order on TopstepX
async function handlePlaceOrder(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { accountId, orderPayload } = req.body;
  
  if (!orderPayload) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing orderPayload' });
  }

  try {
    // Transform Tradovate order payload to TopstepX format
    const topstepXPayload: any = {
      accountId: parseInt(accountId),
      contractId: orderPayload.topstepXContractId || orderPayload.contractId, // Must be TopstepX contract ID
      type: mapOrderType(orderPayload.orderType),
      side: mapSide(orderPayload.action),
      size: orderPayload.orderQty || orderPayload.size || 1
    };

    // Add price fields based on order type
    if (orderPayload.orderType === 'Limit' && orderPayload.price) {
      topstepXPayload.limitPrice = parseFloat(orderPayload.price);
    }
    
    if (orderPayload.orderType === 'Stop' && orderPayload.stopPrice) {
      topstepXPayload.stopPrice = parseFloat(orderPayload.stopPrice);
    }
    
    if (orderPayload.orderType === 'StopLimit') {
      if (orderPayload.stopPrice) topstepXPayload.stopPrice = parseFloat(orderPayload.stopPrice);
      if (orderPayload.price) topstepXPayload.limitPrice = parseFloat(orderPayload.price);
    }
    
    if (orderPayload.trailPrice) {
      topstepXPayload.trailPrice = parseFloat(orderPayload.trailPrice);
    }

    // Optional: Add custom tag for tracking
    topstepXPayload.customTag = `tradescale_${Date.now()}`;

    const base = 'https://api.topstepx.com';
    const orderRes = await fetch(`${base}/api/Order/place`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'accept': 'text/plain'
      },
      body: JSON.stringify(topstepXPayload)
    });

    if (orderRes.ok) {
      const orderResult = await orderRes.json();
      
      if (orderResult.success) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
          success: true,
          orderId: orderResult.orderId,
          id: orderResult.orderId // Compatibility with Tradovate response format
        });
      } else {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ 
          error: 'Order placement failed', 
          details: orderResult.errorMessage,
          errorCode: orderResult.errorCode
        });
      }
    } else {
      const errorText = await orderRes.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(orderRes.status).json({ 
        error: 'Failed to place order', 
        details: errorText 
      });
    }
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Error placing order', 
      details: error.message 
    });
  }
}

// ✅ Cancel order on TopstepX
async function handleCancelOrder(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { accountId, orderId } = req.body;
  
  if (!orderId) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing orderId' });
  }

  try {
    const base = 'https://api.topstepx.com';
    const cancelRes = await fetch(`${base}/api/Order/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'accept': 'text/plain'
      },
      body: JSON.stringify({
        accountId: parseInt(accountId),
        orderId: parseInt(orderId)
      })
    });

    if (cancelRes.ok) {
      const cancelResult = await cancelRes.json();
      
      if (cancelResult.success) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
          success: true,
          orderId
        });
      } else {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ 
          error: 'Order cancellation failed', 
          orderId,
          details: cancelResult.errorMessage,
          errorCode: cancelResult.errorCode
        });
      }
    } else {
      const errorText = await cancelRes.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(cancelRes.status).json({ 
        error: 'Failed to cancel order', 
        orderId,
        details: errorText 
      });
    }
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Error canceling order', 
      orderId,
      details: error.message 
    });
  }
}

// ✅ Modify order on TopstepX
async function handleModifyOrder(req: NextApiRequest, res: NextApiResponse, access_token: string) {
  const { accountId, orderId, modifyPayload } = req.body;
  
  if (!orderId || !modifyPayload) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Missing orderId or modifyPayload' });
  }

  try {
    // Build TopstepX modify payload
    const topstepXPayload: any = {
      accountId: parseInt(accountId),
      orderId: parseInt(orderId)
    };

    // Add fields that can be modified
    if (modifyPayload.size || modifyPayload.orderQty) {
      topstepXPayload.size = modifyPayload.size || modifyPayload.orderQty;
    }
    
    if (modifyPayload.price || modifyPayload.limitPrice) {
      topstepXPayload.limitPrice = parseFloat(modifyPayload.price || modifyPayload.limitPrice);
    }
    
    if (modifyPayload.stopPrice) {
      topstepXPayload.stopPrice = parseFloat(modifyPayload.stopPrice);
    }
    
    if (modifyPayload.trailPrice) {
      topstepXPayload.trailPrice = parseFloat(modifyPayload.trailPrice);
    }

    const base = 'https://api.topstepx.com';
    const modifyRes = await fetch(`${base}/api/Order/modify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'accept': 'text/plain'
      },
      body: JSON.stringify(topstepXPayload)
    });

    if (modifyRes.ok) {
      const modifyResult = await modifyRes.json();
      
      if (modifyResult.success) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
          success: true,
          orderId
        });
      } else {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ 
          error: 'Order modification failed', 
          orderId,
          details: modifyResult.errorMessage,
          errorCode: modifyResult.errorCode
        });
      }
    } else {
      const errorText = await modifyRes.text();
      res.setHeader('Content-Type', 'application/json');
      return res.status(modifyRes.status).json({ 
        error: 'Failed to modify order', 
        orderId,
        details: errorText 
      });
    }
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      error: 'Error modifying order', 
      orderId,
      details: error.message 
    });
  }
}
