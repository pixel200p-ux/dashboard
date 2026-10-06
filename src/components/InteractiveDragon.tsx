import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef } from "react";
import { useUiStore } from "@/lib/ui-store";

const SVG_NS = "http://www.w3.org/2000/svg";
const DRAGON_PARTS = 39;
const SIZE_OPTIONS = [
  { label: "½", value: 0.5 },
  { label: "⅓", value: 1 / 3 },
  { label: "x1", value: 1 },
] as const;

type PetPart = { use: SVGUseElement; x: number; y: number };
type Trick =
  | "wander"
  | "circle"
  | "zigzag"
  | "grow"
  | "shrink"
  | "spin"
  | "glide";

function playBox(width: number, height: number) {
  return {
    minX: -width * 0.675,
    maxX: width + width * 0.675,
    minY: -height * 0.3,
    maxY: height + height * 0.9,
  };
}

function rand(min: number, max: number) {
  return min + Math.random() * Math.max(0.0001, max - min);
}

function PetScene({
  size,
  active,
  home = false,
  facingUp,
}: {
  size: number;
  active: boolean;
  home?: boolean;
  facingUp: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const facingUpRef = useRef(facingUp);
  facingUpRef.current = facingUp;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !active) return;

    const parts: PetPart[] = [];
    const bounds = svg.getBoundingClientRect();
    const point = { x: bounds.width / 2, y: bounds.height / 2 };
    const head = { ...point };
    let frame = 0;
    let frm = Math.random();
    let rad = 0;
    let running = true;
    let mouseFollow = false;

    const partMul = Array.from({ length: DRAGON_PARTS }, () => 1);
    let trick: Trick = "wander";
    let trickUntil = 0;
    let growPhase: "goto" | "pass" = "goto";
    const circle = { cx: 0, cy: 0, r: 80, angle: 0, speed: 0.03 };
    const zig = { vx: 3, vy: 1, t: 0, amp: 24 };
    const spin = { cx: 0, cy: 0, r: 40, angle: 0, speed: 0.08 };
    const glide = { cx: 0, cy: 0, ax: 120, ay: 50, t: 0, speed: 0.02 };
    const gate = { x: 0, y: 0, dx: 1, dy: 0, from: 1, to: 1, armed: false };
    const headTarget = { x: bounds.width / 2, y: bounds.height / 2 };

    for (let i = 1; i <= DRAGON_PARTS; i++) {
      const elem = document.createElementNS(SVG_NS, "use");
      const symbol =
        i === 1 ? "Cabeza" : i === 8 || i === 14 ? "Aletas" : "Espina";
      elem.setAttribute("href", `/dragon.svg#${symbol}`);
      svg.prepend(elem);
      parts.push({ use: elem, x: point.x, y: point.y });
    }

    const resize = () => {
      const rect = svg.getBoundingClientRect();
      svg.setAttribute(
        "viewBox",
        `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`,
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      if (facingUpRef.current) {
        mouseFollow = false;
        return;
      }

      if (home) {
        const el = document.querySelector("[data-pet-home]");
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        if (!inside) {
          mouseFollow = false;
          return;
        }
        point.x = event.clientX - rect.left;
        point.y = event.clientY - rect.top;
        rad = 0;
        mouseFollow = true;
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-pet-home]")) {
        mouseFollow = false;
        return;
      }
      if (
        target.closest(
          '[data-dragon-block], [class*="bg-card"], aside, header, [role="dialog"]',
        )
      ) {
        mouseFollow = false;
        return;
      }
      const rect = svg.getBoundingClientRect();
      point.x = event.clientX - rect.left;
      point.y = event.clientY - rect.top;
      rad = 0;
      mouseFollow = true;
    };

    const applyGate = () => {
      if (!gate.armed) return;
      for (let i = 0; i < parts.length; i++) {
        const px = i === 0 ? head.x : parts[i].x;
        const py = i === 0 ? head.y : parts[i].y;
        const past = (px - gate.x) * gate.dx + (py - gate.y) * gate.dy;
        const t = Math.max(0, Math.min(1, (past + 14) / 40));
        const desired = gate.from + (gate.to - gate.from) * t;
        partMul[i] += (desired - partMul[i]) * 0.14;
      }
    };

    const pickTrick = (width: number, height: number) => {
      const box = playBox(width, height);
      const choices: Trick[] = [
        "wander",
        "circle",
        "zigzag",
        "grow",
        "shrink",
        "spin",
        "glide",
      ];
      trick = choices[Math.floor(Math.random() * choices.length)];
      trickUntil = performance.now() + 2600 + Math.random() * 3400;
      const maxMul = home ? 2.2 : size >= 1 ? 1.35 : 1.7;
      const minMul = home ? 0.5 : 0.7;

      if (trick === "circle") {
        circle.cx = rand(box.minX, box.maxX);
        circle.cy = rand(box.minY, box.maxY);
        circle.r = Math.min(width, height) * (0.22 + Math.random() * 0.38);
        circle.angle = Math.random() * Math.PI * 2;
        circle.speed = (Math.random() < 0.5 ? -1 : 1) * (0.018 + Math.random() * 0.028);
      } else if (trick === "spin") {
        spin.cx = point.x;
        spin.cy = point.y;
        spin.r = Math.min(width, height) * (0.05 + Math.random() * 0.08);
        spin.angle = Math.random() * Math.PI * 2;
        spin.speed = (Math.random() < 0.5 ? -1 : 1) * (0.06 + Math.random() * 0.05);
      } else if (trick === "glide") {
        glide.cx = rand(width * 0.15, width * 0.85);
        glide.cy = rand(height * 0.15, height * 0.85);
        glide.ax = width * (0.42 + Math.random() * 0.33);
        glide.ay = height * (0.18 + Math.random() * 0.24);
        glide.t = Math.random() * Math.PI * 2;
        glide.speed = (Math.random() < 0.5 ? -1 : 1) * (0.014 + Math.random() * 0.018);
      } else if (trick === "zigzag") {
        zig.vx = (Math.random() < 0.5 ? -1 : 1) * (2.2 + Math.random() * 3.4);
        zig.vy = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 2);
        zig.amp = 16 + Math.random() * 32;
        zig.t = 0;
      } else if (trick === "wander") {
        headTarget.x = rand(box.minX, box.maxX);
        headTarget.y = rand(box.minY, box.maxY);
      } else {
        growPhase = "goto";
        gate.armed = false;
        gate.from = Math.max(minMul, Math.min(maxMul, partMul[0] || 1));
        gate.to =
          trick === "grow"
            ? Math.min(maxMul, gate.from + 0.4 + Math.random() * 0.5)
            : Math.max(minMul, gate.from - (0.35 + Math.random() * 0.4));
        headTarget.x = rand(box.minX * 0.2, width + box.maxX * 0.05);
        headTarget.x = rand(width * -0.1, width * 1.1);
        headTarget.y = rand(height * -0.05, height * 1.1);
      }
    };

    const updateTricks = (width: number, height: number) => {
      const box = playBox(width, height);
      const now = performance.now();
      if (trickUntil === 0) pickTrick(width, height);
      else if (
        now > trickUntil &&
        (trick === "grow" || trick === "shrink" ? growPhase === "pass" : true)
      ) {
        pickTrick(width, height);
      }

      if (trick === "circle") {
        circle.angle += circle.speed;
        point.x = circle.cx + Math.cos(circle.angle) * circle.r;
        point.y = circle.cy + Math.sin(circle.angle) * circle.r;
      } else if (trick === "spin") {
        spin.angle += spin.speed;
        point.x = spin.cx + Math.cos(spin.angle) * spin.r;
        point.y = spin.cy + Math.sin(spin.angle) * spin.r;
      } else if (trick === "glide") {
        glide.t += glide.speed;
        point.x = glide.cx + Math.sin(glide.t) * glide.ax;
        point.y = glide.cy + Math.sin(glide.t) * Math.cos(glide.t) * glide.ay;
      } else if (trick === "zigzag") {
        zig.t += 0.18;
        point.x += zig.vx;
        point.y += zig.vy + Math.sin(zig.t) * zig.amp * 0.16;
        if (point.x < box.minX || point.x > box.maxX) zig.vx *= -1;
        if (point.y < box.minY || point.y > box.maxY) zig.vy *= -1;
      } else if (trick === "wander") {
        point.x += (headTarget.x - point.x) * 0.03;
        point.y += (headTarget.y - point.y) * 0.03;
        if (Math.hypot(headTarget.x - point.x, headTarget.y - point.y) < 22) {
          headTarget.x = rand(box.minX, box.maxX);
          headTarget.y = rand(box.minY, box.maxY);
        }
      } else {
        point.x += (headTarget.x - point.x) * 0.05;
        point.y += (headTarget.y - point.y) * 0.05;
        if (growPhase === "goto") {
          if (Math.hypot(headTarget.x - head.x, headTarget.y - head.y) < 16) {
            growPhase = "pass";
            gate.armed = true;
            gate.x = head.x;
            gate.y = head.y;
            const heading = Math.atan2(point.y - head.y, point.x - head.x);
            gate.dx = Math.cos(heading);
            gate.dy = Math.sin(heading);
            const dist = Math.min(width, height) * (0.16 + Math.random() * 0.22);
            headTarget.x = gate.x + gate.dx * dist;
            headTarget.y = gate.y + gate.dy * dist;
            trickUntil = now + 1800 + Math.random() * 1000;
          }
        }
      }

      applyGate();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(svg);
    window.addEventListener("pointermove", onPointerMove);

    const run = () => {
      if (!running) return;
      frame = window.requestAnimationFrame(run);
      const rect = svg.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const scaleFactor = home ? 0.2 : size;
      const box = playBox(width, height);

      if (!mouseFollow && !facingUpRef.current) {
        updateTricks(width, height);
      } else {
        applyGate();
      }

      const ax = (Math.cos(3 * frm) * rad * width) / height;
      const ay = (Math.sin(4 * frm) * rad * height) / width;
      head.x += (ax + point.x - head.x) / 10;
      head.y += (ay + point.y - head.y) / 10;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const previous = i === 0 ? head : parts[i - 1];
        const angle = Math.atan2(part.y - previous.y, part.x - previous.x);
        part.x +=
          (previous.x -
            part.x +
            (Math.cos(angle) * (99 - i) * scaleFactor) / 5) /
          4;
        part.y +=
          (previous.y -
            part.y +
            (Math.sin(angle) * (99 - i) * scaleFactor) / 5) /
          4;
        const partScale = ((162 - 4 * i) / 50) * scaleFactor * partMul[i];
        part.use.setAttribute(
          "transform",
          `translate(${(previous.x + part.x) / 2},${(previous.y + part.y) / 2}) rotate(${(180 / Math.PI) * angle}) scale(${partScale})`,
        );
      }

      point.x = Math.min(box.maxX, Math.max(box.minX, point.x));
      point.y = Math.min(box.maxY, Math.max(box.minY, point.y));

      const radm = Math.min(width, height) / 2 - 20;
      if (rad < radm) rad++;
      frm += 0.003;
      if (rad > 60 && mouseFollow) {
        point.x += (width / 2 - point.x) * 0.05;
        point.y += (height / 2 - point.y) * 0.05;
      }
    };

    run();
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      observer.disconnect();
      svg.replaceChildren();
    };
  }, [active, home, size]);

  return (
    <svg
      ref={svgRef}
      className={
        home
          ? "pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
          : "pointer-events-none fixed inset-0 z-0 h-full w-full overflow-hidden"
      }
      aria-hidden="true"
      focusable="false"
      style={{ display: active ? "block" : "none" }}
    />
  );
}

