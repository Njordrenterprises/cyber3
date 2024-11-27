import { loadEnvironment } from './app/config/env.ts';

// Load environment variables before any other imports
await loadEnvironment();

// Now import and initialize providers
import { initializeProviders } from './auth/providers/mod.ts';
const { GoogleProvider, GitHubProvider, TwitterProvider } = initializeProviders();

// Import the rest of the application
import { OAuth } from './auth/oauth.ts';
import { SessionManager } from './auth/session.ts';
import { UserKV } from './kv/mod.ts';
import { startTimeTracking } from './functions/time/start.ts';
import { stopTimeTracking } from './functions/time/stop.ts';

// Move requireAuth to the top and make it return only Response
async function requireAuth(req: Request): Promise<Response> {
  const kv = await Deno.openKv();
  const sessionManager = new SessionManager(kv);
  
  const cookies = req.headers.get('cookie');
  const sessionId = cookies?.match(/session=([^;]+)/)?.[1];

  if (!sessionId) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/login' }
    });
  }

  const session = await sessionManager.getSession(sessionId);
  if (!session) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/login',
        'Set-Cookie': 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax'
      }
    });
  }

  return new Response(JSON.stringify(session), {
    headers: { 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // Dashboard routes
  if (url.pathname === '/dashboard') {
    const authResult = await requireAuth(req);
    if (authResult.status === 302) {
      return authResult;
    }

    return await Deno.readFile('./pages/dashboard.html')
      .then(data => new Response(data, {
        headers: { 'Content-Type': 'text/html' },
      }));
  }

  if (url.pathname === '/cards/dashboard') {
    const authResult = await requireAuth(req);
    if (authResult.status === 302) {
      return authResult;
    }

    return await Deno.readFile('./cards/dashboard-card.html')
      .then(data => new Response(data, {
        headers: { 'Content-Type': 'text/html' },
      }));
  }

  // Auth routes
  if (url.pathname.startsWith('/auth/')) {
    const kv = await Deno.openKv();
    const oauth = new OAuth(kv);
    const sessionManager = new SessionManager(kv);

    // Handle logout
    if (url.pathname === '/auth/logout') {
      const cookies = req.headers.get('cookie');
      const sessionId = cookies?.match(/session=([^;]+)/)?.[1];
      
      if (sessionId) {
        await sessionManager.deleteSession(sessionId);
      }

      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax'
        }
      });
    }

    // Get provider based on path
    const provider = url.pathname === '/auth/google' ? GoogleProvider :
                    url.pathname === '/auth/github' ? GitHubProvider :
                    url.pathname === '/auth/twitter' ? TwitterProvider :
                    null;

    if (provider !== null && !url.pathname.startsWith('/auth/callback/')) {
      const authUrl = await oauth.createAuthRequest(provider, '/dashboard');
      return Response.redirect(authUrl);
    }

    if (url.pathname.startsWith('/auth/callback/')) {
      const provider = url.pathname.endsWith('/google') ? GoogleProvider :
                      url.pathname.endsWith('/github') ? GitHubProvider :
                      url.pathname.endsWith('/twitter') ? TwitterProvider :
                      null;

      if (provider === null) {
        return new Response('Invalid provider', { status: 400 });
      }

      const params = new URL(req.url).searchParams;
      const code = params.get('code');
      const state = params.get('state');

      if (!code || !state) {
        return new Response('Invalid callback', { status: 400 });
      }

      try {
        const oauthSession = await oauth.handleCallback(provider, code, state);
        
        // Create or get user database
        const userKv = new UserKV(kv, oauthSession.userId);
        try {
          await userKv.getUser();
        } catch {
          // User doesn't exist, create new database
          await UserKV.createUserDatabase(kv, {
            id: oauthSession.userId,
            email: oauthSession.email,
            name: oauthSession.name,
            createdAt: new Date()
          });
        }

        // Create session
        const session = await sessionManager.createSession(
          oauthSession.userId,
          provider.name
        );

        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/dashboard',
            'Set-Cookie': `session=${session.id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
          }
        });
      } catch (error) {
        console.error('Auth error:', error);
        return new Response('Authentication failed', { status: 400 });
      }
    }
  }

  // Time tracking routes
  if (url.pathname === '/time') {
    const authResult = await requireAuth(req);
    if (authResult.status === 302) {
      return authResult;
    }

    return await Deno.readFile('./pages/time.html')
      .then(data => new Response(data, {
        headers: { 'Content-Type': 'text/html' },
      }));
  }

  if (url.pathname === '/cards/time') {
    const authResult = await requireAuth(req);
    if (authResult.status === 302) {
      return authResult;
    }

    return await Deno.readFile('./cards/time.html')
      .then(data => new Response(data, {
        headers: { 'Content-Type': 'text/html' },
      }));
  }

  if (url.pathname === '/functions/time/tracker.ts') {
    const file = await Deno.readFile('./functions/time/tracker.ts');
    return new Response(file, {
      headers: { 
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache'
      },
    });
  }

  if (url.pathname === '/time/start') {
    const authResult = await requireAuth(req);
    if (authResult.status === 302) {
      return authResult;
    }
    const session = JSON.parse(await authResult.text());
    return await startTimeTracking(session.userId);
  }

  if (url.pathname === '/time/stop') {
    const authResult = await requireAuth(req);
    if (authResult.status === 302) {
      return authResult;
    }
    const session = JSON.parse(await authResult.text());
    return await stopTimeTracking(session.userId);
  }

  if (url.pathname === '/time/active') {
    const authResult = await requireAuth(req);
    if (authResult.status === 302) {
      return authResult;
    }
    const session = JSON.parse(await authResult.text());
    
    const kv = await Deno.openKv();
    const activeEntry = await kv.get(['users', session.userId, 'activeTimeEntry']);
    
    if (!activeEntry.value) {
      return new Response('No active time entry', { status: 404 });
    }
    
    return new Response(JSON.stringify(activeEntry.value), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Handle HTMX card requests
  if (url.pathname === '/cards/login') {
    return await Deno.readFile('./cards/login-card.html')
      .then(data => new Response(data, {
        headers: { 'Content-Type': 'text/html' },
      }));
  }

  if (url.pathname === '/cards/header') {
    return await Deno.readFile('./cards/header-card.html')
      .then(data => new Response(data, {
        headers: { 'Content-Type': 'text/html' },
      }));
  }

  if (url.pathname === '/cards/feature-cards') {
    return await Deno.readFile('./cards/feature-cards.html')
      .then(data => new Response(data, {
        headers: { 'Content-Type': 'text/html' },
      }));
  }

  // Static file routes
  if (url.pathname === '/') {
    return await Deno.readFile('./pages/index.html')
      .then(data => new Response(data, {
        headers: { 'Content-Type': 'text/html' },
      }));
  }

  // Static file handling
  if (url.pathname.endsWith('.css')) {
    try {
      const file = await Deno.readFile('.' + url.pathname);
      return new Response(file, {
        headers: { 'Content-Type': 'text/css' }
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  }

  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.ts')) {
    try {
      const file = await Deno.readFile('.' + url.pathname);
      return new Response(file, {
        headers: { 'Content-Type': 'text/javascript' }
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  }

  // Default 404 response
  return new Response('Not Found', { status: 404 });
});
