/**
 * Minimal SMTP client for local dev delivery to Mailpit (no auth, no TLS).
 * Deliberately not a general-purpose SMTP implementation — production email
 * goes through the Resend provider in lib/email.ts. Zero dependencies so the
 * local stack needs nothing beyond `supabase start`.
 */

import net from "node:net";

export interface SmtpMessage {
  host: string;
  port: number;
  /** Envelope sender (bare address). */
  from: string;
  /** RFC 5322 From header, e.g. `"Studio (via CogNote)" <notifications@...>`. */
  fromHeader: string;
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

const TIMEOUT_MS = 10_000;

export async function sendViaSmtp(msg: SmtpMessage): Promise<void> {
  const socket = net.connect({ host: msg.host, port: msg.port });
  socket.setTimeout(TIMEOUT_MS);

  let buffer = "";
  let pending: { resolve: (line: string) => void; reject: (err: Error) => void } | null = null;

  const fail = (err: Error) => {
    socket.destroy();
    pending?.reject(err);
    pending = null;
  };

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    // SMTP replies end with "\r\n"; multiline replies use "250-..." continuation
    // lines, so wait until the final line ("250 ..." with a space) arrives.
    if (!buffer.endsWith("\r\n")) return;
    const lines = buffer.trimEnd().split("\r\n");
    const last = lines[lines.length - 1];
    if (last.length >= 4 && last[3] === "-") return;
    buffer = "";
    pending?.resolve(last);
    pending = null;
  });
  socket.on("error", (err) => fail(err));
  socket.on("timeout", () => fail(new Error("SMTP connection timed out")));

  const readReply = (expect: number): Promise<void> =>
    new Promise((resolve, reject) => {
      pending = {
        resolve: (line) => {
          const code = Number(line.slice(0, 3));
          if (code === expect) resolve();
          else reject(new Error(`Expected ${expect}, got: ${line}`));
        },
        reject,
      };
    });

  const send = (command: string, expect: number): Promise<void> => {
    const reply = readReply(expect);
    socket.write(command + "\r\n");
    return reply;
  };

  try {
    await readReply(220); // server greeting
    await send("EHLO localhost", 250);
    await send(`MAIL FROM:<${msg.from}>`, 250);
    for (const recipient of Array.isArray(msg.to) ? msg.to : [msg.to]) {
      await send(`RCPT TO:<${recipient}>`, 250);
    }
    await send("DATA", 354);
    await send(buildData(msg), 250);
    await send("QUIT", 221).catch(() => {}); // best-effort; message accepted
  } finally {
    socket.end();
    socket.destroy();
  }
}

function buildData(msg: SmtpMessage): string {
  const headers = [
    `From: ${msg.fromHeader}`,
    `To: ${Array.isArray(msg.to) ? msg.to.join(", ") : msg.to}`,
    ...(msg.replyTo ? [`Reply-To: ${msg.replyTo}`] : []),
    `Subject: ${msg.subject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
  ];

  let body: string;
  if (msg.html) {
    const boundary = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="utf-8"',
      "",
      msg.text,
      `--${boundary}`,
      'Content-Type: text/html; charset="utf-8"',
      "",
      msg.html,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    headers.push('Content-Type: text/plain; charset="utf-8"');
    body = msg.text;
  }

  const data = headers.join("\r\n") + "\r\n\r\n" + body;
  // Dot-stuffing per RFC 5321 §4.5.2, then terminate DATA.
  return data.replace(/\r\n\./g, "\r\n..") + "\r\n.";
}
