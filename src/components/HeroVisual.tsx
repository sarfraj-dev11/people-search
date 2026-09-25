"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * Hero visual: a revolving 3D crystal (canvas-rendered bipyramid mesh) with
 * light rays, flanked by two halftone-dot hand images. Hands slide in while
 * the phone input is hovered; the crystal spins faster the closer the
 * cursor gets to the input.
 */

type V3 = [number, number, number];

const SIDES = 8;
// elongated bipyramid: tall top apex, slim ring, short bottom apex (unit space)
const TOP: V3 = [0, -1.55, 0];
const BOTTOM: V3 = [0, 1.05, 0];
const RING: V3[] = Array.from({ length: SIDES }, (_, i) => {
  const a = (i / SIDES) * Math.PI * 2;
  return [Math.cos(a) * 0.68, 0, Math.sin(a) * 0.68];
});

// face palette — cyan / indigo / violet gem tones
const FACE_RGB = [
  [147, 197, 253],
  [129, 140, 248],
  [168, 85, 247],
  [56, 189, 248],
  [99, 102, 241],
  [192, 132, 252],
];

const LIGHT: V3 = [0.35, 0.55, 0.76]; // normalized-ish light dir

function sub(a: V3, b: V3): V3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: V3, b: V3) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function rotY(v: V3, ang: number): V3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
function rotX(v: V3, ang: number): V3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

