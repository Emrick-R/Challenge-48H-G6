import VictoryPodium from "./VictoryPodium";

function SkullIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C7.03 2 3 6.03 3 11c0 3.31 1.79 6.2 4.46 7.74l.12 3.15c.04.52.46 1.11 1 1.11h6.84c.54 0 .96-.59 1-1.11l.12-3.15C19.21 17.2 21 14.31 21 11 21 6.03 16.97 2 12 2Zm-3 9.5A1.5 1.5 0 1 1 9 8.5a1.5 1.5 0 0 1 0 3Zm6 0A1.5 1.5 0 1 1 15 8.5a1.5 1.5 0 0 1 0 3Z" />
    </svg>
  );
}

export default function EventOverlay({ eventType, payload, onClose, leaderboard = [] }) {
  if (!eventType) {
    return null;
  }

  if (eventType === "victory") {
    return (
      <div className="qa-ref-overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.14),rgba(3,4,8,0.94)_60%)] p-4 backdrop-blur-md">
        <div className="w-full max-w-6xl qa-ref-scale-in">
          <div className="mb-6 text-center">
            <p className="qa-ref-kicker">Battle Royale terminee</p>
            <h2 className="qa-ref-title mt-3 text-6xl text-white md:text-8xl">
              Podium <span className="qa-ref-yellow-text">final</span>
            </h2>
          </div>
          <VictoryPodium players={leaderboard} />
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="qa-ref-button qa-ref-button-primary px-6 py-4 text-sm uppercase"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (eventType === "elimination") {
    return (
      <div className="qa-ref-overlay-enter fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,0,85,0.18),rgba(3,4,8,0.96)_62%)] p-4 backdrop-blur-md">
        <div className="w-full max-w-5xl text-center text-white">
          <div className="mx-auto flex max-w-4xl flex-col items-center">
            <SkullIcon className="qa-ref-skull-drift h-28 w-28 text-rose-500 md:h-40 md:w-40" />
            <p className="qa-ref-kicker mt-4 text-cyan-300">Elimination</p>
            <h2 className="qa-ref-title mt-4 text-7xl leading-none md:text-[8rem]">Hecatombe</h2>
            <div className="qa-ref-scale-in mt-8 w-full rounded-[2rem] border border-rose-400/35 bg-[linear-gradient(90deg,transparent,rgba(255,0,85,0.22),transparent)] px-8 py-6">
              <p className="text-sm font-bold uppercase tracking-[0.36em] text-cyan-300">Joueur sorti</p>
              <p className="qa-ref-title mt-4 text-5xl text-white md:text-7xl">
                {payload?.nickname ?? "Joueur elimine"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (eventType === "reveal") {
    return (
      <div className="qa-ref-overlay-enter fixed inset-0 z-50 flex items-start justify-center bg-black/25 p-4 pt-16 backdrop-blur-sm">
        <div className="qa-ref-scale-in w-full max-w-3xl rounded-[2rem] border border-lime-300/35 bg-[linear-gradient(135deg,rgba(57,255,20,0.22),rgba(5,18,8,0.94))] px-6 py-6 text-center text-white shadow-[0_30px_70px_rgba(57,255,20,0.18)]">
          <p className="qa-ref-kicker text-lime-100">Bonne reponse</p>
          <h2 className="qa-ref-title mt-3 text-5xl leading-none md:text-6xl">
            {payload?.title ?? "Reponse devoilee"}
          </h2>
          {payload?.body && <p className="mt-4 text-base leading-7 text-lime-50/90">{payload.body}</p>}
        </div>
      </div>
    );
  }

  return null;
}
