import { withConnection, withTransaction } from '../db.js';
import { config } from '../config.js';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PLAYABLE_QUESTION_FILTER = `
  SELECT question_id
  FROM choices
  GROUP BY question_id
  HAVING COUNT(*) = 4
     AND SUM(CASE WHEN label = 'A' THEN 1 ELSE 0 END) = 1
     AND SUM(CASE WHEN label = 'B' THEN 1 ELSE 0 END) = 1
     AND SUM(CASE WHEN label = 'C' THEN 1 ELSE 0 END) = 1
     AND SUM(CASE WHEN label = 'D' THEN 1 ELSE 0 END) = 1
`;

function createRoomCodeCandidate(length = 6) {
  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    return ROOM_CODE_ALPHABET[index];
  }).join('');
}

function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function toInteger(value) {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRoom(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    roomCode: row.room_code,
    hostName: row.host_name,
    themeId: toInteger(row.theme_id),
    status: row.status,
    currentQuestionId: toInteger(row.current_question_id),
    currentRoomQuestionId: toInteger(row.current_room_question_id),
    currentQuestionOrder: toInteger(row.current_question_order) ?? 0,
    currentPhase: row.current_phase,
    eliminationIntervalSeconds: toInteger(row.elimination_interval_seconds)
      ?? config.game.defaultEliminationIntervalSeconds,
    maxPlayers: toInteger(row.max_players) ?? config.game.defaultMaxPlayers,
    phaseStartedAt: row.phase_started_at,
    phaseEndsAt: row.phase_ends_at,
    nextEliminationAt: row.next_elimination_at,
    lastEliminationPlayerId: toInteger(row.last_elimination_player_id),
    lastEliminationAt: row.last_elimination_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlayer(row) {
  return {
    id: Number(row.id),
    roomId: Number(row.room_id),
    nickname: row.nickname,
    score: toInteger(row.score) ?? 0,
    correctAnswers: toInteger(row.correct_answers) ?? 0,
    wrongAnswers: toInteger(row.wrong_answers) ?? 0,
    averageResponseMs: toInteger(row.average_response_ms),
    answeredCount: toInteger(row.answered_count) ?? 0,
    status: row.status,
    isActive: Boolean(toInteger(row.is_active)),
    connected: Boolean(toInteger(row.is_active)),
    eliminatedAt: row.eliminated_at,
    finalRank: toInteger(row.final_rank),
    joinedAt: row.joined_at,
    updatedAt: row.updated_at,
  };
}

function mapChoice(row) {
  return {
    id: Number(row.id),
    questionId: Number(row.question_id),
    label: row.label,
    text: row.choice_text,
    order: toInteger(row.choice_order) ?? 1,
    isCorrect: Boolean(toInteger(row.is_correct)),
  };
}

function mapQuestion(row, choices) {
  return {
    id: Number(row.id),
    themeId: Number(row.theme_id),
    questionType: row.question_type,
    title: row.title,
    text: row.question_text,
    mediaType: row.media_type,
    mediaPath: row.media_path,
    correctText: row.correct_text,
    explanation: row.explanation,
    difficulty: row.difficulty,
    basePoints: toInteger(row.base_points) ?? 100,
    answerTimeSeconds: toInteger(row.answer_time_seconds) ?? 20,
    revealTimeSeconds: toInteger(row.reveal_time_seconds) ?? 5,
    choices,
  };
}

function mapAnswer(row) {
  return {
    id: Number(row.id),
    roomId: Number(row.room_id),
    roomPlayerId: Number(row.room_player_id),
    questionId: Number(row.question_id),
    choiceId: toInteger(row.choice_id),
    typedAnswer: row.typed_answer,
    isCorrect: Boolean(toInteger(row.is_correct)),
    pointsEarned: toInteger(row.points_earned) ?? 0,
    responseTimeMs: toInteger(row.response_time_ms),
    answeredAt: row.answered_at,
  };
}

async function execute(executor, sql, args = []) {
  return executor.execute({ sql, args });
}

async function queryAll(executor, sql, args = []) {
  const result = await execute(executor, sql, args);
  return result.rows ?? [];
}

async function queryOne(executor, sql, args = []) {
  const rows = await queryAll(executor, sql, args);
  return rows[0] ?? null;
}

async function queryScalar(executor, sql, args = []) {
  const row = await queryOne(executor, sql, args);

  if (!row) {
    return null;
  }

  const [firstKey] = Object.keys(row);
  return firstKey ? row[firstKey] : null;
}

async function generateUniqueRoomCode(executor) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const roomCode = createRoomCodeCandidate();
    const existing = await queryOne(
      executor,
      'SELECT id FROM rooms WHERE room_code = ? LIMIT 1',
      [roomCode],
    );

    if (!existing) {
      return roomCode;
    }
  }

  throw new Error('Impossible de generer un code room unique.');
}

