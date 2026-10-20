"use client";

import { useTheme } from "next-themes";
import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { CREATIVITY_VALUES, LENGTH_VALUES } from "@/lib/limits";
import { clearHistory, resetSettings, settingsStore, useStore } from "@/lib/storage";
import { Card, Chip, GhostButton, PageHeader, Switch } from "@/components/ui/primitives";
import { useNotice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";

const LABEL = { safe: "Safe", balanced: "Balanced", playful: "Playful", short: "Short", medium: "Medium", long: "Long" } as const;
const noop = () => () => {};

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <span>
        <span className="block text-sm font-medium">{title}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      {children}
    </li>
  );
}

export function SettingsView() {
  const s = useStore(settingsStore);
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(noop, () => true, () => false);
  const { show, node } = useNotice();
  const [wipe, setWipe] = React.useState(false);
  const set = (patch: Partial<typeof s>) => settingsStore.set({ ...s, ...patch });

  const themes = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <div>
      <PageHeader title="Settings">Changes save automatically and stay in this browser.</PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <h2 className="mb-4 text-sm font-bold">Defaults</h2>
          <ul className="divide-y divide-border">
            <Row title="Creativity" hint="Safe sticks to likely words, Playful takes more risks">
              <div className="flex flex-wrap gap-2">
                {CREATIVITY_VALUES.map((v) => (
                  <Chip key={v} active={s.creativity === v} onClick={() => set({ creativity: v })}>{LABEL[v]}</Chip>
                ))}
              </div>
            </Row>
            <Row title="Length" hint="How much the model adds">
              <div className="flex flex-wrap gap-2">
                {LENGTH_VALUES.map((v) => (
                  <Chip key={v} active={s.length === v} onClick={() => set({ length: v })}>{LABEL[v]}</Chip>
                ))}
              </div>
            </Row>
            <Row title="Suggestions per try">
              <div className="flex gap-2">
                {([2, 3, 4] as const).map((n) => (
                  <Chip key={n} active={s.suggestions === n} onClick={() => set({ suggestions: n })} className="px-4">{n}</Chip>
                ))}
              </div>
            </Row>
            <Row title="Live next word" hint="Suggestions while you type">
              <Switch label="Live next word suggestions" checked={s.nextWord} onChange={(v) => set({ nextWord: v })} />
            </Row>
            <Row title="Save picks to history" hint="Kept only in this browser">
              <Switch label="Save picks to history" checked={s.saveHistory} onChange={(v) => set({ saveHistory: v })} />
            </Row>
          </ul>
          <div className="mt-5">
            <GhostButton onClick={() => { resetSettings(); show("Defaults restored"); }}>Reset to defaults</GhostButton>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 text-sm font-bold">Appearance</h2>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
              {themes.map(({ id, label, icon: Icon }) => {
                const active = mounted && theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors",
                      active ? "border-primary bg-soft text-soft-foreground" : "border-border bg-surface hover:border-primary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-bold">Your data</h2>
            <p className="mb-4 text-xs text-muted">There are no accounts. Everything lives in this browser, and nothing is stored on our servers.</p>
            <div className="flex flex-col items-start gap-2">
              <GhostButton onClick={() => { clearHistory(true); show("History cleared, saved phrases kept"); }}>Clear history</GhostButton>
              {wipe ? (
                <span className="flex items-center gap-2 text-sm">
                  Erase everything here?
                  <GhostButton
                    className="border-danger text-danger"
                    onClick={() => {
                      clearHistory(false);
                      resetSettings();
                      setWipe(false);
                      show("All local data erased");
                    }}
                  >
                    Yes, erase
                  </GhostButton>
                  <GhostButton onClick={() => setWipe(false)}>Cancel</GhostButton>
                </span>
              ) : (
                <GhostButton onClick={() => setWipe(true)} className="hover:border-danger hover:text-danger">Erase all local data</GhostButton>
              )}
            </div>
          </Card>
        </div>
      </div>
      {node}
    </div>
  );
}
