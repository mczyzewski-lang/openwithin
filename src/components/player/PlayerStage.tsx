"use client";

import { AudioPlayer } from "./AudioPlayer";

export function PlayerStage(props: { src: string; title: string; libraryId: string; initialPositionMs: number; demo: boolean }) {
  return <AudioPlayer {...props} subtitle="OpenWithin" />;
}
