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

  try {
    const upstream = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/files/${id}/stream`,
      { headers: forwardHeaders }
    );

    // Pass through the upstream status (e.g. 206 for partial content)
    // and the full Headers object so Content-Range, Accept-Ranges,
    // Content-Length, etc. all make it back to the browser. Previously
    // only Content-Type and Content-Disposition were forwarded, which
    // silently broke video scrubbing.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
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