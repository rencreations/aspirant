"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

import { Waveform } from "@/components/audio/waveform";
import { EmberField } from "@/components/ember-field";
import { MotionToggle, SoundToggle } from "@/components/hud/preference-toggles";
import { NextFooter } from "@/components/next-footer/next-footer";
import { StarGlyph } from "@/components/star-glyph";
import { LampText } from "@/components/text/lamp-text";
import { ScatterText } from "@/components/text/scatter-text";
import { SplitText } from "@/components/text/split-text";
import { Typewriter } from "@/components/text/typewriter";
import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { HudPanel } from "@/components/ui/hud-panel";
import { Magnetic, MagneticButton } from "@/components/ui/magnetic";
import { Marquee } from "@/components/ui/marquee";
import { Meter } from "@/components/ui/meter";
import { Reveal } from "@/components/ui/reveal";
import { StarButton } from "@/components/ui/star-button";
import { Tag } from "@/components/ui/tag";
import { asset } from "@/lib/asset";
import { audio, type BlipKind } from "@/lib/audio";
import { useVoiceState } from "@/lib/hooks";
import { routes } from "@/lib/site";
import type { ThemeName } from "@/lib/stores";

import { KitFrames, KitOverlays } from "./kit-frames";

const GLStage = dynamic(() => import("@/components/gl/gl-stage"), { ssr: false });
const KitGLDemo = dynamic(() => import("./kit-gl-demo"), { ssr: false });

const THEMES: readonly ThemeName[] = ["storm", "daybreak"];

/** One kit section, rendered in both worlds. */
function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: (theme: ThemeName) => ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="border-t border-line">
      <div className="shell py-sp-l">
        <p className="mb-sp-2xs hud-label">Kit / {id}</p>
        <h2 id={`${id}-title`} className="m-0 display text-step-5">
          {title}
        </h2>
        {note && <p className="mt-sp-xs mb-0 max-w-[70ch] text-text-dim">{note}</p>}
      </div>
      <div className="grid 2xl:grid-cols-2">
        {THEMES.map((theme) => (
          <ThemeZone
            key={theme}
            theme={theme}
            as="div"
            aria-label={`${title}, ${theme}`}
            role="group"
            className="py-sp-l"
          >
            <div className="shell">
              <p className="mb-sp-s hud-label">{theme === "storm" ? "Storm" : "Daybreak"}</p>
              {children(theme)}
            </div>
          </ThemeZone>
        ))}
      </div>
    </section>
  );
}

const SWATCHES = [
  "bg",
  "bg-2",
  "panel",
  "line",
  "line-strong",
  "text",
  "text-dim",
  "text-faint",
  "cyan",
  "gold",
  "amber",
  "violet",
  "magenta",
  "crimson",
  "focus",
  "accent",
  "accent-2",
  "glow",
] as const;

const CONSTANTS = [
  "ink",
  "graphite",
  "ceramic",
  "light-cyan",
  "light-gold",
  "light-amber",
  "light-violet",
  "light-magenta",
  "light-crimson",
] as const;

const STEPS = ["8", "7", "6", "5", "4", "3", "2", "1", "0", "-1", "-2"] as const;

const BLIPS: readonly BlipKind[] = ["hover", "click", "confirm", "whoosh", "star", "error"];

function SoundLab() {
  const voice = useVoiceState();
  const line = asset("/audio/voice/layla/01.m4a");
  const playing = voice.playing && voice.url === line;
  const [music, setMusic] = useState(false);
  return (
    <div className="grid gap-sp-m">
      <div className="flex flex-wrap gap-sp-2xs">
        {BLIPS.map((kind) => (
          <StarButton
            key={kind}
            size="sm"
            variant="ghost"
            blip={false}
            onClick={() => {
              audio.unlock();
              audio.blip(kind);
            }}
          >
            {kind}
          </StarButton>
        ))}
      </div>
      <HudPanel label="Voice / Layla 01" code={playing ? "PLAYING" : "IDLE"} className="max-w-xl">
        <div className="flex items-center gap-sp-s">
          <StarButton
            emblem
            size="sm"
            aria-label="Play Layla, line 1"
            aria-pressed={playing}
            data-cursor={playing ? "STOP" : "PLAY"}
            onClick={() => {
              audio.unlock();
              if (playing) audio.stopVoice();
              else void audio.playVoice(line);
            }}
          />
          <Waveform url={line} className="h-10 flex-1" />
        </div>
      </HudPanel>
      <div className="flex flex-wrap gap-sp-2xs">
        <MagneticButton
          aria-pressed={music}
          onClick={() => {
            audio.unlock();
            if (music) audio.stopMusic();
            else audio.playMusic(asset("/audio/music/we-believe.m4a"), { volume: 0.4 });
            setMusic(!music);
          }}
        >
          {music ? "Stop music" : "Play music"}
        </MagneticButton>
        <SoundToggle labeled />
        <MotionToggle labeled />
      </div>
    </div>
  );
}

