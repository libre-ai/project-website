import { describe, expect, test } from "bun:test";

import { dechunk, exchange, parseResponse } from "./client";

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (body: Uint8Array) => new TextDecoder().decode(body);

describe("raw HTTP client of the parity test", () => {
  test("a declared length ends the body, extra bytes are not part of it", () => {
    const response = parseResponse(
      bytes("HTTP/1.1 200 OK\r\nContent-Length: 3\r\nX-A: b\r\n\r\nabcdef"),
      "GET",
      false,
    );
    expect(response?.status).toBe(200);
    expect(response?.headers).toEqual([
      ["content-length", "3"],
      ["x-a", "b"],
    ]);
    expect(text(response?.body ?? new Uint8Array())).toBe("abc");
  });

  test("an incomplete answer waits, and is an error once the connection closes", () => {
    const partial = bytes("HTTP/1.1 200 OK\r\nContent-Length: 9\r\n\r\nabc");
    expect(parseResponse(partial, "GET", false)).toBeNull();
    expect(() => parseResponse(partial, "GET", true)).toThrow("parity.body_truncated");
    expect(parseResponse(bytes("HTTP/1.1 200 OK\r\n"), "GET", false)).toBeNull();
    expect(() => parseResponse(bytes("HTTP/1.1 200 OK\r\n"), "GET", true)).toThrow(
      "parity.response_without_head",
    );
    expect(() => parseResponse(bytes("garbage\r\n\r\n"), "GET", true)).toThrow(
      "parity.response_without_status",
    );
    expect(() =>
      parseResponse(bytes("HTTP/1.1 200 OK\r\nContent-Length: x\r\n\r\n"), "GET", false),
    ).toThrow("parity.length_invalid");
  });

  test("HEAD, 204 and 304 carry no body whatever their headers say", () => {
    const head = bytes("HTTP/1.1 200 OK\r\nContent-Length: 50\r\n\r\n");
    expect(parseResponse(head, "HEAD", false)?.body.length).toBe(0);
    const notModified = bytes("HTTP/1.1 304 Not Modified\r\nContent-Length: 50\r\n\r\n");
    expect(parseResponse(notModified, "GET", false)?.status).toBe(304);
  });

  test("a body without declared length ends with the connection", () => {
    const raw = bytes("HTTP/1.1 200 OK\r\n\r\nuntil close");
    expect(parseResponse(raw, "GET", false)).toBeNull();
    expect(text(parseResponse(raw, "GET", true)?.body ?? new Uint8Array())).toBe("until close");
  });

  test("a chunked body is decoded once its last chunk has arrived", () => {
    const whole =
      "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n3;x=y\r\nabc\r\n2\r\nde\r\n0\r\n\r\n";
    expect(text(parseResponse(bytes(whole), "GET", false)?.body ?? new Uint8Array())).toBe("abcde");
    const cut = bytes(whole.slice(0, -4));
    expect(parseResponse(cut, "GET", false)).toBeNull();
    expect(() => parseResponse(cut, "GET", true)).toThrow("parity.chunk_truncated");
    expect(() => dechunk(bytes("zz\r\nabc\r\n"))).toThrow("parity.chunk_malformed");
    expect(dechunk(bytes("3\r\nab"))).toBeNull();
  });
});

describe("raw HTTP exchange", () => {
  test("reads one framed answer from a server that keeps the connection open", async () => {
    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        data(socket) {
          socket.write("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok");
        },
      },
    });
    try {
      const response = await exchange(server.port, "GET", bytes("GET / HTTP/1.1\r\n\r\n"));
      expect(response.status).toBe(200);
      expect(text(response.body)).toBe("ok");
    } finally {
      server.stop(true);
    }
  });

  test("a silent server times out, a closed port is an error", async () => {
    const server = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    try {
      await expect(
        exchange(server.port, "GET", bytes("GET / HTTP/1.1\r\n\r\n"), 50),
      ).rejects.toThrow("parity.exchange_timeout");
    } finally {
      server.stop(true);
    }
    await expect(
      exchange(server.port, "GET", bytes("GET / HTTP/1.1\r\n\r\n"), 1000),
    ).rejects.toThrow();
  });

  test("a malformed answer is an error", async () => {
    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: 0,
      socket: {
        data(socket) {
          socket.end("nonsense\r\n\r\n");
        },
      },
    });
    try {
      await expect(exchange(server.port, "GET", bytes("GET / HTTP/1.1\r\n\r\n"))).rejects.toThrow(
        "parity.response_without_status",
      );
    } finally {
      server.stop(true);
    }
  });
});
