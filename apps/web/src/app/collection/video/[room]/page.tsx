import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VideoRoomView } from "@/features/library/video/video-room";
import { VIDEO_ROOMS, isVideoRoom } from "@/features/library/types";

export const dynamicParams = false;

const TITLES = {
  films: {
    title: "Films",
    description: "The ten official Aspirant films, one after the other, in full quality.",
  },
  others: {
    title: "Other videos",
    description: "Every other Aspirant video: shorts, showcases, interviews, music films and more.",
  },
} as const;

export function generateStaticParams() {
  return VIDEO_ROOMS.map((room) => ({ room }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ room: string }>;
}): Promise<Metadata> {
  const { room } = await params;
  if (!isVideoRoom(room)) return { title: "Video", robots: { index: false } };
  return TITLES[room];
}

export default async function Page({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  if (!isVideoRoom(room)) notFound();
  return <VideoRoomView room={room} />;
}
