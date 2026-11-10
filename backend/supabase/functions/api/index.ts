import { createClient } from "npm:@supabase/supabase-js@2";
import { getAddressByBarangayCode } from "npm:@aivangogh/ph-address@2026.2.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  try {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(request.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  let publicPath = url.pathname;
  publicPath = publicPath.replace(/^\/functions\/v1\/api/, "");
  publicPath = publicPath.replace(/^\/api/, "");
  const [action] = publicPath.split("?");

  if (action === "/v1/auth/signup" && request.method === "POST") {
    const body = await request.json();
    const required = ["firstName", "lastName", "employeeId", "phone", "email", "emergencyContactName", "emergencyContactPhone"];
    if (required.some((key) => typeof body[key] !== "string" || !body[key].trim()) ||
        typeof body.password !== "string" || body.password.length < 8 ||
        body.hatcheryId !== "camiguin-sagay" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
        !/^[+()\d\s.-]{7,20}$/.test(body.phone.trim()) ||
        !/^[+()\d\s.-]{7,20}$/.test(body.emergencyContactPhone.trim())) {
      return json({ error: "Complete all required fields with valid contact details and a password of at least 8 characters." }, 400);
    }
    const address = body.address;
    if (!address || address.country !== "PH" || typeof address.street !== "string" || !address.street.trim() ||
        typeof address.barangay !== "string" || typeof address.city !== "string" || typeof address.province !== "string") {
      return json({ error: "A complete Philippine address is required." }, 400);
    }
    const location = getAddressByBarangayCode(address.barangay);
    if (!location || location.municipality.psgcCode !== address.city ||
        (location.province?.psgcCode ?? location.region.psgcCode) !== address.province) {
      return json({ error: "Select a valid province, city and barangay." }, 400);
    }
    const cityName = location.municipality.provinceCode === "1380600000"
      ? `Manila - ${location.municipality.name}` : location.municipality.name;
    const formattedAddress = [address.street.trim(), location.barangay.name, cityName,
      location.province?.name ?? location.region.name, "Philippines"].join(", ");
    const { data, error } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        firstName: body.firstName,
        lastName: body.lastName,
        employeeId: body.employeeId,
        phone: body.phone,
        address: formattedAddress,
        emergencyContactName: body.emergencyContactName,
        emergencyContactPhone: body.emergencyContactPhone,
        hatcheryId: body.hatcheryId,
      },
    });
    if (error) return json({ error: error.message }, 400);
    return json({ status: "pending", user: { id: data.user.id, email: data.user.email } }, 201);
  }

  if (action === "/v1/auth/signin" && request.method === "POST") {
    const body = await request.json();
    const authClient = createClient(supabaseUrl, anonKey);
    const { data, error } = await authClient.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error || !data.user || !data.session) return json({ error: "Invalid credentials." }, 401);
    const { data: profile } = await admin.from("profiles").select("*").eq("id", data.user.id).single();
    if (!profile || profile.status !== "approved") {
      return json({ status: profile?.status ?? "pending" }, profile?.status === "rejected" ? 403 : 200);
    }
    await admin.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", data.user.id);
    return json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: profile.id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
        role: profile.role,
        requestedRole: profile.requested_role,
        status: profile.status,
        position: profile.position,
      },
    });
  }

  if (action === "/v1/ingest/readings" && request.method === "POST") {
    const hardwareKey = Deno.env.get("HARDWARE_INGEST_API_KEY");
    const suppliedKey = request.headers.get("x-hardware-api-key");
    if (!hardwareKey || suppliedKey !== hardwareKey) {
      return json({ error: "Invalid hardware API key." }, 401);
    }

    const reading = await request.json();
    const deviceId = String(reading.deviceId ?? "").trim();
    const temperature = Number(reading.temperature);
    const doMgL = Number(reading.doMgL);
    const ph = Number(reading.ph);
    if (!deviceId || ![temperature, doMgL, ph].every(Number.isFinite)) {
      return json({ error: "deviceId, temperature, doMgL, and ph are required numeric values." }, 400);
    }

    const { data: tank, error: tankError } = await admin.from("tanks")
      .select("id").eq("device_id", deviceId).maybeSingle();
    if (tankError) return json({ error: tankError.message }, 500);
    if (!tank) return json({ error: "Device is not linked to a tank." }, 404);

    const optionalNumber = (value: unknown) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };
    const { data, error } = await admin.from("readings").insert({
      tank_id: tank.id,
      temperature,
      do_mg_l: doMgL,
      ph,
      ec_u_s_cm: optionalNumber(reading.ec),
      salinity_ppm: optionalNumber(reading.salinity),
      tds_ppm: optionalNumber(reading.tds),
      do_saturation_pct: optionalNumber(reading.doSaturation),
      do_probe_temperature: optionalNumber(reading.doProbeTemperature),
    }).select("id,timestamp").single();
    if (error) return json({ error: error.message }, 400);

    const wifiRssi = optionalNumber(reading.wifiRssi);
    const batteryPct = optionalNumber(reading.batteryPct);
    await admin.from("device_statuses").upsert({
      device_id: deviceId,
      online: true,
      last_seen: new Date().toISOString(),
      power_source: String(reading.powerSource ?? "grid"),
      wifi_rssi: wifiRssi ?? 0,
      pending_sync_count: optionalNumber(reading.pendingSyncCount) ?? 0,
      battery_pct: batteryPct ?? null,
    }, { onConflict: "device_id" });

    return json({ accepted: true, readingId: data.id, timestamp: data.timestamp }, 201);
  }

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required." }, 401);
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Invalid or expired session." }, 401);

  const { data: profile } = await admin.from("profiles").select("*").eq("id", userData.user.id).single();

  if (action === "/v1/tanks" && request.method === "GET") {
    const { data, error } = await admin.from("tanks").select("*").order("name");
    if (error) return json({ error: error.message }, 500);
    return json(data?.map((tank) => ({
      id: tank.id,
      name: tank.name,
      site: tank.site,
      rearingStartDate: tank.rearing_start_date,
      deviceId: tank.device_id,
    })));
  }

  if (action === "/v1/tanks" && request.method === "POST") {
    if (!["manager", "admin"].includes(profile.role)) return json({ error: "Forbidden." }, 403);
    const tank = await request.json();
    const { data, error } = await admin.from("tanks").insert({
      name: tank.name,
      site: tank.site,
      rearing_start_date: tank.rearingStartDate,
      device_id: tank.deviceId,
    }).select().single();
    if (error) return json({ error: error.message }, 400);
    await admin.from("audit_logs").insert({ user_name: tank.changedBy, action: "Tank registered", detail: `${data.name} · hardware ${data.device_id}` });
    return json({ id: data.id, name: data.name, site: data.site, rearingStartDate: data.rearing_start_date, deviceId: data.device_id }, 201);
  }

  if (action === "/v1/readings" && request.method === "GET") {
    let query = admin.from("readings").select("*");
    if (url.searchParams.get("tankId")) query = query.eq("tank_id", url.searchParams.get("tankId"));
    if (url.searchParams.get("from")) query = query.gte("timestamp", url.searchParams.get("from"));
    if (url.searchParams.get("to")) query = query.lte("timestamp", url.searchParams.get("to"));
    query = query.order("timestamp", { ascending: false }).limit(Number(url.searchParams.get("limit") ?? 500));
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json((data ?? []).reverse().map((reading) => ({
      id: reading.id,
      tankId: reading.tank_id,
      timestamp: reading.timestamp,
      temperature: reading.temperature,
      doMgL: reading.do_mg_l,
      ph: reading.ph,
      ec: reading.ec_u_s_cm,
      salinity: reading.salinity_ppm,
      tds: reading.tds_ppm,
      doSaturation: reading.do_saturation_pct,
      doProbeTemperature: reading.do_probe_temperature,
    })).filter((reading) => !url.searchParams.get("parameter") || url.searchParams.get("parameter") === "all" || ["temperature", "do", "ph"].includes(url.searchParams.get("parameter")!)));
  }

  if (action === "/v1/devices/status" && request.method === "GET") {
    const { data, error } = await admin.from("device_statuses").select("*");
    if (error) return json({ error: error.message }, 500);
    const { data: tanks, error: tanksError } = await admin.from("tanks").select("id,device_id");
    if (tanksError) return json({ error: tanksError.message }, 500);
    const tankIds = (tanks ?? []).map((tank) => tank.id);
    let readings: Array<{ tank_id: string; timestamp: string }> | null = null;
    if (tankIds.length > 0) {
      const readingsResult = await admin
        .from("readings")
        .select("tank_id,timestamp")
        .in("tank_id", tankIds)
        .order("timestamp", { ascending: false });
      if (readingsResult.error) return json({ error: readingsResult.message }, 500);
      readings = readingsResult.data as Array<{ tank_id: string; timestamp: string }>;
    }

    const latestReadingByTank = new Map<string, string>();
    for (const reading of readings ?? []) {
      if (!latestReadingByTank.has(reading.tank_id)) latestReadingByTank.set(reading.tank_id, reading.timestamp);
    }
    const latestReadingByDevice = new Map<string, string>();
    for (const tank of tanks ?? []) {
      const timestamp = latestReadingByTank.get(tank.id);
      if (timestamp) latestReadingByDevice.set(tank.device_id, timestamp);
    }
    const statusesByDevice = new Map((data ?? []).map((status) => [status.device_id, status]));
    const deviceIds = new Set([
      ...(data ?? []).map((status) => status.device_id),
      ...latestReadingByDevice.keys(),
    ]);
    const now = Date.now();
    const onlineWindowMs = 15 * 60 * 1000;

    return json([...deviceIds].map((deviceId) => {
      const status = statusesByDevice.get(deviceId);
      const readingTimestamp = latestReadingByDevice.get(deviceId);
      const statusTimestamp = status?.last_seen as string | undefined;
      const lastSeen = readingTimestamp && (!statusTimestamp || readingTimestamp > statusTimestamp)
        ? readingTimestamp
        : statusTimestamp ?? readingTimestamp ?? null;
      return {
        deviceId,
        online: Boolean(lastSeen && now - new Date(lastSeen).getTime() <= onlineWindowMs),
        lastSeen: lastSeen ?? new Date(0).toISOString(),
        batteryPct: status?.battery_pct ?? 0,
        powerSource: status?.power_source ?? "battery",
        wifiRssi: status?.wifi_rssi ?? 0,
        pendingSyncCount: status?.pending_sync_count ?? 0,
      };
    }));
  }

  if (action.startsWith("/v1/tanks/") && action.endsWith("/readings/latest") && request.method === "GET") {
    const tankId = decodeURIComponent(action.split("/")[3]);
    const { data, error } = await admin.from("readings").select("*").eq("tank_id", tankId).order("timestamp", { ascending: false }).limit(1).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json(data ? {
      id: data.id,
      tankId: data.tank_id,
      timestamp: data.timestamp,
      temperature: data.temperature,
      doMgL: data.do_mg_l,
      ph: data.ph,
      ec: data.ec_u_s_cm,
      salinity: data.salinity_ppm,
      tds: data.tds_ppm,
      doSaturation: data.do_saturation_pct,
      doProbeTemperature: data.do_probe_temperature,
    } : null);
  }

  const advisoryMatch = action.match(/^\/v1\/tanks\/([^/]+)\/advisories$/);
  if (advisoryMatch && request.method === "GET") {
    const { data: settings } = await admin.from("advisory_settings").select("*").eq("id", true).single();
    const { data: latest } = await admin.from("readings")
      .select("*")
      .eq("tank_id", decodeURIComponent(advisoryMatch[1]))
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    const updatedAt = latest?.timestamp ?? new Date().toISOString();
    const temperature = latest?.temperature ?? null;
    const ph = latest?.ph ?? null;
    const salinityLevel = temperature !== null && temperature >= (settings?.salinity_high_temperature_c ?? 33)
      ? "high"
      : temperature !== null && temperature >= (settings?.salinity_watch_temperature_c ?? 31)
        ? "watch"
        : "normal";
    const ammoniaLevel = ph !== null && ph >= (settings?.ammonia_high_ph ?? 8)
      ? "high"
      : ph !== null && ph >= (settings?.ammonia_watch_ph ?? 7.8)
        ? "watch"
        : "normal";
    return json([
      {
        kind: "salinity",
        level: salinityLevel,
        inputs: { temperature: temperature ?? "unavailable", thresholdC: settings?.salinity_watch_temperature_c ?? 31 },
        firedRule: temperature === null ? "No recent reading" : `${salinityLevel} temperature rule`,
        updatedAt,
      },
      {
        kind: "ammonia",
        level: ammoniaLevel,
        inputs: { ph: ph ?? "unavailable", thresholdPh: settings?.ammonia_watch_ph ?? 7.8 },
        firedRule: ph === null ? "No recent reading" : `${ammoniaLevel} pH rule`,
        updatedAt,
      },
    ]);
  }

  const tankDelete = action.match(/^\/v1\/tanks\/([^/]+)$/);
  if (tankDelete && request.method === "DELETE") {
    if (!["manager", "admin"].includes(profile.role)) return json({ error: "Forbidden." }, 403);
    const { error } = await admin.from("tanks").delete().eq("id", decodeURIComponent(tankDelete[1]));
    if (error) return json({ error: error.message }, 400);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (action === "/v1/alerts" && request.method === "GET") {
    let query = admin.from("alerts").select("*");
    if (url.searchParams.get("tank_id")) query = query.eq("tank_id", url.searchParams.get("tank_id"));
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json(data?.map((alert) => ({
      id: alert.id, tankId: alert.tank_id, parameter: alert.parameter, value: alert.value,
      threshold: alert.threshold, severity: alert.severity, status: alert.status,
      createdAt: alert.created_at, acknowledgedBy: alert.acknowledged_by,
      acknowledgedAt: alert.acknowledged_at, note: alert.note,
    })));
  }

  const alertResponse = action.match(/^\/v1\/alerts\/([^/]+)\/responses$/);
  if (alertResponse && request.method === "GET") {
    const { data, error } = await admin.from("alert_responses").select("*").eq("alert_id", decodeURIComponent(alertResponse[1])).order("created_at");
    if (error) return json({ error: error.message }, 500);
    return json(data?.map((response) => ({
      id: response.id, alertId: response.alert_id, status: response.status,
      note: response.note, createdAt: response.created_at, createdBy: response.created_by,
    })));
  }

  const alertAction = action.match(/^\/v1\/alerts\/([^/]+)\/(acknowledge|resolve)$/);
  if (alertAction && request.method === "POST") {
    const input = await request.json();
    const status = alertAction[2] === "resolve" ? "resolved" : "acknowledged";
    const alertId = decodeURIComponent(alertAction[1]);
    const updates: Record<string, unknown> = { status, note: input.note };
    if (status === "acknowledged") {
      updates.acknowledged_by = input.user;
      updates.acknowledged_at = new Date().toISOString();
    }
    const { data, error } = await admin.from("alerts").update(updates).eq("id", alertId).select().single();
    if (error) return json({ error: error.message }, 400);
    await admin.from("alert_responses").insert({
      alert_id: alertId, status, note: input.note, created_by: input.user,
    });
    return json({
      id: data.id, tankId: data.tank_id, parameter: data.parameter, value: data.value,
      threshold: data.threshold, severity: data.severity, status: data.status,
      createdAt: data.created_at, acknowledgedBy: data.acknowledged_by,
      acknowledgedAt: data.acknowledged_at, note: data.note,
    });
  }

  if (action === "/v1/settings/thresholds" && ["GET", "PUT"].includes(request.method)) {
    if (request.method === "GET") {
      const { data, error } = await admin.from("thresholds").select("*");
      if (error) return json({ error: error.message }, 500);
      return json(data?.map((threshold) => ({
        parameter: threshold.parameter,
        ...(threshold.min_value !== null ? { min: threshold.min_value } : {}),
        ...(threshold.max_value !== null ? { max: threshold.max_value } : {}),
      })));
    }
    if (!["manager", "admin"].includes(profile.role)) return json({ error: "Forbidden." }, 403);
    const body = await request.json();
    await Promise.all(body.thresholds.map((threshold: { parameter: string; min?: number; max?: number }) =>
      admin.from("thresholds").upsert({
        parameter: threshold.parameter, min_value: threshold.min ?? null, max_value: threshold.max ?? null,
        updated_at: new Date().toISOString(),
      })));
    await admin.from("audit_logs").insert({ user_name: body.changedBy, action: "Thresholds updated", detail: "Water-quality thresholds" });
    return json(body.thresholds);
  }

  if (action === "/v1/settings/advisory-rules" && ["GET", "PUT"].includes(request.method)) {
    if (request.method === "GET") {
      const { data, error } = await admin.from("advisory_settings").select("*").eq("id", true).single();
      if (error) return json({ error: error.message }, 500);
      return json({
        salinityWatchTemperatureC: data.salinity_watch_temperature_c,
        salinityHighTemperatureC: data.salinity_high_temperature_c,
        ammoniaWatchTemperatureC: data.ammonia_watch_temperature_c,
        ammoniaHighPh: data.ammonia_high_ph,
      });
    }
    if (!["manager", "admin"].includes(profile.role)) return json({ error: "Forbidden." }, 403);
    const body = await request.json();
    await admin.from("advisory_settings").update({
      salinity_watch_temperature_c: body.settings.salinityWatchTemperatureC,
      salinity_high_temperature_c: body.settings.salinityHighTemperatureC,
      ammonia_watch_temperature_c: body.settings.ammoniaWatchTemperatureC,
      ammonia_high_ph: body.settings.ammoniaHighPh,
    }).eq("id", true);
    await admin.from("audit_logs").insert({ user_name: body.changedBy, action: "Advisory rules updated", detail: "Salinity and ammonia rules" });
    return json(body.settings);
  }

  if (action === "/v1/manual-entries" && ["GET", "POST"].includes(request.method)) {
    if (request.method === "GET") {
      let query = admin.from("manual_entries").select("*");
      if (url.searchParams.get("tank_id")) query = query.eq("tank_id", url.searchParams.get("tank_id"));
      const { data, error } = await query.order("timestamp", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json(data?.map((row) => ({
        id: row.id, tankId: row.tank_id, type: row.type, value: row.value,
        unit: row.unit, timestamp: row.timestamp, enteredBy: row.entered_by, note: row.note,
      })) ?? []);
    }

    const body = await request.json();
    const { data, error } = await admin.from("manual_entries").insert({
      tank_id: body.tankId, type: body.type, value: body.value ?? null,
      unit: body.unit ?? null, timestamp: body.timestamp, entered_by: body.enteredBy, note: body.note ?? null,
    }).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({
      id: data.id, tankId: data.tank_id, type: data.type, value: data.value,
      unit: data.unit, timestamp: data.timestamp, enteredBy: data.entered_by, note: data.note,
    }, 201);
  }

  if (action === "/v1/activity-logs" && ["GET", "POST"].includes(request.method)) {
    if (request.method === "GET") {
      let query = admin.from("activity_logs").select("*");
      if (url.searchParams.get("tank_id")) query = query.eq("tank_id", url.searchParams.get("tank_id"));
      const { data, error } = await query.order("occurred_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json(data?.map((row) => ({
        id: row.id, tankId: row.tank_id, kind: row.kind, type: row.type,
        occurredAt: row.occurred_at, operator: row.operator, notes: row.notes,
        waterChangePercent: row.water_change_percent, waterSource: row.water_source,
        impact: row.impact, manualReadings: row.manual_readings,
      })) ?? []);
    }

    const body = await request.json();
    const { data, error } = await admin.from("activity_logs").insert({
      tank_id: body.tankId, kind: body.kind, type: body.type, occurred_at: body.occurredAt,
      operator: body.operator, notes: body.notes ?? "", water_change_percent: body.waterChangePercent ?? null,
      water_source: body.waterSource ?? null, impact: body.impact ?? null,
      manual_readings: body.manualReadings ?? null,
    }).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({
      id: data.id, tankId: data.tank_id, kind: data.kind, type: data.type,
      occurredAt: data.occurred_at, operator: data.operator, notes: data.notes,
      waterChangePercent: data.water_change_percent, waterSource: data.water_source,
      impact: data.impact, manualReadings: data.manual_readings,
    }, 201);
  }

  if (action === "/v1/calibrations" && ["GET", "POST"].includes(request.method)) {
    if (request.method === "GET") {
      let query = admin.from("calibration_logs").select("*");
      if (url.searchParams.get("tank_id")) query = query.eq("tank_id", url.searchParams.get("tank_id"));
      const { data, error } = await query.order("date", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json(data?.map((row) => ({
        id: row.id, tankId: row.tank_id, parameter: row.parameter, standard: row.standard,
        before: row.before_value, after: row.after_value, date: row.date,
        user: row.user_name, nextDue: row.next_due,
      })));
    }
    const body = await request.json();
    const { data, error } = await admin.from("calibration_logs").insert({
      tank_id: body.tankId, parameter: body.parameter, standard: body.standard,
      before_value: body.before, after_value: body.after, date: body.date,
      user_name: body.user, next_due: body.nextDue,
    }).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({ id: data.id, tankId: data.tank_id, parameter: data.parameter, standard: data.standard, before: data.before_value, after: data.after_value, date: data.date, user: data.user_name, nextDue: data.next_due }, 201);
  }

  if (action === "/v1/validation" && request.method === "GET") {
    let query = admin.from("validation_rows").select("*");
    if (url.searchParams.get("tank_id")) query = query.eq("tank_id", url.searchParams.get("tank_id"));
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json(data?.map((row) => ({
      id: row.id,
      tankId: row.tank_id,
      parameter: row.parameter,
      hydrosenseMean: row.hydrosense_mean,
      reference: row.reference,
      error: row.error,
      pctError: row.pct_error,
      tolerance: row.tolerance,
      pass: row.pass,
    })) ?? []);
  }

  if (action === "/v1/validation/tolerances" && ["GET", "PUT"].includes(request.method)) {
    if (request.method === "GET") {
      const { data, error } = await admin.from("validation_tolerances").select("*").eq("id", true).single();
      if (error) return json({ error: error.message }, 500);
      return json({ temperature: data.temperature, ph: data.ph, do: data.dissolved_oxygen });
    }
    if (!["manager", "admin"].includes(profile.role)) return json({ error: "Forbidden." }, 403);
    const body = await request.json();
    await admin.from("validation_tolerances").update({
      temperature: body.tolerances.temperature,
      ph: body.tolerances.ph,
      dissolved_oxygen: body.tolerances.do,
    }).eq("id", true);
    return json(body.tolerances);
  }

  if (action === "/v1/admin/users" && request.method === "GET") {
    if (!profile || profile.status !== "approved" || !["manager", "admin"].includes(profile.role)) return json({ error: "Forbidden." }, 403);
    const status = url.searchParams.get("status");
    if (status && !["pending", "approved", "rejected"].includes(status)) return json({ error: "Invalid account status." }, 400);
    if (profile.role !== "admin" && status && status !== "approved") return json({ error: "Forbidden." }, 403);
    const query = admin.from("profiles").select("*").order("created_at", { ascending: false }).eq("status", status ?? "approved");
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json(data?.map((user) => ({
      id: user.id, firstName: user.first_name, lastName: user.last_name, name: `${user.first_name} ${user.last_name}`.trim(), email: user.email,
      role: user.role, requestedRole: user.requested_role, status: user.status, createdAt: user.created_at,
      site: user.site, active: user.active, lastActive: user.last_active,
      employeeId: user.employee_id, phone: user.phone, position: user.position, address: user.address,
      emergencyContactName: user.emergency_contact_name, emergencyContactPhone: user.emergency_contact_phone,
    })));
  }

  const adminUserUpdate = action.match(/^\/v1\/admin\/users\/([^/]+)$/);
  if (adminUserUpdate && request.method === "PATCH") {
    if (profile?.role !== "admin" || profile.status !== "approved") return json({ error: "Forbidden." }, 403);
    const body = await request.json();
    if (!((body.status === "approved" && ["operator", "manager", "admin"].includes(body.role)) ||
      (body.status === "rejected" && body.role === null))) {
      return json({ error: "Select a valid approval role or reject the request." }, 400);
    }
    const updates = {
      status: body.status,
      role: body.role,
    };
    const { data, error } = await admin.from("profiles").update(updates).eq("id", decodeURIComponent(adminUserUpdate[1])).eq("status", "pending").select().maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Pending account request was not found." }, 404);
    return json({
      id: data.id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      requested_role: data.requested_role,
      status: data.status,
      role: data.role,
      position: data.position,
      created_at: data.created_at,
      employee_id: data.employee_id,
      phone: data.phone,
      address: data.address,
      emergency_contact_name: data.emergency_contact_name,
      emergency_contact_phone: data.emergency_contact_phone,
    });
  }
  if (adminUserUpdate && request.method === "DELETE") {
    if (profile.role !== "admin") return json({ error: "Forbidden." }, 403);
    const userId = decodeURIComponent(adminUserUpdate[1]);
    if (userId === profile.id) return json({ error: "The administrator account cannot be removed." }, 400);
    const { data: target, error: targetError } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (targetError) return json({ error: targetError.message }, 500);
    if (!target) return json({ error: "Account was not found." }, 404);
    if (target.role === "admin") return json({ error: "Administrator accounts cannot be removed." }, 400);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 400);
    await admin.from("profiles").delete().eq("id", userId);
    return json({ id: userId, removed: true });
  }

  if (action === "/v1/admin/logs" && request.method === "GET") {
    if (profile.role !== "admin") return json({ error: "Forbidden." }, 403);
    const { data, error } = await admin.from("audit_logs").select("*").order("timestamp", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json(data?.map((log) => ({ id: log.id, timestamp: log.timestamp, user: log.user_name, action: log.action, detail: log.detail })));
  }

    return json({ error: `No API route for ${request.method} ${action}.` }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
