// Database schema types
export interface UserSchema {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
}

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  description: string;
  startTime: Date;
  endTime: Date | null;
  duration?: number; // Calculated when entry is completed
  tags: string[];
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
      createdAt: new Date()
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

  // Project methods
  async createProject(name: string, description?: string): Promise<Project> {
    const project: Project = {
      id: crypto.randomUUID(),
      userId: this.userId,
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
      isArchived: false
    };

    await this.kv.set(['projects', this.userId, project.id], project);
    return project;
  }

  async updateProject(projectId: string, updates: { name?: string; description?: string }): Promise<Project> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const updatedProject: Project = {
      ...project,
      ...updates,
      updatedAt: new Date()
    };

    await this.kv.set(['projects', this.userId, projectId], updatedProject);
    return updatedProject;
  }

  async getProject(projectId: string): Promise<Project | null> {
    const result = await this.kv.get<Project>(['projects', this.userId, projectId]);
    return result.value;
  }

  async listProjects(includeArchived = false): Promise<Project[]> {
    const projects: Project[] = [];
    const iter = this.kv.list<Project>({ prefix: ['projects', this.userId] });
    
    for await (const { value } of iter) {
      if (includeArchived || !value.isArchived) {
        projects.push(value);
      }
    }

    return projects;
  }

  async archiveProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Project not found');

    project.isArchived = true;
    project.updatedAt = new Date();
    await this.kv.set(['projects', this.userId, projectId], project);
  }

  // Time entry methods
  async startTimeEntry(projectId: string, description: string): Promise<TimeEntry> {
    // Verify project exists
    const project = await this.getProject(projectId);
    if (!project) throw new Error('Project not found');

    const timeEntry: TimeEntry = {
      id: crypto.randomUUID(),
      userId: this.userId,
      projectId,
      description,
      startTime: new Date(),
      endTime: null,
      tags: []
    };

    await this.kv.atomic()
      .set(['users', this.userId, 'time-entries', timeEntry.id], timeEntry)
      .set(['users', this.userId, 'activeTimeEntries', projectId], timeEntry)
      .commit();

    return timeEntry;
  }

  async stopTimeEntry(projectId: string): Promise<TimeEntry> {
    const activeEntry = await this.getActiveTimeEntry(projectId);
    if (!activeEntry) {
      throw new Error('No active time entry found for this project');
    }

    const stoppedEntry: TimeEntry = {
      ...activeEntry,
      endTime: new Date()
    };

    // Save the completed entry and remove from active entries
    await this.kv.atomic()
      .set(['users', this.userId, 'time-entries', activeEntry.id], stoppedEntry)
      .delete(['users', this.userId, 'activeTimeEntries', projectId])
      .commit();

    return stoppedEntry;
  }

  async getActiveTimeEntry(projectId?: string): Promise<TimeEntry | null> {
    if (projectId) {
      const entry = await this.kv.get(['users', this.userId, 'activeTimeEntries', projectId]);
      return entry.value as TimeEntry | null;
    } else {
      const entries: TimeEntry[] = [];
      const iter = this.kv.list<TimeEntry>({ prefix: ['users', this.userId, 'activeTimeEntries'] });
      for await (const { value } of iter) {
        entries.push(value);
      }
      return entries.length > 0 ? entries[0] : null;
    }
  }

  async getActiveTimeEntries(): Promise<TimeEntry[]> {
    const entries: TimeEntry[] = [];
    const iter = this.kv.list<TimeEntry>({ prefix: ['users', this.userId, 'activeTimeEntries'] });
    for await (const { value } of iter) {
      entries.push(value);
    }
    return entries;
  }

  async getTimeEntries(options: {
    projectId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<TimeEntry[]> {
    const entries: TimeEntry[] = [];
    const iter = this.kv.list<TimeEntry>({ prefix: ['users', this.userId, 'time-entries'] });
    
    for await (const { value } of iter) {
      let include = true;

      // Filter by project
      if (options.projectId && value.projectId !== options.projectId) {
        include = false;
      }

      // Filter by date range
      if (options.startDate && new Date(value.startTime) < options.startDate) {
        include = false;
      }
      if (options.endDate && new Date(value.startTime) > options.endDate) {
        include = false;
      }

      if (include) {
        entries.push(value);
      }
    }

    // Sort by start time, newest first
    return entries.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  async getProjectSummary(projectId: string, startDate?: Date, endDate?: Date): Promise<{
    totalDuration: number;
    entryCount: number;
    entries: TimeEntry[];
  }> {
    const entries = await this.getTimeEntries({ projectId, startDate, endDate });
    
    let totalDuration = 0;
    for (const entry of entries) {
      if (entry.duration) {
        totalDuration += entry.duration;
      } else if (entry.endTime) {
        totalDuration += entry.endTime.getTime() - entry.startTime.getTime();
      }
    }

    return {
      totalDuration,
      entryCount: entries.length,
      entries
    };
  }

  // Add to UserKV class
  async getUser(): Promise<UserSchema> {
    const result = await this.kv.get<UserSchema>(['users', this.userId]);
    if (!result.value) {
      throw new Error('User not found');
    }
    return result.value;
  }

  async updateTimeEntry(entryId: string, updates: Partial<TimeEntry>): Promise<TimeEntry> {
    const entryKey = ['users', this.userId, 'time-entries', entryId];
    const entry = await this.kv.get<TimeEntry>(entryKey);
    
    if (!entry.value) {
      throw new Error('Time entry not found');
    }

    const updatedEntry: TimeEntry = {
      ...entry.value,
      ...updates
    };

    // If this is the active entry, update it there too
    const activeEntry = await this.getActiveTimeEntry();
    if (activeEntry && activeEntry.id === entryId) {
      await this.kv.set(['users', this.userId, 'activeTimeEntry'], updatedEntry);
    }

    await this.kv.set(entryKey, updatedEntry);
    return updatedEntry;
  }
}
