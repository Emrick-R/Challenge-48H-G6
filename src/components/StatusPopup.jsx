const accentClasses = {
  success: "border-lime-300/40 bg-[linear-gradient(135deg,rgba(57,255,20,0.28),rgba(5,22,10,0.9))] text-lime-50 shadow-[0_22px_50px_rgba(57,255,20,0.24)]",
  danger: "border-rose-300/40 bg-[linear-gradient(135deg,rgba(255,0,85,0.3),rgba(34,5,16,0.92))] text-rose-50 shadow-[0_22px_50px_rgba(255,0,85,0.24)]",
  warning: "border-yellow-300/40 bg-[linear-gradient(135deg,rgba(244,234,42,0.22),rgba(29,25,5,0.92))] text-yellow-50 shadow-[0_22px_50px_rgba(244,234,42,0.2)]",
  info: "border-cyan-300/40 bg-[linear-gradient(135deg,rgba(0,240,255,0.26),rgba(4,14,22,0.92))] text-cyan-50 shadow-[0_22px_50px_rgba(0,240,255,0.2)]",
};

export default function StatusPopup({ popup }) {
  if (!popup) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4">
      <div
        className={`qa-ref-popup-enter w-full max-w-2xl rounded-[1.8rem] border px-5 py-4 shadow-2xl backdrop-blur ${accentClasses[popup.tone] ?? accentClasses.info}`}
      >
        <p className="qa-ref-kicker opacity-85">
          {popup.eyebrow}
        </p>
        <p className="qa-ref-title mt-2 text-4xl leading-none">{popup.title}</p>
        {popup.body && <p className="mt-3 text-sm leading-6 opacity-90">{popup.body}</p>}
      </div>
    </div>
  );
}
