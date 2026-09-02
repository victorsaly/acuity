"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Stagger, Item, Tilt } from "@/components/Fx";
import GameMark, { type GameKey } from "@/components/GameMark";
import { useStats, streakOf } from "@/lib/store";

const GAMES: { game: GameKey; note: number; title: string; blurb: string }[] = [
  { game: "color", note: 523, title: "Afterimage", blurb: "Five colors, one at a time, then nothing. Rebuild each one on a slider." },
  { game: "sound", note: 659, title: "Sine Language", blurb: "Five tones. Each plays once. Now go find them again by ear." },
  { game: "time", note: 698, title: "Second Sense", blurb: "How long was that? Hold the button for exactly as long. No clock anywhere." },
  { game: "tempo", note: 784, title: "Downbeat", blurb: "Asteroids tumble in on the beat. Tap them at the ring or watch them sail past." },
  { game: "memory", note: 880, title: "Echo", blurb: "Numbered tiles flash, then go dark. Tap them back in order, and hurry." },
  { game: "piano", note: 988, title: "Refrain", blurb: "A phrase plays. You play it back. One note longer every level." },
  { game: "fever", note: 1047, title: "Fever Dream", blurb: "A microwave is keeping time. Watch how it moves, then give it eight taps back." },
  { game: "phantom", note: 1175, title: "Phantom Drop", blurb: "The beat cuts out right before the drop. Count the silence. Land the 1." },
  { game: "offgrid", note: 1319, title: "Off-Grid", blurb: "One hit in the loop is late. Point at it. Every round it gets harder to hear." },
];

function CardStats({ game }: { game: string }) {
  const s = useStats(game);
  const streak = streakOf(s);
  if (!s.plays) return <span className="cardStats">Not played yet</span>;
  return (
    <span className="cardStats">
      Played {s.plays}{streak > 1 ? ` · ${streak}-day streak` : ""}
    </span>
  );
}

