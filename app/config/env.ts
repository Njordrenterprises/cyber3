export async function loadEnvironment() {
  try {
    const envContent = await Deno.readTextFile('./.env');
    console.log('Loading environment variables...');
    
    for (const line of envContent.split('\n')) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          Deno.env.set(key.trim(), value);
          console.log(`Set ${key.trim()} = ${value.substring(0, 5)}...`);
        }
      }
    }
  } catch (error) {
    console.error('Error loading .env file:', error);
    throw error; // Re-throw to handle it in the main application
  }
} 