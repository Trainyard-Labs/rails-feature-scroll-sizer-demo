'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
  Grip,
  Maximize2,
  MousePointer2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

const MIN_WIDTH = 190;
const MIN_HEIGHT = 128;
const INITIAL_RECT: Rect = { x: 102, y: 72, width: 410, height: 274 };
const CORNERS = ['top left', 'top right', 'bottom left', 'bottom right'];

function nearestCorner(rect: Rect, point: Point) {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];

  return corners.reduce(
    (best, nextCorner, index) => {
      const distance = (point.x - nextCorner.x) ** 2 + (point.y - nextCorner.y) ** 2;
      return distance < best.distance ? { index, distance } : best;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index;
}

function rectWithCornerAtPointer(
  rect: Rect,
  pointer: Point,
  corner: number,
  bounds: { width: number; height: number },
): Rect {
  const anchorX = corner % 2 === 0 ? rect.x + rect.width : rect.x;
  const anchorY = corner < 2 ? rect.y + rect.height : rect.y;
  const left = corner % 2 === 0 ? pointer.x : anchorX;
  const right = corner % 2 === 0 ? anchorX : pointer.x;
  const top = corner < 2 ? pointer.y : anchorY;
  const bottom = corner < 2 ? anchorY : pointer.y;

  const width = Math.min(bounds.width, Math.max(MIN_WIDTH, right - left));
  const height = Math.min(bounds.height, Math.max(MIN_HEIGHT, bottom - top));
  const x = corner % 2 === 0 ? anchorX - width : anchorX;
  const y = corner < 2 ? anchorY - height : anchorY;

  return {
    x: Math.max(0, Math.min(bounds.width - width, x)),
    y: Math.max(0, Math.min(bounds.height - height, y)),
    width,
    height,
  };
}

function positionFromGrab(
  pointer: Point,
  corner: number,
  width: number,
  height: number,
  bounds: { width: number; height: number },
): Point {
  const desiredX = corner % 2 === 0 ? pointer.x : pointer.x - width;
  const desiredY = corner < 2 ? pointer.y : pointer.y - height;

  return {
    x: Math.max(0, Math.min(bounds.width - width, desiredX)),
    y: Math.max(0, Math.min(bounds.height - height, desiredY)),
  };
}

export default function Home() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect>(INITIAL_RECT);
  const [pointer, setPointer] = useState<Point>({ x: 486, y: 324 });
  const [isActive, setIsActive] = useState(false);
  const [corner, setCorner] = useState(3);
  const [wheelDirection, setWheelDirection] = useState<'up' | 'down' | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const keyState = useRef({ control: false, shift: false, r: false });

  const getBounds = useCallback(() => {
    const stage = stageRef.current;
    return {
      width: stage?.clientWidth ?? 720,
      height: stage?.clientHeight ?? 430,
    };
  }, []);

  const activate = useCallback(() => {
    if (isActive) return;
    const bounds = getBounds();
    const selectedCorner = nearestCorner(rect, pointer);
    setCorner(selectedCorner);
    setRect(rectWithCornerAtPointer(rect, pointer, selectedCorner, bounds));
    setIsActive(true);
    setHasInteracted(true);
  }, [getBounds, isActive, pointer, rect]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    setWheelDirection(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') keyState.current.control = true;
      if (event.key === 'Shift') keyState.current.shift = true;
      if (event.key.toLowerCase() === 'r') keyState.current.r = true;

      if (
        (event.ctrlKey || keyState.current.control) &&
        (event.shiftKey || keyState.current.shift) &&
        (event.key.toLowerCase() === 'r' || keyState.current.r)
      ) {
        event.preventDefault();
        activate();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') keyState.current.control = false;
      if (event.key === 'Shift') keyState.current.shift = false;
      if (event.key.toLowerCase() === 'r') keyState.current.r = false;
      if (!keyState.current.control || !keyState.current.shift || !keyState.current.r) deactivate();
    };

    const onBlur = () => {
      keyState.current = { control: false, shift: false, r: false };
      deactivate();
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', onBlur);
    };
  }, [activate, deactivate]);

  useEffect(() => {
    const onResize = () => {
      const bounds = getBounds();
      setRect((current) => {
        const width = Math.min(current.width, bounds.width);
        const height = Math.min(current.height, bounds.height);
        return {
          x: Math.max(0, Math.min(bounds.width - width, current.x)),
          y: Math.max(0, Math.min(bounds.height - height, current.y)),
          width,
          height,
        };
      });
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [getBounds]);

  const movePointer = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageBounds = stage.getBoundingClientRect();
    const nextPointer = {
      x: Math.max(0, Math.min(stageBounds.width, clientX - stageBounds.left)),
      y: Math.max(0, Math.min(stageBounds.height, clientY - stageBounds.top)),
    };
    setPointer(nextPointer);

    if (isActive) {
      setRect((current) => {
        const position = positionFromGrab(
          nextPointer,
          corner,
          current.width,
          current.height,
          { width: stageBounds.width, height: stageBounds.height },
        );
        return { ...current, ...position };
      });
    }
  };

  const resizeWithWheel = (deltaY: number) => {
    if (!isActive) return;
    const bounds = getBounds();
    const growing = deltaY < 0;
    const factor = growing ? 1.1 : 0.9;
    setWheelDirection(growing ? 'up' : 'down');
    window.setTimeout(() => setWheelDirection(null), 180);

    setRect((current) => {
      const width = Math.min(bounds.width, Math.max(MIN_WIDTH, current.width * factor));
      const height = Math.min(bounds.height, Math.max(MIN_HEIGHT, current.height * factor));
      const position = positionFromGrab(pointer, corner, width, height, bounds);
      return { ...position, width, height };
    });
  };

  const bounds = getBounds();
  const widthLocked = Math.abs(rect.width - bounds.width) < 1;
  const heightLocked = Math.abs(rect.height - bounds.height) < 1;
  const ratioLabel = `${(rect.width / rect.height).toFixed(2)} : 1`;

  const reset = () => {
    const nextBounds = getBounds();
    const width = Math.min(INITIAL_RECT.width, nextBounds.width - 24);
    const height = Math.min(INITIAL_RECT.height, nextBounds.height - 24);
    setRect({
      x: Math.max(12, Math.min(INITIAL_RECT.x, nextBounds.width - width - 12)),
      y: Math.max(12, Math.min(INITIAL_RECT.y, nextBounds.height - height - 12)),
      width,
      height,
    });
    setPointer({ x: nextBounds.width * 0.72, y: nextBounds.height * 0.74 });
    deactivate();
    setHasInteracted(false);
  };

  const lockLabel = useMemo(() => {
    if (widthLocked && heightLocked) return 'Monitor filled';
    if (widthLocked) return 'Width locked · height is still fluid';
    if (heightLocked) return 'Height locked · width is still fluid';
    return 'Proportional resize';
  }, [heightLocked, widthLocked]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-[1480px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <a className="flex items-center gap-3" href="#top" aria-label="Scroll Sizer home">
          <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/6 shadow-inner">
            <CornerDownRight className="size-[18px] text-[var(--signal)]" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-[-0.02em]">Scroll Sizer</span>
          <Badge className="hidden border-white/10 bg-white/6 text-[10px] text-white/65 sm:inline-flex" variant="outline">
            Interaction study
          </Badge>
        </a>
        <div className="flex items-center gap-2 text-xs text-white/55">
          <span className="hidden sm:inline">A Rails feature</span>
          <span className="size-1 rounded-full bg-[var(--signal)]" />
          <span>Prototype 01</span>
        </div>
      </header>

      <section id="top" className="mx-auto w-full max-w-[1480px] px-5 pb-12 pt-6 sm:px-8 lg:px-12 lg:pt-10">
        <div className="mb-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.48fr)] lg:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--signal)]">
              <Sparkles className="size-3.5" aria-hidden="true" />
              One chord. A whole new window.
            </div>
            <h1 className="max-w-4xl text-balance text-[clamp(2.5rem,6.2vw,6rem)] font-semibold leading-[0.93] tracking-[-0.065em]">
              Grab it. Drag it.
              <span className="block text-white/38">Roll it into shape.</span>
            </h1>
          </div>
          <p className="max-w-xl text-pretty text-base leading-7 text-white/56 sm:text-lg lg:justify-self-end lg:pb-2">
            Hold the activator to catch the nearest corner. Move to reposition. Roll the wheel to resize—through the monitor limit and into a new aspect ratio.
          </p>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[var(--panel)] shadow-[0_30px_100px_rgba(0,0,0,0.38)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <span className={`status-dot ${isActive ? 'is-active' : ''}`} />
              <span className="text-xs font-semibold uppercase tracking-[0.13em] text-white/78">
                {isActive ? `Holding · ${CORNERS[corner]}` : 'Ready to grab'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-white/8 bg-black/20 px-2.5 py-1.5 text-[11px] text-white/50 md:flex">
                <span>Hold</span>
                <KbdGroup>
                  <Kbd>Ctrl</Kbd><span>+</span><Kbd>Shift</Kbd><span>+</span><Kbd>R</Kbd>
                </KbdGroup>
              </div>
              <Button
                className={`h-8 touch-none select-none px-3 text-xs ${isActive ? 'bg-[var(--signal)] text-[#07100d] hover:bg-[var(--signal)]' : 'border-white/12 bg-white/6 text-white hover:bg-white/10'}`}
                variant="outline"
                onClick={() => (isActive ? deactivate() : activate())}
                aria-pressed={isActive}
              >
                <Grip data-icon="inline-start" />
                {isActive ? 'Release activator' : 'Simulate hold'}
              </Button>
              <Button aria-label="Reset demo" className="border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={reset} size="icon" variant="outline">
                <RotateCcw />
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_286px]">
            <div className="p-3 sm:p-5">
              <div
                ref={stageRef}
                className={`monitor-stage ${isActive ? 'is-active' : ''}`}
                onPointerMove={(event) => movePointer(event.clientX, event.clientY)}
                onWheel={(event) => {
                  if (!isActive) return;
                  event.preventDefault();
                  resizeWithWheel(event.deltaY);
                }}
              >
                <div className="desktop-light desktop-light-one" />
                <div className="desktop-light desktop-light-two" />
                <div className="desktop-grid" />

                <div
                  className={`demo-window ${isActive ? 'is-grabbed' : ''}`}
                  style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                >
                  <div className="window-bar">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#f35d67]" />
                      <span className="size-2 rounded-full bg-[#f5bd4f]" />
                      <span className="size-2 rounded-full bg-[#48c98a]" />
                    </div>
                    <span className="truncate text-[10px] font-medium tracking-wide text-white/42">project-notes.md</span>
                    <Maximize2 className="size-3 text-white/28" />
                  </div>
                  <div className="window-content">
                    <div className="window-sidebar">
                      <span className="mb-3 h-2 w-10 rounded-full bg-white/14" />
                      {[68, 82, 54, 72].map((width) => <span key={width} className="h-1.5 rounded-full bg-white/8" style={{ width: `${width}%` }} />)}
                    </div>
                    <div className="min-w-0 flex-1 p-[clamp(12px,2.5vw,28px)]">
                      <span className="mb-3 block h-2 w-[28%] rounded-full bg-[var(--signal)]/55" />
                      <span className="mb-2 block h-3 w-[72%] rounded-full bg-white/21" />
                      <span className="mb-6 block h-3 w-[48%] rounded-full bg-white/14" />
                      <div className="grid grid-cols-3 gap-2.5">
                        <span className="aspect-[1.3] rounded-md border border-white/8 bg-white/5" />
                        <span className="aspect-[1.3] rounded-md border border-[var(--signal)]/25 bg-[var(--signal)]/8" />
                        <span className="aspect-[1.3] rounded-md border border-white/8 bg-white/5" />
                      </div>
                    </div>
                  </div>
                  <span className={`corner-node corner-${corner}`} />
                  <span className={`corner-ring corner-${corner}`} />
                  <svg className="window-diagonals" aria-hidden="true">
                    <line x1="0" y1="0" x2="100%" y2="100%" />
                    <line x1="100%" y1="0" x2="0" y2="100%" />
                  </svg>
                </div>

                <div className="dimension width-dimension" style={{ left: rect.x + rect.width / 2, top: Math.max(8, rect.y - 24) }}>{Math.round(rect.width)} px</div>
                <div className="dimension height-dimension" style={{ left: Math.min(bounds.width - 54, rect.x + rect.width + 12), top: rect.y + rect.height / 2 }}>{Math.round(rect.height)} px</div>

                <div className={`sim-pointer ${isActive ? 'is-active' : ''}`} style={{ transform: `translate3d(${pointer.x}px, ${pointer.y}px, 0)` }}>
                  <MousePointer2 className="size-6 fill-[#08100d] text-white" />
                  {isActive && <span className="pointer-label">drag + roll</span>}
                </div>

                {!hasInteracted && <div className="stage-hint">Move near a corner, then hold the activator</div>}

                <div className="taskbar" aria-hidden="true">
                  <span className="windows-mark"><i /><i /><i /><i /></span>
                  <span className="taskbar-app active" /><span className="taskbar-app" /><span className="taskbar-app" />
                </div>
              </div>
            </div>

            <aside className="border-t border-white/8 p-5 lg:border-l lg:border-t-0 lg:p-6">
              <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Live geometry</p>
              <div className="space-y-4">
                <Metric label="Window" value={`${Math.round(rect.width)} × ${Math.round(rect.height)}`} suffix="px" />
                <Metric label="Aspect ratio" value={ratioLabel} />
                <Metric label="Limit state" value={lockLabel} accent={widthLocked || heightLocked} />
              </div>
              <div className="my-6 h-px bg-white/8" />
              <ol className="space-y-4 text-sm">
                <Instruction active={!isActive && !hasInteracted} number="01" title="Point" detail="Move close to any window corner." />
                <Instruction active={isActive && !wheelDirection} number="02" title="Hold + drag" detail="The window follows at its current size." />
                <Instruction active={Boolean(wheelDirection)} number="03" title="Roll" detail="Up grows. Down shrinks at the live ratio." />
              </ol>
              <div className={`wheel-readout ${isActive ? 'is-ready' : ''}`}>
                <ArrowUp className={wheelDirection === 'up' ? 'is-lit' : ''} />
                <span>mouse wheel</span>
                <ArrowDown className={wheelDirection === 'down' ? 'is-lit' : ''} />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 bg-[#090c0c]">
        <div className="mx-auto grid w-full max-w-[1480px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:px-12 lg:py-20">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--signal)]">The behavior</p>
            <h2 className="max-w-lg text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">The monitor edge becomes a hinge—not a dead end.</h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 sm:grid-cols-3">
            <FeatureCard number="01" title="Catch" copy="The nearest corner jumps to the pointer while its opposite stays anchored." />
            <FeatureCard number="02" title="Carry" copy="Keep holding and the whole window moves with the grabbed corner." />
            <FeatureCard number="03" title="Re-shape" copy="Once a dimension fills the monitor, the other keeps growing. Shrink from the new ratio." />
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, suffix, accent = false }: { label: string; value: string; suffix?: string; accent?: boolean }) {
  return <div className="flex items-start justify-between gap-3"><span className="text-xs text-white/38">{label}</span><span className={`text-right font-mono text-xs ${accent ? 'text-[var(--signal)]' : 'text-white/78'}`}>{value} {suffix && <span className="text-white/35">{suffix}</span>}</span></div>;
}

function Instruction({ active, number, title, detail }: { active: boolean; number: string; title: string; detail: string }) {
  return <li className={`instruction ${active ? 'is-active' : ''}`}><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div></li>;
}

function FeatureCard({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <article className="bg-[#0d1110] p-6 sm:min-h-56 sm:p-7"><span className="font-mono text-[11px] text-[var(--signal)]">{number}</span><h3 className="mb-3 mt-12 text-xl font-semibold tracking-[-0.03em]">{title}</h3><p className="text-sm leading-6 text-white/44">{copy}</p></article>;
}
