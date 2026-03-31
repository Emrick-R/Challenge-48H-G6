const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      ...options,
    });
  } catch {
    throw new Error("Impossible de joindre le serveur. Verifiez que le backend est lance.");
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  return payload;
}

export function createRoom({ hostName, themeId = 1, maxPlayers = 8 }) {
  return apiFetch("/api/rooms", {
    method: "POST",
    body: JSON.stringify({
      hostName,
      themeId,
      maxPlayers,
    }),
  });
}

export function joinRoom({ roomCode, nickname }) {
  return apiFetch(`/api/rooms/${encodeURIComponent(roomCode)}/players`, {
    method: "POST",
    body: JSON.stringify({ nickname }),
  });
}

export function startRoom(roomCode) {
  return apiFetch(`/api/rooms/${encodeURIComponent(roomCode)}/start`, {
    method: "POST",
  });
}

export function submitAnswer({ roomCode, playerId, choiceId = null, typedAnswer = null }) {
  return apiFetch(`/api/rooms/${encodeURIComponent(roomCode)}/answers`, {
    method: "POST",
    body: JSON.stringify({
      playerId,
      choiceId,
      typedAnswer,
    }),
  });
}

export function getRoomState(roomCode, viewer = {}) {
  const params = new URLSearchParams();

  if (viewer.role) {
    params.set("role", viewer.role);
  }

  if (viewer.playerId) {
    params.set("playerId", viewer.playerId);
  }

  const suffix = params.size ? `?${params.toString()}` : "";

  return apiFetch(`/api/rooms/${encodeURIComponent(roomCode)}/state${suffix}`);
}

export function buildJoinUrl(roomCode) {
  const publicUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  const baseUrl = publicUrl || window.location.origin;
  return `${baseUrl}/scan?room=${encodeURIComponent(roomCode)}`;
}

export { API_BASE_URL };
