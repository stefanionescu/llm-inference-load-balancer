import { RedisClientType } from 'redis';
import fs from 'fs';
import path from 'path';

// Cache for Redis scripts to avoid reading files multiple times
const scriptCache = new Map<string, string>();

export async function loadRedisScript(scriptName: string): Promise<string> {
  if (scriptCache.has(scriptName)) {
    return scriptCache.get(scriptName)!;
  }

  const scriptPath = path.join(process.cwd(), 'src', 'shared', 'redis-scripts', `${scriptName}.lua`);
  const script = fs.readFileSync(scriptPath, 'utf-8');
  scriptCache.set(scriptName, script);
  return script;
}

export async function executeProviderSelection(
  redis: RedisClientType,
  profiles: Record<string, any[]>,
  scriptName: string = 'provider-selection'
): Promise<unknown[]> {
  if (!redis.isOpen) {
    throw new Error('Redis connection not available');
  }

  const script = await loadRedisScript(scriptName);
  
  const result = await redis.eval(
    script,
    {
      keys: [],
      arguments: [JSON.stringify(profiles), Date.now().toString()]
    }
  ) as unknown[];

  return result;
}

export async function markRequestComplete(
  redis: RedisClientType,
  profileId: string,
  requestTimestamp: number,
  withPending: boolean = false
): Promise<void> {
  try {
    if (!redis.isOpen) {
      console.warn('Redis connection not available when marking request complete');
      return;
    }

    const key = `provider:${profileId}`;
    const operations = [
      redis.zRemRangeByScore(
        `${key}:requests`,
        requestTimestamp,
        requestTimestamp
      )
    ];

    if (withPending) {
      operations.push(redis.decr(`${key}:pending`));
    }

    await Promise.all(operations);
  } catch (error) {
    console.error(`Failed to mark request complete for ${profileId}:`, error);
  }
} 