export function InteractiveDragon() {
  const atHome = useUiStore((state) => state.dragonAtHome);
  const size = useUiStore((state) => state.dragonSize);
  const facingUp = useUiStore((state) => state.dragonFacingUp);
  return <PetScene size={size} active={!atHome} facingUp={facingUp} />;
}

export function PetHome({
  expanded,
  onExpandedChange,
}: {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const atHome = useUiStore((state) => state.dragonAtHome);
  const setAtHome = useUiStore((state) => state.setDragonAtHome);
  const size = useUiStore((state) => state.dragonSize);
  const setSize = useUiStore((state) => state.setDragonSize);
  const facingUp = useUiStore((state) => state.dragonFacingUp);
  const cycleSize = () => {
    const currentIndex = SIZE_OPTIONS.findIndex(
      (option) => option.value === size,
    );
    setSize(SIZE_OPTIONS[(currentIndex + 1) % SIZE_OPTIONS.length].value);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <PetScene size={size} active={atHome} home facingUp={facingUp} />
      <div className="pointer-events-auto absolute right-3 top-3 z-20">
        {atHome ? (
          <button
            type="button"
            onClick={() => {
              setAtHome(false);
              onExpandedChange(false);
            }}
            className="rounded-md border border-border bg-card/90 px-3 py-1 text-xs font-semibold hover:bg-muted"
          >
            Thả ra
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAtHome(true)}
            className="rounded-md border border-border bg-card/90 px-3 py-1 text-xs font-semibold hover:bg-muted"
          >
            Quay về
          </button>
        )}
      </div>
      <div className="pointer-events-auto absolute bottom-2 right-2 z-20 flex gap-1">
        {atHome && (
          <button
            type="button"
            aria-label={`Kích thước rồng ${SIZE_OPTIONS.find((option) => option.value === size)?.label}; đổi kích thước`}
            onClick={cycleSize}
            className="grid h-8 min-w-8 place-items-center rounded-full border border-border bg-card/90 px-2 text-xs font-semibold hover:bg-muted"
          >
            {SIZE_OPTIONS.find((option) => option.value === size)?.label}
          </button>
        )}
        <button
          type="button"
          aria-label={expanded ? "Thu gọn khu vực rồng" : "Mở rộng khu vực rồng"}
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
          className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card/90 hover:bg-muted"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}