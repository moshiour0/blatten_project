// api/counter.js
// Vercel serverless proxy for CounterAPI (preserve behavior, robust fetch fallback)

export default async function handler(req, res) {
  // Allow CORS so your GitHub Pages site or other frontends can call this endpoint.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Ensure we have a fetch implementation (Node 18+ on Vercel has global fetch).
  let fetchFn = global.fetch || (globalThis && globalThis.fetch);
  if (!fetchFn) {
    try {
      const nodeFetch = await import('node-fetch');
      fetchFn = nodeFetch.default || nodeFetch;
    } catch (e) {
      console.error('Failed to load node-fetch fallback:', e);
      return res.status(500).json({ error: 'no_fetch_available', message: 'Server fetch not available' });
    }
  }

  try {
    // Call the CounterAPI on the server side (not blocked by browser extensions)
    const upstream = await fetchFn('https://api.counterapi.dev/v2/sarguardians/sarguardians/up', {
      method: 'GET'
    });

    // try to parse JSON safely
    let data = null;
    try {
      data = await upstream.json();
    } catch (parseErr) {
      console.error('Failed to parse upstream JSON:', parseErr);
      // Mirror upstream status with a minimal error payload
      return res.status(upstream.status || 502).json({ error: 'invalid_upstream_json', details: String(parseErr) });
    }

    // Mirror upstream status and body
    return res.status(upstream.status || 200).json(data);
  } catch (err) {
    console.error('Proxy fetch failed:', err && err.stack ? err.stack : err);
    return res.status(502).json({ error: 'proxy_failed', message: String(err) });
  }
}
