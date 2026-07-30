import type { Metadata } from "next";
import type { ReactNode } from "react";

const TITLE = "Dragonica Event Timetable — Community Calendar";
const DESCRIPTION =
  "A community-maintained calendar of Dragonica in-game events — see which events are running and when, with links to the official pages, or add an event you know about to share with everyone.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/timetable" },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: "/timetable",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function TimetableLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