async function appendQuestionCycle(executor, roomId, themeId, startOrder) {
  const params = [];
  let sql = `
    SELECT q.id
    FROM questions q
    JOIN (${PLAYABLE_QUESTION_FILTER}) playable ON playable.question_id = q.id
    WHERE q.is_active = 1
  `;

  if (themeId) {
    sql += ' AND q.theme_id = ?';
    params.push(themeId);
  }

  sql += ' ORDER BY q.id ASC';

  let questions = await queryAll(executor, sql, params);

  if (!questions.length && themeId) {
    questions = await queryAll(
      executor,
      `SELECT q.id
       FROM questions q
       JOIN (${PLAYABLE_QUESTION_FILTER}) playable ON playable.question_id = q.id
       WHERE q.is_active = 1
       ORDER BY q.id ASC`,
    );
  }

  if (!questions.length) {
    throw new Error('Aucune question jouable avec 4 reponses A/B/C/D n est disponible en base.');
  }

  shuffleInPlace(questions);

  for (const [index, question] of questions.entries()) {
    await execute(
      executor,
      `INSERT INTO room_questions (
         room_id,
         question_id,
         question_order
       ) VALUES (?, ?, ?)`,
      [roomId, question.id, startOrder + index],
    );
  }
}

export async function createRoom({
  hostName,
  themeId = null,
  eliminationIntervalSeconds = config.game.defaultEliminationIntervalSeconds,
  maxPlayers = config.game.defaultMaxPlayers,
}) {
  return withTransaction(async (transaction) => {
    const roomCode = await generateUniqueRoomCode(transaction);
    const insertResult = await execute(
      transaction,
      `INSERT INTO rooms (
         room_code,
         host_name,
         theme_id,
         status,
         current_phase,
         elimination_interval_seconds,
         max_players,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, 'lobby', 'waiting', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [roomCode, hostName ?? null, themeId, eliminationIntervalSeconds, maxPlayers],
    );

    const roomId = Number(insertResult.lastInsertRowid);
    const row = await queryOne(transaction, 'SELECT * FROM rooms WHERE id = ? LIMIT 1', [roomId]);

    return mapRoom(row);
  });
}

export async function getRoomByCode(roomCode) {
  return withConnection(async (connection) => {
    const row = await queryOne(
      connection,
      'SELECT * FROM rooms WHERE room_code = ? LIMIT 1',
      [String(roomCode).toUpperCase()],
    );

    return mapRoom(row);
  });
}

export async function listPlayers(roomId) {
  return withConnection(async (connection) => {
    const rows = await queryAll(
      connection,
      `SELECT
         rp.*,
         COALESCE(answer_stats.answered_count, 0) AS answered_count
       FROM room_players rp
       LEFT JOIN (
         SELECT room_player_id, COUNT(*) AS answered_count
         FROM player_answers
         WHERE room_id = ?
         GROUP BY room_player_id
       ) AS answer_stats ON answer_stats.room_player_id = rp.id
       WHERE rp.room_id = ?
       ORDER BY rp.score DESC, rp.correct_answers DESC, rp.joined_at ASC`,
      [roomId, roomId],
    );

    return rows.map(mapPlayer);
  });
}

export async function getPlayerById(playerId) {
  return withConnection(async (connection) => {
    const row = await queryOne(
      connection,
      `SELECT
         rp.*,
         COALESCE(answer_stats.answered_count, 0) AS answered_count
       FROM room_players rp
       LEFT JOIN (
         SELECT room_player_id, COUNT(*) AS answered_count
         FROM player_answers
         WHERE room_player_id = ?
         GROUP BY room_player_id
       ) AS answer_stats ON answer_stats.room_player_id = rp.id
       WHERE rp.id = ?
       LIMIT 1`,
      [playerId, playerId],
    );

    return row ? mapPlayer(row) : null;
  });
}

export async function createPlayer({ roomId, nickname }) {
  return withTransaction(async (transaction) => {
    try {
      const insertResult = await execute(
        transaction,
        `INSERT INTO room_players (
           room_id,
           nickname,
           joined_at,
           updated_at
         ) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [roomId, nickname],
      );

      const playerId = Number(insertResult.lastInsertRowid);
      const row = await queryOne(
        transaction,
        `SELECT
           rp.*,
           0 AS answered_count
         FROM room_players rp
         WHERE rp.id = ?
         LIMIT 1`,
        [playerId],
      );

      return mapPlayer(row);
    } catch (error) {
      if (String(error.message ?? '').toLowerCase().includes('unique')) {
        throw new Error('Ce pseudo est deja pris dans cette room.');
      }

      throw error;
    }
  });
}

