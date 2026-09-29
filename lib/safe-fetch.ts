import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Agent, fetch } from "undici";

function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

// Pin DNS resolution for each hop; validating a name and then resolving it again
// during the request would leave image downloads vulnerable to DNS rebinding.
export async function fetchPublicBytes(
  input: string,
  maxBytes = 6 * 1024 * 1024,
  signal?: AbortSignal,
): Promise<{ bytes: Buffer; contentType: string; url: string }> {
  const requestSignal = AbortSignal.any([
    AbortSignal.timeout(15_000),
    ...(signal ? [signal] : []),
  ]);
  requestSignal.throwIfAborted();
  let current = new URL(input);
  for (let hop = 0; hop < 5; hop++) {
    requestSignal.throwIfAborted();
    if (
      current.protocol !== "https:" ||
      current.username ||
      current.password ||
      (current.port && current.port !== "443")
    ) {
      throw new Error("Only public HTTPS images and pages are supported.");
    }
    const addresses = await abortable(
      lookup(current.hostname, { all: true }),
      requestSignal,
    );
    if (
      !addresses.length ||
      addresses.some(({ address }) => !isPublicAddress(address))
    ) {
      throw new Error("This resource does not point to a public address.");
    }
    const pinned = addresses[0];
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [pinned]);
          else callback(null, pinned.address, pinned.family);
        },
      },
    });
    try {
      const response = await fetch(current, {
        dispatcher,
        redirect: "manual",
        signal: requestSignal,
        headers: {
          "User-Agent": "NotionLabReports/0.1 (+public-page-report-renderer)",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location)
          throw new Error("The resource redirected without a destination.");
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`The resource returned HTTP ${response.status}.`);
      }
      if (Number(response.headers.get("content-length")) > maxBytes) {
        await response.body?.cancel();
        throw new Error("The resource is too large to embed.");
      }
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (response.body) {
        for await (const chunk of response.body) {
          size += chunk.byteLength;
          if (size > maxBytes)
            throw new Error("The resource is too large to embed.");
          chunks.push(chunk);
        }
      }
      return {
        bytes: Buffer.concat(chunks),
        contentType: response.headers.get("content-type")?.split(";")[0] ?? "",
        url: current.href,
      };
    } finally {
      await dispatcher.destroy();
    }
  }
  throw new Error("The resource redirected too many times.");
}
