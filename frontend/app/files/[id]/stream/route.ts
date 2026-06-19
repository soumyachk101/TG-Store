import { auth } from "@/auth";

// Use Node.js runtime so we get streaming fetch semantics (Web fetch
// buffers the body in some edge runtimes, which breaks video scrubbing).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const token = session?.apiToken;

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  // Forward the inbound Range header so video scrubbing / partial
  // downloads work end-to-end. Other headers are forwarded via the
  // upstream response below.
  const inboundRange = req.headers.get("range");
  const forwardHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (inboundRange) {
    forwardHeaders["Range"] = inboundRange;
  }

  // Propagate the inbound abort signal to the upstream fetch so that
  // a browser navigation, video scrub past EOF, or manual abort
  // doesn't leave a connection to Telegram open for up to the 300s
  // FastAPI stream timeout. Using `signal: req.signal` would abort on
  // the *node* side as well, which is exactly what we want.
  try {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
    const upstream = await fetch(
      `${apiBase}/files/${id}/stream`,
      {
        headers: forwardHeaders,
        cache: "no-store",
        signal: req.signal,
      }
    );

    // Clean up headers to avoid proxy conflicts (hop-by-hop headers and decompression header mismatches)
    const outboundHeaders = new Headers();
    for (const [key, value] of upstream.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === "connection" ||
        lowerKey === "keep-alive" ||
        lowerKey === "transfer-encoding" ||
        lowerKey === "content-encoding"
      ) {
        continue;
      }
      outboundHeaders.set(key, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: outboundHeaders,
    });
  } catch (error) {
    // Do NOT log the error verbatim — its str() can include the
    // upstream URL which embeds the bot token (the backend never
    // exposes that URL to the browser, but if the env var was
    // misconfigured the upstream fetch URL could still surface it).
    console.error("Stream proxy error:", (error as Error)?.name ?? "UnknownError");
    return new Response("Internal Server Error", { status: 500 });
  }
}