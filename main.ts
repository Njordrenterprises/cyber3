Deno.serve(async (req) => {
  const url = new URL(req.url);

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

  // Handle other static files (css, js, etc)
  try {
    const file = await Deno.readFile('.' + url.pathname);
    const contentType = url.pathname.endsWith('.css') ? 'text/css' :
                       url.pathname.endsWith('.js') ? 'text/javascript' :
                       url.pathname.endsWith('.ts') ? 'text/typescript' :
                       'application/octet-stream';
    
    return new Response(file, {
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
});