export default function HeroVisual() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLImageElement>(null);
  const rightRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let angle = 0;
    let spinBoost = 0;       // eased spin multiplier from cursor proximity
    // touch devices have no cursor — keep hands visible
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    let handTarget = isTouch ? 1 : 0;
    let handCurrent = 0;
    let raf = 0;
    let last = performance.now();

    // cursor proximity to the phone input drives spin speed AND hand reach
    function onMove(e: MouseEvent) {
      const input = document.querySelector("[data-phone-input]");
      if (!input) return;
      const r = input.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(e.clientX - cx, e.clientY - cy);
      const maxD = 520;
      const prox = Math.max(0, Math.min(1, 1 - d / maxD));
      spinBoost = prox * prox * 6; // up to 6x extra speed
      handTarget = prox * prox;    // hands track distance, not just hover
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      if (canvas!.width !== w * dpr || canvas!.height !== h * dpr) {
        canvas!.width = w * dpr;
        canvas!.height = h * dpr;
      }
      const g = ctx!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.52;
      const s = Math.max(40, Math.min(w, h) * 0.12);

      // ---- ambient particles (deterministic scatter) ----
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 140; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        if (Math.hypot(x - cx, y - cy) < 70) continue;
        g.fillStyle = `rgba(148,163,184,${0.05 + rnd() * 0.16})`;
        g.beginPath();
        g.arc(x, y, 0.5 + rnd() * 1.3, 0, Math.PI * 2);
        g.fill();
      }

      // ---- glow + shine rays (glow swells as cursor nears the input) ----
      const prox = spinBoost / 6; // 0..1
      const intensity = 0.45 + prox * 0.55;
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, s * (2.6 + prox * 2.6));
      glow.addColorStop(0, `rgba(147,197,253,${0.35 + prox * 0.45})`);
      glow.addColorStop(0.3, `rgba(129,140,248,${0.22 + prox * 0.3})`);
      glow.addColorStop(0.65, `rgba(99,102,241,${0.08 + prox * 0.15})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow;
      g.fillRect(cx - s * 4, cy - s * 4, s * 8, s * 8);

      // rotating light beams
      g.globalCompositeOperation = "lighter";
      const beams = 5;
      for (let i = 0; i < beams; i++) {
        const ba = angle * 0.6 + (i / beams) * Math.PI * 2;
        const len = s * (2.2 + Math.sin(angle * 2 + i * 1.7) * 0.5);
        const half = 0.09 + 0.03 * Math.sin(angle + i);
        const x1 = cx + Math.cos(ba - half) * s * 0.4;
        const y1 = cy + Math.sin(ba - half) * s * 0.4;
        const x2 = cx + Math.cos(ba + half) * s * 0.4;
        const y2 = cy + Math.sin(ba + half) * s * 0.4;
        const tx = cx + Math.cos(ba) * len;
        const ty = cy + Math.sin(ba) * len;
        const grad = g.createLinearGradient(cx, cy, tx, ty);
        grad.addColorStop(0, `rgba(165,180,252,${0.35 * intensity})`);
        grad.addColorStop(1, "rgba(165,180,252,0)");
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(tx, ty);
        g.lineTo(x2, y2);
        g.closePath();
        g.fillStyle = grad;
        g.fill();
      }
      g.globalCompositeOperation = "source-over";

      // ---- revolving 3D crystal ----
      angle += dt * (0.5 + spinBoost);
      const tilt = 0.32;

      const tv = rotX(rotY(TOP, angle), tilt);
      const bv = rotX(rotY(BOTTOM, angle), tilt);
      const ring = RING.map((v) => rotX(rotY(v, angle), tilt));

      // build faces: [indices into combined verts], painter-sorted
      interface Face { pts: V3[]; z: number; color: number[]; top: boolean }
      const faces: Face[] = [];
      for (let i = 0; i < SIDES; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % SIDES];
        faces.push({ pts: [tv, a, b], z: (tv[2] + a[2] + b[2]) / 3, color: FACE_RGB[i % FACE_RGB.length], top: true });
        faces.push({ pts: [bv, b, a], z: (bv[2] + a[2] + b[2]) / 3, color: FACE_RGB[(i + 3) % FACE_RGB.length], top: false });
      }
      faces.sort((f1, f2) => f1.z - f2.z); // far first

      g.globalCompositeOperation = "lighter";
      for (const f of faces) {
        const n = norm(cross(sub(f.pts[1], f.pts[0]), sub(f.pts[2], f.pts[0])));
        const bright = Math.max(0, dot(n, LIGHT));
        const lum = 0.35 + bright * 0.75;
        const [r, gg, b] = f.color;
        const alpha = 0.35 + Math.abs(n[2]) * 0.5;
        g.beginPath();
        f.pts.forEach(([px, py], i) =>
          i === 0 ? g.moveTo(cx + px * s, cy + py * s) : g.lineTo(cx + px * s, cy + py * s)
        );
        g.closePath();
        g.fillStyle = `rgba(${Math.min(255, r * lum)},${Math.min(255, gg * lum)},${Math.min(255, b * lum)},${alpha})`;
        g.fill();
        g.strokeStyle = `rgba(255,255,255,${0.3 + prox * 0.3})`;
        g.lineWidth = 0.8;
        g.stroke();
      }

      // bright girdle rim where the ring meets the light
      g.beginPath();
      for (let i = 0; i <= SIDES; i++) {
        const [px, py] = ring[i % SIDES];
        if (i === 0) g.moveTo(cx + px * s, cy + py * s);
        else g.lineTo(cx + px * s, cy + py * s);
      }
      g.strokeStyle = `rgba(224,242,254,${0.35 + prox * 0.5})`;
      g.lineWidth = 1.4;
      g.stroke();

      g.globalCompositeOperation = "source-over";

      // core sparkle — brightens with proximity
      const core = g.createRadialGradient(cx, cy, 0, cx, cy, s * (0.4 + prox * 0.4));
      core.addColorStop(0, `rgba(255,255,255,${0.35 + prox * 0.55})`);
      core.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = core;
      g.fillRect(cx - s, cy - s, s * 2, s * 2);

      // ---- hands slide in/out ----
      handCurrent += (handTarget - handCurrent) * 0.08;
      const hide = (1 - handCurrent) * 115;
      if (leftRef.current) leftRef.current.style.transform = `translateX(${-hide}%)`;
      if (rightRef.current) rightRef.current.style.transform = `translateX(${hide}%)`;

      raf = requestAnimationFrame(frame);
    }

    document.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(frame);
    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full h-[380px] sm:h-[460px] overflow-x-clip">
      <Image
        ref={leftRef}
        src="/images/robo-hand.png"
        alt=""
        aria-hidden
        width={600}
        height={460}
        className="absolute left-0 bottom-[144px] w-[30%] h-auto max-w-none object-contain pointer-events-none select-none"
        style={{ transform: "translateX(-115%)" }}
      />
      <Image
        ref={rightRef}
        src="/images/human-hand.png"
        alt=""
        aria-hidden
        width={600}
        height={460}
        className="absolute right-0 top-[144px] w-[30%] h-auto object-contain pointer-events-none select-none"
        style={{ transform: "translateX(115%)" }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden />
    </div>
  );
}
