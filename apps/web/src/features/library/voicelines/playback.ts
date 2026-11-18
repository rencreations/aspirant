"use client";

/**
 * Playing in the voicelines room. A voice line is decoded whole and played through the voice bus
 * (`audio.playVoice`), which draws the live waveform. A full recording (two to five minutes) is
 * played from a media element through the music bus instead, so it can be paused and sought without
 * holding a long decoded buffer in memory. Starting one stops the other.
 */
import { create } from "zustand";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { withSound } from "@/lib/sound-prompt";
import { voiceLevel } from "@/lib/voice-gain";

interface RecordingState {
  /** The recording that owns the music element, or null. */
  id: string | null;
  playing: boolean;
}

export const useRecording = create<RecordingState>(() => ({ id: null, playing: false }));

/**
 * Full level, times the recording's baked gain `g` (a recording plays through the music bus, which has no
 * lift, so its gain brings it to the loudness of the lines).
 */
const RECORDING_VOLUME = 1;

function stopRecording(): void {
  if (useRecording.getState().id === null) return;
  audio.stopMusic(200);
  useRecording.setState({ id: null, playing: false });
}

interface LineOptions {
  /** Called when the line ends or is stopped. */
  onEnd?: () => void;
  /** The baked gain `g` of the line's record (dB), so every clip plays at the same loudness. */
  gainDb?: number;
}

/** Play a line, or stop it when it is the one that plays. Call inside the press. */
export function toggleLine(url: string, { onEnd, gainDb }: LineOptions = {}): void {
  audio.unlock();
  const voice = audio.getVoiceState();
  if (voice.playing && voice.url === url) {
    audio.stopVoice();
    return;
  }
  withSound("This voice line", () => {
    stopRecording();
    audio.blip("click");
    void audio.playVoice(url, { onEnd, gainDb });
  });
}

/** Play, pause or restart the long recording of a character. Call inside the press. */
export function toggleRecording(recording: { id: string; m4a: string; g?: number }): void {
  audio.unlock();
  const { id, playing } = useRecording.getState();
  const el = audio.getMusicElement();
  if (id === recording.id && el) {
    if (playing && !el.paused) {
      audio.pauseMusic();
      useRecording.setState({ playing: false });
    } else {
      withSound("This recording", () => {
        if (el.ended) el.currentTime = 0;
        audio.resumeMusic();
        useRecording.setState({ playing: true });
      });
    }
    return;
  }
  withSound("This recording", () => {
    audio.stopVoice();
    audio.playMusic(libUrl(recording.m4a), {
      loop: false,
      volume: voiceLevel(RECORDING_VOLUME, recording.g),
      fadeMs: 200,
    });
    useRecording.setState({ id: recording.id, playing: true });
  });
}

export function seekRecording(seconds: number): void {
  const el = audio.getMusicElement();
  if (el && Number.isFinite(seconds)) el.currentTime = Math.max(0, seconds);
}

/** Stop everything this room started (when the visitor leaves). */
export function stopRoom(): void {
  audio.stopVoice();
  stopRecording();
}
