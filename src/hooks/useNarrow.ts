import { useSyncExternalStore } from "react";

// One stable subscribe function per query, so React does not resubscribe on
// every render.
const subscribers = new Map<string, (cb: () => void) => () => void>();

function subscribeTo(query: string) {
  let sub = subscribers.get(query);
  if (!sub) {
    sub = (cb) => {
      const mq = window.matchMedia?.(query);
      mq?.addEventListener("change", cb);
      return () => mq?.removeEventListener("change", cb);
    };
    subscribers.set(query, sub);
  }
  return sub;
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    subscribeTo(query),
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}

/**
 * True on phone-width screens. Wide left-to-right diagrams switch to a
 * top-to-bottom layout there instead of shrinking into illegibility.
 */
export function useNarrow(): boolean {
  return useMedia("(max-width: 639px)");
}

/**
 * True below tablet width. The big topology map needs more room than a lab
 * diagram, so it swaps to a strip map earlier.
 */
export function useCompact(): boolean {
  return useMedia("(max-width: 767px)");
}
