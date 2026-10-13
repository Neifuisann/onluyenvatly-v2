"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ZombieGame as ZombieScreen } from "@/features/zombie/components/zombie-game";
import type { Finish as FinishScreen } from "./finish";
import type { JoinForm as JoinScreen } from "./join-form";
import type { Lobby as LobbyScreen } from "./lobby";
import type { Race as RaceScreen } from "./race";

/*
 * One request renders one phase, so each phase is its own chunk: a phone
 * downloads the race only when it races (08 §1, 150 KB student budget).
 * A Server Component can't split client code itself; this boundary does.
 */
const JoinForm = dynamic(() => import("./join-form").then((m) => m.JoinForm));
const Lobby = dynamic(() => import("./lobby").then((m) => m.Lobby));
const Race = dynamic(() => import("./race").then((m) => m.Race));
const Finish = dynamic(() => import("./finish").then((m) => m.Finish));
const ZombieGame = dynamic(() =>
  import("@/features/zombie/components/zombie-game").then((m) => m.ZombieGame),
);

export type PlayScreenProps =
  | ({ phase: "join" } & ComponentProps<typeof JoinScreen>)
  | ({ phase: "lobby" } & ComponentProps<typeof LobbyScreen>)
  | ({ phase: "race" } & ComponentProps<typeof RaceScreen>)
  | ({ phase: "finish" } & ComponentProps<typeof FinishScreen>)
  /** A zombie room (B-14) plays instead of racing. */
  | ({ phase: "zombie" } & ComponentProps<typeof ZombieScreen>);

/** `/play/[pin]`'s client side: the phase the server chose. */
export function PlayScreen(props: PlayScreenProps) {
  switch (props.phase) {
    case "join": {
      const { phase: _, ...rest } = props;
      return <JoinForm {...rest} />;
    }
    case "lobby": {
      const { phase: _, ...rest } = props;
      return <Lobby {...rest} />;
    }
    case "race": {
      const { phase: _, ...rest } = props;
      return <Race {...rest} />;
    }
    case "finish": {
      const { phase: _, ...rest } = props;
      return <Finish {...rest} />;
    }
    case "zombie": {
      const { phase: _, ...rest } = props;
      return <ZombieGame {...rest} />;
    }
  }
}
