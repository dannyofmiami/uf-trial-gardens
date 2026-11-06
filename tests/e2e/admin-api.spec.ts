import { test, expect } from './fixtures';
import { createAdminApi } from '../../server/admin-core.mjs';

// The admin API core on its own: an in-memory store and a fake clock, so lockout and
// expiry can be tested without waiting and without affecting the browser tests.
test.describe('admin API', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'no browser involved; run once'));

  const PASSWORD = 'correct-horse-battery';
  const setup = () => {
    let clock = 1_800_000_000_000;
    let saved: unknown = { enabled: false };
    let edits: any = { cultivars: {} };
    const api = createAdminApi({
      password: PASSWORD,
      sessionSecret: 'test-secret',
      now: () => clock,
      store: {
        getBanner: async () => saved, putBanner: async (b: unknown) => { saved = b; },
        getEdits: async () => structuredClone(edits), putEdits: async (e: unknown) => { edits = e; },
      },
    });
    const call = async (method: string, path: string, body?: unknown, token?: string, ip = '10.0.0.1') => {
      const r = await api.handle({
        method, path, ip, body: body === undefined ? '' : JSON.stringify(body),
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      return { status: r.status, data: JSON.parse(r.body) };
    };
    const login = async () => (await call('POST', '/login', { password: PASSWORD })).data.token as string;
    return { call, login, advance: (ms: number) => { clock += ms; }, saved: () => saved, edits: () => edits };
  };
  const valid = {
    enabled: true, title: 'Open House', message: 'Come by', linkLabel: 'Visit', linkUrl: '/visit/',
    showFrom: '', showUntil: '2027-01-01',
  };

  test('refuses to start without a strong password', () => {
    const store = { getBanner: async () => ({}), putBanner: async () => {} };
    expect(() => createAdminApi({ password: '', store })).toThrow();
    expect(() => createAdminApi({ password: 'short', store })).toThrow();
  });

  test('wrong password is rejected, right one returns a session', async () => {
    const { call } = setup();
    expect((await call('POST', '/login', { password: 'nope' })).status).toBe(401);
    const ok = await call('POST', '/login', { password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.data.token).toBeTruthy();
  });

  test('locks out an address after 5 failed logins, not other addresses', async () => {
    const { call, advance } = setup();
    for (let i = 0; i < 5; i++) await call('POST', '/login', { password: 'nope' });
    expect((await call('POST', '/login', { password: PASSWORD })).status).toBe(429);
    expect((await call('POST', '/login', { password: PASSWORD }, undefined, '10.0.0.2')).status).toBe(200);
    advance(16 * 60 * 1000);
    expect((await call('POST', '/login', { password: PASSWORD })).status).toBe(200);
  });

  test('saving requires a valid, unexpired, untampered session', async () => {
    const { call, login, advance } = setup();
    expect((await call('PUT', '/banner', valid)).status).toBe(401);
    const token = await login();
    expect((await call('PUT', '/banner', valid, token + 'x')).status).toBe(401);
    const [body, mac] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ exp: 9e15 })).toString('base64url') + '.' + mac;
    expect((await call('PUT', '/banner', valid, forged)).status).toBe(401);
    expect(body).toBeTruthy();
    expect((await call('PUT', '/banner', valid, token)).status).toBe(200);
    advance(9 * 3600 * 1000);
    expect((await call('PUT', '/banner', valid, token)).status).toBe(401);
  });

  test('rejects unsafe or invalid banner fields', async () => {
    const { call, login, saved } = setup();
    const token = await login();
    for (const [field, value] of [
      ['linkUrl', 'javascript:alert(1)'], ['linkUrl', 'http://insecure.example'], ['linkUrl', '//evil.example'],
      ['title', 'x'.repeat(121)], ['showUntil', '01/01/2027'],
    ] as const) {
      const r = await call('PUT', '/banner', { ...valid, [field]: value }, token);
      expect(r.status, `${field}=${value}`).toBe(400);
      expect(r.data.fields[field]).toBeTruthy();
    }
    expect((await call('PUT', '/banner', { ...valid, showFrom: '2027-02-01' }, token)).status).toBe(400);
    expect((await call('PUT', '/banner', { ...valid, enabled: true, title: '' }, token)).status).toBe(400);
    expect(saved()).toEqual({ enabled: false }); // nothing invalid was stored
  });

  test('saves a valid banner and drops unknown fields', async () => {
    const { call, login, saved } = setup();
    const token = await login();
    const r = await call('PUT', '/banner', { ...valid, title: '  Open House  ', injected: '<script>' }, token);
    expect(r.status).toBe(200);
    expect(r.data.title).toBe('Open House');
    expect(r.data.updatedAt).toBeTruthy();
    expect(saved()).not.toHaveProperty('injected');
  });

  test('cultivar edits need a session, and saving one changes only that cultivar', async () => {
    const { call, login, edits } = setup();
    const edit = { fields: { name: 'Akila Sunshine Gold', lightExposure: 'Full sun' }, rounds: { '2026-05-06': { foliage: 4.5 } } };
    expect((await call('PUT', '/cultivars/akila', edit)).status).toBe(401);
    const token = await login();
    const r = await call('PUT', '/cultivars/akila', edit, token);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject(edit);
    await call('PUT', '/cultivars/other', { fields: { genus: 'Vinca' } }, token);
    expect(Object.keys(edits().cultivars)).toEqual(['akila', 'other']);
    expect((await call('GET', '/cultivars')).data.cultivars.akila.fields.name).toBe('Akila Sunshine Gold');
  });

  test('an empty cultivar edit restores the spreadsheet values', async () => {
    const { call, login, edits } = setup();
    const token = await login();
    await call('PUT', '/cultivars/akila', { fields: { genus: 'Vinca' } }, token);
    expect((await call('PUT', '/cultivars/akila', { fields: {}, rounds: {} }, token)).status).toBe(200);
    expect(edits().cultivars).toEqual({});
  });

  test('rejects invalid cultivar edits and odd ids', async () => {
    const { call, login, edits } = setup();
    const token = await login();
    for (const bad of [
      { fields: { name: '' } },
      { fields: { name: 'x'.repeat(121) } },
      { fields: { year: 'soon' } },
      { fields: { status: 'On the roof' } },
      { fields: { lightExposure: 'Full shade' } },
      { rounds: { '2026-05-06': { foliage: 6 } } },
      { rounds: { '2026-05-06': { foliage: 3.3 } } },
      { rounds: { 'not-a-date': { foliage: 3 } } },
    ]) {
      expect((await call('PUT', '/cultivars/akila', bad, token)).status, JSON.stringify(bad)).toBe(400);
    }
    for (const id of ['__proto__', 'Akila', 'a/b', '..']) {
      expect((await call('PUT', `/cultivars/${id}`, { fields: { genus: 'Vinca' } }, token)).status, id).toBe(404);
    }
    expect(edits().cultivars).toEqual({});
  });

  test('a cultivar edit keeps only known fields', async () => {
    const { call, login } = setup();
    const token = await login();
    const r = await call('PUT', '/cultivars/akila', {
      fields: { genus: ' Vinca ', images: [], injected: '<script>' },
      rounds: { '2026-05-06': { foliage: null, notes: '  Leaf spot after rain  ', avg: 5 } },
    }, token);
    expect(r.status).toBe(200);
    expect(r.data.fields).toEqual({ genus: 'Vinca' });
    expect(r.data.rounds).toEqual({ '2026-05-06': { foliage: null, notes: 'Leaf spot after rain' } });
  });
});