export async function ensureQuestionCycle(room) {
  return withTransaction(async (transaction) => {
    const maxOrder = await queryScalar(
      transaction,
      'SELECT COALESCE(MAX(question_order), 0) AS max_order FROM room_questions WHERE room_id = ?',
      [room.id],
    );

    if ((toInteger(maxOrder) ?? 0) > 0) {
      return;
    }

    await appendQuestionCycle(transaction, room.id, room.themeId, 1);
  });
}

export async function getQuestionById(questionId, executor = null) {
  const load = async (db) => {
    const row = await queryOne(
      db,
      `SELECT
         q.*,
         qt.code AS question_type
       FROM questions q
       JOIN question_types qt ON qt.id = q.question_type_id
       WHERE q.id = ?
       LIMIT 1`,
      [questionId],
    );

    if (!row) {
      return null;
    }

    const choices = await queryAll(
      db,
      `SELECT *
       FROM choices
       WHERE question_id = ?
       ORDER BY choice_order ASC, id ASC`,
      [questionId],
    );

    return mapQuestion(row, choices.map(mapChoice));
  };

  if (executor) {
    return load(executor);
  }

  return withConnection(load);
}

export async function getNextRoomQuestion(room, currentOrder = 0) {
  return withTransaction(async (transaction) => {
    let row = await queryOne(
      transaction,
      `SELECT rq.id, rq.question_id, rq.question_order
       FROM room_questions rq
       JOIN (${PLAYABLE_QUESTION_FILTER}) playable ON playable.question_id = rq.question_id
       WHERE rq.room_id = ? AND rq.question_order > ?
       ORDER BY rq.question_order ASC
       LIMIT 1`,
      [room.id, currentOrder],
    );

    if (!row) {
      const maxOrder = await queryScalar(
        transaction,
        'SELECT COALESCE(MAX(question_order), 0) AS max_order FROM room_questions WHERE room_id = ?',
        [room.id],
      );

      await appendQuestionCycle(
        transaction,
        room.id,
        room.themeId,
        (toInteger(maxOrder) ?? 0) + 1,
      );

      row = await queryOne(
        transaction,
        `SELECT rq.id, rq.question_id, rq.question_order
         FROM room_questions rq
         JOIN (${PLAYABLE_QUESTION_FILTER}) playable ON playable.question_id = rq.question_id
         WHERE rq.room_id = ? AND rq.question_order > ?
         ORDER BY rq.question_order ASC
         LIMIT 1`,
        [room.id, currentOrder],
      );
    }

    const question = await getQuestionById(row.question_id, transaction);

    return {
      roomQuestionId: Number(row.id),
      questionId: Number(row.question_id),
      questionOrder: Number(row.question_order),
      question,
    };
  });
}

export async function launchQuestion({
  roomId,
  roomQuestionId,
  questionId,
  questionOrder,
  phaseStartedAt,
  phaseEndsAt,
  nextEliminationAt,
}) {
  return withTransaction(async (transaction) => {
    await execute(
      transaction,
      `UPDATE rooms
       SET status = 'in_progress',
           current_phase = 'question_live',
           current_question_id = ?,
           current_room_question_id = ?,
           current_question_order = ?,
           phase_started_at = ?,
           phase_ends_at = ?,
           next_elimination_at = ?,
           started_at = COALESCE(started_at, ?),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        questionId,
        roomQuestionId,
        questionOrder,
        phaseStartedAt,
        phaseEndsAt,
        nextEliminationAt,
        phaseStartedAt,
        roomId,
      ],
    );

    await execute(
      transaction,
      `UPDATE room_questions
       SET asked_at = COALESCE(asked_at, ?)
       WHERE id = ?`,
      [phaseStartedAt, roomQuestionId],
    );
  });
}

export async function moveToRevealPhase({
  roomId,
  roomQuestionId,
  phaseStartedAt,
  phaseEndsAt,
}) {
  return withTransaction(async (transaction) => {
    await execute(
      transaction,
      `UPDATE rooms
       SET current_phase = 'answer_reveal',
           phase_started_at = ?,
           phase_ends_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [phaseStartedAt, phaseEndsAt, roomId],
    );

    await execute(
      transaction,
      `UPDATE room_questions
       SET revealed_at = COALESCE(revealed_at, ?)
       WHERE id = ?`,
      [phaseStartedAt, roomQuestionId],
    );
  });
}

