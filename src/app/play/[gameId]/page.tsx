import { notFound } from "next/navigation";
import Arcade from "@/components/arcade";
import { GAME_IDS, type GameId } from "@/lib/games";
export default async function Page({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!GAME_IDS.includes(gameId as GameId)) notFound();
  return <Arcade initialGame={gameId as GameId} autoPlay />;
}
