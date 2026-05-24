export function withScriptLock<T>(jobName: string, fn: () => T): T {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
