/* أبلكيشن اللوحة: مش بيخزّن أي بيانات – بس رسالة لو مفيش إنترنت */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui,Tahoma,sans-serif;background:#0b2a4a;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;margin:0;padding:24px"><div><div style="font-size:46px">📡</div><h2>مفيش إنترنت</h2><p>اللوحة محتاجة إنترنت – اتأكد من الاتصال وجرّب تاني.</p><button onclick="location.reload()" style="font:inherit;font-size:16px;padding:10px 24px;border:0;border-radius:8px;background:#feb206;color:#0b2a4a">جرّب تاني</button></div></body></html>', {headers: {"Content-Type": "text/html; charset=utf-8"}})));
});
