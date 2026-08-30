"use client";

import { useRef, useState } from "react";
import { shareText, whatsappShareUrl } from "@/lib/share";

export default function ShareScore({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<number>(0);

  return (
    <div className="shareRow">
      <button
        type="button"
        className="ghost shareAction"
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
      <a
        className="ghost shareAction"
        data-note={523}
        href={whatsappShareUrl(text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share score on WhatsApp"
      >
        WhatsApp
      </a>
    </div>
  );
}
