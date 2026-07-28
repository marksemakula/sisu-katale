// Vercel Serverless Function: /api/submit-application
// Proxies "Apply Now" submissions to the Google Apps Script web app server-side.
// A direct browser fetch() to script.google.com can't reliably read the JSON
// response (Apps Script doesn't set CORS headers), so this relays the request
// and returns a clean JSON result to the frontend.
//
// This is a dedicated deployment for the SISU (Scooby Doo International
// School Uganda) campus sites (Katale, Gulu, etc.). The Apps Script emails
// coordinator@scoobydoointernational.ac.ug and info@ges.ac.ug, and logs a
// backup row to its own Sheet.
//
// If this ever starts returning "Upstream returned 403", the script's OAuth
// authorization has likely lapsed (a known Apps Script quirk for personal
// accounts): open the "SISU Katale Apply Now Handler" project -> Deploy ->
// New deployment -> Web app (Execute as: Me, Who has access: Anyone) ->
// Authorize access, then update the URL below.

const APPLY_NOW_FORM_URL = 'https://script.google.com/macros/s/AKfycbywzX0Y8iSS-epKQIBmlxHaFvqMv6fmFNoKtHJaGA6gG0cVWS7m7AQsObjvJDNEbzos/exec';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const payload = req.body || {};

  if (!payload.learnerName || !payload.name || !payload.phone) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    const upstream = await fetch(APPLY_NOW_FORM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow' // Apps Script redirects to script.googleusercontent.com
    });

    const text = await upstream.text();

    let result = null;
    try {
      result = JSON.parse(text);
    } catch (e) {
      result = { success: upstream.ok, raw: text.substring(0, 300) };
    }

    if (upstream.ok && result.success !== false) {
      return res.status(200).json({ success: true });
    }

    console.error('Apps Script submission failed', upstream.status, text.substring(0, 500));
    return res.status(502).json({ success: false, error: result.error || `Upstream returned ${upstream.status}` });
  } catch (error) {
    console.error('submit-application error', error);
    return res.status(500).json({ success: false, error: 'Internal error submitting application' });
  }
}
