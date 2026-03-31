import {
  createPlayer,
  createRoom as createRoomRecord,
  eliminatePlayer,
  ensureQuestionCycle,
  finishRoom,
  getNextRoomQuestion,
  getPlayerAnswer,
  getPlayerById,
  getQuestionById,
  getRoomByCode,
  insertPlayerAnswer,
  launchQuestion,
  listAnswersForQuestion,
  listPlayers,
  markWinner,
  moveToRevealPhase,
  saveQuestionResults,
  updateRoomElimination,
} from '../repositories/gameRepository.js';

function normalizeRoomCode(roomCode) {
  return String(roomCode ?? '').trim().toUpperCase();
}

function normalizeTextAnswer(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function toTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function toIsoString(timestamp) {
  return new Date(timestamp).toISOString();
}

function buildQuestionPayload(question, phase) {
  if (!question) {
    return null;
  }

  const revealMode = phase === 'answer_reveal' || phase === 'finished';

  return {
    id: question.id,
    title: question.title,
    text: question.text,
    type: question.questionType,
    mediaType: question.mediaType,
    mediaPath: question.mediaPath,
    explanation: revealMode ? question.explanation : null,
    correctText: revealMode ? question.correctText : null,
    answerTimeSeconds: question.answerTimeSeconds,
    revealTimeSeconds: question.revealTimeSeconds,
    choices: question.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      text: choice.text,
      isCorrect: revealMode ? choice.isCorrect : undefined,
    })),
  };
}

function computePoints(question, responseTimeMs) {
  const maxDurationMs = question.answerTimeSeconds * 1000;
  const boundedResponse = Math.min(Math.max(responseTimeMs, 0), maxDurationMs);
  const speedRatio = maxDurationMs === 0 ? 0 : (maxDurationMs - boundedResponse) / maxDurationMs;
  const speedBonus = Math.round(question.basePoints * speedRatio);

  return question.basePoints + speedBonus;
}

function computeAverageResponse(previousAverage, answeredCount, responseTimeMs) {
  if (responseTimeMs == null) {
    return previousAverage ?? null;
  }

  if (!answeredCount || previousAverage == null) {
    return responseTimeMs;
  }

  return Math.round(
    ((previousAverage * answeredCount) + responseTimeMs) / (answeredCount + 1),
  );
}

function chooseEliminationCandidate(players) {
  return [...players].sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    if (left.correctAnswers !== right.correctAnswers) {
      return left.correctAnswers - right.correctAnswers;
    }

    return new Date(right.joinedAt).getTime() - new Date(left.joinedAt).getTime();
  })[0];
}

function chooseWinner(players) {
  return [...players].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (right.correctAnswers !== left.correctAnswers) {
      return right.correctAnswers - left.correctAnswers;
    }

    return new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime();
  })[0];
}

function getCorrectChoice(question) {
  return question.choices.find((choice) => choice.isCorrect) ?? null;
}

function evaluateAnswer(question, payload) {
  const correctChoice = getCorrectChoice(question);

  if (question.questionType === 'text_hole') {
    const submitted = normalizeTextAnswer(payload.typedAnswer);
    const expected = normalizeTextAnswer(question.correctText);

    return {
      isCorrect: Boolean(submitted) && submitted === expected,
      typedAnswer: payload.typedAnswer ?? null,
      choiceId: null,
    };
  }

  const selectedChoice = question.choices.find((choice) => choice.id === Number(payload.choiceId));

  if (!selectedChoice) {
    throw new Error('La reponse choisie est invalide pour cette question.');
  }

  return {
    isCorrect: Boolean(correctChoice && selectedChoice.id === correctChoice.id),
    typedAnswer: null,
    choiceId: selectedChoice.id,
  };
}

async function buildRoomContext(room) {
  const players = await listPlayers(room.id);
  const playersById = new Map(players.map((player) => [player.id, player]));
  const currentQuestion = room.currentQuestionId
    ? await getQuestionById(room.currentQuestionId)
    : null;
  const answers = currentQuestion
    ? await listAnswersForQuestion(room.id, currentQuestion.id)
    : [];
  const answerByPlayerId = new Map(answers.map((answer) => [answer.roomPlayerId, answer]));

  return {
    room,
    players,
    playersById,
    currentQuestion,
    answers,
    answerByPlayerId,
  };
}

export class GameOrchestrator {
  async requireRoom(roomCode) {
    const room = await getRoomByCode(normalizeRoomCode(roomCode));

    if (!room) {
      throw new Error('Room introuvable.');
    }

    return room;
  }

