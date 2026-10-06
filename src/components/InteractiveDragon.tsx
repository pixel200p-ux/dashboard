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
    let following = false;
    const onPointerMove = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const inHome = Boolean(target.closest("[data-pet-home]"));
      if (home ? !inHome : inHome) {
        if (home) following = false;
        return;
      }
      if (facingUpRef.current) {
        following = false;
        return;
      }
      if (
        !home &&
        target.closest(
          '[data-dragon-block], [class*="bg-card"], aside, header, [role="dialog"]',
        )
      ) {
        return;
      }
      const rect = svg.getBoundingClientRect();
      point.x = event.clientX - rect.left;
      point.y = event.clientY - rect.top;
      rad = 0;
      following = true;
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
        const partScale = ((162 - 4 * i) / 50) * scaleFactor;
        part.use.setAttribute(
          "transform",
          `translate(${(previous.x + part.x) / 2},${(previous.y + part.y) / 2}) rotate(${(180 / Math.PI) * angle}) scale(${partScale})`,
        );
      }

      if (rad < Math.min(point.x, point.y) - 20) rad++;
      frm += 0.003;
      if ((!home && rad > 60) || (home && !following)) {
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
          ? "pointer-events-none absolute inset-0 h-full w-full"
          : "pointer-events-none fixed inset-0 z-0 h-full w-full"
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
