/**
 * Tagged console logging for the one thing this server does in a browser: the passkey ceremony of
 * §9.3. It is the hardest step in the whole product to debug from the outside — the app hands over
 * to a browser, the browser talks to an authenticator, and all the app ever sees afterwards is a
 * deep link that either carried a token or did not.
 *
 * Development only, mirroring the app's own `log`: these lines are printed on somebody else's
 * machine. Never the handoff token, never the invite code — a token that reaches a console is a
 * token that reaches whatever reads that console.
 */
const enabled: boolean = process.env.NODE_ENV !== 'production';

export function log(scope: string, message: string, detail?: Record<string, unknown>): void {
  if (!enabled) return;
  if (detail === undefined) console.log(`[saldo:${scope}] ${message}`);
  else console.log(`[saldo:${scope}] ${message}`, detail);
}
