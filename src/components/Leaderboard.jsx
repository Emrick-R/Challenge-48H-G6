import { TrophyIcon } from "@heroicons/react/24/solid";

function initialFromName(name = "?") {
  return String(name).trim().charAt(0).toUpperCase() || "?";
}

function avatarClasses(rank) {
  if (rank === 1) {
    return "bg-[#f4ea2a] text-slate-950 shadow-[0_0_18px_rgba(244,234,42,0.45)]";
  }

  if (rank === 2) {
    return "bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(0,240,255,0.36)]";
  }

  if (rank === 3) {
    return "bg-rose-500 text-white shadow-[0_0_18px_rgba(255,0,85,0.34)]";
  }

  return "bg-lime-400 text-slate-950";
}

function rowClasses(status) {
  if (status === "winner") {
    return "border-yellow-300/40 bg-[linear-gradient(90deg,rgba(244,234,42,0.12),rgba(255,255,255,0.04))] text-yellow-50";
  }

  if (status === "eliminated") {
    return "border-white/10 bg-white/5 text-white/45";
  }

  return "border-white/10 bg-white/6 text-white";
}

export default function Leaderboard({
  players = [],
  compact = false,
  title = "Leaderboard",
  subtitle = "Nom + score en direct",
}) {
  return (
    <section className="qa-ref-panel qa-ref-panel-animate relative overflow-hidden rounded-[2rem] p-6 text-white">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-rose-500 to-[#f4ea2a]" />
      <div className="mb-6 flex items-center gap-4">
        <div className="relative">
          <TrophyIcon className={`${compact ? "h-10 w-10" : "h-12 w-12"} text-yellow-400`} />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-400" />
          </span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200/70">
            {subtitle}
          </p>
          <h2 className={`qa-ref-title ${compact ? "text-3xl" : "text-4xl"} tracking-tight uppercase`}>
            {title}
          </h2>
        </div>
      </div>

      <div className="grid gap-3">
        {players.map((player, index) => (
          <div
            key={player.id}
            className={`qa-ref-row-enter grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-sm transition ${rowClasses(player.status)}`}
            style={{ animationDelay: `${index * 55}ms` }}
          >
            <div className="flex items-center gap-3">
              <span className={`qa-ref-title w-8 text-center text-3xl leading-none ${player.rank === 1 ? "text-[#f4ea2a]" : "text-slate-400"}`}>
                {player.rank ?? index + 1}
              </span>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-black ${avatarClasses(player.rank ?? index + 1)}`}>
                {initialFromName(player.nickname)}
              </div>
            </div>

            <div className="min-w-0">
              <p className="truncate text-lg font-bold uppercase">{player.nickname}</p>
              <p className="text-xs uppercase tracking-[0.2em] opacity-70">
                {player.status === "winner"
                  ? "gagnant"
                  : player.status === "eliminated"
                    ? "elimine"
                    : "en jeu"}
              </p>
            </div>

            <div className="text-right">
              <p className="qa-ref-title text-3xl leading-none text-cyan-300">{player.score}</p>
              <p className="text-xs uppercase tracking-[0.2em] opacity-70">pts</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
