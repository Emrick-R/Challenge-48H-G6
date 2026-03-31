import QuestionMediaDisplay from "./QuestionMediaDisplay";
import { orderChoicesForDisplay } from "./questionMediaUtils";

export default function MediaQuestion({ data, onAnswer, disabled = false }) {
  const mediaUrl = data.mediaUrl || data.mediaPath;
  const options = orderChoicesForDisplay(data.options);
  const mobileLetters = ["A", "B", "C", "D"];
  const colors = [
    "bg-rose-500 hover:bg-rose-400 text-white shadow-[0_18px_36px_rgba(255,0,85,0.25)]",
    "bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_18px_36px_rgba(0,240,255,0.24)]",
    "bg-yellow-300 hover:bg-yellow-200 text-slate-950 shadow-[0_18px_36px_rgba(244,234,42,0.24)]",
    "bg-lime-400 hover:bg-lime-300 text-slate-950 shadow-[0_18px_36px_rgba(57,255,20,0.24)]",
  ];

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-8 flex justify-center rounded-[2rem] bg-white p-4 shadow-2xl">
        {mediaUrl ? (
          <QuestionMediaDisplay
            mediaPath={mediaUrl}
            mediaType={data.mediaType}
            alt="Question media"
            autoPlay
            muted={false}
            controls
            className="max-h-80 w-full rounded-xl object-contain"
          />
        ) : (
          <div className="grid h-72 w-full place-items-center rounded-2xl bg-slate-100 text-center text-slate-500">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em]">Media</p>
              <p className="mt-3 text-lg">{data.mediaPath || "Aucun media disponible"}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(option.id)}
            className={`qa-ref-button qa-ref-answer-card flex aspect-square items-center justify-center rounded-[2rem] text-6xl font-black uppercase transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 md:text-7xl ${colors[index % colors.length]}`}
            aria-label={`Repondre ${mobileLetters[index] ?? option.label ?? ""}`.trim()}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            {mobileLetters[index] ?? option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
