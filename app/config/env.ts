export async function loadEnvironment() {
  const isDev = Deno.env.get('DENO_ENV') === 'development';
  
  if (isDev) {
    try {
      const envContent = await Deno.readTextFile('./.env');
      console.log('Loading environment variables from .env file...');
      
      for (const line of envContent.split('\n')) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          const value = valueParts.join('=');
          if (key && value) {
            Deno.env.set(key.trim(), value.trim());
            console.log(`Set ${key.trim()} = ${value.substring(0, 5)}...`);
          }
        }
      }
    } catch (error) {
      console.error('Error loading .env file:', error);
      throw error;
    }
  } else {
    // In production (Deno Deploy), environment variables are set in the dashboard
    console.log('Running in production mode, using Deno Deploy environment variables');
  }
} 