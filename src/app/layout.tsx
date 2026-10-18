import type { Metadata } from "next";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/archivo-black/400.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "N7GEEKS // ARCADE",
  description:
    "Pick a challenge. Own the board. Four playable challenges from N7Geeks: reaction, memory, aim and tech trivia.",
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
