/**
 * KyriosStems - backend/src/routes/drive.js
 * Ponte entre o navegador e o Google Drive.
 *
 * Os bytes dos arquivos NÃO passam pelo backend. Um pacote de sessão pode ter
 * gigabytes; fazê-lo atravessar a API somaria latência, consumiria memória do
 * processo e esbarraria no limite de corpo da requisição.
 *
 * O fluxo é:
 *   1. o navegador pede a preparação, informando nome e tamanho de cada arquivo
 *   2. o backend cria as pastas e assina uma URL de envio retomável por arquivo
 *   3. o navegador envia os bytes direto para o Drive
 *   4. o navegador registra a sessão com os ids devolvidos pelo Drive
 *
 * Assim o backend nunca vê a senha do banco nem os bytes dos arquivos, e o
 * navegador nunca vê o refresh token da conta do Drive.
 */

import { post, get } from '../http/router.js';
import { sendJson, readJsonBody, HttpError } from '../http/respond.js';
import * as Drive from '../drive/client.js';
import { drive as driveConfig, server } from '../config.js';
import {
  categorize,
  sanitizeFileName,
  safeHeaderFileName,
  folderName,
  packageFileName,
} from '../lib/files.js';
import * as Songs from '../db/songs.js';
import * as Sessions from '../db/sessions.js';

/**
 * Cria (ou reaproveita) a pasta de uma sessão no Drive e devolve uma URL de
 * envio por arquivo.
 */
post('/api/drive/prepare', {
  auth: true,
  handler: async ({ request, response, origin }) => {
    const body = await readJsonBody(request);
    const { songId, sessionId, files } = body;

    if (!songId || !sessionId) throw new HttpError(400, 'Informe songId e sessionId.');
    if (!Array.isArray(files) || !files.length) {
      throw new HttpError(400, 'Informe ao menos um arquivo.');
    }

    // A música precisa existir: a pasta é derivada dela e a sessão a referencia.
    const song = await Songs.getSong(songId);
    if (!song) throw new HttpError(404, 'A música precisa ser gravada antes dos arquivos.');

    const sessionFolder = await Drive.ensureFolder(
      folderName('session', sessionId),
      driveConfig.rootFolderId,
    );

    const uploads = [];
    for (const file of files) {
      const name = sanitizeFileName(file.name);
      const category = file.category || categorize(name);

      const uploadUrl = await Drive.createResumableUpload({
        name,
        parentId: sessionFolder,
        contentType: file.contentType,
        size: file.size,
      });

      uploads.push({
        name,
        category,
        path: file.path || name,
        size: file.size ?? null,
        uploadUrl,
      });
    }

    sendJson(response, 200, { folderId: sessionFolder, uploads }, origin);
  },
});

/** Metadados de um arquivo, para conferir tamanho e nome. */
get('/api/drive/files/:fileId', {
  auth: true,
  handler: async ({ response, params, origin }) => {
    const file = await Drive.getFile(params.fileId);
    sendJson(response, 200, {
      file: { id: file.id, name: file.name, size: Number(file.size || 0), mimeType: file.mimeType },
    }, origin);
  },
});

/**
 * Entrega o conteúdo de um arquivo.
 *
 * A biblioteca é privada, então o backend faz o papel de intermediário: confere
 * o token, busca no Drive e repassa o stream. O nome amigável vai no
 * Content-Disposition, o que resolve a limitação conhecida do Firebase Storage,
 * onde o atributo `download` era ignorado entre domínios.
 */
get('/api/drive/files/:fileId/content', {
  // Sem autenticação quando o download é público (padrão). Com
  // KYRIOS_PUBLIC_DOWNLOAD=false, o roteador passa a exigir o token.
  auth: !server.publicDownload,
  handler: async ({ request, response, params, query, origin }) => {
    const file = await Drive.getFile(params.fileId);
    const stream = await Drive.downloadFile(params.fileId, request.headers.range);

    // O nome amigável vem por parâmetro e é reduzido a um nome de arquivo
    // seguro antes de entrar no cabeçalho — sem isso, um valor com quebra de
    // linha permitiria injetar cabeçalhos na resposta.
    const requested = query.get('name');
    const downloadName = requested ? safeHeaderFileName(requested) : null;

    const headers = {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Cache-Control': 'private, max-age=0',
      ...(downloadName
        ? { 'Content-Disposition': `attachment; filename="${downloadName}"` }
        : {}),
    };

    // Repassa o suporte a requisições parciais: sem isso, um download grande
    // interrompido recomeçaria do zero.
    for (const header of ['content-length', 'content-range', 'accept-ranges']) {
      const value = stream.headers.get(header);
      if (value) headers[header.replace(/(^|-)([a-z])/g, (m) => m.toUpperCase())] = value;
    }

    response.writeHead(stream.status, { ...headers, ...(origin ? { Vary: 'Origin' } : {}) });
    for await (const chunk of stream.body) response.write(chunk);
    response.end();
  },
});

/**
 * URL de download com nome amigável.
 *
 * Devolve o caminho do próprio backend, não uma URL do Drive: a pasta é
 * privada e o token de sessão é o que autoriza. O nome é resolvido aqui para
 * que o navegador salve o arquivo com o título da música.
 */
get('/api/drive/sessions/:sessionId/package', {
  handler: async ({ response, params, origin }) => {
    const session = await Sessions.getSession(params.sessionId);
    if (!session) throw new HttpError(404, 'Sessão não encontrada.');
    if (!session.packageFileId) throw new HttpError(404, 'Esta sessão não tem pacote.');

    const song = await Songs.getSong(session.songId);
    const name = packageFileName(song, session);

    sendJson(response, 200, {
      url: `/api/drive/files/${session.packageFileId}/content`,
      fileName: name,
      size: session.packageSize,
    }, origin);
  },
});

/** Arquivos individuais de uma sessão, para download avulso. */
get('/api/drive/sessions/:sessionId/files', {
  handler: async ({ response, params, origin }) => {
    const session = await Sessions.getSession(params.sessionId);
    if (!session) throw new HttpError(404, 'Sessão não encontrada.');

    const files = await Sessions.listFilesBySession(params.sessionId);

    sendJson(response, 200, {
      files: files.map((file) => ({
        ...file,
        url: `/api/drive/files/${file.fileId}/content?name=${encodeURIComponent(file.name)}`,
      })),
    }, origin);
  },
});