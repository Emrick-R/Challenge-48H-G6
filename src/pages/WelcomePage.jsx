import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createRoom } from "../api/lobby";

export default function WelcomePage() {
  const navigate = useNavigate();
  const [hostName, setHostName] = useState("Host Qui a la ref ?");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateRoom(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await createRoom({
        hostName,
        themeId: 3,
        maxPlayers: 8,
      });

      navigate(`/screen?room=${result.room.roomCode}`);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="qa-ref-stage min-h-screen bg-[#030408] text-white">
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 md:px-8">
        <div>
          <p className="qa-ref-kicker">Quiz Battle Royale</p>
          <h1 className="qa-ref-title mt-2 text-5xl leading-none md:text-7xl">
            Qui a la <span className="qa-ref-yellow-text">ref ?</span>
          </h1>
        </div>

        <Link
          to="/scan"
          className="qa-ref-button qa-ref-button-primary px-5 py-3 text-sm uppercase"
        >
          Rejoindre une room
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl flex-col gap-10 px-5 pb-10 md:px-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="max-w-3xl">
          <p className="qa-ref-kicker">Pop culture. Elimination. Tension.</p>
          <h2 className="qa-ref-title qa-ref-neon-text mt-5 text-6xl leading-[0.9] md:text-8xl">
            Battle quiz
            <br />
            en direct
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
            Ouvrez une room sur le grand ecran, faites rejoindre jusqu a 8 joueurs
            sur telephone, puis laissez la partie enchainer questions, corrections
            et eliminations comme un vrai game show.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="qa-ref-panel-soft qa-ref-card-glow-cyan rounded-[1.6rem] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Joueurs</p>
              <p className="qa-ref-title mt-3 text-4xl text-cyan-300">8 max</p>
            </div>
            <div className="qa-ref-panel-soft qa-ref-card-glow-yellow rounded-[1.6rem] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Reponses</p>
              <p className="qa-ref-title mt-3 text-4xl text-[#f4ea2a]">A B C D</p>
            </div>
            <div className="qa-ref-panel-soft qa-ref-card-glow-magenta rounded-[1.6rem] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Elimination</p>
              <p className="qa-ref-title mt-3 text-4xl text-rose-400">120s</p>
            </div>
          </div>
        </section>

        <section className="qa-ref-panel relative overflow-hidden rounded-[2.2rem] p-6 md:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-rose-500 to-[#f4ea2a]" />
          <div className="grid gap-8">
            <div>
              <p className="qa-ref-kicker">Poste principal</p>
              <h3 className="qa-ref-title mt-3 text-5xl leading-none">Creer une salle</h3>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Le grand ecran affiche la question, le timer, la correction et
                le leaderboard pendant que les joueurs repondent sur mobile.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="qa-ref-panel-soft rounded-[1.4rem] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Lobby</p>
                <p className="mt-3 text-sm font-bold text-white">QR code + code room visibles</p>
              </div>
              <div className="qa-ref-panel-soft rounded-[1.4rem] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Live</p>
                <p className="mt-3 text-sm font-bold text-white">Question, media, timer, scores</p>
              </div>
              <div className="qa-ref-panel-soft rounded-[1.4rem] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Final</p>
                <p className="mt-3 text-sm font-bold text-white">Podium + classement final</p>
              </div>
            </div>

            <form onSubmit={handleCreateRoom} className="grid gap-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Nom de l host
                </span>
                <input
                  type="text"
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  className="w-full rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-4 text-lg font-semibold text-white outline-none transition focus:border-cyan-300/50 focus:bg-white/8"
                />
              </label>

              {error && (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/12 px-4 py-3 text-sm font-medium text-rose-100">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="qa-ref-button qa-ref-button-primary px-6 py-4 text-sm uppercase disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creation..." : "Creer la room"}
                </button>
                <Link
                  to="/scan"
                  className="qa-ref-button border border-white/12 bg-white/6 px-6 py-4 text-sm uppercase text-white"
                >
                  Rejoindre avec un code
                </Link>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
