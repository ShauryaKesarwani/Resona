/** Runs tasks one at a time. Arkiv has no unique constraint, so sign-ups must not overlap. */
export function createQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task);
    tail = result.catch(() => {});
    return result;
  };
}
