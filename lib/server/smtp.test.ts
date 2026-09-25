import { describe, it, expect } from "vitest";
import net from "node:net";
import {
  smtpEnvelopeRecipients,
  buildData,
  sendViaSmtp,
} from "@/lib/server/smtp";

const base = {
  host: "127.0.0.1",
  port: 54325,
  from: "notifications@cognote.studio",
  fromHeader: '"Studio (via CogNote)" <notifications@cognote.studio>',
  to: "parent@example.com",
  subject: "Hi",
  text: "Body",
};

describe("smtpEnvelopeRecipients", () => {
  it("adds BCC recipients to the envelope", () => {
    expect(
      smtpEnvelopeRecipients({ to: base.to, bcc: "teacher@example.com" })
    ).toEqual(["parent@example.com", "teacher@example.com"]);
  });

  it("handles arrays and no BCC", () => {
    expect(
      smtpEnvelopeRecipients({
        to: ["a@example.com", "b@example.com"],
        bcc: ["c@example.com"],
      })
    ).toEqual(["a@example.com", "b@example.com", "c@example.com"]);
    expect(smtpEnvelopeRecipients({ to: base.to })).toEqual([
      "parent@example.com",
    ]);
  });
});

describe("buildData BCC handling", () => {
  it("never writes a Bcc header or the BCC address into headers", () => {
    const data = buildData({ ...base, bcc: "teacher@example.com" });
    const [headers] = data.split("\r\n\r\n");
    expect(headers).toContain("To: parent@example.com");
    expect(headers).not.toMatch(/^Bcc:/im);
    expect(headers).not.toContain("teacher@example.com");
  });

  it("leaves the message unchanged when there is no BCC", () => {
    const data = buildData(base);
    expect(data).toContain("To: parent@example.com");
    expect(data).not.toMatch(/^Bcc:/im);
  });
});

/** Accept one message and capture the RCPT list and DATA payload. */
async function captureOneMessage(): Promise<{
  port: number;
  rcpts: string[];
  getData: () => string;
  close: () => void;
}> {
  const rcpts: string[] = [];
  let data = "";
  let inData = false;
  const server = net.createServer((socket) => {
    socket.setEncoding("utf8");
    socket.write("220 test ESMTP\r\n");
    let buf = "";
    socket.on("data", (chunk: string) => {
      buf += chunk;
      let idx = buf.indexOf("\r\n");
      while (idx !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write("250 OK\r\n");
          } else {
            data += `${line}\r\n`;
          }
        } else {
          const upper = line.toUpperCase();
          if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
            socket.write("250-test\r\n250 OK\r\n");
          } else if (upper.startsWith("RCPT TO:")) {
            rcpts.push(
              line.replace(/^RCPT TO:</i, "").replace(/>$/, "").trim()
            );
            socket.write("250 OK\r\n");
          } else if (upper === "DATA") {
            inData = true;
            socket.write("354 End data\r\n");
          } else if (upper === "QUIT") {
            socket.write("221 Bye\r\n");
            socket.end();
          } else {
            socket.write("250 OK\r\n");
          }
        }
        idx = buf.indexOf("\r\n");
      }
    });
  });

  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve())
  );
  const port = (server.address() as net.AddressInfo).port;
  return { port, rcpts, getData: () => data, close: () => server.close() };
}

describe("sendViaSmtp BCC delivery", () => {
  it("delivers BCC via RCPT TO and keeps it out of the headers", async () => {
    const capture = await captureOneMessage();
    try {
      await sendViaSmtp({
        ...base,
        port: capture.port,
        bcc: "teacher@example.com",
      });
      expect(capture.rcpts).toContain("parent@example.com");
      expect(capture.rcpts).toContain("teacher@example.com");
      expect(capture.getData()).toContain("To: parent@example.com");
      expect(capture.getData()).not.toMatch(/^Bcc:/im);
      expect(capture.getData()).not.toContain("teacher@example.com");
    } finally {
      capture.close();
    }
  });
});
