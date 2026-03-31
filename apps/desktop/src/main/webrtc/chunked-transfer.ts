import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { PeerTransportConnection } from "./peer-session";

export interface TransferCallbacks {
  onComplete(filePath: string, sha256: string): void;
  onError(err: Error): void;
  onProgress(bytesTransferred: number, totalBytes: number): void;
}

export const CHUNK_SIZE = 64 * 1024;

interface TransferHeader {
  filename: string;
  sha256: string;
  size: number;
  type: "header";
}

interface TransferEof {
  type: "eof";
}

export async function sendFile(
  conn: PeerTransportConnection,
  filePath: string,
  callbacks: TransferCallbacks,
): Promise<void> {
  let closedEarly = false;

  const handleClose = () => {
    closedEarly = true;
  };

  conn.on("close", handleClose);

  try {
    const stats = await fsp.stat(filePath);
    const totalBytes = stats.size;
    const sha256 = await computeFileSha256(filePath);

    await conn.send({
      filename: path.basename(filePath),
      sha256,
      size: totalBytes,
      type: "header",
    } satisfies TransferHeader);

    let transferredBytes = 0;
    const stream = fs.createReadStream(filePath, {
      highWaterMark: CHUNK_SIZE,
    });

    for await (const chunk of stream) {
      if (closedEarly) {
        throw new Error("Transfer cancelled");
      }

      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      await conn.send(buffer);
      transferredBytes += buffer.byteLength;
      callbacks.onProgress(transferredBytes, totalBytes);
    }

    if (closedEarly) {
      throw new Error("Transfer cancelled");
    }

    await conn.send({
      type: "eof",
    } satisfies TransferEof);

    callbacks.onComplete(filePath, sha256);
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error("Unexpected sender transfer error");
    callbacks.onError(normalizedError);
    throw normalizedError;
  } finally {
    conn.off("close", handleClose);
  }
}

export async function receiveFile(
  conn: PeerTransportConnection,
  partPath: string,
  finalPath: string,
  expectedSha256: string | null,
  callbacks: TransferCallbacks,
): Promise<void> {
  await fsp.mkdir(path.dirname(partPath), { recursive: true });
  await fsp.mkdir(path.dirname(finalPath), { recursive: true });
  await safeDeleteFile(partPath);

  const hash = createHash("sha256");
  const writeStream = fs.createWriteStream(partPath, {
    flags: "w",
  });

  let closedEarly = false;
  let header: TransferHeader | null = null;
  let receivedBytes = 0;
  let resolved = false;

  const dataQueue: unknown[] = [];
  let queueResolver: (() => void) | null = null;

  const handleData = (payload: unknown) => {
    dataQueue.push(payload);
    queueResolver?.();
    queueResolver = null;
  };

  const handleClose = () => {
    closedEarly = true;
    queueResolver?.();
    queueResolver = null;
  };

  const handleError = (error: unknown) => {
    closedEarly = true;
    callbacks.onError(error instanceof Error ? error : new Error("Transfer cancelled"));
    queueResolver?.();
    queueResolver = null;
  };

  conn.on("data", handleData);
  conn.on("close", handleClose);
  conn.on("error", handleError);

  try {
    while (!resolved) {
      if (dataQueue.length === 0) {
        if (closedEarly) {
          throw new Error("Transfer cancelled");
        }

        await new Promise<void>((resolve) => {
          queueResolver = resolve;
        });
        continue;
      }

      const payload = dataQueue.shift();
      if (payload === undefined) {
        continue;
      }

      if (isTransferHeader(payload)) {
        header = payload;
        continue;
      }

      if (isTransferEof(payload)) {
        if (!header) {
          throw new Error("Transfer ended before a header was received.");
        }

        if (receivedBytes !== header.size) {
          throw new Error(
            `Transfer size mismatch: expected ${header.size} bytes, received ${receivedBytes}.`,
          );
        }

        writeStream.end();
        await once(writeStream, "finish");

        const sha256 = hash.digest("hex");
        const hashToVerify = expectedSha256 ?? header.sha256;
        if (hashToVerify && sha256 !== hashToVerify) {
          throw new Error("SHA-256 mismatch after receiving the full trade file.");
        }

        await fsp.rename(partPath, finalPath);
        callbacks.onComplete(finalPath, sha256);
        resolved = true;
        continue;
      }

      if (!header) {
        throw new Error("Received file bytes before the transfer header.");
      }

      const buffer = normalizeBinaryPayload(payload);
      writeStream.write(buffer);
      hash.update(buffer);
      receivedBytes += buffer.byteLength;
      callbacks.onProgress(receivedBytes, header.size);
    }
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error("Unexpected receiver transfer error");
    callbacks.onError(normalizedError);
    throw normalizedError;
  } finally {
    conn.off("data", handleData);
    conn.off("close", handleClose);
    conn.off("error", handleError);
    writeStream.destroy();
  }
}

function isTransferHeader(payload: unknown): payload is TransferHeader {
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as { type?: unknown }).type === "header" &&
    typeof (payload as { filename?: unknown }).filename === "string" &&
    typeof (payload as { sha256?: unknown }).sha256 === "string" &&
    typeof (payload as { size?: unknown }).size === "number"
  );
}

function isTransferEof(payload: unknown): payload is TransferEof {
  return !!payload && typeof payload === "object" && (payload as { type?: unknown }).type === "eof";
}

function normalizeBinaryPayload(payload: unknown) {
  if (Buffer.isBuffer(payload)) {
    return payload;
  }

  if (payload instanceof Uint8Array) {
    return Buffer.from(payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength));
  }

  if (payload instanceof ArrayBuffer) {
    return Buffer.from(payload);
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return Buffer.from(data);
    }
  }

  throw new Error("Received an invalid binary payload during transfer.");
}

async function computeFileSha256(filePath: string) {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

async function safeDeleteFile(targetPath: string) {
  try {
    await fsp.unlink(targetPath);
  } catch (error) {
    const normalizedError = error as NodeJS.ErrnoException;
    if (normalizedError.code !== "ENOENT") {
      throw error;
    }
  }
}
