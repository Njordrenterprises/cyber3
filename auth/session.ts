export interface Session {
  id: string;
  userId: string;
  provider: string;
  createdAt: Date;
  expiresAt: Date;
}

export class SessionManager {
  private kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  async createSession(userId: string, provider: string): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      provider,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    await this.kv.set(
      ['sessions', session.id],
      session,
      { expireIn: 7 * 24 * 60 * 60 * 1000 }
    );

    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const result = await this.kv.get<Session>(['sessions', sessionId]);
    return result.value;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.kv.delete(['sessions', sessionId]);
  }
} 