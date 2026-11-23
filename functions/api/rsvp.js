/**
 * Cloudflare Pages Function — Wedding RSVP API (/api/rsvp)
 * - POST /api/rsvp: Validates & stores a guest RSVP in Cloudflare D1 (`env.DB`)
 * - GET  /api/rsvp: Returns RSVP summary & list (protected via optional ADMIN_KEY header/query)
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function cleanText(value, maxLen = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return jsonResponse(
      { ok: false, error: 'Database binding (DB) is not configured.' },
      500
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON request body.' }, 400);
  }

  const attendance = cleanText(body.attendance, 60);
  const eventPart = cleanText(body.eventPart, 80);
  const guestSide = cleanText(body.guestSide, 80);
  const lastName = cleanText(body.lastName, 80);
  const firstName = cleanText(body.firstName, 80);
  const middleName = cleanText(body.lastNameKana || body.middleName, 80);
  const nickname = cleanText(body.firstNameKana || body.nickname, 80);
  const postalCode = cleanText(body.postalCode, 30);
  const address = cleanText(body.cityAddress || body.address, 200);
  const phone = cleanText(body.phone, 40);
  const email = cleanText(body.email, 120);
  const dietary = cleanText(body.dietary, 200);
  const message = cleanText(body.message, 1000);

  if (!attendance || !lastName || !firstName || !phone) {
    return jsonResponse(
      { ok: false, error: 'Please fill in all required RSVP fields.' },
      400
    );
  }

  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      `INSERT INTO rsvps (
        id, attendance, event_part, guest_side,
        last_name, first_name, middle_name, nickname,
        postal_code, address, phone, email, dietary, message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        attendance,
        eventPart || 'Both Ceremony & Reception',
        guestSide || 'Guest',
        lastName,
        firstName,
        middleName,
        nickname,
        postalCode,
        address,
        phone,
        email,
        dietary,
        message
      )
      .run();

    return jsonResponse(
      {
        ok: true,
        id,
        guestName: `${firstName} ${lastName}`.trim(),
        message: 'RSVP saved successfully.',
      },
      201
    );
  } catch (err) {
    console.error('D1 RSVP insert failed:', err);
    return jsonResponse(
      { ok: false, error: 'Unable to save RSVP right now. Please try again.' },
      500
    );
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) {
    return jsonResponse(
      { ok: false, error: 'Database binding (DB) is not configured.' },
      500
    );
  }

  // Optional admin protection if ADMIN_KEY secret is set in Cloudflare Pages
  if (env.ADMIN_KEY) {
    const url = new URL(request.url);
    const provided = request.headers.get('x-admin-key') || url.searchParams.get('key') || '';
    if (provided !== env.ADMIN_KEY) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, attendance, event_part, guest_side, last_name, first_name,
              middle_name, nickname, postal_code, address, phone, email,
              dietary, message, created_at
       FROM rsvps
       ORDER BY created_at DESC`
    ).all();

    const attendingCount = results.filter((r) =>
      String(r.attendance).toLowerCase().includes('attend')
    ).length;

    return jsonResponse({
      ok: true,
      total: results.length,
      attending: attendingCount,
      declined: results.length - attendingCount,
      rsvps: results,
    });
  } catch (err) {
    console.error('D1 RSVP query failed:', err);
    return jsonResponse({ ok: false, error: 'Unable to load RSVPs.' }, 500);
  }
}
