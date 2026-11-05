"use client";

/**
 * Playing in the voicelines room. A voice line is decoded whole and played through the voice bus
 * (`audio.playVoice`), which draws the live waveform. A full compilation (two to five minutes)
 * is played from a media element through the music bus instead, so it can be paused and sought
 * without holding a long decoded buffer in memory. Starting one stops the other.
 */
import { create } from "zustand";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { withSound } from "@/lib/sound-prompt";

import type { VoiceItem } from "./types";

interface CompilationState {
  /** The compilation that owns the music element, or null. */
  id: string | null;
  playing: boolean;
}

export const useCompilation = create<CompilationState>(() => ({ id: null, playing: false }));

/** Full level: a line is lifted by the voice bus, so a compilation should not sit below it. */
const COMPILATION_VOLUME = 1;

export function lineUrl(item: VoiceItem): string {
  return libUrl(item.m4a);
}

function stopCompilation(): void {
  if (useCompilation.getState().id === null) return;
  audio.stopMusic(200);
  useCompilation.setState({ id: null, playing: false });
}

/** Play a line, or stop it when it is the one that plays. Call inside the press. */
export function toggleLine(item: VoiceItem, onEnd?: () => void): void {
  audio.unlock();
  const url = lineUrl(item);
  const voice = audio.getVoiceState();
  if (voice.playing && voice.url === url) {
    audio.stopVoice();
    return;
  }
  withSound("This voice line", () => {
    stopCompilation();
    audio.blip("click");
    void audio.playVoice(url, onEnd ? { onEnd } : {});
  });
}

/** Play, pause or restart the long recording of a character. Call inside the press. */
export function toggleCompilation(item: VoiceItem): void {
  audio.unlock();
  const { id, playing } = useCompilation.getState();
  const el = audio.getMusicElement();
  if (id === item.id && el) {
    if (playing && !el.paused) {
      audio.pauseMusic();
      useCompilation.setState({ playing: false });
    } else {
      withSound("This recording", () => {
        if (el.ended) el.currentTime = 0;
        audio.resumeMusic();
        useCompilation.setState({ playing: true });
      });
    }
    return;
  }
  withSound("This recording", () => {
    audio.stopVoice();
    audio.playMusic(libUrl(item.m4a), { loop: false, volume: COMPILATION_VOLUME, fadeMs: 200 });
    useCompilation.setState({ id: item.id, playing: true });
  });
}

export function seekCompilation(seconds: number): void {
  const el = audio.getMusicElement();
  if (el && Number.isFinite(seconds)) el.currentTime = Math.max(0, seconds);
}

/** Stop everything this room started (when the visitor leaves). */
export function stopRoom(): void {
  audio.stopVoice();
  stopCompilation();
}