  async createRoom(payload) {
    const requestedMaxPlayers = payload?.maxPlayers == null
      ? null
      : Number(payload.maxPlayers);

    if (
      requestedMaxPlayers != null
      && (
        !Number.isInteger(requestedMaxPlayers)
        || requestedMaxPlayers < 1
        || requestedMaxPlayers > 8
      )
    ) {
      throw new Error('Le nombre maximum de joueurs doit etre compris entre 1 et 8.');
    }

    const room = await createRoomRecord({
      ...payload,
      maxPlayers: requestedMaxPlayers ?? 8,
    });

    return {
      room,
      state: await this.getState(room.roomCode),
    };
  }

  async joinRoom(roomCode, nickname) {
    const room = await this.requireRoom(roomCode);

    if (!String(nickname ?? '').trim()) {
      throw new Error('Le pseudo joueur est obligatoire.');
    }

    if (room.status !== 'lobby') {
      throw new Error('La partie a deja commence dans cette room.');
    }

    const players = await listPlayers(room.id);

    if (players.length >= room.maxPlayers) {
      throw new Error('La room a atteint le nombre maximum de joueurs.');
    }

    const player = await createPlayer({
      roomId: room.id,
      nickname: String(nickname).trim(),
    });

    return {
      room,
      player,
      state: await this.getState(room.roomCode, { role: 'player', playerId: player.id }),
    };
  }

  async startRoom(roomCode) {
    const room = await this.requireRoom(roomCode);
    const players = await listPlayers(room.id);

    if (!players.length) {
      throw new Error('Impossible de lancer une partie sans joueur.');
    }

    if (room.status !== 'lobby') {
      throw new Error('La room est deja lancee.');
    }

    await ensureQuestionCycle(room);

    const next = await getNextRoomQuestion(room, 0);
    const now = Date.now();
    const phaseStartedAt = toIsoString(now);
    const phaseEndsAt = toIsoString(now + (next.question.answerTimeSeconds * 1000));
    const nextEliminationAt = toIsoString(now + (room.eliminationIntervalSeconds * 1000));

    await launchQuestion({
      roomId: room.id,
      roomQuestionId: next.roomQuestionId,
      questionId: next.questionId,
      questionOrder: next.questionOrder,
      phaseStartedAt,
      phaseEndsAt,
      nextEliminationAt,
    });

    return this.getState(room.roomCode);
  }

  async submitAnswer({ roomCode, playerId, choiceId, typedAnswer }) {
    const room = await this.reconcileRoom(roomCode);

    if (room.status !== 'in_progress' || room.currentPhase !== 'question_live') {
      throw new Error('La room n est pas en phase de reponse.');
    }

    const player = await getPlayerById(playerId);

    if (!player || player.roomId !== room.id) {
      throw new Error('Le joueur est introuvable dans cette room.');
    }

    if (player.status !== 'alive') {
      throw new Error('Ce joueur est elimine et ne peut plus repondre.');
    }

    const currentQuestion = await getQuestionById(room.currentQuestionId);

    if (!currentQuestion) {
      throw new Error('Aucune question active trouvee pour cette room.');
    }

    const existingAnswer = await getPlayerAnswer(player.id, currentQuestion.id);

    if (existingAnswer) {
      throw new Error('Une seule reponse est autorisee par question.');
    }

    const evaluation = evaluateAnswer(currentQuestion, { choiceId, typedAnswer });
    const startedAt = toTimestamp(room.phaseStartedAt) ?? Date.now();
    const responseTimeMs = Math.max(Date.now() - startedAt, 0);

    await insertPlayerAnswer({
      roomId: room.id,
      roomPlayerId: player.id,
      questionId: currentQuestion.id,
      choiceId: evaluation.choiceId,
      typedAnswer: evaluation.typedAnswer,
      isCorrect: evaluation.isCorrect,
      responseTimeMs,
    });

    return {
      accepted: true,
      responseTimeMs,
    };
  }

