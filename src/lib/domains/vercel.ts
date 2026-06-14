import 'server-only';

/**
 * Wrapper de Vercel API para gestionar dominios custom de tenants.
 * Requiere env vars VERCEL_API_TOKEN + VERCEL_PROJECT_ID.
 * Opcional VERCEL_TEAM_ID si el proyecto está bajo un team.
 */

const VERCEL_API = 'https://api.vercel.com';

function getToken(): string {
  const t = process.env.VERCEL_API_TOKEN;
  if (!t) throw new Error('VERCEL_API_TOKEN not configured');
  return t;
}
function getProjectId(): string {
  const p = process.env.VERCEL_PROJECT_ID;
  if (!p) throw new Error('VERCEL_PROJECT_ID not configured');
  return p;
}
function getTeamQuery(): string {
  const team = process.env.VERCEL_TEAM_ID;
  return team ? `?teamId=${encodeURIComponent(team)}` : '';
}

export type VercelDomainStatus = {
  name: string;
  verified: boolean;
  apexValue?: string;
  cnameTarget?: string;
  verification?: Array<{ type: string; domain: string; value: string; reason: string }>;
  raw: unknown;
};

/** Agrega el dominio al proyecto. Idempotente (409 = ya existía → OK). */
export async function addDomainToVercel(domain: string): Promise<VercelDomainStatus> {
  const token = getToken();
  const projectId = getProjectId();
  const team = getTeamQuery();
  const res = await fetch(`${VERCEL_API}/v10/projects/${projectId}/domains${team}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: domain })
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(`Vercel addDomain failed: ${res.status} ${text}`);
  }
  return await getDomainStatus(domain);
}

export async function getDomainStatus(domain: string): Promise<VercelDomainStatus> {
  const token = getToken();
  const projectId = getProjectId();
  const team = getTeamQuery();
  const res = await fetch(`${VERCEL_API}/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${team}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    if (res.status === 404) return { name: domain, verified: false, raw: { error: 'not_found' } };
    const text = await res.text();
    throw new Error(`Vercel getDomain failed: ${res.status} ${text}`);
  }
  const data = await res.json() as {
    name: string; verified: boolean;
    verification?: Array<{ type: string; domain: string; value: string; reason: string }>;
  };
  return {
    name: data.name,
    verified: data.verified,
    apexValue: '76.76.21.21',
    cnameTarget: 'cname.vercel-dns.com',
    verification: data.verification,
    raw: data
  };
}

export async function removeDomainFromVercel(domain: string): Promise<void> {
  const token = getToken();
  const projectId = getProjectId();
  const team = getTeamQuery();
  const res = await fetch(`${VERCEL_API}/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${team}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Vercel removeDomain failed: ${res.status} ${text}`);
  }
}

export async function verifyDomain(domain: string): Promise<VercelDomainStatus> {
  const token = getToken();
  const projectId = getProjectId();
  const team = getTeamQuery();
  await fetch(`${VERCEL_API}/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}/verify${team}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await getDomainStatus(domain);
}
