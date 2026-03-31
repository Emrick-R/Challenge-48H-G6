import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDatabaseReady, getClient } from '../server/db.js';

const apiBaseUrl = 'http://localhost:3001';
const frontendBaseUrl = 'http://localhost:5173';
const normalizedInputFile = path.join(process.cwd(), 'question', 'question-bank.normalized.json');
const themeId = 3;

async function api(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `HTTP ${response.status} on ${pathname}`);
  }

  return payload;
}

async function fetchStatus(url) {
  const response = await fetch(url, { method: 'GET' });
  return response.status;
}

async function queryAll(sql, args = []) {
  const result = await getClient().execute({ sql, args });
  return result.rows ?? [];
}

async function queryOne(sql, args = []) {
  const rows = await queryAll(sql, args);
  return rows[0] ?? null;
}

async function executeWithRetry(executor, sql, args = [], attempts = 8) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await executor.execute({ sql, args });
    } catch (error) {
      if (error?.code !== 'SQLITE_BUSY' || attempt === attempts - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  return null;
}

async function markPhaseAsExpired(roomCode) {
  await executeWithRetry(
    getClient(),
    `
      UPDATE rooms
      SET phase_ends_at = datetime('now', '-1 second')
      WHERE room_code = ?
    `,
    [roomCode],
  );
}

function getCorrectChoice(question) {
  return question.choices.find((choice) => choice.isCorrect) ?? question.choices[0] ?? null;
}

function dedupe(values) {
  return [...new Set(values)];
}

async function validateMediaAvailability(records) {
  const mediaPaths = [];

  for (const record of records) {
    if (record.mediaPath) {
      mediaPaths.push(record.mediaPath);
    }

    for (const option of record.options) {
      if (typeof option.value === 'string' && option.value.startsWith('/question-assets/')) {
        mediaPaths.push(option.value);
      }
    }
  }

  const uniquePaths = dedupe(mediaPaths);
  const failures = [];

  for (const mediaPath of uniquePaths) {
    const status = await fetchStatus(`${frontendBaseUrl}${mediaPath}`);

    if (status !== 200) {
      failures.push({ mediaPath, status });
    }
  }

  return {
    checkedCount: uniquePaths.length,
    failures,
  };
}

async function validateRuntimeFlow(expectedQuestionCount) {
  const room = await api('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({
      hostName: 'Validation Host',
      themeId,
      maxPlayers: 8,
      eliminationIntervalSeconds: 99999,
    }),
  });

  const roomCode = room.room.roomCode;
  const playerOne = await api(`/api/rooms/${roomCode}/players`, {
    method: 'POST',
    body: JSON.stringify({ nickname: 'ValA' }),
  });
  const playerTwo = await api(`/api/rooms/${roomCode}/players`, {
    method: 'POST',
    body: JSON.stringify({ nickname: 'ValB' }),
  });
  await api(`/api/rooms/${roomCode}/start`, {
    method: 'POST',
  });

  const seenQuestions = [];
  const issues = [];
  let revealCount = 0;
  let guard = 0;
  const answeredQuestionIds = new Set();

  while (guard < expectedQuestionCount * 4) {
    guard += 1;
    const stateResponse = await api(`/api/rooms/${roomCode}/state?role=screen`);
    const state = stateResponse.state;

    if (state.room.phase === 'finished') {
      break;
    }

    if (state.room.phase === 'question_live') {
      if (!state.question) {
        issues.push('Phase question_live sans payload question.');
        break;
      }

      const currentQuestionId = state.question.id;
      if (!seenQuestions.includes(currentQuestionId)) {
        seenQuestions.push(currentQuestionId);
      }

      if (!answeredQuestionIds.has(currentQuestionId)) {
        const playerStateBefore = await api(
          `/api/rooms/${roomCode}/state?role=player&playerId=${playerOne.player.id}`,
        );

        if (playerStateBefore.state.viewer.hasAnswered) {
          answeredQuestionIds.add(currentQuestionId);
        } else {
          const answerState = await api(`/api/rooms/${roomCode}/state?role=screen`);
          const correctChoice = getCorrectChoice(answerState.state.question);

          if (!correctChoice) {
            issues.push(`Impossible de determiner une reponse pour ${currentQuestionId}.`);
            break;
          }

          try {
            await api(`/api/rooms/${roomCode}/answers`, {
              method: 'POST',
              body: JSON.stringify({
                playerId: playerOne.player.id,
                choiceId: correctChoice.id,
              }),
            });
          } catch (error) {
            issues.push(`Soumission refusee sur ${currentQuestionId}: ${error.message}`);
          }

          const playerStateAfter = await api(
            `/api/rooms/${roomCode}/state?role=player&playerId=${playerOne.player.id}`,
          );

          if (!playerStateAfter.state.viewer.hasAnswered) {
            issues.push(`Le joueur n est pas marque repondu apres soumission sur ${currentQuestionId}.`);
          } else {
            answeredQuestionIds.add(currentQuestionId);
          }
        }
      }

      if (
        seenQuestions.length === expectedQuestionCount
        && answeredQuestionIds.has(currentQuestionId)
      ) {
        break;
      }

      await markPhaseAsExpired(roomCode);
      continue;
    }

    if (state.room.phase === 'answer_reveal') {
      revealCount += 1;

      if (!state.reveal?.correctChoiceText) {
        issues.push(`Reveal incomplet sur la question ${state.question?.id ?? 'n/a'}.`);
      }

      await markPhaseAsExpired(roomCode);
      continue;
    }

    issues.push(`Phase inattendue: ${state.room.phase}`);
    break;
  }

  const finalStateResponse = await api(`/api/rooms/${roomCode}/state?role=screen`);
  const finalState = finalStateResponse.state;

  if (seenQuestions.length < expectedQuestionCount) {
    issues.push(`Questions vues insuffisantes: ${seenQuestions.length}/${expectedQuestionCount}.`);
  }

  return {
    roomCode,
    seenQuestions,
    revealCount,
    issues,
    finalPhase: finalState.room.phase,
  };
}

async function main() {
  await ensureDatabaseReady();

  const normalizedRaw = await fs.readFile(normalizedInputFile, 'utf8');
  const normalized = JSON.parse(normalizedRaw);
  const validRecords = normalized.records.filter((record) => record.issues.length === 0);
  const databaseQuestions = await queryAll(
    'SELECT id, title, media_type, media_path FROM questions WHERE theme_id = ? ORDER BY id ASC',
    [themeId],
  );

  const mediaReport = await validateMediaAvailability(validRecords);
  const runtimeReport = await validateRuntimeFlow(databaseQuestions.length);
  const summary = {
    themeId,
    expectedQuestions: databaseQuestions.length,
    importedTitles: databaseQuestions.map((question) => ({
      id: Number(question.id),
      title: question.title,
      mediaType: question.media_type,
      mediaPath: question.media_path,
    })),
    media: mediaReport,
    runtime: runtimeReport,
  };

  const hasFailure =
    mediaReport.failures.length > 0
    || runtimeReport.issues.length > 0
    || runtimeReport.seenQuestions.length !== databaseQuestions.length;

  console.log(JSON.stringify(summary, null, 2));

  if (hasFailure) {
    process.exitCode = 1;
  }
}

await main();
