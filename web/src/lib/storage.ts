"use client";

import { useSyncExternalStore } from "react";
import { CREATIVITY_VALUES, LENGTH_VALUES, MAX_PROMPT_CHARS, type Creativity, type Length } from "@/lib/limits";
import type { Suggestion } from "@/lib/api";

type Area = "local" | "session";

export type Store<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (cb: () => void) => () => void;
  fallback: T;
};

/** Tiny external store over localStorage or sessionStorage. Everything read back is re-validated. */
export function createStore<T>(key: string, fallback: T, parse: (raw: unknown) => T, area: Area = "local"): Store<T> {
  const storageKey = "complete.io:" + key;
  const listeners = new Set<() => void>();
  let cache: T | undefined;

  const backend = () => {
    try {
      return area === "local" ? window.localStorage : window.sessionStorage;
    } catch {
      return null; // blocked storage, private mode
    }
  };

  const read = (): T => {
    try {
      const raw = backend()?.getItem(storageKey);
      return raw ? parse(JSON.parse(raw)) : fallback;
    } catch {
      return fallback;
    }
  };

  const notify = () => listeners.forEach((l) => l());

  if (typeof window !== "undefined" && area === "local") {
    window.addEventListener("storage", (e) => {
      if (e.key === storageKey) {
        cache = undefined;
        notify();
      }
    });
  }

  return {
    fallback,
    get() {
      if (typeof window === "undefined") return fallback;
      if (cache === undefined) cache = read();
      return cache;
    },
    set(next) {
      const value = typeof next === "function" ? (next as (p: T) => T)(this.get()) : next;
      cache = value;
      try {
        backend()?.setItem(storageKey, JSON.stringify(value));
      } catch {
        /* quota or blocked: keep the in-memory value for this visit */
      }
      notify();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.fallback);
}

// ---------- settings ----------
export type Settings = {
  creativity: Creativity;
  length: Length;
  suggestions: 2 | 3 | 4;
  nextWord: boolean;
  saveHistory: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  creativity: "balanced",
  length: "medium",
  suggestions: 3,
  nextWord: true,
  saveHistory: true,
};

function parseSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = DEFAULT_SETTINGS;
  return {
    creativity: CREATIVITY_VALUES.includes(r.creativity as Creativity) ? (r.creativity as Creativity) : s.creativity,
    length: LENGTH_VALUES.includes(r.length as Length) ? (r.length as Length) : s.length,
    suggestions: r.suggestions === 2 || r.suggestions === 3 || r.suggestions === 4 ? r.suggestions : s.suggestions,
    nextWord: typeof r.nextWord === "boolean" ? r.nextWord : s.nextWord,
    saveHistory: typeof r.saveHistory === "boolean" ? r.saveHistory : s.saveHistory,
  };
}

export const settingsStore = createStore<Settings>("settings", DEFAULT_SETTINGS, parseSettings);

// ---------- history and saved phrases ----------
export type Entry = { id: string; input: string; output: string; createdAt: number; saved: boolean };
const MAX_ENTRIES = 200;
const MAX_TEXT = 1200;

function parseEntries(raw: unknown): Entry[] {
  if (!Array.isArray(raw)) return [];
  const out: Entry[] = [];
  for (const item of raw) {
    const e = item as Record<string, unknown>;
    if (typeof e?.id !== "string" || typeof e.input !== "string" || typeof e.output !== "string") continue;
    if (typeof e.createdAt !== "number" || !Number.isFinite(e.createdAt)) continue;
    out.push({
      id: e.id.slice(0, 64),
      input: e.input.slice(0, MAX_TEXT),
      output: e.output.slice(0, MAX_TEXT),
      createdAt: e.createdAt,
      saved: e.saved === true,
    });
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}

export const entriesStore = createStore<Entry[]>("entries", [], parseEntries);

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}

/** Record what the visitor chose. Same text twice just moves it to the top. */
export function recordEntry(input: string, output: string, opts: { saved?: boolean } = {}) {
  const settings = settingsStore.get();
  if (!settings.saveHistory && !opts.saved) return;
  entriesStore.set((prev) => {
    const existing = prev.find((e) => e.input === input && e.output === output);
    const rest = prev.filter((e) => e !== existing);
    const entry: Entry = existing
      ? { ...existing, createdAt: Date.now(), saved: existing.saved || !!opts.saved }
      : { id: newId(), input, output, createdAt: Date.now(), saved: !!opts.saved };
    return [entry, ...rest].slice(0, MAX_ENTRIES);
  });
}

export function toggleSaved(input: string, output: string) {
  const found = entriesStore.get().find((e) => e.input === input && e.output === output);
  if (found) {
    entriesStore.set((prev) => prev.map((e) => (e.id === found.id ? { ...e, saved: !e.saved } : e)));
  } else {
    recordEntry(input, output, { saved: true });
  }
}

// ---------- hand off between pages (this tab only) ----------
export type Result = {
  input: string;
  suggestions: Suggestion[];
  latencyMs: number;
  creativity: Creativity;
  length: Length;
  createdAt: number;
};

function parseResult(raw: unknown): Result | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.input !== "string" || !Array.isArray(r.suggestions)) return null;
  const suggestions = r.suggestions
    .filter((s): s is Suggestion => typeof s?.text === "string" && typeof s?.continuation === "string")
    .slice(0, 12)
    .map((s) => ({ text: s.text.slice(0, MAX_TEXT), continuation: s.continuation.slice(0, MAX_TEXT) }));
  if (!suggestions.length) return null;
  return {
    input: r.input.slice(0, MAX_PROMPT_CHARS + 20),
    suggestions,
    latencyMs: typeof r.latencyMs === "number" ? r.latencyMs : 0,
    creativity: CREATIVITY_VALUES.includes(r.creativity as Creativity) ? (r.creativity as Creativity) : "balanced",
    length: LENGTH_VALUES.includes(r.length as Length) ? (r.length as Length) : "medium",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
  };
}

export const resultStore = createStore<Result | null>("result", null, parseResult, "session");

export const draftStore = createStore<string>(
  "draft",
  "",
  (raw) => (typeof raw === "string" ? raw.slice(0, MAX_PROMPT_CHARS) : ""),
  "session",
);

export function removeEntry(id: string) {
  entriesStore.set((prev) => prev.filter((e) => e.id !== id));
}

/** Clear history. Saved phrases survive unless keepSaved is false. */
export function clearHistory(keepSaved = true) {
  entriesStore.set((prev) => (keepSaved ? prev.filter((e) => e.saved) : []));
}

export function resetSettings() {
  settingsStore.set(DEFAULT_SETTINGS);
}
