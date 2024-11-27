// Database schema types
export interface UserSchema {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  databases: UserDatabase[];
}

export interface UserDatabase {
  id: string;
  name: string;
  createdAt: Date;
  schema: DatabaseSchema;
}

export interface DatabaseSchema {
  timeEntries: TimeEntry[];
  projects: Project[];
  clients: Client[];
  invoices: Invoice[];
  apiKeys: ApiKey[];
}

// Specific schema interfaces
export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  startTime: Date;
  endTime: Date;
  description: string;
  tags: string[];
  rate: number;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  rate: number;
  status: 'active' | 'archived';
}

export interface Client {
  id: string;
  name: string;
  email: string;
  billingInfo: BillingInfo;
}

export interface Invoice {
  id: string;
  clientId: string;
  timeEntries: string[]; // Array of timeEntry IDs
  amount: number;
  status: 'draft' | 'sent' | 'paid';
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: Date;
  lastUsed: Date;
  permissions: string[];
}

interface BillingInfo {
  address: string;
  paymentTerms: string;
  currency: string;
}

// KV Database class
export class UserKV {
  private kv: Deno.Kv;
  private userId: string;

  constructor(kv: Deno.Kv, userId: string) {
    this.kv = kv;
    this.userId = userId;
  }

  // Initialize a new user's database
  static async createUserDatabase(kv: Deno.Kv, user: Omit<UserSchema, 'databases'>): Promise<UserKV> {
    const userKey = ['users', user.id];
    const newUser: UserSchema = {
      ...user,
      databases: [{
        id: crypto.randomUUID(),
        name: 'default',
        createdAt: new Date(),
        schema: {
          timeEntries: [],
          projects: [],
          clients: [],
          invoices: [],
          apiKeys: []
        }
      }]
    };

    // Atomic operation to ensure user doesn't already exist
    const result = await kv.atomic()
      .check({ key: userKey, versionstamp: null })
      .set(userKey, newUser)
      .commit();

    if (!result.ok) {
      throw new Error('User already exists');
    }

    return new UserKV(kv, user.id);
  }

  // Time entries methods
  async addTimeEntry(entry: Omit<TimeEntry, 'id'>): Promise<TimeEntry> {
    const id = crypto.randomUUID();
    const timeEntry: TimeEntry = { ...entry, id };
    await this.kv.set(['users', this.userId, 'timeEntries', id], timeEntry);
    return timeEntry;
  }

  async getTimeEntries(): Promise<TimeEntry[]> {
    const entries = this.kv.list<TimeEntry>({ prefix: ['users', this.userId, 'timeEntries'] });
    const timeEntries: TimeEntry[] = [];
    for await (const entry of entries) {
      timeEntries.push(entry.value);
    }
    return timeEntries;
  }

  // Project methods
  async addProject(project: Omit<Project, 'id'>): Promise<Project> {
    const id = crypto.randomUUID();
    const newProject: Project = { ...project, id };
    await this.kv.set(['users', this.userId, 'projects', id], newProject);
    return newProject;
  }

  // Client methods
  async addClient(client: Omit<Client, 'id'>): Promise<Client> {
    const id = crypto.randomUUID();
    const newClient: Client = { ...client, id };
    await this.kv.set(['users', this.userId, 'clients', id], newClient);
    return newClient;
  }

  // API key methods
  async createApiKey(name: string, permissions: string[]): Promise<ApiKey> {
    const apiKey: ApiKey = {
      id: crypto.randomUUID(),
      name,
      key: crypto.randomUUID(),
      permissions,
      createdAt: new Date(),
      lastUsed: new Date()
    };
    await this.kv.set(['users', this.userId, 'apiKeys', apiKey.id], apiKey);
    return apiKey;
  }

  // Add to UserKV class
  async getUser(): Promise<UserSchema> {
    const result = await this.kv.get<UserSchema>(['users', this.userId]);
    if (!result.value) {
      throw new Error('User not found');
    }
    return result.value;
  }
}
