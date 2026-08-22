"use client";

import { useEffect, useRef } from "react";
import { createHeroFlight } from "./hero-flight-engine";

/**
 * Обвязка движка [hero-flight-engine.ts]: rAF, размеры, параллакс от курсора.
 * Анимация стоит, пока герой вне вьюпорта или вкладка скрыта.
 */
export function HeroFlight() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const engine = createHeroFlight(canvas);
    if (!engine) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let last = 0;
    let visible = true;

    // Прямоугольники строк героя: движок гасит по ним свечение, чтобы оно
    // не било в текст. Снимаем после переезда надписи — во время CSS-анимации
    // элементы сдвинуты, и боксы получились бы не на своём месте.
    const textWrap = host.parentElement?.querySelector<HTMLElement>(".hero-settle") ?? null;

    const readShields = () => {
      if (!textWrap) return;
      const hostRect = host.getBoundingClientRect();
      engine.setShields(
        Array.from(textWrap.children).map((child) => {
          const r = child.getBoundingClientRect();
          return {
            x: r.left - hostRect.left,
            y: r.top - hostRect.top,
            w: r.width,
            h: r.height,
          };
        }),
      );
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      engine.resize(rect.width, rect.height, window.devicePixelRatio || 1);
      readShields();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      engine.step(dt);
      engine.draw();
      raf = requestAnimationFrame(frame);
    };

    const play = () => {
      if (raf || reduceMotion) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    const pause = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onPointer = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      engine.setPointer((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    };

    const onLeave = () => engine.setPointer(0.5, 0.5);

    const onVisibility = () => {
      if (document.hidden) pause();
      else if (visible) play();
    };

    resize();

    const ro = new ResizeObserver(() => {
      resize();
      if (reduceMotion) {
        engine.seek(7);
        engine.draw();
      }
    });
    ro.observe(host);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !document.hidden) play();
        else pause();
      },
      { threshold: 0 },
    );
    io.observe(host);

    textWrap?.addEventListener("animationend", readShields);
    document.addEventListener("visibilitychange", onVisibility);
    if (window.matchMedia("(pointer: fine)").matches) {
      host.addEventListener("pointermove", onPointer);
      host.addEventListener("pointerleave", onLeave);
    }

    canvas.style.opacity = "1";

    if (reduceMotion) {
      // без анимации показываем спокойный финал: эмблема горит, следы короткие
      engine.seek(7);
      engine.draw();
    } else {
      play();
    }

    return () => {
      pause();
      ro.disconnect();
      io.disconnect();
      textWrap?.removeEventListener("animationend", readShields);
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onPointer);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={hostRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* гашение слоя над колонкой текста делает сам движок: на интро дрон
          облетает надпись и должен быть виден слева, маска включается позже */}
      <canvas ref={canvasRef} className="size-full opacity-0 transition-opacity duration-700 ease-out" />
    </div>
  );
}
