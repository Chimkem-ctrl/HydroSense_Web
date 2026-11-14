import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../supabase/functions/api/index.ts', import.meta.url), 'utf8');
const javascript = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, ''), { mode: 'strip' });

function setup(role = 'admin', status = 'approved') {
  const profiles = [
    { id: 'actor', first_name: 'Admin', last_name: 'User', email: 'admin@example.test', role, status },
    { id: 'pending', first_name: 'Jane', last_name: 'Smith', email: 'jane@example.test', role: null, status: 'pending', requested_role: null },
    { id: 'member', first_name: 'John', last_name: 'Smith', email: 'john@example.test', role: 'operator', status: 'approved', site: 'site', active: true, last_active: 'today' },
    { id: 'other-admin', first_name: 'Other', last_name: 'Admin', email: 'other@example.test', role: 'admin', status: 'approved' },
  ];
  const tables = { profiles, tanks: [], sms_alert_queue: [], thresholds: [], alerts: [], device_statuses: [], audit_logs: [], manual_entries: [], activity_logs: [], validation_rows: [], readings: [], advisory_settings: [{ id: true, salinity_watch_temperature_c: 31, salinity_high_temperature_c: 32, ammonia_watch_temperature_c: 31, ammonia_high_ph: 7.8 }] };
  let createdUser;
  const db = {
    auth: { admin: { createUser: async (body) => { createdUser = body; return { data: { user: { id: 'new', email: body.email } }, error: null }; } } },
    async rpc(name, args) {
      assert.equal(name, 'claim_alert_sms');
      const item = tables.sms_alert_queue.find((row) => row.tank_id === args.p_tank_id && row.status === 'pending');
      if (item) item.status = 'claimed';
      return { data: item ? [item] : [], error: null };
    },
    from(table) {
      let rows = tables[table];
      let updates;
      let insertError;
      const query = {
        select() { return this; },
        order() { return this; },
        limit(count) { rows = rows.slice(0, count); return this; },
        eq(field, value) { rows = rows.filter((row) => row[field] === value); return this; },
        in(field, values) { rows = rows.filter((row) => values.includes(row[field])); return this; },
        update(value) { updates = value; return this; },
        insert(value) {
          if (table === 'readings' && value.source_id && tables.readings.some((row) => row.tank_id === value.tank_id && row.source_id === value.source_id)) {
            insertError = { code: '23505', message: 'duplicate reading' };
            rows = [];
          } else {
            if (table === 'readings') value = { id: `reading-${tables.readings.length}`, timestamp: new Date().toISOString(), ...value };
            tables[table].push(value);
            rows = [value];
          }
          return this;
        },
        upsert(value) { tables[table].push(value); rows = [value]; return this; },
        result() {
          if (updates) rows.forEach((row) => Object.assign(row, updates));
          return { data: rows, error: insertError ?? null };
        },
        async maybeSingle() { const result = this.result(); return { ...result, data: result.data[0] ?? null }; },
        async single() { return this.maybeSingle(); },
        then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); },
      };
      return query;
    },
  };
  let handler;
  const context = {
    Deno: { env: { get: (name) => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service' : name === 'HARDWARE_INGEST_API_KEY' ? 'hardware-key' : 'anon' }, serve: (fn) => { handler = fn; } },
    createClient: (_url, key) => key === 'service' ? db : { auth: { getUser: async () => ({ data: { user: { id: 'actor' } }, error: null }) } },
    getAddressByBarangayCode: (code) => code === 'barangay' ? {
      barangay: { name: 'Alangilan' }, municipality: { psgcCode: 'city', provinceCode: 'province', name: 'Sagay' },
      province: { psgcCode: 'province', name: 'Camiguin' }, region: { psgcCode: 'region', name: 'Region X' },
    } : undefined,
    Request, Response, URL, console,
  };
  runInNewContext(javascript, context);
  return {
    tables,
    get createdUser() { return createdUser; },
    hardwareRequest: (path, body, key = 'hardware-key') => handler(new Request(`https://example.test/functions/v1/api${path}`, {
      method: 'POST', headers: { 'X-Hardware-Api-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })),
    request: (path, method = 'GET', body) => handler(new Request(`https://example.test/functions/v1/api${path}`, {
      method, headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })),
  };
}

test('buffered readings preserve time, deduplicate retries, and never alert for historical samples', async () => {
  const app = setup();
  app.tables.tanks.push({ id: 'tank-a', device_id: 'device-a' });
  app.tables.thresholds.push({ parameter: 'do', min_value: 5, max_value: null });
  const sourceId = '11111111-1111-4111-8111-111111111111';
  const timestamp = new Date(Date.now() - 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const reading = { deviceId: 'device-a', sourceId, recordedAt: timestamp, historical: true, temperature: 29, ph: 8, doMgL: 2 };
  assert.equal((await app.hardwareRequest('/v1/ingest/readings', reading)).status, 201);
  assert.equal((await app.hardwareRequest('/v1/ingest/readings', reading)).status, 201);
  assert.equal(app.tables.readings.length, 1);
  assert.equal(app.tables.readings[0].timestamp, timestamp);
  assert.equal(app.tables.alerts.length, 0);
  assert.equal((await app.hardwareRequest('/v1/ingest/readings', { ...reading, recordedAt: null })).status, 400);
  assert.equal((await app.hardwareRequest('/v1/ingest/readings', { ...reading, sourceId: 'invalid' })).status, 400);
  assert.equal((await app.hardwareRequest('/v1/ingest/readings', { ...reading, historical: 'false' })).status, 400);
  assert.equal((await app.hardwareRequest('/v1/ingest/readings', { ...reading, recordedAt: '2026-02-31T00:00:00Z' })).status, 400);
  assert.equal((await app.hardwareRequest('/v1/ingest/readings', { ...reading, sourceId: '33333333-3333-4333-8333-333333333333', historical: false })).status, 201);
  assert.equal(app.tables.alerts.length, 0);
  assert.equal((await app.hardwareRequest('/v1/ingest/readings', { ...reading, sourceId: '22222222-2222-4222-8222-222222222222', recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), historical: false })).status, 201);
  assert.equal(app.tables.alerts.length, 1);
  assert.equal((await app.hardwareRequest('/v1/hardware/thresholds', { deviceId: 'device-a' })).status, 200);
  assert.equal((await app.hardwareRequest('/v1/hardware/thresholds', { deviceId: 'unknown' })).status, 404);
  assert.equal((await app.hardwareRequest('/v1/hardware/thresholds', { deviceId: 'device-a' }, 'wrong')).status, 401);
});

test('hardware SMS claims are scoped, single-use, and require the hardware key', async () => {
  const app = setup();
  const id = '11111111-1111-4111-8111-111111111111';
  app.tables.tanks.push({ id: 'tank-a', device_id: 'device-a' }, { id: 'tank-b', device_id: 'device-b' });
  app.tables.sms_alert_queue.push({ id, tank_id: 'tank-a', status: 'pending', phone: '+639123456789', message: 'Alert' });
  const claim = (deviceId, key) => app.hardwareRequest('/v1/hardware/sms/claim', { deviceId }, key);
  const complete = (deviceId, status) => app.hardwareRequest('/v1/hardware/sms/complete', { deviceId, id, status });
  assert.equal((await claim('device-a', 'wrong')).status, 401);
  assert.equal((await claim('unknown')).status, 404);
  assert.equal((await (await claim('device-b')).json()).message, null);
  assert.equal((await (await claim('device-a')).json()).message.id, id);
  assert.equal((await (await claim('device-a')).json()).message, null);
  assert.equal((await complete('device-b', 'sent')).status, 404);
  assert.equal((await complete('device-a', 'pending')).status, 400);
  assert.equal((await complete('device-a', 'sent')).status, 200);
  assert.equal(app.tables.sms_alert_queue[0].status, 'sent');
  assert.equal((await complete('device-a', 'sent')).status, 404);
  app.tables.sms_alert_queue[0].status = 'pending';
  assert.equal((await (await claim('device-a')).json()).message.id, id);
  assert.equal((await complete('device-a', 'failed')).status, 200);
  assert.equal((await (await claim('device-a')).json()).message, null);
});

test('signup accepts required fields without requested role and stores a readable address', async () => {
  const app = setup();
  const response = await app.request('/v1/auth/signup', 'POST', {
    firstName: 'Jane', lastName: 'Smith', email: 'jane@example.test', password: 'password123', employeeId: '123',
    phone: '+639123456789', emergencyContactName: 'John', emergencyContactPhone: '+639123456789',
    hatcheryId: 'camiguin-sagay', address: { country: 'PH', province: 'province', city: 'city', barangay: 'barangay', street: 'Main St' },
  });
  assert.equal(response.status, 201);
  assert.equal(app.createdUser.user_metadata.address, 'Main St, Alangilan, Sagay, Camiguin, Philippines');
  assert.equal('requestedRole' in app.createdUser.user_metadata, false);
  assert.equal((await app.request('/v1/auth/signup', 'POST', {})).status, 400);
});

test('only approved admins can review pending requests and assign any approval role', async () => {
  for (const role of ['operator', 'manager', 'admin']) {
    const app = setup();
    const pending = await app.request('/v1/admin/pending-requests');
    assert.equal((await pending.json()).length, 1);
    const approved = await app.request('/v1/admin/pending-requests/pending/approve', 'PUT', { role });
    assert.equal(approved.status, 200);
    assert.equal(app.tables.profiles[1].role, role);
    assert.equal(app.tables.profiles[1].requested_role, null);
    assert.equal((await app.request('/v1/admin/pending-requests/pending/reject', 'PUT')).status, 404);
  }
  assert.equal((await setup('manager').request('/v1/admin/pending-requests')).status, 403);
  assert.equal((await setup('admin', 'pending').request('/v1/admin/pending-requests')).status, 403);
  const app = setup();
  assert.equal((await app.request('/v1/admin/pending-requests/pending/approve', 'PUT', { role: 'invalid' })).status, 400);
  assert.equal((await app.request('/v1/admin/pending-requests/pending/reject', 'PUT')).status, 200);
  const legacy = setup();
  assert.equal((await legacy.request('/v1/admin/users/pending', 'PATCH', { status: 'approved', role: 'admin' })).status, 200);
  assert.equal(legacy.tables.profiles[1].role, 'admin');
});

test('approved-user role changes exclude admins and pending accounts', async () => {
  const app = setup();
  assert.equal((await app.request('/v1/admin/users/member/role', 'PUT', { role: 'manager' })).status, 200);
  assert.equal(app.tables.profiles[2].role, 'manager');
  assert.equal(app.tables.audit_logs.length, 1);
  assert.equal((await app.request('/v1/admin/users/other-admin/role', 'PUT', { role: 'operator' })).status, 404);
  assert.equal((await app.request('/v1/admin/users/pending/role', 'PUT', { role: 'operator' })).status, 404);
  assert.equal((await app.request('/v1/admin/users/member/role', 'PUT', { role: 'admin' })).status, 400);
  assert.equal((await setup('operator').request('/v1/admin/users/member/role', 'PUT', { role: 'manager' })).status, 403);
});

test('operational routes use database timestamps and include hatchery-wide activity', async () => {
  const app = setup();
  await app.request('/v1/manual-entries', 'POST', { tankId: 'tank', type: 'rain_event', enteredBy: 'Jane' });
  await app.request('/v1/activity-logs', 'POST', { tankId: 'hatchery', kind: 'ENVIRONMENT', type: 'Rainfall', operator: 'Jane' });
  assert.equal('timestamp' in app.tables.manual_entries[0], false);
  assert.equal('occurred_at' in app.tables.activity_logs[0], false);
  assert.equal((await (await app.request('/v1/manual-entries?tank_id=tank')).json()).length, 1);
  assert.equal((await (await app.request('/v1/activity-logs?tank_id=tank')).json()).length, 1);
  assert.equal((await app.request('/v1/validation')).status, 200);
  assert.deepEqual(await (await app.request('/v1/tanks/tank/advisories')).json(), []);
});

test('advisories use configured thresholds and recorded water events', async () => {
  const app = setup();
  app.tables.readings.push({ tank_id: 'tank', timestamp: '2026-01-01T00:00:00Z', temperature: 33, ph: 8 });
  let result = await (await app.request('/v1/tanks/tank/advisories')).json();
  assert.equal(result[0].level, 'high');
  assert.equal(result[1].level, 'watch');
  assert.equal(result[0].inputs.temperatureC, 33);
  app.tables.activity_logs.push({ tank_id: 'hatchery', kind: 'ENVIRONMENT', type: 'Rainfall' });
  result = await (await app.request('/v1/tanks/tank/advisories')).json();
  assert.equal(result[0].level, 'watch');
  assert.equal(result[0].inputs.recentRainEvent, 'yes');
  app.tables.readings[0].temperature = 25;
  app.tables.readings[0].ph = 7;
  app.tables.activity_logs.length = 0;
  result = await (await app.request('/v1/tanks/tank/advisories')).json();
  assert.equal(result[0].level, 'low');
  assert.equal(result[1].level, 'low');
});