function TransitionLab() {
  const router = useTransitionRouter();
  return (
    <div className="flex flex-wrap items-center gap-sp-s">
      <TLink href={routes.story} className="link">
        TLink to Story
      </TLink>
      <TLink href="https://github.com" className="link">
        External link (new tab)
      </TLink>
      <MagneticButton onClick={() => router.push(routes.experience, { label: "Experience" })}>
        push(&quot;/experience&quot;)
      </MagneticButton>
      <MagneticButton onClick={() => void router.reveal({ tone: "light" })}>
        reveal(light)
      </MagneticButton>
      <MagneticButton onClick={() => void router.reveal({ tone: "dark" })}>
        reveal(dark)
      </MagneticButton>
    </div>
  );
}

/** The /kit page body (client). */
export function KitBody() {
  return (
    <div className="below-nav">
      <header className="shell pb-sp-l">
        <p className="mb-sp-s flex items-center gap-sp-2xs hud-label">
          <StarGlyph className="size-3 text-accent" />
          Internal / not linked
        </p>
        <h1 className="m-0 display text-step-7">Design kit</h1>
        <p className="mt-sp-s mb-0 max-w-[60ch] serif text-step-2 text-text-dim italic">
          Every token and component, in Storm and in Daybreak. Use it to check a change before you
          ship it. Docs: docs/design/design-system.md.
        </p>
      </header>

      <Section id="tokens" title="Tokens" note="Themed tokens flip with data-theme.">
        {() => (
          <div className="grid gap-sp-m">
            <ul className="m-0 grid list-none grid-cols-2 gap-sp-2xs p-0 sm:grid-cols-3 lg:grid-cols-6">
              {SWATCHES.map((name) => (
                <li key={name} className="border border-line p-sp-2xs">
                  <span
                    className="block h-12 border border-line"
                    style={{ background: `var(--${name})` }}
                  />
                  <span className="mt-sp-3xs block mono text-step--2 text-text-dim">--{name}</span>
                </li>
              ))}
            </ul>
            <ul className="m-0 grid list-none grid-cols-3 gap-sp-2xs p-0 lg:grid-cols-9">
              {CONSTANTS.map((name) => (
                <li key={name}>
                  <span className="block h-8" style={{ background: `var(--${name})` }} />
                  <span className="mt-sp-3xs block mono text-step--2 text-text-faint">
                    --{name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section id="type" title="Type" note="Fluid from 320 to 3440 px.">
        {() => (
          <div className="grid gap-sp-s">
            {STEPS.slice(0, 4).map((s) => (
              <p
                key={s}
                className="m-0 display"
                style={{ fontSize: `var(--step-${s})` }}
              >{`Step ${s}`}</p>
            ))}
            <p className="m-0 serif text-step-4 italic">Someone is always waiting.</p>
            <p className="m-0 serif text-step-2">The lamp is on in the third-floor window.</p>
            <p className="m-0 max-w-[60ch] text-step-0">
              Body copy in Hanken Grotesk. The archive keeps the whole story, every voice line and
              every drawing. Dim body text uses --text-dim and still reads at 7:1.
            </p>
            <p className="m-0 max-w-[60ch] text-step-0 text-text-dim">
              Dim body text for secondary paragraphs, captions and long notes.
            </p>
            <p className="m-0 mono text-step--1">MONO / UNIT 07 / SYNC 1.62 / 0123456789</p>
            <p className="m-0 hud-label">HUD label / micro caption</p>
            <p className="m-0 font-sans text-step-0">日本語: ライラ / ファニー / セリナ</p>
          </div>
        )}
      </Section>

      <Section id="utilities" title="Utilities">
        {() => (
          <div className="grid gap-sp-s sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid h-28 place-items-center bg-bg-2 hud-label chamfer">.chamfer</div>
            <div
              className="grid h-28 place-items-center bg-bg-2 hud-label chamfer-4"
              style={{ ["--cut" as string]: "22px" }}
            >
              .chamfer-4 --cut 22px
            </div>
            <div className="scanlines grid h-28 place-items-center bg-bg-2 hud-label">
              .scanlines
            </div>
            <div className="scan-band grid h-28 place-items-center bg-bg-2 hud-label">
              .scan-band
            </div>
            <div className="grid-hex grid h-28 place-items-center border border-line hud-label">
              .grid-hex
            </div>
            <div className="grid h-28 place-items-center border border-line grid-dots hud-label">
              .grid-dots
            </div>
            <div className="grid h-28 place-items-center border border-line">
              <a href="#utilities-title" className="link">
                .link underline
              </a>
            </div>
            <div
              data-lantern
              data-cursor="LOOK"
              className="relative grid h-28 place-items-center overflow-hidden border border-line"
            >
              <span className="hud-label">Move the lantern here</span>
              <span
                aria-hidden="true"
                className="absolute inset-0 grid place-items-center bg-accent display text-step-3 text-on-accent lantern-mask"
              >
                Revealed
              </span>
            </div>
          </div>
        )}
      </Section>

      <Section id="buttons" title="Buttons">
        {() => (
          <div className="grid gap-sp-m">
            <div className="flex flex-wrap items-center gap-sp-s">
              <StarButton pulse>Enter the archive</StarButton>
              <StarButton>Solid</StarButton>
              <StarButton variant="ghost">Ghost</StarButton>
              <StarButton size="sm">Small</StarButton>
              <StarButton size="lg" arrow>
                Large
              </StarButton>
              <StarButton href={routes.story} variant="ghost">
                Link to Story
              </StarButton>
              <StarButton emblem aria-label="Play" />
              <StarButton emblem variant="ghost" aria-label="Favourite" />
              <StarButton disabled>Disabled</StarButton>
            </div>
            <div className="flex flex-wrap items-center gap-sp-s">
              <MagneticButton>Replay</MagneticButton>
              <MagneticButton href={routes.collection} strength={0.45}>
                Open collection
              </MagneticButton>
              <MagneticButton disabled>Disabled</MagneticButton>
              <Magnetic>
                <span className="hud-label">Magnetic wraps anything</span>
              </Magnetic>
            </div>
          </div>
        )}
      </Section>

      <Section id="text" title="Text">
        {() => (
          <div className="grid gap-sp-m">
            <SplitText
              as="p"
              by="chars"
              trigger="mount"
              className="m-0 display text-step-6"
              text="The Aspirants"
            />
            <SplitText
              as="p"
              by="words"
              className="m-0 display text-step-4"
              text="Someone is always waiting."
            />
            <SplitText
              as="p"
              by="lines"
              delay={0.2}
              stagger={0.15}
              className="m-0 max-w-[28ch] serif text-step-3"
              text="The archive keeps the whole story, every voice line and every drawing, with credit."
            />
            <ScatterText text="Scatter me" className="display text-step-5" />
            <LampText
              className="m-0 max-w-[24ch] serif text-step-4"
              text="Aspirant is a story about ten Aspirants, one academy and a heart that holds on to one thing. Read it as you scroll."
            />
            <Typewriter
              trigger="mount"
              text="Resonance link established."
              className="mono text-step-0"
            />
            <Typewriter
              as="p"
              speed={18}
              startDelay={0.5}
              caret={false}
              className="m-0 mono text-step--1 text-text-dim"
              text="UNIT 07 / TWILIGHT STAR / SYNC 1.62"
            />
          </div>
        )}
      </Section>

      <Section id="panels" title="Panels, tags, meters">
        {() => (
          <div className="grid gap-sp-m">
            <div className="grid gap-sp-s lg:grid-cols-3">
              <HudPanel label="Unit 07 / Twilight Star" code="SYNC 1.62">
                <p className="m-0 text-text-dim">Solid panel with a header.</p>
              </HudPanel>
              <HudPanel tone="glass" scan label="Scan band" code="LIVE" accent="var(--cyan)">
                <p className="m-0">Glass panel, scan band, cyan accent.</p>
              </HudPanel>
              <HudPanel as="section" accent="var(--crimson)">
                <p className="m-0">No header, crimson ticks.</p>
              </HudPanel>
            </div>
            <div className="flex flex-wrap gap-sp-2xs">
              <Tag>Daybreak</Tag>
              <Tag variant="solid">Selected</Tag>
              <Tag variant="solid" accent="var(--violet)">
                Storm
              </Tag>
              <Tag accent="var(--gold)">Unit 03</Tag>
              <Tag variant="warn">Non-canon parody</Tag>
            </div>
            <div className="flex flex-wrap items-end gap-sp-l">
              <Meter label="Coupling" value={1.62} max={2.5} className="w-72 max-w-full" />
              <Meter
                label="Resonance"
                value={0.4}
                segments={12}
                accent="var(--cyan)"
                format={(v) => `${Math.round(v * 100)}%`}
                className="w-56 max-w-full"
              />
              <Meter
                label="Sync"
                value={2.1}
                max={2.5}
                orientation="vertical"
                showValue={false}
                accent="var(--gold)"
              />
            </div>
            <Marquee label="Archive ticker" className="border-y border-line py-sp-xs hud-label">
              {["Selrick Academy", "Resonance terminal", "Dawnbreak", "Terrinia"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </Marquee>
            <Marquee
              reverse
              speed={70}
              pauseOnHover={false}
              gap="1.5rem"
              className="display text-step-4 text-text-faint"
            >
              <span>Daybreak</span>
              <span>Storm</span>
              <span>Daybreak</span>
              <span>Storm</span>
            </Marquee>
            <div className="grid gap-sp-xs sm:grid-cols-5">
              <Reveal>
                <p className="m-0">Fade up</p>
              </Reveal>
              <Reveal variant="fade" delay={100}>
                <p className="m-0">Fade</p>
              </Reveal>
              <Reveal variant="mask-up" delay={200}>
                <p className="m-0 display text-step-3">Mask up</p>
              </Reveal>
              <Reveal variant="scale" delay={300}>
                <p className="m-0">Scale</p>
              </Reveal>
              <Reveal variant="clip" once={false}>
                <p className="m-0">Clip, replays</p>
              </Reveal>
            </div>
          </div>
        )}
      </Section>

      <KitFrames Section={Section} />
      <KitOverlays Section={Section} />

      <Section id="sound" title="Sound" note="Click a blip to unlock audio first.">
        {() => <SoundLab />}
      </Section>

      <Section id="motion" title="Navigation and transitions">
        {() => <TransitionLab />}
      </Section>

      <Section id="embers" title="Embers" note="Contained fields, one per world.">
        {(theme) => (
          <div className="relative isolate h-64 overflow-hidden border border-line">
            <EmberField contained theme={theme} />
            <p className="relative m-0 p-sp-s hud-label">EmberField contained</p>
          </div>
        )}
      </Section>

      <Section id="gl" title="WebGL stage">
        {() => (
          <div className="h-[360px] border border-line">
            <GLStage
              camera={{ position: [0, 0, 5], fov: 40 }}
              label="Demo crystal"
              fallback={<p className="p-sp-s hud-label">WebGL unavailable</p>}
            >
              <KitGLDemo />
            </GLStage>
          </div>
        )}
      </Section>

      <NextFooter
        eyebrow="End of kit"
        label="Home"
        sublabel="NextFooter demo. Keep scrolling and it opens Home."
        href={routes.home}
        image="/img/char/layla/splash.webp"
      />
    </div>
  );
}

export type KitSectionComponent = typeof Section;
