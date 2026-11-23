/* =====================================================================
   وصلة Supabase خفيفة (من غير مكتبات خارجية)
   بتكلم: قاعدة البيانات (REST) – تسجيل الدخول (Auth) – تخزين الفيديوهات (Storage)
   ===================================================================== */
(function () {
  const PRODUCT_COLS = ["id", "sort", "active", "cat", "line", "ar", "en", "d", "f", "img", "image", "col", "price", "u", "sizes", "packs", "cov", "url", "best", "is_new", "floor"];
  const SITE_KEYS = ["settings", "packages", "reviews", "discountCodes", "videos"];

  function Supa(cfg) {
    const base = String(cfg.supabaseUrl || "").replace(/\/+$/, ""), key = cfg.supabaseAnonKey;
    let session = null;
    /* المفتاح الجديد (sb_publishable_...) بيتبعت في apikey بس؛ المفتاح القديم (JWT) أو جلسة الدخول بتتبعت كمان في Authorization */
    const headers = extra => {
      const h = {apikey: key};
      if (session) h.Authorization = "Bearer " + session.access_token; else if (/^eyJ/.test(key)) h.Authorization = "Bearer " + key;
      return Object.assign(h, extra || {});
    };
    async function req(path, opt = {}) {
      const r = await fetch(base + path, Object.assign({}, opt, {headers: headers(opt.headers)}));
      const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null } catch (e) {}
      if (!r.ok) { const e = new Error((j && (j.msg || j.message || j.error_description || j.error)) || ("HTTP " + r.status)); e.status = r.status; e.code = j && (j.error_code || j.code); throw e }
      return j;
    }
    const json = (method, body, prefer) => ({method, headers: Object.assign({"Content-Type": "application/json"}, prefer ? {Prefer: prefer} : {}), body: JSON.stringify(body)});
    const keepSession = j => (session = {access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: j.user && j.user.email});
    const sb = {
      base,
      get session() { return session }, setSession(s) { session = s },
      /* تسجيل الدخول */
      async signIn(email, password) { return keepSession(await req("/auth/v1/token?grant_type=password", json("POST", {email, password}))) },
      async refresh() { const email = session && session.email; const s = keepSession(await req("/auth/v1/token?grant_type=refresh_token", json("POST", {refresh_token: session.refresh_token}))); if (!s.email) s.email = email; return s },
      async ensureFresh() { if (session && session.expires_at - Date.now() < 120000) await sb.refresh() },
      async signOut() { try { await req("/auth/v1/logout", {method: "POST"}) } catch (e) {} session = null },
      updatePassword(password) { return req("/auth/v1/user", json("PUT", {password})) },
      /* قاعدة البيانات */
      select: (table, query = "") => req(`/rest/v1/${table}?${query}`),
      insert: (table, row) => req(`/rest/v1/${table}`, json("POST", row, "return=minimal")),
      upsert: (table, rows) => req(`/rest/v1/${table}`, json("POST", rows, "resolution=merge-duplicates,return=minimal")),
      update: (table, filter, patch) => req(`/rest/v1/${table}?${filter}`, json("PATCH", patch, "return=minimal")),
      del: (table, filter) => req(`/rest/v1/${table}?${filter}`, {method: "DELETE", headers: {Prefer: "return=minimal"}}),
      rpc: (fn, args = {}) => req(`/rest/v1/rpc/${fn}`, json("POST", args)),
      /* التخزين (مع نسبة الرفع) */
      publicUrl: (bucket, path) => `${base}/storage/v1/object/public/${bucket}/${path}`,
      upload(bucket, path, file, onProgress) {
        return new Promise((res, rej) => {
          const x = new XMLHttpRequest();
          x.open("POST", `${base}/storage/v1/object/${bucket}/${path}`);
          const h = headers({"Content-Type": file.type || "application/octet-stream", "x-upsert": "false", "cache-control": "3600"});
          for (const k in h) x.setRequestHeader(k, h[k]);
          x.upload.onprogress = e => e.lengthComputable && onProgress && onProgress(Math.round(e.loaded / e.total * 100));
          x.onload = () => { if (x.status >= 200 && x.status < 300) res(true); else { let m = "HTTP " + x.status; try { const j = JSON.parse(x.responseText); m = j.message || j.error || m } catch (e) {} rej(Object.assign(new Error(m), {status: x.status})) } };
          x.onerror = () => rej(new Error("انقطع الاتصال أثناء الرفع"));
          x.send(file);
        });
      },
      removeFile: (bucket, path) => req(`/storage/v1/object/${bucket}`, json("DELETE", {prefixes: [path]})),

      /* تحويل بين شكل بيانات الموقع وجداول Supabase */
      toRow(p, i) { const r = {}; for (const c of PRODUCT_COLS) r[c] = null; Object.assign(r, {id: p.id, sort: i, active: p.active !== false, cat: p.cat || "interior", line: p.line || null, ar: p.ar || "", en: p.en || null, d: p.d || null, f: p.f || [], img: p.img || null, image: p.image || null, col: p.col || null, price: p.price ?? null, u: p.u || "لتر", sizes: p.sizes || null, packs: p.packs || null, cov: p.cov || 10, url: p.url || null, best: !!p.best, is_new: !!p.isNew, floor: !!p.floor}); return r },
      fromRow(r) { const p = {}; for (const c of PRODUCT_COLS) if (r[c] !== null && r[c] !== undefined && c !== "sort" && c !== "is_new") p[c] = r[c]; if (r.is_new) p.isNew = true; if (!r.floor) delete p.floor; if (!r.best) p.best = false; return p },
      async loadAll(adminView) {
        const [rows, site] = await Promise.all([
          sb.select("products", "select=*&order=sort.asc" + (adminView ? "" : "&active=eq.true")),
          sb.select("site_data", "select=key,value")
        ]);
        const D = {products: (rows || []).map(sb.fromRow)};
        for (const s of site || []) if (SITE_KEYS.includes(s.key)) D[s.key] = s.value;
        D.settings = D.settings || {}; D.packages = D.packages || []; D.reviews = D.reviews || []; D.discountCodes = D.discountCodes || []; D.videos = D.videos || [];
        return D;
      },
      async saveAll(D) {
        const rows = D.products.map(sb.toRow);
        if (rows.length) await sb.upsert("products", rows);
        const ids = rows.map(r => `"${r.id.replace(/"/g, "")}"`).join(",");
        await sb.del("products", rows.length ? `id=not.in.(${ids})` : "id=not.is.null");
        const settings = Object.assign({}, D.settings); delete settings.adminHash; delete settings.apiUrl;
        await sb.upsert("site_data", SITE_KEYS.map(k => ({key: k, value: k === "settings" ? settings : (D[k] || []), updated_at: new Date().toISOString()})));
      }
    };
    return sb;
  }
  window.Supa = Supa;
  window.supaConfigured = () => { const c = window.EVEREST_CONFIG || {}; return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.supabaseUrl || "") && (c.supabaseAnonKey || "").length > 30 };
})();