  async reconcileRoom(roomCode) {
    let room = await this.requireRoom(roomCode);

    for (let iteration = 0; iteration < 20; iteration += 1) {
      if (room.status === 'lobby' || room.status === 'finished') {
        return room;
      }

      const context = await buildRoomContext(room);
      const alivePlayers = context.players.filter(
        (player) => player.status === 'alive' || player.status === 'winner',
      );
      const now = Date.now();
      const nextEliminationAt = toTimestamp(room.nextEliminationAt);
      const phaseEndsAt = toTimestamp(room.phaseEndsAt);

      if (alivePlayers.length <= 1) {
        await this.finishGame(room, context.players, now);
        room = await this.requireRoom(room.roomCode);
        continue;
      }

      if (room.currentPhase === 'question_live' && phaseEndsAt && phaseEndsAt <= now) {
        await this.endCurrentQuestion(room, context, now);
        room = await this.requireRoom(room.roomCode);
        continue;
      }

      if (room.currentPhase === 'answer_reveal' && phaseEndsAt && phaseEndsAt <= now) {
        await this.afterReveal(room, context.players, now);
        room = await this.requireRoom(room.roomCode);
        continue;
      }

      if (
        nextEliminationAt
        && nextEliminationAt <= now
        && room.currentPhase !== 'question_live'
        && room.currentPhase !== 'answer_reveal'
      ) {
        await this.runElimination(room, context.players, now);
        room = await this.requireRoom(room.roomCode);
        continue;
      }

      return room;
    }

    throw new Error('La room a depasse la limite de transitions automatiques.');
  }

  async endCurrentQuestion(room, context, now = Date.now()) {
    const question = context.currentQuestion ?? await getQuestionById(room.currentQuestionId);

    if (!question) {
      throw new Error('Impossible de finaliser une question introuvable.');
    }

    const answerByPlayerId = context.answerByPlayerId;
    const playerResults = context.players.map((player) => {
      const answer = answerByPlayerId.get(player.id);
      const answered = Boolean(answer);
      const isCorrect = Boolean(answer?.isCorrect);
      const pointsEarned = isCorrect ? computePoints(question, answer.responseTimeMs ?? 0) : 0;
      const nextScore = player.score + pointsEarned;
      const nextCorrectAnswers = player.correctAnswers + (isCorrect ? 1 : 0);
      const nextWrongAnswers = player.wrongAnswers + (isCorrect ? 0 : 1);
      const nextAverageResponseMs = answered
        ? computeAverageResponse(
          player.averageResponseMs,
          player.answeredCount,
          answer.responseTimeMs,
        )
        : player.averageResponseMs;

      return {
        roomPlayerId: player.id,
        answered,
        isCorrect,
        responseTimeMs: answer?.responseTimeMs ?? null,
        pointsEarned,
        nextScore,
        nextCorrectAnswers,
        nextWrongAnswers,
        nextAverageResponseMs,
      };
    });

    await saveQuestionResults({
      questionId: question.id,
      playerResults,
    });

    const phaseStartedAt = toIsoString(now);
    const phaseEndsAt = toIsoString(now + (question.revealTimeSeconds * 1000));

    await moveToRevealPhase({
      roomId: room.id,
      roomQuestionId: room.currentRoomQuestionId,
      phaseStartedAt,
      phaseEndsAt,
    });
  }

  async afterReveal(room, players, now = Date.now()) {
    let activeRoom = room;
    let activePlayers = players;

    const eliminationDue = toTimestamp(activeRoom.nextEliminationAt);

    if (eliminationDue && eliminationDue <= now) {
      await this.runElimination(activeRoom, activePlayers, now);
      activeRoom = await this.requireRoom(activeRoom.roomCode);

      if (activeRoom.status === 'finished') {
        return;
      }

      activePlayers = await listPlayers(activeRoom.id);
    }

    const alivePlayers = activePlayers.filter((player) => player.status === 'alive');

    if (alivePlayers.length <= 1) {
      await this.finishGame(activeRoom, activePlayers, now);
      return;
    }

    const next = await getNextRoomQuestion(activeRoom, activeRoom.currentQuestionOrder);
    const phaseStartedAt = toIsoString(now);
    const phaseEndsAt = toIsoString(now + (next.question.answerTimeSeconds * 1000));

    await launchQuestion({
      roomId: activeRoom.id,
      roomQuestionId: next.roomQuestionId,
      questionId: next.questionId,
      questionOrder: next.questionOrder,
      phaseStartedAt,
      phaseEndsAt,
      nextEliminationAt: activeRoom.nextEliminationAt,
    });
  }

