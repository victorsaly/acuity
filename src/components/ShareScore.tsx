"use client";

import { useRef, useState } from "react";
import { shareText } from "@/lib/share";

export default function ShareScore({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<number>(0);

  return (
    <button
      className="ghost"
      data-note={523}
      onClick={async () => {
        if (await shareText(text)) {
          setDone(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setDone(false), 1600);
        }
      }}
    >
      {done ? "Copied ✓" : "Share score"}
    </button>
  );
}
