import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArtsRoomView } from "@/features/library/arts/core/arts-room";
import { ARTS_SEGMENTS, ROOM_LABELS, isArtsSegment } from "@/features/library/arts/core/routes";

export const dynamicParams = false;

const DESCRIPTIONS = {
  scene: "A still from every scene of the official films, as rows that move with the scroll.",
  comic: "The art made for the official comics, without the words.",
  game: "Pictures of the game and its in-game animation.",
  design: "Character designs and sheets.",
  others: "Chibi art, posters and every other official picture.",
  fanart: "Fan art made by readers and players, each with its maker.",
} as const;

export function generateStaticParams() {
  return ARTS_SEGMENTS.map((room) => ({ room }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ room: string }>;
}): Promise<Metadata> {
  const { room } = await params;
  if (!isArtsSegment(room)) return { title: "Arts", robots: { index: false } };
  return { title: ROOM_LABELS[room], description: DESCRIPTIONS[room] };
}

export default async function Page({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  if (!isArtsSegment(room)) notFound();
  return <ArtsRoomView room={room} />;
}
