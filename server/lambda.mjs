// AWS Lambda entry point for the admin API (API Gateway HTTP API, payload v2), for the
// hosting provider. Route /api/admin/* on the site's CloudFront distribution to this API
// so the browser sees one origin (no CORS, and the site's CSP connect-src 'self' holds).
//
// Environment:
//   ADMIN_PASSWORD        the shared admin password (store in Secrets Manager / SSM)
//   ADMIN_SESSION_SECRET  random 32+ byte string; must be set here so sessions survive
//                         across Lambda instances
//   BANNER_BUCKET         the site's S3 bucket; BANNER_KEY defaults to content/banner.json
//
// Not exercised by this repo's tests (the shared core is); verify on the AWS setup.
// Login rate limiting in the core is per instance, so add an API Gateway / WAF rate limit.

import { createAdminApi } from './admin-core.mjs';
import { s3Store } from './stores.mjs';

const BASE = process.env.ADMIN_API_BASE ?? '/api/admin';

let api;
export async function handler(event) {
  api ??= createAdminApi({
    password: process.env.ADMIN_PASSWORD,
    sessionSecret: process.env.ADMIN_SESSION_SECRET,
    store: s3Store({ bucket: process.env.BANNER_BUCKET, key: process.env.BANNER_KEY, region: process.env.AWS_REGION }),
  });
  const res = await api.handle({
    method: event.requestContext.http.method,
    path: event.rawPath.startsWith(BASE) ? event.rawPath.slice(BASE.length) : event.rawPath,
    headers: event.headers ?? {},
    body: event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString() : (event.body ?? ''),
    ip: event.requestContext.http.sourceIp,
  });
  return { statusCode: res.status, headers: res.headers, body: res.body };
}
