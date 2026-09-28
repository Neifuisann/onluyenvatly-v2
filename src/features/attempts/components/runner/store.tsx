"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { GuardEvent } from "@/db/schema";
import { pushGuard } from "../../domain/guard";
import {
  chooseOption,
  goTo,
  type RunnerState,
  setStatement,
  setText,
  toggleFlag,
} from "../../domain/runner-state";

/** Zustand is used only here, in the runner (02 §2). One store per attempt. */
export type RunnerStore = RunnerState & {
  /** Exam-guard events the server hasn't confirmed yet (S4-04). */
  guard: readonly GuardEvent[];
  recordGuard: (event: GuardEvent) => void;
  /** The first `n` pending events reached the server. */
  ackGuard: (n: number) => void;
  choose: (index: number, letter: string) => void;
  setStatement: (
    index: number,
    statement: number,
    value: boolean,
    count: number,
  ) => void;
  setText: (index: number, text: string) => void;
  toggleFlag: (index: number) => void;
  goTo: (index: number) => void;
};

export function createRunnerStore(initial: RunnerState) {
  return createStore<RunnerStore>()((set) => ({
    ...initial,
    guard: [],
    recordGuard: (e) => set((s) => ({ guard: pushGuard(s.guard, e) })),
    ackGuard: (n) => set((s) => ({ guard: s.guard.slice(n) })),
    choose: (i, letter) => set((s) => chooseOption(s, i, letter)),
    setStatement: (i, statement, value, count) =>
      set((s) => setStatement(s, i, statement, value, count)),
    setText: (i, text) => set((s) => setText(s, i, text)),
    toggleFlag: (i) => set((s) => toggleFlag(s, i)),
    goTo: (i) => set((s) => goTo(s, i)),
  }));
}

const RunnerContext = createContext<StoreApi<RunnerStore> | null>(null);

export function RunnerProvider({
  initial,
  children,
}: {
  initial: () => RunnerState;
  children: ReactNode;
}) {
  const [store] = useState(() => createRunnerStore(initial()));
  return (
    <RunnerContext.Provider value={store}>{children}</RunnerContext.Provider>
  );
}

export function useRunnerApi(): StoreApi<RunnerStore> {
  const store = useContext(RunnerContext);
  if (!store) throw new Error("useRunner must be used inside RunnerProvider");
  return store;
}

export function useRunner<T>(selector: (s: RunnerStore) => T): T {
  return useStore(useRunnerApi(), selector);
}
