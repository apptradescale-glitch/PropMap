import { openDB } from 'idb';

export interface Finance {
  id: string;
  type: 'earning' | 'expense';
  firm?: string;
  description?: string;
  amount: number;
  date: string;
}

export interface Account {
  id: string;
  firm: string;
  capital: string;
  type: string;
  balance: string;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  riskAmount: string;
  content: {
    title: string;
    details: string[];
    tables: {
      first: { headers: string[]; rows: string[][] };
      second: { headers: string[]; rows: string[][] };
      third: { headers: string[]; rows: string[][] };
    };
  };
}

const DB_NAME = 'tradescale-db';
const STORE_NAMES = {
  finances: 'finances',
  accounts: 'accounts',
  templates: 'templates'
} as const;

export const initDB = async () => {
  const db = await openDB(DB_NAME, 5, {
    upgrade(db, oldVersion, newVersion) {
      // Create or update finances store
      if (!db.objectStoreNames.contains(STORE_NAMES.finances)) {
        const financeStore = db.createObjectStore(STORE_NAMES.finances, { keyPath: 'id' });
        financeStore.createIndex('by-type', 'type');
        financeStore.createIndex('by-date', 'date');
      }

      // Create or update accounts store
      if (!db.objectStoreNames.contains(STORE_NAMES.accounts)) {
        const accountStore = db.createObjectStore(STORE_NAMES.accounts, { keyPath: 'id' });
        accountStore.createIndex('by-firm', 'firm');
      }

      // Create or update templates store
      if (!db.objectStoreNames.contains(STORE_NAMES.templates)) {
        const templateStore = db.createObjectStore(STORE_NAMES.templates, { keyPath: 'id' });
        templateStore.createIndex('by-title', 'title');
      }
    },
  });
  return db;
};

export const dbOperations = {
  // Finance operations
  async addFinance(finance: Omit<Finance, 'id' | 'date'>) {
    const db = await initDB();
    const newFinance = {
      ...finance,
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0]
    };
    await db.add(STORE_NAMES.finances, newFinance);
    return newFinance;
  },

  async getAllFinances() {
    const db = await initDB();
    return db.getAll(STORE_NAMES.finances);
  },

  async getTotalByType(type: 'earning' | 'expense') {
    const db = await initDB();
    const finances = await db.getAllFromIndex(STORE_NAMES.finances, 'by-type', type);
    return finances.reduce((sum, finance) => sum + finance.amount, 0);
  },

  // Account operations
  async addAccount(account: Omit<Account, 'id'>) {
    const db = await initDB();
    const newAccount = {
      ...account,
      id: crypto.randomUUID()
    };
    await db.add(STORE_NAMES.accounts, newAccount);
    return newAccount;
  },

  async updateAccount(id: string, data: Partial<Account>) {
    const db = await initDB();
    const existingAccount = await db.get(STORE_NAMES.accounts, id);
    
    // If account exists, update it
    if (existingAccount) {
      const updatedAccount = {
        ...existingAccount,
        ...data,
        id // Ensure we keep the original ID
      };
      await db.put(STORE_NAMES.accounts, updatedAccount);
      return updatedAccount;
    } 
    // If account doesn't exist, create new one
    else {
      const newAccount = {
        firm: '',
        capital: '',
        type: '',
        balance: '',
        ...data,
        id
      };
      await db.add(STORE_NAMES.accounts, newAccount);
      return newAccount;
    }
  },

  async getAllAccounts() {
    const db = await initDB();
    const accounts = await db.getAll(STORE_NAMES.accounts);
    
    // Ensure we always have at least 9 accounts
    if (accounts.length < 9) {
      const emptyAccounts = Array(9 - accounts.length).fill(null).map(() => ({
        id: crypto.randomUUID(),
        firm: '',
        capital: '',
        type: '',
        balance: ''
      }));
      
      // Add empty accounts to database
      await Promise.all(emptyAccounts.map(account => 
        db.add(STORE_NAMES.accounts, account)
      ));
      
      return [...accounts, ...emptyAccounts];
    }
    
    return accounts;
  },

 async deleteAccount(id: string) {
  const db = await initDB();
  await db.delete(STORE_NAMES.accounts, id);
  
  // Get remaining accounts after deletion
  const remainingAccounts = await this.getAllAccounts();
  
  // Ensure we maintain minimum 9 accounts
  if (remainingAccounts.length < 9) {
    const emptyAccount = {
      id: crypto.randomUUID(),
      firm: '',
      capital: '',
      type: '',
      balance: ''
    };
    await db.add(STORE_NAMES.accounts, emptyAccount);
  }
  },

  // Template operations
  async addTemplate(template: Omit<Template, 'id'>) {
    const db = await initDB();
    const newTemplate = {
      ...template,
      id: crypto.randomUUID()
    };
    await db.add(STORE_NAMES.templates, newTemplate);
    return newTemplate;
  },

  async updateTemplate(id: string, template: Partial<Template>) {
    const db = await initDB();
    const existingTemplate = await db.get(STORE_NAMES.templates, id);
    if (!existingTemplate) throw new Error('Template not found');
    
    const updatedTemplate = {
      ...existingTemplate,
      ...template
    };
    await db.put(STORE_NAMES.templates, updatedTemplate);
    return updatedTemplate;
  },

  async getAllTemplates() {
    const db = await initDB();
    return db.getAll(STORE_NAMES.templates);
  },

  async deleteTemplate(id: string) {
    const db = await initDB();
    await db.delete(STORE_NAMES.templates, id);
  }
};

export default dbOperations;