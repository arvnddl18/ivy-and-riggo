/**
 * Cloudflare Pages Function — Health Check (/api/health)
 */
export async function onRequestGet(context) {
  const hasDb = Boolean(context.env && context.env.DB);
  return new Response(
    JSON.stringify({
      ok: true,
      service: 'riggo-and-ivy-wedding',
      databaseConnected: hasDb,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}
