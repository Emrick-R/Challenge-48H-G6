import { orderChoicesForDisplay } from "./questionMediaUtils";

const colors = [
  "bg-rose-500 hover:bg-rose-400 text-white shadow-[0_18px_36px_rgba(255,0,85,0.25)]",
  "bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_18px_36px_rgba(0,240,255,0.24)]",
  "bg-yellow-300 hover:bg-yellow-200 text-slate-950 shadow-[0_18px_36px_rgba(244,234,42,0.24)]",
  "bg-lime-400 hover:bg-lime-300 text-slate-950 shadow-[0_18px_36px_rgba(57,255,20,0.24)]",
];
const mobileLetters = ["A", "B", "C", "D"];

export default function QCM({ data, onAnswer, disabled = false }) {
  const options = orderChoicesForDisplay(data.options);

  return (
    <div className="w-full max-w-3xl">
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
