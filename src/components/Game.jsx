import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRoomState } from "../hooks/useRoomState";
import { clearPlayerSession, getPlayerSession } from "../lib/playerSession";
import Leaderboard from "./Leaderboard";
import StatusPopup from "./StatusPopup";
import MediaQuestion from "./questions/MediaQuestion";
import QCM from "./questions/QCM";
import QuestionOptionContent from "./questions/QuestionOptionContent";

function formatSeconds(milliseconds) {
  return Math.ceil(Math.max(milliseconds, 0) / 1000);
}

function getQuestionNumber(state) {
  return Number.isInteger(state?.room?.currentQuestionOrder)
    ? state.room.currentQuestionOrder + 1
    : null;
}

export default function Game() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = useMemo(() => getPlayerSession(), []);
  const roomCode = searchParams.get("room")?.toUpperCase() ?? session?.roomCode ?? "";
  const playerId = Number(searchParams.get("playerId") ?? session?.playerId ?? 0) || null;
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState(null);
  const popupTimeoutRef = useRef(null);
  const seenRevealRef = useRef("");
  const seenEliminationRef = useRef("");
  const seenFinishRef = useRef("");
  const { state, loading, error, phaseRemainingMs, nextEliminationMs, submitAnswer } =
    useRoomState({
      roomCode,
      role: "player",
      playerId,
    });

  function showPopup(nextPopup) {
    if (popupTimeoutRef.current) {
      window.clearTimeout(popupTimeoutRef.current);
    }

    setPopup(nextPopup);
    popupTimeoutRef.current = window.setTimeout(() => {
      setPopup(null);
    }, 4200);
  }

  useEffect(() => () => {
    if (popupTimeoutRef.current) {
      window.clearTimeout(popupTimeoutRef.current);
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

    const viewerWasCorrect =
      state.viewer?.lastChoiceId != null
      && state.viewer.lastChoiceId === state.reveal.correctChoiceId;

    showPopup(viewerWasCorrect
      ? {
        eyebrow: "Bonne reponse",
        title: "Yes, vous l'avez !",
        body: "Votre reponse etait la bonne. Le classement vient de bouger.",
        tone: "success",
      }
      : {
        eyebrow: "Correction",
        title: "Bonne reponse devoilee",
        body: `${state.reveal.correctChoiceLabel ?? ""} ${state.reveal.correctChoiceText ?? ""}`.trim(),
        tone: "info",
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

    const selfEliminated = state.lastElimination.playerId === state.viewer?.playerId;

    showPopup({
      eyebrow: "Elimination",
      title: selfEliminated ? "Vous etes elimine" : `${state.lastElimination.nickname} est elimine`,
      body: selfEliminated
        ? "Vous restez dans la partie en spectateur."
        : "Le battle royale continue.",
      tone: "danger",
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
      eyebrow: "Fin de partie",
      title: state.viewer?.status === "winner" ? "Victoire !" : "Partie terminee",
      body: winner ? `${winner.nickname} termine avec ${winner.score} points.` : "",
      tone: "warning",
    });
  }, [state]);

  async function handleChoice(choiceId) {
    if (!roomCode || !playerId || state?.viewer?.hasAnswered || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      await submitAnswer({
        roomCode,
        playerId,
        choiceId,
      });
    } catch (answerError) {
      setSubmitError(answerError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleLeave() {
    clearPlayerSession();
    navigate("/scan");
  }

  const question = state?.question;
  const questionNumber = getQuestionNumber(state);
  const questionData = {
    question: question?.text,
    mediaUrl: question?.mediaPath,
    mediaPath: question?.mediaPath,
    mediaType: question?.mediaType,
    options: question?.choices ?? [],
  };
  const isLobby = state?.room?.phase === "waiting";
  const isLive = state?.room?.phase === "question_live";
  const isReveal = state?.room?.phase === "answer_reveal";
  const isFinished = state?.room?.phase === "finished";
  const isEliminated = state?.viewer?.status === "eliminated";
  const isWinner = state?.viewer?.status === "winner";
  const winner = state?.leaderboard?.find((entry) => entry.status === "winner")
    ?? state?.leaderboard?.[0];

  if (!roomCode || !playerId) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 px-4 text-center text-white">
        <div className="space-y-4">
          <h1 className="text-4xl font-black">Aucune session joueur detectee</h1>
          <button
            type="button"
            onClick={() => navigate("/scan")}
            className="rounded-full bg-indigo-600 px-6 py-3 font-bold text-white"
          >
            Rejoindre une room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="qa-ref-stage min-h-screen bg-[#030408] text-white">
      <StatusPopup popup={popup} />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5">
        <header className="qa-ref-panel flex items-center justify-between rounded-[2rem] px-5 py-4">
          <div>
            <p className="qa-ref-kicker">
              Room {roomCode}
            </p>
            <h1 className="qa-ref-title text-4xl leading-none">{state?.viewer?.nickname ?? "Joueur"}</h1>
          </div>

          <button
            type="button"
            onClick={handleLeave}
            className="qa-ref-button qa-ref-chip px-4 py-2 text-sm uppercase text-white transition hover:bg-white/10"
          >
            Quitter
          </button>
        </header>

        {(error || submitError) && (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-rose-100">
            {submitError || error}
          </div>
        )}

        <div className="grid flex-1 gap-4 lg:grid-cols-[1.35fr_0.78fr]">
          <section className="qa-ref-panel rounded-[2rem] p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/60">Votre score</p>
                <p className="qa-ref-title text-6xl leading-none text-[#f4ea2a]">{state?.viewer?.score ?? 0}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/60">Timer</p>
                <p className="qa-ref-title text-6xl leading-none">{formatSeconds(phaseRemainingMs)}s</p>
              </div>
            </div>

            <div className="qa-ref-panel-soft qa-ref-card-glow-magenta mb-5 rounded-[1.5rem] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-100/50">
                Prochaine elimination
              </p>
              <p className="qa-ref-title mt-1 text-4xl leading-none text-rose-300">
                {state?.room?.status === "in_progress" ? `${formatSeconds(nextEliminationMs)}s` : "--"}
              </p>
            </div>

            {loading ? (
              <div className="grid h-[420px] place-items-center rounded-[1.8rem] border border-white/10 bg-white/5">
                <div className="flex items-center gap-3 text-lg font-semibold text-slate-200">
                  <ArrowPathIcon className="h-6 w-6 animate-spin" />
                  Connexion a la partie...
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="qa-ref-panel-soft rounded-[1.8rem] p-6">
                  <p className="qa-ref-kicker">
                    {isLobby
                      ? "Lobby"
                      : isReveal
                        ? `${state?.reveal?.correctChoiceLabel ?? ""} ${state?.reveal?.correctChoiceText ?? "Correction"}`.trim()
                        : isFinished
                          ? "Resume de partie"
                          : `Question ${questionNumber ?? ""}`.trim()}
                  </p>

                  <h2 className="qa-ref-title mt-3 text-5xl leading-none">
                    {isLobby
                      ? "En attente du lancement de la partie"
                      : isFinished
                        ? "Classement final"
                        : questionNumber
                          ? `Question ${questionNumber}`
                          : "Question en cours"}
                  </h2>

                  <p className="mt-4 text-lg text-slate-100">
                    {isLobby
                      ? "Gardez votre telephone pret. L ecran principal va lancer la premiere question."
                      : isFinished
                        ? `${winner?.nickname ?? "Le gagnant"} termine en tete avec ${winner?.score ?? 0} points.`
                        : question?.text}
                  </p>
                </div>

                {isEliminated && (
                  <div className="qa-ref-card-glow-magenta rounded-[1.6rem] border border-rose-300/30 bg-[linear-gradient(135deg,rgba(255,0,85,0.16),rgba(255,255,255,0.03))] p-5 text-center">
                    <p className="text-sm uppercase tracking-[0.3em] text-rose-200">Elimine</p>
                    <p className="qa-ref-title mt-3 text-4xl">Vous restez spectateur</p>
                  </div>
                )}

                {isWinner && (
                  <div className="qa-ref-card-glow-yellow rounded-[1.6rem] border border-yellow-300/30 bg-[linear-gradient(135deg,rgba(244,234,42,0.16),rgba(255,255,255,0.03))] p-5 text-center">
                    <p className="text-sm uppercase tracking-[0.3em] text-yellow-200">Victoire</p>
                    <p className="qa-ref-title mt-3 text-4xl">Dernier joueur vivant</p>
                  </div>
                )}

                {isLive && !isEliminated && question?.choices?.length > 0 && (
                  question?.mediaPath ? (
                    <MediaQuestion
                      data={questionData}
                      disabled={state?.viewer?.hasAnswered || submitting}
                      onAnswer={handleChoice}
                    />
                  ) : (
                    <QCM
                      data={questionData}
                      disabled={state?.viewer?.hasAnswered || submitting}
                      onAnswer={handleChoice}
                    />
                  )
                )}

                {isLive && state?.viewer?.hasAnswered && (
                  <div className="qa-ref-card-glow-lime rounded-[1.5rem] border border-green-300/30 bg-[linear-gradient(135deg,rgba(57,255,20,0.16),rgba(255,255,255,0.03))] p-5 text-center">
                    <p className="text-sm uppercase tracking-[0.3em] text-green-100">
                      Reponse envoyee
                    </p>
                    <p className="qa-ref-title mt-2 text-4xl">
                      Attendez la correction sur l ecran principal
                    </p>
                  </div>
                )}

                {isReveal && state?.reveal && (
                  <div className="qa-ref-card-glow-lime rounded-[1.5rem] border border-lime-300/30 bg-[linear-gradient(135deg,rgba(57,255,20,0.16),rgba(255,255,255,0.03))] p-5">
                    <p className="qa-ref-title text-3xl text-lime-100">
                      {`${state.reveal.correctChoiceLabel} - ${state.reveal.correctChoiceText}`}
                    </p>
                    <div className="mt-3 rounded-[1.3rem] border border-lime-200/20 bg-black/10 p-4">
                      <QuestionOptionContent
                        option={{
                          label: state.reveal.correctChoiceLabel,
                          text: state.reveal.correctChoiceText,
                        }}
                      />
                    </div>
                    {state.reveal.explanation && (
                      <p className="mt-3 text-slate-100">{state.reveal.explanation}</p>
                    )}
                  </div>
                )}

                {isFinished && (
                  <div className="qa-ref-panel-soft rounded-[1.5rem] p-5">
                    <p className="text-sm uppercase tracking-[0.3em] text-indigo-100/70">
                      Votre bilan
                    </p>
                    <p className="qa-ref-title mt-3 text-4xl">
                      Rang {state?.leaderboard?.findIndex((entry) => entry.id === playerId) + 1 || "--"}
                    </p>
                    <p className="mt-2 text-slate-200">
                      Score final: {state?.viewer?.score ?? 0} points
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          <Leaderboard
            players={state?.leaderboard ?? []}
            compact
            title={isFinished ? "Classement final" : "Leaderboard live"}
            subtitle={isFinished ? "Resume de partie" : "Nom + score"}
          />
        </div>
      </div>
    </div>
  );
}
