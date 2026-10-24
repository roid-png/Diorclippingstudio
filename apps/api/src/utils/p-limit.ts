/**
 * Lightweight, zero-dependency promise concurrency limiter.
 * Matches the exact API of `p-limit`.
 */
export type LimitFunction = <T>(fn: () => Promise<T>) => Promise<T>;

export function pLimit(concurrency: number): LimitFunction {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError("Expected `concurrency` to be an integer greater than 0");
  }

  const queue: Array<() => void> = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const runNext = queue.shift()!;
      runNext();
    }
  };

  const limit: LimitFunction = <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        activeCount++;
        fn()
          .then(
            (val) => {
              resolve(val);
              next();
            },
            (err) => {
              reject(err);
              next();
            }
          );
      };

      if (activeCount < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };

  return limit;
}

export default pLimit;

