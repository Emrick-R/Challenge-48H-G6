import { ArrowLeftIcon, ComputerDesktopIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { buildJoinUrl, joinRoom } from "../api/lobby";
import { savePlayerSession } from "../lib/playerSession";

export default function ScanQr() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRoomCode = searchParams.get("room")?.toUpperCase() ?? "";
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const qrValue = useMemo(
    () => buildJoinUrl(roomCode || "ROOMCODE"),
    [roomCode],
  );

  async function handleJoin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await joinRoom({
        roomCode,
        nickname,
      });

      savePlayerSession({
        roomCode: result.room.roomCode,
        playerId: result.player.id,
        nickname: result.player.nickname,
      });

      navigate(`/game?room=${result.room.roomCode}&playerId=${result.player.id}`);
    } catch (joinError) {
      setError(joinError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="qa-ref-stage min-h-screen bg-[#030408] px-4 py-6 text-white md:p-8">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-cyan-300">
            <ArrowLeftIcon className="h-5 w-5" />
            Retour
          </Link>
          <div className="qa-ref-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-slate-200">
            <ComputerDesktopIcon className="h-5 w-5 text-cyan-300" />
            Ecran joueur
          </div>
        </header>

        <div className="grid flex-1 items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="qa-ref-panel rounded-[2rem] p-6 md:p-8">
            <div className="qa-ref-card-glow-cyan mb-6 inline-flex rounded-full bg-cyan-400/10 p-4 shadow-inner">
              <QrCodeIcon className="h-8 w-8 text-cyan-300" />
            </div>

            <p className="qa-ref-kicker">Mobile player</p>
            <h1 className="qa-ref-title mt-3 text-5xl leading-none md:text-6xl">
              Rejoins la partie
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Entre le code de salle, choisis ton pseudo, puis prepare-toi a
              repondre le plus vite possible pour survivre.
            </p>

            <form onSubmit={handleJoin} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Code de salle
                </span>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                  className="qa-ref-title w-full rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-4 text-3xl tracking-[0.22em] text-white outline-none transition focus:border-cyan-300/50 focus:bg-white/8"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Pseudo
                </span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Votre pseudo"
                  className="w-full rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-4 text-lg text-white outline-none transition focus:border-cyan-300/50 focus:bg-white/8"
                />
              </label>

              {error && (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/12 px-4 py-3 text-sm font-medium text-rose-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !roomCode || !nickname}
                className="qa-ref-button qa-ref-button-primary flex w-full items-center justify-center gap-3 px-5 py-4 text-lg uppercase disabled:cursor-not-allowed disabled:opacity-60"
              >
                <QrCodeIcon className="h-6 w-6" />
                {loading ? "Connexion..." : "Rejoindre la room"}
              </button>
            </form>
          </section>

          <section className="flex items-center justify-center">
            <div className="qa-ref-panel qa-ref-card-glow-magenta relative w-full max-w-md rounded-[2.2rem] p-6 text-center">
              <div className="absolute -top-4 -left-4 h-12 w-12 rounded-tl-2xl border-t-4 border-l-4 border-cyan-300" />
              <div className="absolute -top-4 -right-4 h-12 w-12 rounded-tr-2xl border-t-4 border-r-4 border-cyan-300" />
              <div className="absolute -bottom-4 -left-4 h-12 w-12 rounded-bl-2xl border-b-4 border-l-4 border-cyan-300" />
              <div className="absolute -bottom-4 -right-4 h-12 w-12 rounded-br-2xl border-r-4 border-b-4 border-cyan-300" />

              <div className="relative rounded-[1.7rem] bg-white p-6 text-slate-950 shadow-2xl">
                <QRCodeSVG value={qrValue} size={260} className="mx-auto" />
                <div className="qa-ref-scan-line absolute top-0 left-0 h-1 w-full bg-cyan-400 shadow-lg shadow-cyan-300/50" />
              </div>

              <p className="qa-ref-kicker mt-6">QR de la room</p>
              <p className="qa-ref-title mt-2 text-5xl text-[#f4ea2a]">
                {roomCode || "ROOM"}
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Si vous voyez le grand ecran, vous pouvez aussi simplement saisir
                le code sans scanner.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
