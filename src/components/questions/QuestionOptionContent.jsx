import QuestionMediaDisplay from "./QuestionMediaDisplay";
import { isAssetMediaPath } from "./questionMediaUtils";

function inferOptionMediaType(optionValue = "") {
  const lower = optionValue.toLowerCase();

  if (lower.endsWith(".mp4") || lower.endsWith(".webm")) {
    return "video";
  }

  if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".ogg")) {
    return "audio";
  }

  return "image";
}

export default function QuestionOptionContent({ option }) {
  if (!isAssetMediaPath(option.text)) {
    return <span className="block text-2xl leading-snug">{option.text}</span>;
  }

  return (
    <div className="space-y-3">
      <QuestionMediaDisplay
        mediaPath={option.text}
        mediaType={inferOptionMediaType(option.text)}
        alt={`Option ${option.label}`}
        className="max-h-44 w-full rounded-2xl object-contain bg-white/10"
        controls
      />
      <span className="block text-sm font-semibold uppercase tracking-[0.25em] opacity-80">
        Option {option.label}
      </span>
    </div>
  );
}
