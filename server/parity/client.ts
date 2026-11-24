/**
 * A raw HTTP/1.1 client for the parity test: the request goes out byte for byte as the corpus
 * writes it (`fetch` would resolve `..`, set its own Host and refuse some methods), on a new
 * connection. The answer is framed by the client itself — `Content-Length`, chunked encoding,
 * or the close of the connection when the server declares neither — because Bun.serve keeps a
 * connection open after answering a POST, whatever its `Connection: close`.
 */
import { connect } from "node:net";

export interface RawResponse {
  readonly status: number;
  /** Lowercased names, in the order received. */
  readonly headers: readonly (readonly [string, string])[];
  readonly body: Uint8Array;
}

const HEAD_END = "\r\n\r\n";
const EXCHANGE_TIMEOUT_MS = 10_000;

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** HTTP heads are bytes: one character per byte, whatever its value. */
const latin1 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("latin1");

function indexOf(bytes: Uint8Array, needle: string, from: number): number {
  const target = new TextEncoder().encode(needle);
  outer: for (let index = from; index <= bytes.length - target.length; index += 1) {
    for (let offset = 0; offset < target.length; offset += 1) {
      if (bytes[index + offset] !== target[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

/**
 * Decodes a chunked body. Returns the body and the bytes it used, or `null` while the last
 * chunk has not arrived; a malformed size is an error, never a partial body.
 */
export function dechunk(
  body: Uint8Array,
): { readonly body: Uint8Array; readonly used: number } | null {
  const parts: Uint8Array[] = [];
  let offset = 0;
  for (;;) {
    const lineEnd = indexOf(body, "\r\n", offset);
    if (lineEnd === -1) return null;
    const field = latin1(body.subarray(offset, lineEnd)).split(";")[0] ?? "";
    if (!/^[0-9A-Fa-f]+$/.test(field.trim())) throw new Error("parity.chunk_malformed");
    const size = Number.parseInt(field, 16);
    offset = lineEnd + 2;
    if (size === 0) {
      // No trailer is sent by either server: the last chunk ends with one more line break.
      if (body.length < offset + 2) return null;
      return { body: concat(parts), used: offset + 2 };
    }
    if (body.length < offset + size + 2) return null;
    parts.push(body.subarray(offset, offset + size));
    offset += size + 2;
  }
}

interface Head {
  readonly status: number;
  readonly headers: readonly (readonly [string, string])[];
  readonly bodyStart: number;
}

function parseHead(raw: Uint8Array): Head | null {
  const end = indexOf(raw, HEAD_END, 0);
  if (end === -1) return null;
  const lines = latin1(raw.subarray(0, end)).split("\r\n");
  const status = Number(/^HTTP\/1\.1 (\d{3})/.exec(lines[0] ?? "")?.[1]);
  if (!Number.isInteger(status)) throw new Error("parity.response_without_status");
  const headers = lines.slice(1).map((line): [string, string] => {
    const colon = line.indexOf(":");
    return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
  });
  return { status, headers, bodyStart: end + HEAD_END.length };
}

/**
 * The complete response in `raw`, or `null` while it is incomplete. `closed` says the server
 * closed the connection: only then does a response without a declared length end.
 */
export function parseResponse(
  raw: Uint8Array,
  method: string,
  closed: boolean,
): RawResponse | null {
  const head = parseHead(raw);
  if (head === null) {
    if (closed) throw new Error("parity.response_without_head");
    return null;
  }
  const { status, headers, bodyStart } = head;
  const rest = raw.subarray(bodyStart);
  // RFC 9112 §6.3: no body after HEAD, 1xx, 204 and 304, whatever the headers say.
  if (method === "HEAD" || status === 204 || status === 304 || (status >= 100 && status < 200)) {
    return { status, headers, body: new Uint8Array(0) };
  }
  const value = (name: string) => headers.find(([key]) => key === name)?.[1];
  if (value("transfer-encoding")?.toLowerCase() === "chunked") {
    const decoded = dechunk(rest);
    if (decoded === null) {
      if (closed) throw new Error("parity.chunk_truncated");
      return null;
    }
    return { status, headers, body: decoded.body };
  }
  const declared = value("content-length");
  if (declared !== undefined) {
    const length = Number(declared);
    if (!Number.isInteger(length) || length < 0) throw new Error("parity.length_invalid");
    if (rest.length < length) {
      if (closed) throw new Error("parity.body_truncated");
      return null;
    }
    return { status, headers, body: rest.subarray(0, length) };
  }
  return closed ? { status, headers, body: rest } : null;
}

/** Sends `request` (whose method is `method`) to 127.0.0.1:`port` and reads one response. */
export function exchange(
  port: number,
  method: string,
  request: Uint8Array,
  timeoutMs: number = EXCHANGE_TIMEOUT_MS,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let settled = false;
    const settle = (closed: boolean) => {
      if (settled) return;
      try {
        const response = parseResponse(concat(chunks), method, closed);
        if (response === null) return;
        settled = true;
        socket.destroy();
        resolve(response);
      } catch (error) {
        settled = true;
        socket.destroy();
        reject(error);
      }
    };
    const socket = connect({ port, host: "127.0.0.1" }, () => socket.write(request));
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error("parity.exchange_timeout")));
    socket.on("data", (chunk) => {
      // No encoding is set on the socket: every chunk is a Buffer.
      chunks.push(
        typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk),
      );
      settle(false);
    });
    socket.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    socket.on("close", () => settle(true));
  });
}
