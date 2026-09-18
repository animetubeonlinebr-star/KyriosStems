/**
 * Publica as Security Rules usando a chave de servico, sem firebase login.
 *
 * Usa a Firebase Rules API (firebaserules.googleapis.com), a mesma que o CLI
 * usa por baixo. Permite publicar as regras de forma nao interativa.
 */

const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const ROOT = path.resolve(__dirname, '..');
const key = require(path.join(ROOT, 'serviceAccount.json'));

async function headers() {
  const auth = new GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' };
}

async function api(h, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { ok: res.ok, status: res.status, body: parsed };
}

async function publish(h, project, sourceName, rulesFile) {
  const content = fs.readFileSync(path.join(ROOT, rulesFile), 'utf8');

  const release = `projects/${project}/releases/${sourceName}`;
  const rulesetName = `projects/${project}/rulesets`;

  // Cria um ruleset novo
  const created = await api(h, 'POST', `https://firebaserules.googleapis.com/v1/${rulesetName}`, {
    source: {
      files: [{ name: rulesFile, content }],
    },
  });

  if (!created.ok) {
    return { ok: false, step: 'criar ruleset', status: created.status, body: created.body };
  }

  const rulesetId = created.body.name;

  // Aponta o release para ele
  const updated = await api(h, 'PATCH', `https://firebaserules.googleapis.com/v1/${release}`, {
    release: { name: release, rulesetName: rulesetId },
  });

  if (!updated.ok) {
    return { ok: false, step: 'atualizar release', status: updated.status, body: updated.body };
  }

  return { ok: true, ruleset: rulesetId };
}

async function main() {
  const project = key.project_id;
  const h = await headers();

  const targets = [
    ['cloud.firestore', 'firestore.rules'],
    ['firebase.storage', 'storage.rules'],
  ];

  for (const [source, file] of targets) {
    console.log(`\n${source}  (${file})`);

    // Um release precisa existir antes de ser atualizado; tenta criar se faltar.
    const release = `projects/${project}/releases/${source}`;
    const existing = await api(h, 'GET', `https://firebaserules.googleapis.com/v1/${release}`);
    console.log(`  release existente: ${existing.ok ? 'sim' : `nao (HTTP ${existing.status})`}`);

    const result = await publish(h, project, source, file);

    if (result.ok) {
      console.log(`  PUBLICADO  ruleset ${result.ruleset.split('/').pop()}`);
    } else {
      console.log(`  FALHOU em "${result.step}" (HTTP ${result.status})`);
      console.log(`  ${JSON.stringify(result.body).slice(0, 300)}`);
    }
  }
}

main().catch((error) => {
  console.error('Erro:', error.message);
  process.exit(1);
});
