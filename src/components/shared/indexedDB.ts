import { auth } from '@/config/firebase';

export interface Trade {
  symbol: string
  pnl: number
  account: string
  date: string
  screenshot: String | null
  userId: string  // Add userId field
}

const DB_NAME = 'tradesDB'
const STORE_NAME = 'trades'
const DB_VERSION = 3  // Increment version to trigger upgrade

class TradeDB {
  private db: IDBDatabase | null = null

  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'date' })
          // Add index for userId
          store.createIndex('userId', 'userId', { unique: false })
        }
      }
    })
  }

  async getAllTrades(): Promise<Trade[]> {
    const currentUser = auth.currentUser
    if (!currentUser) throw new Error('No authenticated user')
    if (!this.db) await this.initDB()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        // Filter trades by current user
        const trades = request.result.filter(
          trade => trade.userId === currentUser.uid
        )
        resolve(trades)
      }
    })
  }

  async addTrade(trade: Omit<Trade, 'userId'>): Promise<void> {
    const currentUser = auth.currentUser
    if (!currentUser) throw new Error('No authenticated user')
    if (!this.db) await this.initDB()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      
      // Add userId to trade
      const tradeWithUser = {
        ...trade,
        userId: currentUser.uid
      }
      
      const request = store.add(tradeWithUser)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

// Create and export a single instance
const tradeDB = new TradeDB()
export { tradeDB }  // Named export