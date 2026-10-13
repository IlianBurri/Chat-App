/** Without keyboard, mouse or touch input for this long, the status becomes "Away". */
export const IDLE_AFTER_MS = 5 * 60_000;
const CHECK_EVERY_MS = 15_000;
const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'] as const;

/**
 * Watches for user inactivity and reports changes through `onChange`
 * (true = idle). Returns a function that stops watching.
 */
export function watchIdle(onChange: (idle: boolean) => void, idleAfter = IDLE_AFTER_MS, target: EventTarget = window): () => void {
  let idle = false;
  let lastActivity = Date.now();

  const onActivity = () => {
    lastActivity = Date.now();
    if (idle) {
      idle = false;
      onChange(false);
    }
  };
  const check = () => {
    if (!idle && Date.now() - lastActivity >= idleAfter) {
      idle = true;
      onChange(true);
    }
  };

  for (const event of ACTIVITY_EVENTS) target.addEventListener(event, onActivity, { passive: true });
  const timer = setInterval(check, Math.min(CHECK_EVERY_MS, idleAfter));
  return () => {
    for (const event of ACTIVITY_EVENTS) target.removeEventListener(event, onActivity);
    clearInterval(timer);
  };
}
