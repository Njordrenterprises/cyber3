export interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string[];
  redirectUri: string;
}

export interface OAuthState {
  provider: string;
  codeVerifier: string;
  redirectUrl: string;
  createdAt: Date;
}

export interface OAuthSession {
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  email: string;
  name: string;
}

function createProvider(
  name: string,
  authUrl: string,
  tokenUrl: string,
  userInfoUrl: string,
  scope: string[],
): OAuthProvider {
  const clientId = Deno.env.get(`${name.toUpperCase()}_CLIENT_ID`) || '';
  const clientSecret = Deno.env.get(`${name.toUpperCase()}_CLIENT_SECRET`) || '';
  const appUrl = Deno.env.get('APP_URL');
  
  return {
    name,
    clientId,
    clientSecret,
    authUrl,
    tokenUrl,
    userInfoUrl,
    scope,
    redirectUri: `${appUrl}/auth/callback/${name}`
  };
}

// Create providers after environment variables are loaded
let GoogleProvider: OAuthProvider;
let GitHubProvider: OAuthProvider;
let TwitterProvider: OAuthProvider;

export function initializeProviders() {
  GoogleProvider = createProvider(
    'google',
    'https://accounts.google.com/o/oauth2/v2/auth',
    'https://oauth2.googleapis.com/token',
    'https://www.googleapis.com/oauth2/v2/userinfo',
    ['email', 'profile']
  );

  GitHubProvider = createProvider(
    'github',
    'https://github.com/login/oauth/authorize',
    'https://github.com/login/oauth/access_token',
    'https://api.github.com/user',
    ['user:email']
  );

  TwitterProvider = createProvider(
    'twitter',
    'https://twitter.com/i/oauth2/authorize',
    'https://api.twitter.com/2/oauth2/token',
    'https://api.twitter.com/2/users/me',
    ['tweet.read', 'users.read']
  );

  return { GoogleProvider, GitHubProvider, TwitterProvider };
}

export { GoogleProvider, GitHubProvider, TwitterProvider }; 