export default function Hub() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  /* Starfield parallax: three dot layers drift on their own and lean
     toward the cursor at different depths. */
  useEffect(() => {
    const el = fieldRef.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      el.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
      el.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
    };
    addEventListener("pointermove", onMove);
    return () => removeEventListener("pointermove", onMove);
  }, []);

  /* Depth shelf: on wide screens the cards sit on a horizontal rail in
     3D — each card turns away and recedes by its distance from center.
     On narrow screens the rail reverts to the plain column and this
     effect leaves the slots untouched. */
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = matchMedia("(max-width: 640px)");
    const slots = () => Array.from(row.querySelectorAll<HTMLElement>(".depthSlot"));
    const centerOf = (el: HTMLElement) => el.offsetLeft + el.offsetWidth / 2;
    const centerSlot = (el: HTMLElement) => {
      row.scrollTo({
        left: centerOf(el) - row.clientWidth / 2,
        behavior: reduce.matches ? "auto" : "smooth",
      });
      /* focus follows selection, so Enter opens the selected game and the
         focus ring never lingers on a card you steered away from */
      el.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
    };
    const nearest = () => {
      const mid = row.scrollLeft + row.clientWidth / 2;
      let best: HTMLElement | null = null, bestDist = Infinity;
      for (const el of slots()) {
        const dist = Math.abs(centerOf(el) - mid);
        if (dist < bestDist) { bestDist = dist; best = el; }
      }
      return best;
    };

    const update = () => {
      if (narrow.matches) {
        for (const el of slots()) {
          el.style.transform = ""; el.style.zIndex = "";
          el.classList.remove("isCentered");
        }
        return;
      }
      const mid = row.scrollLeft + row.clientWidth / 2;
      const sel = nearest();
      for (const el of slots()) {
        const d = Math.max(-1, Math.min(1, (centerOf(el) - mid) / (row.clientWidth * 0.55)));
        /* Anything at negative Z loses pointer hits to the flat row, so the
           card may rotate but must never reach behind z=0: push it forward
           by its own backward extent (halfWidth·sin θ) and shrink it by the
           perspective magnification that push would cause. */
        const theta = (-d * 26 * Math.PI) / 180;
        const s0 = 1 - Math.abs(d) * 0.13;
        const zF = (el.offsetWidth / 2) * s0 * Math.abs(Math.sin(theta));
        const s = s0 * ((1200 - zF) / 1200);
        el.style.transform = reduce.matches ? "" :
          `perspective(1200px) translateZ(${zF.toFixed(1)}px) rotateY(${(-d * 26).toFixed(2)}deg) scale(${s.toFixed(3)})`;
        el.style.zIndex = String(100 - Math.round(Math.abs(d) * 60));
        el.classList.toggle("isCentered", el === sel);
      }
    };
    /* The shelf opens on Downbeat. */
    if (!narrow.matches) {
      const start = row.querySelector<HTMLElement>('.hubCard[data-game="tempo"]')?.closest<HTMLElement>(".depthSlot");
      row.scrollLeft = start
        ? start.offsetLeft + start.offsetWidth / 2 - row.clientWidth / 2
        : (row.scrollWidth - row.clientWidth) / 2;
    }
    update();
    row.addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);

    /* A plain wheel steers the shelf while it can still move that way;
       once it hits an end the page scrolls as usual. */
    const onWheel = (e: WheelEvent) => {
      if (narrow.matches || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const before = row.scrollLeft;
      row.scrollLeft += e.deltaY;
      if (row.scrollLeft !== before) e.preventDefault();
    };
    row.addEventListener("wheel", onWheel, { passive: false });

    /* Mouse drag scrolls the shelf; a real drag swallows the click so
       letting go over a card doesn't launch it. */
    let downX = 0, startL = 0, dragging = false, moved = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || narrow.matches) return;
      dragging = true; moved = false; downX = e.clientX; startL = row.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - downX;
      if (Math.abs(dx) > 6) moved = true;
      if (moved) row.scrollLeft = startL - dx;
    };
    const onUp = () => { dragging = false; };
    /* Selecting: a click on the selected (centered) card opens the game; a
       click on any other card just selects it. A drag never clicks anything. */
    const onClick = (e: MouseEvent) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
      if (narrow.matches) return;
      const slot = (e.target as Element | null)?.closest<HTMLElement>(".depthSlot");
      if (!slot) return;
      if (!slot.classList.contains("isCentered")) {
        e.preventDefault(); e.stopPropagation();
        centerSlot(slot);
      }
    };

    /* Arrow keys move the selection one card at a time. Steps are counted
       from the last keyed target (not from mid-scroll position), so quick
       repeated presses accumulate instead of being swallowed. */
    let keyTarget = -1;
    let keySettle: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || narrow.matches) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const all = slots();
      const sel = nearest();
      const base = keyTarget >= 0 ? keyTarget : sel ? all.indexOf(sel) : 0;
      const next = all[base + (e.key === "ArrowRight" ? 1 : -1)];
      if (!next) return;
      e.preventDefault();
      keyTarget = all.indexOf(next);
      clearTimeout(keySettle);
      keySettle = setTimeout(() => { keyTarget = -1; }, 600);
      centerSlot(next);
    };
    document.addEventListener("keydown", onKey);

    /* Tabbing into a card selects it too, so keyboard users never fight
       the browser's own scroll-into-view against the snap points. */
    const onFocus = (e: FocusEvent) => {
      if (narrow.matches) return;
      const slot = (e.target as Element | null)?.closest<HTMLElement>(".depthSlot");
      if (slot && !slot.classList.contains("isCentered")) centerSlot(slot);
    };
    row.addEventListener("focusin", onFocus);
    row.addEventListener("pointerdown", onDown);
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    row.addEventListener("click", onClick, { capture: true });

    return () => {
      row.removeEventListener("scroll", update);
      removeEventListener("resize", update);
      row.removeEventListener("wheel", onWheel);
      row.removeEventListener("pointerdown", onDown);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      row.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("keydown", onKey);
      row.removeEventListener("focusin", onFocus);
      clearTimeout(keySettle);
    };
  }, []);

  return (
    <main className="stage menuStage hubStage">
      <div className="starField" aria-hidden ref={fieldRef}><i /><i /><i /></div>
      <nav className="hubNav" aria-label="Site">
        <Link href="/" className="hubNavBrand" data-note={392} aria-label="Delulu Beats home">
          <svg className="hubNavMark" viewBox="0 0 36 24" aria-hidden>
            <rect className="navCell1" x="1" y="7" width="9" height="9" rx="2.5" fill="#eff0f4" />
            <rect className="navCell2" x="13" y="7" width="9" height="9" rx="2.5" fill="#eff0f4" opacity="0.3" />
            <rect className="navCell3" x="27" y="11" width="9" height="9" rx="2.5" fill="#ffb02e" />
          </svg>
          <span className="hubNavName">Delul<i className="navOffU">u</i> Beats</span>
        </Link>
        <div className="hubNavLinks">
          <a href="#games" data-note={440}>Games</a>
          <Link href="/leaderboard" data-note={523}>Leaderboard</Link>
          <Link href="/about" data-note={587}>About</Link>
        </div>
      </nav>
      <Stagger style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", flex: 1 }}>
        <Item>
          <h1 className="wordmark brandName">
            <span>Delul<i className="offLetter">u</i></span>{" "}<span>Beats</span>
          </h1>
        </Item>
        <Item>
          <p className="tagline hubTag">
            Everything here is <em className="offWords">slightly off</em>. Your job is to notice.
            <span className="taglineSub">
              Nine tiny games about hearing, timing, and being confidently wrong.
            </span>
          </p>
        </Item>
        <span id="games" aria-hidden />
        <div className="depthScroller" ref={rowRef}>
          {/* flat, not preserve-3d: slots at negative Z would fall behind the
              row's own hit plane and become unclickable */}
          <Stagger className="hubCards depthRow" delay={0.12} style={{ transformStyle: "flat" }}>
            {GAMES.map((g) => (
              <div className="depthSlot" key={g.game}>
                <Item style={{ display: "flex", width: "100%" }}>
                  <Tilt style={{ display: "flex", width: "100%" }}>
                    <Link href={`/${g.game}`} className="hubCard" data-game={g.game} data-note={g.note} style={{ width: "100%" }}>
                      <div className="art" aria-hidden>{g.game !== "color" && <GameMark game={g.game} />}</div>
                      <h2>{g.title}</h2>
                      <p>{g.blurb}</p>
                      <CardStats game={g.game} />
                      <span className="go">Play ▸</span>
                    </Link>
                  </Tilt>
                </Item>
              </div>
            ))}
          </Stagger>
        </div>
      </Stagger>
      <div className="hint deskHint">
        <Link href="/about" className="hubMetaLink">About &amp; credits</Link>
        {" · "}<Link href="/leaderboard" className="hubMetaLink">Leaderboard</Link>
        {" · "}Sound on · headphones recommended · F fullscreen · B changes the background
      </div>
      <div className="footJoke">
        Sign in and the daily stops being yours alone: your score is kept, ranked,
        and waiting for you next time.
      </div>
      <div className="hint touchNote">
        <Link href="/about" className="hubMetaLink">About &amp; credits</Link>
        {" · "}<Link href="/leaderboard" className="hubMetaLink">Leaderboard</Link>
        {" · "}Works on touch — tap to play · sound on, headphones recommended
      </div>
    </main>
  );
}
