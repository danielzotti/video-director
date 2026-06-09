export function formatAdaptiveTimelineTime(valueMs: number): string {
  const ms = Math.max(0, Math.round(valueMs));
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const deciseconds = Math.floor((ms % 1000) / 100);

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}.${deciseconds}`;
  }

  if (minutes > 0) {
    return `${minutes}:${pad(seconds)}.${deciseconds}`;
  }

  return `${seconds}.${deciseconds}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

