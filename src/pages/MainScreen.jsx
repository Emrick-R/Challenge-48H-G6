import { ArrowPathIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { buildJoinUrl, createRoom, startRoom } from "../api/lobby";
import EventOverlay from "../components/EventOverlay";
import Leaderboard from "../components/Leaderboard";
import StatusPopup from "../components/StatusPopup";
import VictoryPodium from "../components/VictoryPodium";
import QuestionMediaDisplay from "../components/questions/QuestionMediaDisplay";
import QuestionOptionContent from "../components/questions/QuestionOptionContent";
import { orderChoicesForDisplay } from "../components/questions/questionMediaUtils";
import { useRoomState } from "../hooks/useRoomState";

function formatSeconds(milliseconds) {
  return Math.ceil(Math.max(milliseconds, 0) / 1000);
}

function getQuestionNumber(state) {
  return Number.isInteger(state?.room?.currentQuestionOrder)
    ? state.room.currentQuestionOrder + 1
    : null;
}

function answerTone(index) {
  if (index === 0) {
    return {
      container: "qa-ref-card-glow-magenta border-rose-400/30 bg-[linear-gradient(135deg,rgba(255,0,85,0.12),rgba(255,255,255,0.03))]",
      letter: "text-rose-300",
    };
  }

  if (index === 1) {
    return {
      container: "qa-ref-card-glow-cyan border-cyan-300/30 bg-[linear-gradient(135deg,rgba(0,240,255,0.12),rgba(255,255,255,0.03))]",
      letter: "text-cyan-300",
    };
  }

  if (index === 2) {
    return {
      container: "qa-ref-card-glow-yellow border-[#f4ea2a]/30 bg-[linear-gradient(135deg,rgba(244,234,42,0.11),rgba(255,255,255,0.03))]",
      letter: "text-[#f4ea2a]",
    };
  }

  return {
    container: "qa-ref-card-glow-lime border-lime-300/30 bg-[linear-gradient(135deg,rgba(57,255,20,0.11),rgba(255,255,255,0.03))]",
    letter: "text-lime-300",
  };
}

function PhasePill({ phase }) {
  const labels = {
    waiting: "Lobby",
    question_live: "Question",
    answer_reveal: "Correction",
    finished: "Termine",
  };

  return (
    <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">
      {labels[phase] ?? phase}
    </span>
  );
}

export default function MainScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [popup, setPopup] = useState(null);
  const [eventOverlay, setEventOverlay] = useState(null);
  const popupTimeoutRef = useRef(null);
  const overlayTimeoutRef = useRef(null);
  const seenRevealRef = useRef("");
  const seenEliminationRef = useRef("");
  const seenFinishRef = useRef("");
  const roomCode = searchParams.get("room")?.toUpperCase() ?? "";
  const { state, loading, error: roomError, phaseRemainingMs, nextEliminationMs } =
    useRoomState({
      roomCode,
      role: "screen",
    });

  const joinUrl = useMemo(
    () => (roomCode ? buildJoinUrl(roomCode) : ""),
    [roomCode],
  );

  function showPopup(nextPopup) {
    if (popupTimeoutRef.current) {
      window.clearTimeout(popupTimeoutRef.current);
    }

    setPopup(nextPopup);
    popupTimeoutRef.current = window.setTimeout(() => {
      setPopup(null);
    }, 4200);
  }

  function showOverlay(nextOverlay, duration = 2600) {
    if (overlayTimeoutRef.current) {
      window.clearTimeout(overlayTimeoutRef.current);
    }

    setEventOverlay(nextOverlay);

    if (duration > 0) {
      overlayTimeoutRef.current = window.setTimeout(() => {
        setEventOverlay(null);
      }, duration);
    }
  }

  useEffect(() => () => {
    if (popupTimeoutRef.current) {
      window.clearTimeout(popupTimeoutRef.current);
    }

    if (overlayTimeoutRef.current) {
      window.clearTimeout(overlayTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (state?.room?.phase !== "answer_reveal" || !state?.reveal) {
      return;
    }

    const key = `${state.reveal.questionId}:${state.reveal.correctChoiceId}`;

    if (seenRevealRef.current === key) {
      return;
    }

    seenRevealRef.current = key;
    showPopup({
      eyebrow: "Bonne reponse",
      title: `${state.reveal.correctChoiceLabel ?? ""} devoilee`,
      body: state.reveal.explanation ?? state.reveal.correctChoiceText ?? "",
      tone: "success",
    });
    showOverlay({
      type: "reveal",
      payload: {
        title: `${state.reveal.correctChoiceLabel ?? ""} - ${state.reveal.correctChoiceText ?? ""}`.trim(),
        body: state.reveal.explanation ?? "",
      },
    });
  }, [state]);

  useEffect(() => {
    if (!state?.lastElimination?.at) {
      return;
    }

    const key = String(state.lastElimination.at);

    if (seenEliminationRef.current === key) {
      return;
    }

    seenEliminationRef.current = key;
    showPopup({
      eyebrow: "Elimination",
      title: `${state.lastElimination.nickname} est elimine`,
      body: "Le classement continue de se resserrer.",
      tone: "danger",
    });
    showOverlay({
      type: "elimination",
      payload: {
        nickname: state.lastElimination.nickname,
      },
    });
  }, [state]);

  useEffect(() => {
    if (state?.room?.phase !== "finished" || !state?.room?.endedAt) {
      return;
    }

    const winner = state.leaderboard?.find((entry) => entry.status === "winner")
      ?? state.leaderboard?.[0];
    const key = `${state.room.endedAt}:${winner?.id ?? "none"}`;

    if (seenFinishRef.current === key) {
      return;
    }

    seenFinishRef.current = key;
    showPopup({
      eyebrow: "Victoire",
      title: winner ? `${winner.nickname} remporte la partie` : "Partie terminee",
      body: winner ? `${winner.score} points au classement final.` : "",
      tone: "warning",
    });
    showOverlay({
      type: "victory",
      payload: winner,
    }, 0);
  }, [state]);

  async function handleCreateRoom() {
    setCreating(true);
    setError("");

    try {
      const result = await createRoom({
        hostName: "Host Qui a la ref ?",
        themeId: 3,
        maxPlayers: 8,
      });

      setSearchParams({ room: result.room.roomCode });
    } catch (createError) {
      setError(createError.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleStartRoom() {
    if (!roomCode) {
      return;
    }

    setStarting(true);
    setError("");

    try {
      await startRoom(roomCode);
    } catch (startError) {
      setError(startError.message);
    } finally {
      setStarting(false);
    }
  }

  function handleQuitScreen() {
    setError("");
    setSearchParams({});
  }

  const displayedError = error || roomError;
  const questionNumber = getQuestionNumber(state);
  const orderedChoices = orderChoicesForDisplay(state?.question?.choices ?? []);
  const winner = state?.leaderboard?.find((entry) => entry.status === "winner")
    ?? state?.leaderboard?.[0];
  const hasQuestionMedia = Boolean(
    state?.question?.mediaPath && state?.room?.phase !== "finished",
  );

  return (
    <div className="qa-ref-stage min-h-screen overflow-x-hidden overflow-y-auto bg-[#030408] text-white">
      <StatusPopup popup={popup} />
      <EventOverlay
        eventType={eventOverlay?.type}
        payload={eventOverlay?.payload}
        leaderboard={state?.leaderboard ?? []}
        onClose={() => setEventOverlay(null)}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1820px] flex-col gap-4 px-4 py-4 lg:px-6 xl:px-8">
        <header className="qa-ref-panel qa-ref-header-animate flex flex-wrap items-center justify-between gap-4 rounded-[2rem] px-6 py-5">
          <div>
            <p className="qa-ref-kicker">
              Qui a la ref ?
            </p>
            <h1 className="qa-ref-title text-5xl leading-none tracking-tight md:text-6xl">Ecran principal</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {state?.room?.phase && <PhasePill phase={state.room.phase} />}

            {!roomCode && (
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={creating}
                className="qa-ref-button qa-ref-button-primary px-6 py-3 text-sm uppercase disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Creation..." : "Creer une room"}
              </button>
            )}

            {roomCode && state?.room?.phase === "waiting" && (
              <button
                type="button"
                onClick={handleStartRoom}
                disabled={starting || loading}
                className="qa-ref-button qa-ref-button-secondary inline-flex items-center gap-2 px-6 py-3 text-sm uppercase disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlayIcon className="h-5 w-5" />
                {starting ? "Lancement..." : "Lancer la partie"}
              </button>
            )}

            {roomCode && (
              <>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="qa-ref-button qa-ref-chip inline-flex items-center gap-2 px-5 py-3 text-sm uppercase text-white transition hover:bg-white/10"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                  Rafraichir
                </button>
                <button
                  type="button"
                  onClick={handleQuitScreen}
                  className="qa-ref-button qa-ref-chip inline-flex items-center gap-2 px-5 py-3 text-sm uppercase text-white transition hover:bg-white/10"
                >
                  <XMarkIcon className="h-5 w-5" />
                  Quitter
                </button>
              </>
            )}
          </div>
        </header>

        {displayedError && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-red-100">
            {displayedError}
          </div>
        )}

        {!roomCode ? (
          <div className="qa-ref-panel grid flex-1 place-items-center rounded-[2rem] p-10 text-center">
            <div className="max-w-2xl space-y-4">
              <p className="qa-ref-kicker">Pre show</p>
              <h2 className="qa-ref-title text-6xl leading-none md:text-7xl">Pret a lancer le quiz ?</h2>
              <p className="text-lg text-slate-300">
                Creez une room puis laissez les joueurs rejoindre depuis leur telephone
                avec le QR code ou le code de salle.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid flex-1 gap-4 lg:grid-cols-[1.8fr_0.72fr]">
            <section className="qa-ref-panel qa-ref-panel-animate rounded-[2rem] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="qa-ref-kicker">
                    Room
                  </p>
                  <h2 className="qa-ref-title text-6xl leading-none tracking-[0.15em] text-[#f4ea2a]">
                    {roomCode}
                  </h2>
                </div>
                <div className="grid gap-2 text-right">
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                    Joueurs
                  </p>
                  <p className="qa-ref-title text-5xl leading-none text-cyan-300">
                    {state?.meta?.alivePlayers ?? 0}/{state?.room?.maxPlayers ?? 8}
                  </p>
                </div>
              </div>

              <div className={`mb-4 grid items-stretch gap-4 ${state?.room?.phase === "waiting" ? "md:grid-cols-[250px_1fr]" : "md:grid-cols-2"}`}>
                {state?.room?.phase === "waiting" && (
                  <div className="qa-ref-panel-soft qa-ref-card-glow-cyan flex h-full min-h-[320px] flex-col items-center justify-center rounded-[1.8rem] px-4 py-6 text-center text-slate-950">
                    {joinUrl ? (
                      <>
                        <div className="relative inline-flex rounded-[1.4rem] bg-white p-4 shadow-[0_18px_50px_rgba(0,240,255,0.18)]">
                          <QRCodeSVG value={joinUrl} size={168} className="block" />
                          <div className="qa-ref-scan-line absolute top-0 left-0 h-1 w-full bg-cyan-400 shadow-lg shadow-cyan-300/50" />
                        </div>
                        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">
                          Room {roomCode}
                        </p>
                        <p className="mt-3 max-w-[14rem] text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">
                          Scan pour rejoindre
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">QR code indisponible</p>
                    )}
                  </div>
                )}

                <div className={`grid gap-4 ${state?.room?.phase === "waiting" ? "" : "md:col-span-2 md:grid-cols-2"}`}>
                  <div className="qa-ref-panel-soft qa-ref-card-glow-magenta flex min-h-[124px] flex-col justify-center rounded-[1.5rem] px-5 py-4">
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                      Timer question
                    </p>
                    <p className="qa-ref-title mt-2 text-6xl leading-none text-white">
                      {formatSeconds(phaseRemainingMs)}s
                    </p>
                  </div>
                  <div className="qa-ref-panel-soft qa-ref-card-glow-cyan flex min-h-[124px] flex-col justify-center rounded-[1.5rem] px-5 py-4">
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                      Prochaine elimination
                    </p>
                    <p className="qa-ref-title mt-2 text-4xl leading-none text-rose-300">
                      {state?.room?.status === "in_progress" ? `${formatSeconds(nextEliminationMs)}s` : "--"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="qa-ref-panel-soft flex flex-col overflow-hidden rounded-[2rem] p-4">
                <p className="qa-ref-kicker">
                  {state?.room?.phase === "finished"
                    ? "Resume final"
                    : state?.room?.phase === "answer_reveal"
                      ? `${state?.reveal?.correctChoiceLabel ?? ""} ${state?.reveal?.correctChoiceText ?? "Correction"}`.trim()
                      : `Question ${questionNumber ?? ""}`.trim()}
                </p>
                <div className="relative">
                  {state?.room?.phase !== "finished" && (
                    <div className="absolute left-0 top-1 flex h-18 w-18 items-center justify-center md:h-20 md:w-20">
                      <svg viewBox="0 0 100 100" className="absolute h-full w-full -rotate-90">
                        <circle cx="50" cy="50" r="44" className="fill-none stroke-white/10 stroke-[8]" />
                        <circle
                          cx="50"
                          cy="50"
                          r="44"
                          className="fill-none stroke-rose-400 stroke-[8] drop-shadow-[0_0_10px_rgba(255,0,85,0.6)]"
                          strokeLinecap="round"
                          strokeDasharray={276}
                          strokeDashoffset={276 - ((Math.max(formatSeconds(phaseRemainingMs), 0) / Math.max(state?.question?.answerTimeSeconds ?? 15, 1)) * 276)}
                        />
                      </svg>
                      <span className="qa-ref-title relative text-3xl leading-none md:text-3xl">
                        {formatSeconds(phaseRemainingMs)}
                      </span>
                    </div>
                  )}

                  <h3 className="qa-ref-title mt-1 text-4xl leading-none md:pl-20 md:text-[3.35rem]">
                    {state?.room?.phase === "finished"
                      ? "Classement final"
                      : questionNumber
                        ? `Question ${questionNumber}`
                        : "En attente du lancement"}
                  </h3>
                </div>

                <p className="mt-2 text-lg text-slate-200 md:max-w-4xl md:pl-20 md:text-[1.65rem] md:font-extrabold md:leading-[1.04] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                  {state?.room?.phase === "finished"
                    ? `${winner?.nickname ?? "Le gagnant"} termine premier avec ${winner?.score ?? 0} points.`
                    : state?.question?.text ?? "Les joueurs peuvent rejoindre la salle."}
                </p>

                {state?.room?.phase === "finished" ? (
                  <div className="mt-8">
                    <VictoryPodium players={state?.leaderboard ?? []} />
                  </div>
                ) : null}

                {state?.room?.phase !== "finished" && (
                  <div className={`mt-4 grid gap-3 ${hasQuestionMedia ? "lg:grid-cols-[minmax(280px,0.8fr)_minmax(560px,1.2fr)]" : ""}`}>
                    {hasQuestionMedia && (
                      <div className="qa-ref-panel-soft qa-ref-card-glow-cyan flex min-h-0 items-center justify-center rounded-[1.5rem] p-3">
                        <QuestionMediaDisplay
                          mediaPath={state.question.mediaPath}
                          mediaType={state.question.mediaType}
                          alt={state.question.title ?? "Question media"}
                          autoPlay
                          muted={false}
                          controls
                          className="mx-auto max-h-[18vh] w-full rounded-2xl object-contain lg:max-h-[21vh]"
                        />
                      </div>
                    )}

                    {orderedChoices.length > 0 && (
                      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
                        {orderedChoices.map((choice, index) => {
                          const tone = answerTone(index);

                          return (
                          <div
                              key={choice.id}
                              className={`qa-ref-answer-card relative overflow-hidden rounded-[1.35rem] border px-4 py-3.5 ${
                                choice.isCorrect
                                  ? "border-lime-300/40 bg-[linear-gradient(135deg,rgba(57,255,20,0.18),rgba(255,255,255,0.04))]"
                                  : tone.container
                              }`}
                              style={{ animationDelay: `${index * 70}ms` }}
                            >
                              <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/10 to-transparent" />
                              <div className="flex items-center gap-3">
                                <div className={`qa-ref-title flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-3xl leading-none ${choice.isCorrect ? "text-lime-200" : tone.letter}`}>
                                  {choice.label}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-bold leading-snug md:text-base lg:text-[1.05rem] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
                                    <QuestionOptionContent option={choice} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {state?.reveal && (
                  <div className="qa-ref-card-glow-lime mt-4 rounded-[1.8rem] border border-lime-300/30 bg-[linear-gradient(135deg,rgba(57,255,20,0.16),rgba(255,255,255,0.03))] p-4">
                    <p className="qa-ref-title text-3xl text-lime-100 md:text-4xl">
                      {`${state.reveal.correctChoiceLabel} - ${state.reveal.correctChoiceText}`}
                    </p>
                    <div className="qa-ref-panel-soft mt-3 rounded-[1.3rem] p-3">
                      <QuestionOptionContent
                        option={{
                          label: state.reveal.correctChoiceLabel,
                          text: state.reveal.correctChoiceText,
                        }}
                      />
                    </div>
                    {state.reveal.explanation && (
                      <p className="mt-3 text-slate-200">{state.reveal.explanation}</p>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="flex flex-col gap-4">
              <Leaderboard
                players={state?.leaderboard ?? []}
                title={state?.room?.phase === "finished" ? "Classement final" : "Leaderboard live"}
                subtitle={state?.room?.phase === "finished" ? "Resume de partie" : "Nom + score"}
              />
              {state?.lastElimination && (
                <div className="qa-ref-card-glow-magenta rounded-[1.8rem] border border-rose-300/30 bg-[linear-gradient(135deg,rgba(255,0,85,0.16),rgba(255,255,255,0.03))] p-5">
                  <p className="qa-ref-kicker text-rose-200">
                    Derniere elimination
                  </p>
                  <p className="qa-ref-title mt-2 text-4xl">{state.lastElimination.nickname}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
