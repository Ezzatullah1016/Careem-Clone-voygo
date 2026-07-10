// Supabase Edge Function: notify
// Multi-channel notification fan-out: in-app row + SMS (Twilio) + email (Resend).
// Invoked by database webhooks or server code with the service role key.
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from "npm:@supabase/supabase-js@2";

interface NotifyPayload {
  user_id: string;
  title: string;
  body: string;
  type?: string;
  data?: Record<string, unknown>;
  channels?: ("in_app" | "sms" | "email")[];
}

Deno.serve(async (req) => {
  // Only service-role callers (server-to-server) may fan out notifications.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const payload = (await req.json()) as NotifyPayload;
  const channels = payload.channels ?? ["in_app"];

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results: Record<string, string> = {};

  if (channels.includes("in_app")) {
    const { error } = await admin.from("notifications").insert({
      user_id: payload.user_id,
      title: payload.title,
      body: payload.body,
      type: payload.type ?? "general",
      data: payload.data ?? {},
    });
    results.in_app = error ? `error: ${error.message}` : "sent";
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("phone, email")
    .eq("id", payload.user_id)
    .single();

  if (channels.includes("sms") && profile?.phone) {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const messagingSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
    if (sid && token && messagingSid) {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: profile.phone,
            MessagingServiceSid: messagingSid,
            Body: `${payload.title}\n${payload.body}`,
          }),
        }
      );
      results.sms = res.ok ? "sent" : `error: ${res.status}`;
    } else {
      results.sms = "skipped: twilio not configured";
    }
  }

  if (channels.includes("email") && profile?.email) {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Voygo <no-reply@voygo.app>",
          to: profile.email,
          subject: payload.title,
          text: payload.body,
        }),
      });
      results.email = res.ok ? "sent" : `error: ${res.status}`;
    } else {
      results.email = "skipped: resend not configured";
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
});
