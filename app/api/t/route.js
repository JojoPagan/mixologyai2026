import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Funnel telemetry sink — Phase 1 of the Guided Pour rollout.
 *
 * Deliberately has NO database. At the app's current volume (~45
 * installs/month) Vercel function logs ARE the analytics store: every
 * event lands as one structured console line, and the Phase-3 gate
 * read queries them via the Vercel runtime-logs API. If volume ever
 * makes logs impractical, this route is the single seam where a real
 * sink (KV, Tinybird, PostHog) plugs in without touching the client.
 *
 * Privacy: `sid` is a random per-install UUID minted on the client.
 * It is not the IDFA, not the device ID, and never linked to identity —
 * consistent with the App Privacy declaration (Analytics, not linked,
 * no tracking).
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { e, sid, ...rest } = body ?? {};
    if (typeof e !== 'string' || e.length > 64) {
      return new NextResponse(null, { status: 400 });
    }
    // One structured line per event. The "MIXTEL" prefix is the grep
    // handle for the gate read.
    console.log(
      'MIXTEL',
      JSON.stringify({
        e,
        sid: typeof sid === 'string' ? sid.slice(0, 36) : undefined,
        t: Date.now(),
        ...Object.fromEntries(
          Object.entries(rest)
            .slice(0, 8)
            .map(([k, v]) => [k.slice(0, 24), typeof v === 'string' ? v.slice(0, 120) : v]),
        ),
      }),
    );
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
