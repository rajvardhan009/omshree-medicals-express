/** Browser REST adapter for the standalone Express server. */
type Row = Record<string, any>;
type Result = { data: any; error: { message: string } | null; count?: number };
const BASE = (import.meta.env['VITE_API_URL'] || 'http://localhost:4000/api').replace(/\/$/, '');
const KEY = 'omshree-express-session';
const listeners = new Set<(event: string) => void>();
function session(): { token: string; user: Row } | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function notify(event: string) { listeners.forEach(fn => fn(event)); }
export async function request(path: string, method = 'GET', body?: unknown) {
  const token = session()?.token;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  let res: Response;
  try { res = await fetch(`${BASE}${path}`, { method, headers, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }) }); }
  catch { throw new Error('Network error: cannot reach the Express server.'); }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) { localStorage.removeItem(KEY); notify('SIGNED_OUT'); }
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}
class Query implements PromiseLike<Result> {
  private filters: [string, string, unknown][] = [];
  private columns = '*'; private max?: number; private sort?: [string, boolean]; private one = false; private required = false;
  private method = 'GET'; private body: any; private search = ''; private head = false;
  constructor(private table: string) {}
  select(columns = '*', options?: { count?: string; head?: boolean }) { this.columns = columns; this.head = !!options?.head; return this; }
  eq(k: string, v: unknown) { this.filters.push([k, 'eq', v]); return this; }
  gte(k: string, v: unknown) { this.filters.push([k, 'gte', v]); return this; }
  lt(k: string, v: unknown) { this.filters.push([k, 'lt', v]); return this; }
  or(v: string) { this.search = v.match(/ilike\.%([\s\S]*?)%,date_based_number/)?.[1] ?? ''; return this; }
  order(k: string, opts?: { ascending?: boolean }) { this.sort = [k, opts?.ascending !== false]; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = true; this.required = true; return this; }
  maybeSingle() { this.one = true; return this; }
  insert(body: unknown) { this.method = 'POST'; this.body = body; return this; }
  upsert(body: unknown, _options?: unknown) { this.method = this.table === 'profiles' ? 'PUT' : 'POST'; this.body = body; return this; }
  update(body: unknown) { this.method = 'PUT'; this.body = body; return this; }
  delete() { this.method = 'DELETE'; return this; }
  private value(k: string) { return this.filters.find(f => f[0] === k && f[1] === 'eq')?.[2]; }
  private async execute(): Promise<Result> {
    try {
      const id = this.value('id'), pid = this.value('indoor_patient_id') ?? this.body?.indoor_patient_id;
      const encode = (v: unknown) => encodeURIComponent(String(v));
      let path = '';
      switch (this.table) {
        case 'profiles': path = '/auth/me'; break;
        case 'bills': path = '/bills' + (id ? `/${encode(id)}` : ''); break;
        case 'indoor_patients': path = '/indoor-patients' + (id ? `/${encode(id)}` : '');
          if (this.method === 'PUT' && this.body?.is_deleted) this.method = 'DELETE';
          else if (this.method === 'PUT' && this.body?.status === 'Discharged') { path += '/discharge'; this.method = 'POST'; }
          break;
        case 'indoor_medicines': path = id ? `/medicines/${encode(id)}` : `/indoor-patients/${encode(pid)}/medicines`; break;
        case 'indoor_bills': path = id ? `/indoor-bills/${encode(id)}` : pid ? `/indoor-patients/${encode(pid)}/bill` : '/indoor-bills'; break;
        case 'common_medicines': path = '/common-medicines' + (id ? `/${encode(id)}` : ''); break;
        default: throw new Error(`Unsupported resource: ${this.table}`);
      }
      if (this.table === 'bills' && this.method === 'GET' && !id) {
        const params = new URLSearchParams({ limit: String(this.max ?? 1000000) });
        if (this.search) params.set('search', this.search);
        const from = this.filters.find(f => f[0] === 'created_at' && f[1] === 'gte');
        const until = this.filters.find(f => f[0] === 'created_at' && f[1] === 'lt');
        if (from) params.set('from', String(from[2]));
        if (until) params.set('until', String(until[2]));
        path += `?${params}`;
      }
      const output = await request(path, this.method, this.method === 'GET' || this.method === 'DELETE' ? undefined : this.body);
      let rows: Row[] = output == null ? [] : Array.isArray(output) ? output : [output];
      if (this.method === 'GET') {
        rows = rows.filter(row => this.filters.every(([k, op, v]) => op === 'eq' ? row[k] === v : op === 'gte' ? String(row[k]) >= String(v) : String(row[k]) < String(v)));
        if (this.sort) { const [k, asc] = this.sort; rows.sort((a,b) => String(a[k]).localeCompare(String(b[k])) * (asc ? 1 : -1)); }
        if (this.max !== undefined) rows = rows.slice(0, this.max);
        if (this.columns !== '*' && !this.columns.includes('(')) {
          const keys = this.columns.split(','); rows = rows.map(row => Object.fromEntries(keys.map(k => [k, row[k]])));
        }
      }
      if (this.required && rows.length !== 1) throw new Error('Record not found.');
      return { data: this.head ? null : this.one ? rows[0] ?? null : rows, error: null, count: rows.length };
    } catch (e) { return { data: null, error: { message: e instanceof Error ? e.message : 'Request failed' } }; }
  }
  then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
export const api = {
  from: (table: string) => new Query(table),
  auth: {
    async getUser() {
      const saved = session();
      if (!saved) return { data: { user: null }, error: null };
      if (!navigator.onLine) return { data: { user: saved.user }, error: null };
      try { const user = await request('/auth/me'); return { data: { user }, error: null }; }
      catch (e) { return { data: { user: null }, error: e }; }
    },
    async signInWithPassword(body: { email: string; password: string }) { return login('/auth/login', body); },
    async signUp(body: { email: string; password: string; options?: { data?: { full_name?: string }; emailRedirectTo?: string } }) {
      return login('/auth/signup', { email: body.email, password: body.password, full_name: body.options?.data?.full_name });
    },
    async signOut() { localStorage.removeItem(KEY); notify('SIGNED_OUT'); return { error: null }; },
    onAuthStateChange(fn: (event: string) => void) { listeners.add(fn); return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }; },
  },
};
async function login(path: string, body: unknown) {
  try { const saved = await request(path, 'POST', body); localStorage.setItem(KEY, JSON.stringify(saved)); notify('SIGNED_IN'); return { data: { session: saved, user: saved.user }, error: null }; }
  catch (e) { return { data: { session: null, user: null }, error: e }; }
}
export async function analyzeBill({ data }: { data: { mime: string; base64: string } }) {
  try {
    const bytes = Uint8Array.from(atob(data.base64), ch => ch.charCodeAt(0));
    const form = new FormData(); form.append('file', new Blob([bytes], { type: data.mime }), 'bill-photo');
    return { ok: true as const, bill: await request('/analyze-bill', 'POST', form) };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : 'Could not read the bill.' }; }
}
