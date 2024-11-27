import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { OAuthProvider, OAuthState, OAuthSession } from './providers/mod.ts';

export class OAuth {
  private kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  private generateCodeVerifier(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return encodeBase64(bytes)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return encodeBase64(new Uint8Array(hash))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async createAuthRequest(provider: OAuthProvider, redirectUrl: string): Promise<string> {
    const state = crypto.randomUUID();
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store state in KV with expiration
    const oauthState: OAuthState = {
      provider: provider.name,
      codeVerifier,
      redirectUrl,
      createdAt: new Date()
    };

    await this.kv.set(
      ['oauth-states', state],
      oauthState,
      { expireIn: 600000 } // 10 minutes
    );

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: provider.scope.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return `${provider.authUrl}?${params.toString()}`;
  }

  async handleCallback(
    provider: OAuthProvider,
    code: string,
    state: string
  ): Promise<OAuthSession> {
    // Verify state and get stored data
    const storedState = await this.kv.get<OAuthState>(['oauth-states', state]);
    if (!storedState?.value) {
      throw new Error('Invalid state');
    }

    // Exchange code for tokens
    const params = new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: provider.redirectUri,
      code_verifier: storedState.value.codeVerifier,
      grant_type: 'authorization_code'
    });

    const tokenResponse = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: params.toString()
    });

    const tokens = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch(provider.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    });

    const userInfo = await userResponse.json();

    // Map provider-specific user info to common format
    let email = '';
    let name = '';

    switch (provider.name) {
      case 'google':
        email = userInfo.email;
        name = userInfo.name;
        break;
      case 'github':
        email = userInfo.email;
        name = userInfo.name || userInfo.login;
        break;
      case 'twitter':
        email = userInfo.data.email;
        name = userInfo.data.name;
        break;
    }

    // Create session
    const session: OAuthSession = {
      userId: userInfo.id,
      provider: provider.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      email,
      name
    };

    // Store session in KV
    await this.kv.set(
      ['sessions', session.userId],
      session,
      { expireIn: 604800000 } // 7 days
    );

    // Clean up state
    await this.kv.delete(['oauth-states', state]);

    return session;
  }
} 