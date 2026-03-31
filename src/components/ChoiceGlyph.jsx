function glyphClasses(label = "A") {
  switch (label) {
    case "A":
      return "text-rose-400 drop-shadow-[0_0_12px_rgba(255,0,85,0.55)]";
    case "B":
      return "text-cyan-300 drop-shadow-[0_0_12px_rgba(0,240,255,0.55)]";
    case "C":
      return "text-[#f4ea2a] drop-shadow-[0_0_12px_rgba(244,234,42,0.55)]";
    default:
      return "text-lime-300 drop-shadow-[0_0_12px_rgba(57,255,20,0.55)]";
  }
}

export default function ChoiceGlyph({ label, className = "h-12 w-12" }) {
  if (label === "A") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} ${glyphClasses(label)}`}>
        <path d="M12 3L22 21H2L12 3Z" />
      </svg>
    );
  }

  if (label === "B") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} ${glyphClasses(label)}`}>
        <path d="M12 2L22 12L12 22L2 12L12 2Z" />
      </svg>
    );
  }

  if (label === "C") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} ${glyphClasses(label)}`}>
        <circle cx="12" cy="12" r="10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} ${glyphClasses(label)}`}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
    </svg>
  );
}
