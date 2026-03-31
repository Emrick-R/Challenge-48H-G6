function avatarTone(rank) {
  if (rank === 1) {
    return "bg-[#f4ea2a] text-slate-950 shadow-[0_0_24px_rgba(244,234,42,0.45)]";
  }

  if (rank === 2) {
    return "bg-[#00f0ff] text-slate-950 shadow-[0_0_24px_rgba(0,240,255,0.45)]";
  }

  return "bg-[#ff0055] text-white shadow-[0_0_24px_rgba(255,0,85,0.4)]";
}

function podiumTone(rank) {
  if (rank === 1) {
    return "border-[#f4ea2a]/50 shadow-[0_-14px_34px_rgba(244,234,42,0.14)]";
  }

  if (rank === 2) {
    return "border-cyan-300/40 shadow-[0_-14px_34px_rgba(0,240,255,0.12)]";
  }

  return "border-rose-400/40 shadow-[0_-14px_34px_rgba(255,0,85,0.12)]";
}

function podiumHeight(rank) {
  if (rank === 1) {
    return "h-64 md:h-80";
  }

  if (rank === 2) {
    return "h-48 md:h-60";
  }

  return "h-40 md:h-52";
}

function initialFromName(name = "?") {
  return String(name).trim().charAt(0).toUpperCase() || "?";
}

const CONFETTI_COLORS = ["#00f0ff", "#ff0055", "#f4ea2a", "#39ff14"];

function buildConfettiPieces(count = 22) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    left: `${4 + ((index * 91) % 92)}%`,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    duration: 3.8 + ((index % 5) * 0.45),
    delay: (index % 7) * 0.22,
    rotate: ((index * 37) % 48) - 24,
  }));
}

export default function VictoryPodium({ players = [] }) {
  const podium = players.slice(0, 3);

  if (!podium.length) {
    return null;
  }

  const order = [podium[1], podium[0], podium[2]].filter(Boolean);
  const confettiPieces = buildConfettiPieces();

  return (
    <section className="qa-ref-panel qa-ref-panel-animate relative overflow-hidden rounded-[2rem] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confettiPieces.map((piece) => (
          <span
            key={piece.id}
            className="absolute top-[-12%] block h-4 w-2 rounded-full opacity-85"
            style={{
              left: piece.left,
              backgroundColor: piece.color,
              transform: `rotate(${piece.rotate}deg)`,
              animation: `qa-ref-confetti-fall ${piece.duration}s linear ${piece.delay}s infinite`,
              boxShadow: `0 0 12px ${piece.color}`,
            }}
          />
        ))}
      </div>
      <div className="text-center">
        <p className="qa-ref-kicker">Battle Royale Terminee</p>
        <h2 className="qa-ref-title mt-3 text-5xl md:text-7xl">Podium Final</h2>
      </div>

      <div className="mt-10 flex items-end justify-center gap-4 md:gap-8">
        {order.map((player) => {
          const rank = player.rank;
          const isWinner = rank === 1;

          return (
            <article
              key={player.id}
              className={`qa-ref-podium-card flex w-[30%] min-w-[110px] max-w-[240px] flex-col items-center ${isWinner ? "qa-ref-podium-card--winner md:-translate-y-6" : ""}`}
              style={{ animationDelay: `${rank * 110}ms` }}
            >
              <div
                className={`relative flex h-20 w-20 items-center justify-center rounded-[1.4rem] text-4xl font-black md:h-28 md:w-28 md:text-5xl ${avatarTone(rank)}`}
              >
                {isWinner && (
                  <div className="absolute -top-8 text-3xl text-[#f4ea2a] drop-shadow-[0_0_12px_rgba(244,234,42,0.55)]">
                    ♛
                  </div>
                )}
                {initialFromName(player.nickname)}
              </div>

              <div
                className={`qa-ref-panel mt-4 flex w-full flex-col items-center justify-center rounded-t-[2rem] border-2 px-4 py-5 text-center ${podiumHeight(rank)} ${podiumTone(rank)}`}
              >
                <p className={`qa-ref-title text-6xl leading-none ${rank === 1 ? "text-[#f4ea2a]" : rank === 2 ? "text-cyan-300" : "text-rose-300"}`}>
                  {rank}
                </p>
                <p className="mt-3 truncate text-base font-black uppercase md:text-xl">
                  {player.nickname}
                </p>
                <p className="qa-ref-title mt-2 text-3xl text-cyan-300 md:text-4xl">
                  {player.score}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