  async runElimination(room, players, now = Date.now()) {
    const alivePlayers = players.filter((player) => player.status === 'alive');

    if (alivePlayers.length <= 1) {
      await this.finishGame(room, players, now);
      return;
    }

    const eliminatedPlayer = chooseEliminationCandidate(alivePlayers);
    const eliminatedAt = toIsoString(now);
    const nextEliminationAt = toIsoString(now + (room.eliminationIntervalSeconds * 1000));

    await eliminatePlayer(eliminatedPlayer.id, alivePlayers.length, eliminatedAt);
    await updateRoomElimination(room.id, eliminatedPlayer.id, eliminatedAt, nextEliminationAt);

    const updatedPlayers = await listPlayers(room.id);
    const updatedAlivePlayers = updatedPlayers.filter((player) => player.status === 'alive');

    if (updatedAlivePlayers.length <= 1) {
      await this.finishGame(room, updatedPlayers, now);
    }
  }

  async finishGame(room, players = null, now = Date.now()) {
    const resolvedPlayers = players ?? (await listPlayers(room.id));
    const winnerPool = resolvedPlayers.filter(
      (player) => player.status === 'alive' || player.status === 'winner',
    );
    const winner = chooseWinner(winnerPool.length ? winnerPool : resolvedPlayers);

    if (winner && winner.status !== 'winner') {
      await markWinner(winner.id);
    }

    await finishRoom(room.id, toIsoString(now));
  }

  async getState(roomCode, viewer = { role: 'spectator', playerId: null }) {
    const room = await this.reconcileRoom(roomCode);
    const context = await buildRoomContext(room);
    const player = viewer.playerId ? context.playersById.get(viewer.playerId) : null;
    const viewerAnswer = player ? context.answerByPlayerId.get(player.id) ?? null : null;
    const correctChoice = context.currentQuestion ? getCorrectChoice(context.currentQuestion) : null;
    const aliveCount = context.players.filter(
      (entry) => entry.status === 'alive' || entry.status === 'winner',
    ).length;
    const lastEliminatedPlayer = room.lastEliminationPlayerId
      ? context.playersById.get(room.lastEliminationPlayerId) ?? null
      : null;

    const leaderboard = [...context.players]
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        if (right.correctAnswers !== left.correctAnswers) {
          return right.correctAnswers - left.correctAnswers;
        }

        return new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime();
      })
      .map((entry, index) => ({
        id: entry.id,
        nickname: entry.nickname,
        score: entry.score,
        correctAnswers: entry.correctAnswers,
        wrongAnswers: entry.wrongAnswers,
        averageResponseMs: entry.averageResponseMs,
        status: entry.status,
        connected: entry.connected,
        finalRank: entry.finalRank,
        eliminatedAt: entry.eliminatedAt,
        rank: entry.finalRank ?? index + 1,
      }));

    return {
      room: {
        id: room.id,
        code: room.roomCode,
        hostName: room.hostName,
        status: room.status,
        phase: room.currentPhase,
        currentQuestionId: room.currentQuestionId,
        currentQuestionOrder: room.currentQuestionOrder,
        eliminationIntervalSeconds: room.eliminationIntervalSeconds,
        maxPlayers: room.maxPlayers,
        startedAt: room.startedAt,
        endedAt: room.endedAt,
        phaseEndsAt: toTimestamp(room.phaseEndsAt),
        nextEliminationAt: toTimestamp(room.nextEliminationAt),
      },
      question: buildQuestionPayload(context.currentQuestion, room.currentPhase),
      reveal: (room.currentPhase === 'answer_reveal' || room.currentPhase === 'finished')
        && context.currentQuestion
        ? {
          questionId: context.currentQuestion.id,
          correctChoiceId: correctChoice?.id ?? null,
          correctChoiceLabel: correctChoice?.label ?? null,
          correctChoiceText: correctChoice?.text ?? context.currentQuestion.correctText ?? null,
          explanation: context.currentQuestion.explanation,
        }
        : null,
      lastElimination: lastEliminatedPlayer && room.lastEliminationAt
        ? {
          playerId: lastEliminatedPlayer.id,
          nickname: lastEliminatedPlayer.nickname,
          at: toTimestamp(room.lastEliminationAt),
        }
        : null,
      leaderboard,
      meta: {
        serverTime: Date.now(),
        totalPlayers: context.players.length,
        alivePlayers: aliveCount,
        answeredPlayers: context.answers.length,
      },
      viewer: {
        role: viewer.role ?? 'spectator',
        playerId: player?.id ?? null,
        nickname: player?.nickname ?? null,
        status: player?.status ?? null,
        score: player?.score ?? null,
        hasAnswered: Boolean(viewerAnswer),
        lastChoiceId: viewerAnswer?.choiceId ?? null,
        lastTypedAnswer: viewerAnswer?.typedAnswer ?? null,
      },
    };
  }
}
