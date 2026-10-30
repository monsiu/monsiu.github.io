const ALLOWED_ORIGINS = new Set([
  "https://monsiu.github.io",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
]);

const MAX_BODY_BYTES = 12_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function row(label, value) {
  if (!value) return "";
  return `<tr><th align="left" style="padding:12px 16px;border-bottom:1px solid #e7eaf0;color:#667085;font:600 13px Arial,sans-serif;white-space:nowrap">${escapeHtml(label)}</th><td style="padding:12px 16px;border-bottom:1px solid #e7eaf0;color:#172033;font:15px Arial,sans-serif;line-height:1.6">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`;
}

function makeEmail(data) {
  const serviceRequest = data.kind === "service";
  const heading = serviceRequest ? "New project request" : "New portfolio message";
  const subjectLabel = serviceRequest ? "Services" : "Topic";
  const subjectValue = serviceRequest ? data.services : data.subject;
  const title = serviceRequest ? `Project request · ${data.services || "Services not specified"}` : `Portfolio message · ${data.subject || "General"}`;
  const details = serviceRequest ? data.details : data.message;
  const fields = [
    row("Name", data.name),
    row("Email", data.email),
    row(subjectLabel, subjectValue),
    serviceRequest ? row("Budget", data.budget) : "",
    serviceRequest ? row("Timeline", data.timeline) : "",
    serviceRequest ? row("Country", data.country) : "",
    serviceRequest ? row("Company", data.company) : "",
    `<tr><td colspan="2" style="padding:18px 16px 8px;color:#667085;font:600 13px Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em">${serviceRequest ? "Project details" : "Message"}</td></tr>`,
    `<tr><td colspan="2" style="padding:0 16px 20px;color:#172033;font:15px Arial,sans-serif;line-height:1.7;white-space:normal">${escapeHtml(details).replace(/\n/g, "<br>")}</td></tr>`,
  ].join("");
  const html = `<!doctype html><html><body style="margin:0;padding:28px 12px;background:#f3f5f8"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #e7eaf0;border-radius:12px;overflow:hidden"><tr><td style="padding:24px 24px 20px;background:#111827;color:#fff"><div style="font:700 12px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#a8b5ca">MONSIU · PORTFOLIO</div><h1 style="margin:12px 0 0;font:600 23px Arial,sans-serif">${escapeHtml(heading)}</h1></td></tr><tr><td style="padding:8px 8px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${fields}</table></td></tr><tr><td style="padding:16px 24px 22px;color:#667085;font:12px Arial,sans-serif">Sent from <a href="https://monsiu.github.io" style="color:#375dfb">monsiu.github.io</a>. Reply directly to this email to respond to ${escapeHtml(data.name || data.email)}.</td></tr></table></td></tr></table></body></html>`;
  const text = [heading, "", `Name: ${data.name || "Not provided"}`, `Email: ${data.email}`, `${subjectLabel}: ${subjectValue || "Not specified"}`, serviceRequest ? `Budget: ${data.budget || "Not specified"}` : "", serviceRequest ? `Timeline: ${data.timeline || "Not specified"}` : "", serviceRequest ? `Country: ${data.country || "Not specified"}` : "", serviceRequest ? `Company: ${data.company || "Not provided"}` : "", "", serviceRequest ? "Project details:" : "Message:", details, "", "Sent from monsiu.github.io"].filter(Boolean).join("\n");
  return { subject: title, html, text };
}

async function verifyTurnstile(token, remoteIp, secret) {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true && (!result.hostname || result.hostname === "monsiu.github.io");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403);
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
      } });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
    if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403);
    if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) return json({ error: "Request is too large" }, 413, origin);

    let payload;
    try { payload = await request.json(); } catch { return json({ error: "Invalid request" }, 400, origin); }
    if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_BODY_BYTES) return json({ error: "Request is too large" }, 413, origin);

    // Silently accept bot traps so automated senders do not learn the form rules.
    if (clean(payload.companyTrap || payload.company, 200)) return json({ ok: true }, 200, origin);

    const data = {
      kind: payload.kind === "service" ? "service" : "portfolio",
      name: clean(payload.name, 100),
      email: clean(payload.email, 200),
      subject: clean(payload.subject, 120).replace(/[\r\n]+/g, " "),
      message: clean(payload.message, 5000),
      services: clean(payload.services, 500),
      budget: clean(payload.budget, 100),
      timeline: clean(payload.timeline, 100),
      country: clean(payload.country, 100),
      company: clean(payload.organization, 150),
      details: clean(payload.details, 5000),
    };
    if (!EMAIL_RE.test(data.email)) return json({ error: "Enter a valid email address." }, 400, origin);
    if (data.kind === "service" ? data.details.length < 5 : data.message.length < 5) return json({ error: "Please add a little more detail." }, 400, origin);
    if (!payload.turnstileToken || !await verifyTurnstile(payload.turnstileToken, request.headers.get("CF-Connecting-IP"), env.TURNSTILE_SECRET)) {
      return json({ error: "Verification failed. Please try again." }, 400, origin);
    }

    try {
      const email = makeEmail(data);
      await env.EMAIL.send({
        from: { name: "Monsiu Portfolio", email: env.EMAIL_FROM },
        to: env.EMAIL_TO,
        replyTo: { name: data.name || data.email, email: data.email },
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      return json({ ok: true }, 200, origin);
    } catch (error) {
      console.error("Contact email delivery failed", error?.code || "unknown");
      return json({ error: "Your message could not be delivered. Please email me directly." }, 502, origin);
    }
  },
};