export async function getPlayerAnswer(roomPlayerId, questionId) {
  return withConnection(async (connection) => {
    const row = await queryOne(
      connection,
      `SELECT *
       FROM player_answers
       WHERE room_player_id = ? AND question_id = ?
       LIMIT 1`,
      [roomPlayerId, questionId],
    );

    return row ? mapAnswer(row) : null;
  });
}

export async function insertPlayerAnswer({
  roomId,
  roomPlayerId,
  questionId,
  choiceId = null,
  typedAnswer = null,
  isCorrect,
  responseTimeMs,
}) {
  return withTransaction(async (transaction) => {
    const existing = await queryOne(
      transaction,
      `SELECT id
       FROM player_answers
       WHERE room_player_id = ? AND question_id = ?
       LIMIT 1`,
      [roomPlayerId, questionId],
    );

    if (existing) {
      throw new Error('Une seule reponse est autorisee par question.');
    }

    await execute(
      transaction,
      `INSERT INTO player_answers (
         room_id,
         room_player_id,
         question_id,
         choice_id,
         typed_answer,
         is_correct,
         points_earned,
         response_time_ms,
         answered_at
       ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)`,
      [
        roomId,
        roomPlayerId,
        questionId,
        choiceId,
        typedAnswer,
        isCorrect ? 1 : 0,
        responseTimeMs,
      ],
    );
  });
}

export async function listAnswersForQuestion(roomId, questionId) {
  return withConnection(async (connection) => {
    const rows = await queryAll(
      connection,
      `SELECT *
       FROM player_answers
       WHERE room_id = ? AND question_id = ?
       ORDER BY answered_at ASC`,
      [roomId, questionId],
    );

    return rows.map(mapAnswer);
  });
}

export async function saveQuestionResults({ questionId, playerResults }) {
  return withTransaction(async (transaction) => {
    for (const result of playerResults) {
      await execute(
        transaction,
        `UPDATE room_players
         SET score = ?,
             correct_answers = ?,
             wrong_answers = ?,
             average_response_ms = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          result.nextScore,
          result.nextCorrectAnswers,
          result.nextWrongAnswers,
          result.nextAverageResponseMs,
          result.roomPlayerId,
        ],
      );

      if (result.answered) {
        await execute(
          transaction,
          `UPDATE player_answers
           SET is_correct = ?,
               points_earned = ?,
               response_time_ms = ?
           WHERE room_player_id = ? AND question_id = ?`,
          [
            result.isCorrect ? 1 : 0,
            result.pointsEarned,
            result.responseTimeMs,
            result.roomPlayerId,
            questionId,
          ],
        );
      }
    }
  });
}

export async function eliminatePlayer(playerId, finalRank, eliminatedAt) {
  return withConnection(async (connection) =>
    execute(
      connection,
      `UPDATE room_players
       SET status = 'eliminated',
           is_active = 0,
           eliminated_at = ?,
           final_rank = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'alive'`,
      [eliminatedAt, finalRank, playerId],
    ));
}

export async function updateRoomElimination(roomId, playerId, eliminatedAt, nextEliminationAt) {
  return withConnection(async (connection) =>
    execute(
      connection,
      `UPDATE rooms
       SET last_elimination_player_id = ?,
           last_elimination_at = ?,
           next_elimination_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [playerId, eliminatedAt, nextEliminationAt, roomId],
    ));
}

export async function markWinner(playerId) {
  return withConnection(async (connection) =>
    execute(
      connection,
      `UPDATE room_players
       SET status = 'winner',
           is_active = 1,
           eliminated_at = NULL,
           final_rank = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [playerId],
    ));
}

export async function finishRoom(roomId, endedAt) {
  return withConnection(async (connection) =>
    execute(
      connection,
      `UPDATE rooms
       SET status = 'finished',
           current_phase = 'finished',
           phase_started_at = ?,
           phase_ends_at = NULL,
           next_elimination_at = NULL,
           ended_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [endedAt, endedAt, roomId],
    ));
}
