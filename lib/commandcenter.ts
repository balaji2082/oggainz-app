/**
 * Client for the Command Center's customer API (docs/03 §5).
 *
 * This is the seam. Today it calls Flask over HTTPS; after cutover the same
 * function signatures will be served from Postgres. Nothing that calls this
 * file should need to change when that happens.
 *
 * [LAW] The service token lives only here, on the server. It is never sent to a
 * browser and never appears in a page. A customer's browser talks to this app's
 * own routes; only this app talks to the Command Center.
 *
 * [LAW] Every call names an explicit customer id, and the caller must take that
 * id from the signed-in session — never from anything the browser sent.
 */

export interface CommandCenterAddress {
  id: number;
  label: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  pinned: boolean;
  pin_source: string | null;
  map_note: string | null;
  slot: string | null;
  weekdays: string | null;
  is_default: boolean;
}

export class CommandCenterDown extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandCenterDown";
  }
}

function config() {
  const base = process.env.OG_API_BASE;
  const token = process.env.OG_API_TOKEN;
  if (!base || !token) {
    throw new CommandCenterDown(
      "OG_API_BASE / OG_API_TOKEN are not set — see .env.example"
    );
  }
  return { base: base.replace(/\/$/, ""), token };
}

/**
 * One GET against the Command Center.
 *
 * PythonAnywhere's free tier is a single small worker and free apps sleep, so
 * this WILL be unreachable sometimes. It fails fast and loudly rather than
 * hanging a customer's page: eight seconds, then throw. Callers decide whether
 * to fall back to a cached copy (reads) or to tell the customer honestly that
 * it could not be done (writes) — docs/03 §6.
 */
async function get<T>(path: string): Promise<T> {
  const { base, token } = config();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      headers: { "X-OG-Service-Token": token },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch (cause) {
    throw new CommandCenterDown(
      `Could not reach the Command Center: ${(cause as Error).message}`
    );
  }
  if (!response.ok) {
    throw new CommandCenterDown(
      `Command Center answered ${response.status} for ${path}`
    );
  }
  return (await response.json()) as T;
}

export async function fetchAddresses(
  customerId: string
): Promise<CommandCenterAddress[]> {
  const data = await get<{ ok: boolean; addresses: CommandCenterAddress[] }>(
    `/api/v1/customer/${encodeURIComponent(customerId)}/addresses`
  );
  return data.addresses ?? [];
}

export async function fetchPacks(customerId: string) {
  const data = await get<{ ok: boolean; packs: unknown[] }>(
    `/api/v1/customer/${encodeURIComponent(customerId)}/packs`
  );
  return data.packs ?? [];
}

export async function fetchMeals(customerId: string, from?: string, to?: string) {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const suffix = q.toString() ? `?${q}` : "";
  const data = await get<{ ok: boolean; meals: unknown[] }>(
    `/api/v1/customer/${encodeURIComponent(customerId)}/meals${suffix}`
  );
  return data.meals ?? [];
}

export async function fetchPublicSettings() {
  const data = await get<{ ok: boolean; settings: Record<string, unknown> }>(
    "/api/v1/settings/public"
  );
  return data.settings;
}
