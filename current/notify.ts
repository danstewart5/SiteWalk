import { createServerFn } from "@tanstack/react-start";

export const sendTradeNotice = createServerFn({ method: "POST" })
  .validator((input: { channel: "sms" | "email"; to: string; body: string; subject?: string }) => input)
  .handler(async ({ data }) => {
    if (data.channel === "sms") {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM;
      if (!sid || !token || !from) {
        return { ok: false as const, mode: "device" as const, error: "SMS provider is not configured." };
      }
      const auth = btoa(`${sid}:${token}`);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: data.to, From: from, Body: data.body.slice(0, 1500) }),
      });
      if (!res.ok) {
        return { ok: false as const, mode: "provider" as const, error: `SMS failed (${res.status}).` };
      }
      return { ok: true as const, mode: "provider" as const };
    }

    const sendgrid = process.env.SENDGRID_API_KEY;
    const resend = process.env.RESEND_API_KEY;
    const postmark = process.env.POSTMARK_TOKEN;
    const from = process.env.NOTIFY_FROM_EMAIL || "sitewalk@example.com";
    const subject = data.subject || "SiteWalk notice";

    if (resend) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [data.to], subject, text: data.body }),
      });
      if (!res.ok) return { ok: false as const, mode: "provider" as const, error: `Email failed (${res.status}).` };
      return { ok: true as const, mode: "provider" as const };
    }
    if (sendgrid) {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${sendgrid}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: data.to }] }],
          from: { email: from },
          subject,
          content: [{ type: "text/plain", value: data.body }],
        }),
      });
      if (!res.ok) return { ok: false as const, mode: "provider" as const, error: `Email failed (${res.status}).` };
      return { ok: true as const, mode: "provider" as const };
    }
    if (postmark) {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": postmark,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ From: from, To: data.to, Subject: subject, TextBody: data.body }),
      });
      if (!res.ok) return { ok: false as const, mode: "provider" as const, error: `Email failed (${res.status}).` };
      return { ok: true as const, mode: "provider" as const };
    }

    return { ok: false as const, mode: "device" as const, error: "Email provider is not configured." };
  });
