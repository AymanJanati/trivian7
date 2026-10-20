import { notFound } from "next/navigation";
import Arcade from "@/components/arcade";
import { isActiveGame } from "@/lib/games";
export default async function Page({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!isActiveGame(gameId)) notFound();
  return <Arcade initialGame={gameId} autoPlay />;
}
