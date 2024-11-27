import { UserKV } from './mod.ts';

// Command line interface for managing user databases
export async function initializeUserDatabase(
  email: string,
  name: string
): Promise<void> {
  const kv = await Deno.openKv();
  
  try {
    const userId = crypto.randomUUID();
    const _user = await UserKV.createUserDatabase(kv, {
      id: userId,
      email,
      name,
      createdAt: new Date()
    });

    console.log(`Created database for user: ${name} (${email})`);
    console.log(`User ID: ${userId}`);
  } catch (error) {
    console.error('Failed to create user database:', error);
    throw error;
  } finally {
    kv.close();
  }
}

// CLI command handler
if (import.meta.main) {
  const command = Deno.args[0];
  
  switch (command) {
    case 'init': {
      const email = Deno.args[1];
      const name = Deno.args[2];
      
      if (!email || !name) {
        console.error('Usage: deno run --allow-read --allow-write --allow-env --unstable kv/cmd.ts init <email> <name>');
        Deno.exit(1);
      }
      
      await initializeUserDatabase(email, name);
      break;
    }
      
    default: {
      console.error('Unknown command. Available commands: init');
      Deno.exit(1);
    }
  }
}
