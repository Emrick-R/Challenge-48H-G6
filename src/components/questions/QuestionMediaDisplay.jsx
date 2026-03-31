import { useEffect, useRef } from "react";

function inferMediaKindFromPath(mediaPath = "") {
  const lower = mediaPath.toLowerCase();

  if (lower.endsWith(".mp4") || lower.endsWith(".webm")) {
    return "video";
  }

  if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".ogg")) {
    return "audio";
  }

  return "image";
}

export default function QuestionMediaDisplay({
  mediaPath,
  mediaType,
  alt = "Media de question",
  className = "",
  autoPlay = false,
  muted = false,
  controls = true,
}) {
  const mediaRef = useRef(null);
  const resolvedType = mediaType && mediaType !== "none"
    ? mediaType
    : inferMediaKindFromPath(mediaPath);

  useEffect(() => {
    if (!autoPlay || !mediaRef.current) {
      return;
    }

    const element = mediaRef.current;
    const playPromise = element.play?.();

    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  }, [autoPlay, mediaPath, resolvedType]);

  if (!mediaPath) {
    return null;
  }

  if (resolvedType === "video") {
    return (
      <video
        ref={mediaRef}
        src={mediaPath}
        autoPlay={autoPlay}
        muted={muted}
        controls={controls}
        loop={autoPlay}
        playsInline
        preload="auto"
        className={className}
      />
    );
  }

  if (resolvedType === "audio") {
    return (
      <audio
        ref={mediaRef}
        src={mediaPath}
        autoPlay={autoPlay}
        controls={controls}
        preload="auto"
        className={className}
      />
    );
  }

  return (
    <img
      src={mediaPath}
      alt={alt}
      className={className}
    />
  );
}
