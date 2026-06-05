const KEY = 'dismissed_notifs';

export function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function dismissAll(ids: string[]) {
  const existing = getDismissed();
  ids.forEach(id => existing.add(id));
  localStorage.setItem(KEY, JSON.stringify([...existing]));
}

export function dismissOne(id: string) {
  dismissAll([id]);
}

export function isDismissed(id: string): boolean {
  return getDismissed().has(id);
}
