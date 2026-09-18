/**
 * KyriosStems - backend/src/routes/songs.js
 * Rotas de músicas e sessões.
 *
 * Leitura é pública (o catálogo é o propósito do sistema). Escrita exige token
 * de administrador. Os nomes dos campos na resposta são os mesmos que o
 * frontend já consumia do Firestore, para que as páginas não precisem mudar.
 */

import { get, post, patch, del } from '../http/router.js';
import { sendJson, readJsonBody, HttpError } from '../http/respond.js';
import * as Songs from '../db/songs.js';
import * as Sessions from '../db/sessions.js';
import * as Drive from '../drive/client.js';

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                    */
/* -------------------------------------------------------------------------- */

/** Todas as músicas e sessões, para o catálogo montar as facetas de filtro. */
get('/api/library', {
  handler: async ({ response, origin }) => {
    const [songs, sessions] = await Promise.all([Songs.listSongs(), Sessions.listSessions()]);
    const files = await Sessions.listFilesBySessions(sessions.map((session) => session.id));

    sendJson(response, 200, {
      songs,
      sessions: sessions.map((session) => ({
        ...session,
        files: files.get(session.id) ?? [],
      })),
    }, origin);
  },
});

/* -------------------------------------------------------------------------- */
/* Músicas                                                                     */
/* -------------------------------------------------------------------------- */

get('/api/songs/:id', {
  handler: async ({ response, params, origin }) => {
    const song = await Songs.getSong(params.id);
    if (!song) throw new HttpError(404, 'Música não encontrada.');

    const sessions = await Sessions.listSessionsBySong(params.id);
    const files = await Sessions.listFilesBySessions(sessions.map((session) => session.id));

    sendJson(response, 200, {
      song,
      sessions: sessions.map((session) => ({
        ...session,
        files: files.get(session.id) ?? [],
      })),
    }, origin);
  },
});

post('/api/songs', {
  auth: true,
  handler: async ({ request, response, origin }) => {
    const body = await readJsonBody(request);
    const song = body.song ?? body;
    if (!song?.id) throw new HttpError(400, 'A música precisa de um id.');

    const created = await Songs.createSong(song);
    sendJson(response, 201, { song: created }, origin);
  },
});

patch('/api/songs/:id', {
  auth: true,
  handler: async ({ request, response, params, origin }) => {
    const changes = await readJsonBody(request);
    const updated = await Songs.updateSong(params.id, changes);
    if (!updated) throw new HttpError(404, 'Música não encontrada.');
    sendJson(response, 200, { song: updated }, origin);
  },
});

/**
 * Exclui uma música.
 *
 * A ordem importa: os arquivos saem do Drive antes do registro no banco. Se a
 * remoção no Drive falhar, a música continua existindo e pode ser tentada de
 * novo — o contrário deixaria arquivos órfãos ocupando cota, sem referência
 * para encontrá-los depois.
 */
del('/api/songs/:id', {
  auth: true,
  handler: async ({ response, params, origin }) => {
    const song = await Songs.getSong(params.id);
    if (!song) throw new HttpError(404, 'Música não encontrada.');

    const files = await Songs.driveFilesOfSong(params.id);
    const failures = [];

    for (const file of files) {
      try {
        await Drive.trashFile(file.file_id);
      } catch (error) {
        failures.push({ name: file.name, message: error.message });
      }
    }

    if (failures.length) {
      throw new HttpError(
        502,
        `Não foi possível remover ${failures.length} arquivo(s) do Drive. A música não foi excluída.`,
      );
    }

    await Songs.deleteSong(params.id);
    sendJson(response, 200, { deleted: true, files: files.length }, origin);
  },
});

/* -------------------------------------------------------------------------- */
/* Sessões                                                                     */
/* -------------------------------------------------------------------------- */

post('/api/sessions', {
  auth: true,
  handler: async ({ request, response, origin }) => {
    const body = await readJsonBody(request);
    const session = body.session ?? body;
    const files = body.files ?? [];

    if (!session?.id || !session?.songId) {
      throw new HttpError(400, 'A sessão precisa de id e songId.');
    }

    const created = await Sessions.createSession(session, files);
    sendJson(response, 201, { session: created }, origin);
  },
});

patch('/api/sessions/:id', {
  auth: true,
  handler: async ({ request, response, params, origin }) => {
    const changes = await readJsonBody(request);
    const updated = await Sessions.updateSession(params.id, changes);
    if (!updated) throw new HttpError(404, 'Sessão não encontrada.');
    sendJson(response, 200, { session: updated }, origin);
  },
});

/** Próxima versão de uma DAW para uma música. */
get('/api/songs/:id/next-version', {
  auth: true,
  handler: async ({ response, params, query, origin }) => {
    const daw = String(query.get('daw') || '').trim();
    if (!daw) throw new HttpError(400, 'Informe a DAW.');

    const version = await Sessions.nextVersion(params.id, daw);
    sendJson(response, 200, { version }, origin);
  },
});

/** Exclui uma sessão, removendo antes os arquivos dela no Drive. */
del('/api/sessions/:id', {
  auth: true,
  handler: async ({ response, params, origin }) => {
    const session = await Sessions.getSession(params.id);
    if (!session) throw new HttpError(404, 'Sessão não encontrada.');

    const files = await Sessions.driveFilesOfSession(params.id);
    for (const file of files) {
      try {
        await Drive.trashFile(file.file_id);
      } catch (error) {
        throw new HttpError(
          502,
          `Não foi possível remover "${file.name}" do Drive. A sessão não foi excluída.`,
        );
      }
    }

    // A pasta da sessão também sai, se estiver registrada.
    if (session.driveFolderId) {
      try {
        await Drive.trashFile(session.driveFolderId);
      } catch {
        // Pasta já ausente ou inacessível não impede a exclusão do registro:
        // os arquivos, que são o que ocupa cota, já foram removidos.
      }
    }

    await Sessions.deleteSession(params.id);
    sendJson(response, 200, { deleted: true, files: files.length }, origin);
  },
});