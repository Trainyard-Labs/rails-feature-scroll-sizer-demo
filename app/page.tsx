'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
  Keyboard,
  Minus,
  MoveDiagonal,
  MoveDiagonal2,
  MoveHorizontal,
  MoveVertical,
  MousePointer2,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type WindowMode = 'normal' | 'maximized' | 'minimized' | 'closed';
type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const MIN_WIDTH = 190;
const MIN_HEIGHT = 128;
const INITIAL_RECT: Rect = { x: 102, y: 72, width: 410, height: 274 };
const CORNERS = ['top left', 'top right', 'bottom left', 'bottom right'];
const DEFAULT_SHORTCUT = ['Ctrl', 'Shift', 'R'];
const SHORTCUT_STORAGE_KEY = 'scroll-sizer-demo-shortcut';
const MODIFIER_ORDER = ['Ctrl', 'Shift', 'Alt', 'Win'];
const RESIZE_DIRECTIONS: ResizeDirection[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const RESIZE_LABELS: Record<ResizeDirection, string> = {
  n: 'top edge',
  ne: 'top-right corner',
  e: 'right edge',
  se: 'bottom-right corner',
  s: 'bottom edge',
  sw: 'bottom-left corner',
  w: 'left edge',
  nw: 'top-left corner',
};

function resizePointerGlyph(direction: ResizeDirection) {
  if (direction === 'e' || direction === 'w') return <MoveHorizontal aria-hidden="true" />;
  if (direction === 'n' || direction === 's') return <MoveVertical aria-hidden="true" />;
  if (direction === 'ne' || direction === 'sw') return <MoveDiagonal aria-hidden="true" />;
  return <MoveDiagonal2 aria-hidden="true" />;
}

function normalizeKey(key: string) {
  if (key === 'Control') return 'Ctrl';
  if (key === 'Meta') return 'Win';
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function mouseButtonInput(button: number) {
  if (button === 3) return 'MB4';
  if (button === 4) return 'MB5';
  return null;
}

function sortShortcut(keys: string[]) {
  return [...keys].sort((left, right) => {
    const leftIndex = MODIFIER_ORDER.indexOf(left);
    const rightIndex = MODIFIER_ORDER.indexOf(right);
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1;
    if (rightIndex >= 0) return 1;
    return left.localeCompare(right);
  });
}

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
  const [shortcut, setShortcut] = useState(DEFAULT_SHORTCUT);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
  const [recordingError, setRecordingError] = useState('');
  const [windowMode, setWindowMode] = useState<WindowMode>('normal');
  const [isTitleDragging, setIsTitleDragging] = useState(false);
  const [nativeResizeDirection, setNativeResizeDirection] = useState<ResizeDirection | null>(null);
  const [hoveredResizeDirection, setHoveredResizeDirection] = useState<ResizeDirection | null>(null);
  const heldKeys = useRef(new Set<string>());
  const capturedKeys = useRef(new Set<string>());
  const recordingInvalid = useRef(false);
  const historyGuardInstalled = useRef(false);
  const restoreRect = useRef<Rect>(INITIAL_RECT);
  const modeBeforeMinimize = useRef<Exclude<WindowMode, 'minimized' | 'closed'>>('normal');
  const titleDrag = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const nativeResize = useRef<{
    pointerId: number;
    direction: ResizeDirection;
    startX: number;
    startY: number;
    startRect: Rect;
  } | null>(null);

  const getBounds = useCallback(() => {
    const stage = stageRef.current;
    return {
      width: stage?.clientWidth ?? 720,
      height: stage?.clientHeight ?? 430,
    };
  }, []);

  const activate = useCallback(() => {
    if (isActive || windowMode === 'minimized' || windowMode === 'closed') return;
    const bounds = getBounds();
    const sourceRect = windowMode === 'maximized' ? restoreRect.current : rect;
    const selectedCorner = nearestCorner(sourceRect, pointer);
    setCorner(selectedCorner);
    setRect(rectWithCornerAtPointer(sourceRect, pointer, selectedCorner, bounds));
    if (windowMode === 'maximized') setWindowMode('normal');
    setIsActive(true);
    setHasInteracted(true);
  }, [getBounds, isActive, pointer, rect, windowMode]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    setWheelDirection(null);
  }, []);

  const saveShortcut = useCallback((inputs: string[]) => {
    const nextShortcut = sortShortcut(inputs);
    setShortcut(nextShortcut);
    window.localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(nextShortcut));
    capturedKeys.current.clear();
    heldKeys.current.clear();
    setRecordingKeys([]);
    setRecordingError('');
    setIsRecording(false);
  }, []);

  useEffect(() => {
    try {
      const savedShortcut = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);
      if (!savedShortcut) return;
      const parsed = JSON.parse(savedShortcut);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 3 && parsed.every((key) => typeof key === 'string')) {
        setShortcut(sortShortcut(parsed));
      }
    } catch {
      window.localStorage.removeItem(SHORTCUT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = normalizeKey(event.key);

      if (isRecording) {
        event.preventDefault();
        event.stopPropagation();
        if (key === 'Escape') {
          capturedKeys.current.clear();
          heldKeys.current.clear();
          setRecordingKeys([]);
          setRecordingError('');
          setIsRecording(false);
          return;
        }
        if (event.repeat || capturedKeys.current.has(key)) return;
        if (capturedKeys.current.size >= 3) {
          recordingInvalid.current = true;
          setRecordingError('Use up to three keys. Release and try again.');
          return;
        }
        capturedKeys.current.add(key);
        heldKeys.current.add(key);
        setRecordingKeys(sortShortcut([...capturedKeys.current]));
        return;
      }

      heldKeys.current.add(key);
      if (shortcut.includes(key)) event.preventDefault();
      if (shortcut.every((shortcutKey) => heldKeys.current.has(shortcutKey))) activate();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = normalizeKey(event.key);
      heldKeys.current.delete(key);

      if (isRecording) {
        event.preventDefault();
        event.stopPropagation();
        const recordedKeyStillHeld = [...capturedKeys.current].some((capturedKey) => heldKeys.current.has(capturedKey));
        if (recordedKeyStillHeld || capturedKeys.current.size === 0) return;

        if (recordingInvalid.current) {
          capturedKeys.current.clear();
          recordingInvalid.current = false;
          setRecordingKeys([]);
          return;
        }

        saveShortcut([...capturedKeys.current]);
        return;
      }

      if (!shortcut.every((shortcutKey) => heldKeys.current.has(shortcutKey))) deactivate();
    };

    const onBlur = () => {
      heldKeys.current.clear();
      capturedKeys.current.clear();
      recordingInvalid.current = false;
      setRecordingKeys([]);
      setRecordingError('');
      setIsRecording(false);
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
  }, [activate, deactivate, isRecording, saveShortcut, shortcut]);

  useEffect(() => {
    const consume = (event: MouseEvent | PointerEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onPointerDown = (event: PointerEvent) => {
      const input = mouseButtonInput(event.button);
      if (!input || (!isRecording && !shortcut.includes(input))) return;
      consume(event);
      heldKeys.current.add(input);

      if (isRecording) {
        if (capturedKeys.current.has(input)) return;
        if (capturedKeys.current.size >= 3) {
          recordingInvalid.current = true;
          setRecordingError('Use up to three inputs. Release and try again.');
          return;
        }
        capturedKeys.current.add(input);
        setRecordingKeys(sortShortcut([...capturedKeys.current]));
        return;
      }

      if (shortcut.every((shortcutInput) => heldKeys.current.has(shortcutInput))) activate();
    };

    const onPointerUp = (event: PointerEvent) => {
      const input = mouseButtonInput(event.button);
      if (!input || (!isRecording && !shortcut.includes(input))) return;
      consume(event);
      heldKeys.current.delete(input);

      if (isRecording) {
        const recordedInputStillHeld = [...capturedKeys.current].some((capturedInput) => heldKeys.current.has(capturedInput));
        if (recordedInputStillHeld || capturedKeys.current.size === 0) return;
        if (recordingInvalid.current) {
          capturedKeys.current.clear();
          recordingInvalid.current = false;
          setRecordingKeys([]);
          return;
        }
        saveShortcut([...capturedKeys.current]);
        return;
      }

      if (!shortcut.every((shortcutInput) => heldKeys.current.has(shortcutInput))) deactivate();
    };

    const swallowCompatibilityEvent = (event: MouseEvent) => {
      const input = mouseButtonInput(event.button);
      if (input && (isRecording || shortcut.includes(input))) consume(event);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('mousedown', swallowCompatibilityEvent, true);
    window.addEventListener('mouseup', swallowCompatibilityEvent, true);
    window.addEventListener('auxclick', swallowCompatibilityEvent, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('mousedown', swallowCompatibilityEvent, true);
      window.removeEventListener('mouseup', swallowCompatibilityEvent, true);
      window.removeEventListener('auxclick', swallowCompatibilityEvent, true);
    };
  }, [activate, deactivate, isRecording, saveShortcut, shortcut]);

  useEffect(() => {
    const shouldGuardHistory = isRecording || shortcut.includes('MB4');
    if (shouldGuardHistory && !historyGuardInstalled.current) {
      if (!window.history.state?.scrollSizerInputGuard) {
        window.history.pushState({ ...window.history.state, scrollSizerInputGuard: true }, '', window.location.href);
      }
      historyGuardInstalled.current = true;
    } else if (!shouldGuardHistory && historyGuardInstalled.current) {
      historyGuardInstalled.current = false;
      if (window.history.state?.scrollSizerInputGuard) window.history.back();
    }
  }, [isRecording, shortcut]);

  useEffect(() => {
    const onPopState = () => {
      if (!historyGuardInstalled.current) return;
      window.history.pushState({ ...window.history.state, scrollSizerInputGuard: true }, '', window.location.href);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const bounds = getBounds();
      setRect((current) => {
        if (windowMode === 'maximized') {
          return { x: 0, y: 0, width: bounds.width, height: Math.max(MIN_HEIGHT, bounds.height - 52) };
        }
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
  }, [getBounds, windowMode]);

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

  const resizeWithWheel = useCallback((deltaY: number) => {
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
  }, [corner, getBounds, isActive, pointer]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const blockPageScroll = (event: WheelEvent) => {
      event.preventDefault();
      if (isActive) resizeWithWheel(event.deltaY);
    };
    stage.addEventListener('wheel', blockPageScroll, { passive: false });
    return () => stage.removeEventListener('wheel', blockPageScroll);
  }, [isActive, resizeWithWheel]);

  const beginShortcutRecording = () => {
    deactivate();
    heldKeys.current.clear();
    capturedKeys.current.clear();
    recordingInvalid.current = false;
    setRecordingKeys([]);
    setRecordingError('');
    setIsRecording(true);
  };

  const toggleMaximize = () => {
    const stageBounds = getBounds();
    deactivate();
    if (windowMode === 'maximized') {
      const saved = restoreRect.current;
      const width = Math.min(saved.width, stageBounds.width);
      const height = Math.min(saved.height, stageBounds.height);
      setRect({
        x: Math.max(0, Math.min(stageBounds.width - width, saved.x)),
        y: Math.max(0, Math.min(stageBounds.height - height, saved.y)),
        width,
        height,
      });
      setWindowMode('normal');
      return;
    }

    restoreRect.current = rect;
    setRect({ x: 0, y: 0, width: stageBounds.width, height: Math.max(MIN_HEIGHT, stageBounds.height - 52) });
    setWindowMode('maximized');
  };

  const minimizeWindow = () => {
    deactivate();
    modeBeforeMinimize.current = windowMode === 'maximized' ? 'maximized' : 'normal';
    setWindowMode('minimized');
  };

  const restoreMinimizedWindow = () => {
    if (windowMode !== 'minimized') return;
    const nextMode = modeBeforeMinimize.current;
    if (nextMode === 'maximized') {
      const stageBounds = getBounds();
      setRect({ x: 0, y: 0, width: stageBounds.width, height: Math.max(MIN_HEIGHT, stageBounds.height - 52) });
    }
    setWindowMode(nextMode);
  };

  const closeWindow = () => {
    deactivate();
    setWindowMode('closed');
  };

  const reopenWindow = () => {
    const stageBounds = getBounds();
    const saved = restoreRect.current;
    const width = Math.min(saved.width, stageBounds.width - 24);
    const height = Math.min(saved.height, stageBounds.height - 24);
    setRect({
      x: Math.max(12, Math.min(stageBounds.width - width - 12, saved.x)),
      y: Math.max(12, Math.min(stageBounds.height - height - 12, saved.y)),
      width,
      height,
    });
    setWindowMode('normal');
  };

  const startTitleDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (windowMode !== 'normal' || isActive) return;
    const stage = stageRef.current;
    if (!stage) return;
    const stageBounds = stage.getBoundingClientRect();
    titleDrag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - stageBounds.left - rect.x,
      offsetY: event.clientY - stageBounds.top - rect.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsTitleDragging(true);
  };

  const moveTitleDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = titleDrag.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const stage = stageRef.current;
    if (!stage) return;
    const stageBounds = stage.getBoundingClientRect();
    const { offsetX, offsetY } = dragState;
    const pointerX = event.clientX;
    const pointerY = event.clientY;
    setRect((current) => ({
      ...current,
      x: Math.max(0, Math.min(stageBounds.width - current.width, pointerX - stageBounds.left - offsetX)),
      y: Math.max(0, Math.min(stageBounds.height - current.height, pointerY - stageBounds.top - offsetY)),
    }));
  };

  const endTitleDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (titleDrag.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    titleDrag.current = null;
    setIsTitleDragging(false);
  };

  const startNativeResize = (event: React.PointerEvent<HTMLSpanElement>, direction: ResizeDirection) => {
    if (event.button !== 0 || windowMode !== 'normal' || isActive) return;
    event.preventDefault();
    event.stopPropagation();
    nativeResize.current = {
      pointerId: event.pointerId,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startRect: rect,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setNativeResizeDirection(direction);
    setHoveredResizeDirection(direction);
  };

  const moveNativeResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    const resizeState = nativeResize.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    movePointer(event.clientX, event.clientY);
    const stageBounds = getBounds();
    const dx = event.clientX - resizeState.startX;
    const dy = event.clientY - resizeState.startY;
    const start = resizeState.startRect;
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;

    if (resizeState.direction.includes('w')) left = Math.max(0, Math.min(right - MIN_WIDTH, start.x + dx));
    if (resizeState.direction.includes('e')) right = Math.min(stageBounds.width, Math.max(left + MIN_WIDTH, start.x + start.width + dx));
    if (resizeState.direction.includes('n')) top = Math.max(0, Math.min(bottom - MIN_HEIGHT, start.y + dy));
    if (resizeState.direction.includes('s')) bottom = Math.min(stageBounds.height, Math.max(top + MIN_HEIGHT, start.y + start.height + dy));

    const nextRect = { x: left, y: top, width: right - left, height: bottom - top };
    restoreRect.current = nextRect;
    setRect(nextRect);
    setHasInteracted(true);
  };

  const endNativeResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (nativeResize.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    nativeResize.current = null;
    setNativeResizeDirection(null);
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
    restoreRect.current = INITIAL_RECT;
    titleDrag.current = null;
    nativeResize.current = null;
    setWindowMode('normal');
    setIsTitleDragging(false);
    setNativeResizeDirection(null);
    setHoveredResizeDirection(null);
    deactivate();
    setHasInteracted(false);
  };

  const lockLabel = useMemo(() => {
    if (widthLocked && heightLocked) return 'Monitor filled';
    if (widthLocked) return 'Width locked · height is still fluid';
    if (heightLocked) return 'Height locked · width is still fluid';
    return 'Proportional resize';
  }, [heightLocked, widthLocked]);

  const windowVisible = windowMode === 'normal' || windowMode === 'maximized';
  const statusLabel = isRecording
    ? 'Recording shortcut'
    : windowMode === 'minimized'
      ? 'Window minimized'
      : windowMode === 'closed'
        ? 'Sample window closed'
        : nativeResizeDirection
          ? `Standard resize · ${RESIZE_LABELS[nativeResizeDirection]}`
          : isActive
            ? `Holding · ${CORNERS[corner]}`
            : windowMode === 'maximized'
              ? 'Window maximized'
              : 'Ready to grab';
  const pointerResizeDirection = nativeResizeDirection || hoveredResizeDirection;

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
              <span className={`status-dot ${isActive || isRecording || nativeResizeDirection ? 'is-active' : ''}`} />
              <span className="text-xs font-semibold uppercase tracking-[0.13em] text-white/78">
                {statusLabel}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                className={`h-8 gap-2 border-white/12 px-2.5 text-[11px] text-white hover:bg-white/10 ${isRecording ? 'bg-[var(--signal)]/12' : 'bg-black/20'}`}
                variant="outline"
                onClick={beginShortcutRecording}
                aria-label={`Change shortcut. Current shortcut is ${shortcut.join(' plus ')}`}
              >
                <Keyboard data-icon="inline-start" />
                <span className="hidden sm:inline">Shortcut</span>
                <KbdGroup>
                  {shortcut.map((key, index) => (
                    <span className="contents" key={key}>
                      {index > 0 && <span className="text-white/30">+</span>}
                      <Kbd>{key}</Kbd>
                    </span>
                  ))}
                </KbdGroup>
              </Button>
              {shortcut.some((input) => input === 'MB4' || input === 'MB5') && (
                <span className="input-capture-status" title="The assigned mouse side button is consumed while this page is focused.">
                  <i />
                  Browser action captured
                </span>
              )}
              <Button aria-label="Reset demo" className="border-white/12 bg-white/6 text-white hover:bg-white/10" onClick={reset} size="icon" variant="outline">
                <RotateCcw />
              </Button>
            </div>

            {isRecording && (
              <div className="shortcut-recorder" role="status" aria-live="polite">
                <div>
                  <strong>Press your new shortcut</strong>
                  <p>{recordingError || 'Hold one to three keyboard or side-button inputs, then release to save. Escape cancels.'}</p>
                </div>
                <div className="recording-inputs">
                  <KbdGroup className="min-h-7">
                    {recordingKeys.length === 0 ? (
                      <span className="recording-placeholder">Waiting for input…</span>
                    ) : recordingKeys.map((key, index) => (
                      <span className="contents" key={key}>
                        {index > 0 && <span className="text-white/30">+</span>}
                        <Kbd className="bg-[var(--signal)]/14 text-[var(--signal)]">{key}</Kbd>
                      </span>
                    ))}
                  </KbdGroup>
                  <div className="side-input-presets">
                    <button type="button" onClick={() => saveShortcut(['MB4'])}>Use MB4</button>
                    <button type="button" onClick={() => saveShortcut(['MB5'])}>Use MB5</button>
                  </div>
                </div>
                <Button
                  className="text-white/45 hover:bg-white/8 hover:text-white"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    capturedKeys.current.clear();
                    heldKeys.current.clear();
                    setRecordingKeys([]);
                    setRecordingError('');
                    setIsRecording(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_286px]">
            <div className="p-3 sm:p-5">
              <div
                ref={stageRef}
                className={`monitor-stage ${isActive ? 'is-active' : ''}`}
                onPointerMove={(event) => movePointer(event.clientX, event.clientY)}
              >
                <div className="desktop-light desktop-light-one" />
                <div className="desktop-light desktop-light-two" />
                <div className="desktop-grid" />

                {windowVisible && (
                  <div
                    className={`demo-window ${isActive ? 'is-grabbed' : ''} ${isTitleDragging ? 'is-moving' : ''} ${windowMode === 'maximized' ? 'is-maximized' : ''}`}
                    style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
                  >
                  <div
                    className="window-bar"
                    onPointerDown={startTitleDrag}
                    onPointerMove={moveTitleDrag}
                    onPointerUp={endTitleDrag}
                    onPointerCancel={endTitleDrag}
                    onDoubleClick={toggleMaximize}
                  >
                    <div className="window-title">
                      <span className="window-app-icon"><CornerDownRight /></span>
                      <span>Project Notes</span>
                    </div>
                    <div className="window-controls" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
                      <button type="button" className="window-control" aria-label="Minimize sample window" onClick={minimizeWindow}>
                        <Minus />
                      </button>
                      <button type="button" className="window-control" aria-label={windowMode === 'maximized' ? 'Restore sample window' : 'Maximize sample window'} onClick={toggleMaximize}>
                        {windowMode === 'maximized' ? <span className="restore-glyph" /> : <Square />}
                      </button>
                      <button type="button" className="window-control window-close" aria-label="Close sample window" onClick={closeWindow}>
                        <X />
                      </button>
                    </div>
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
                  {windowMode === 'normal' && RESIZE_DIRECTIONS.map((direction) => (
                    <span
                      key={direction}
                      className={`native-resize-handle resize-${direction}`}
                      role="separator"
                      aria-label={`Resize from ${RESIZE_LABELS[direction]}`}
                      onPointerEnter={() => setHoveredResizeDirection(direction)}
                      onPointerLeave={() => {
                        if (!nativeResize.current) setHoveredResizeDirection(null);
                      }}
                      onPointerDown={(event) => startNativeResize(event, direction)}
                      onPointerMove={moveNativeResize}
                      onPointerUp={endNativeResize}
                      onPointerCancel={endNativeResize}
                    />
                  ))}
                  </div>
                )}

                {windowVisible && <div className="dimension width-dimension" style={{ left: rect.x + rect.width / 2, top: Math.max(8, rect.y - 24) }}>{Math.round(rect.width)} px</div>}
                {windowVisible && <div className="dimension height-dimension" style={{ left: Math.min(bounds.width - 54, rect.x + rect.width + 12), top: rect.y + rect.height / 2 }}>{Math.round(rect.height)} px</div>}

                {windowMode === 'closed' && (
                  <Button className="reopen-window" onClick={reopenWindow} variant="outline">
                    <CornerDownRight data-icon="inline-start" />
                    Open sample window
                  </Button>
                )}

                <div className={`sim-pointer ${isActive ? 'is-active' : ''} ${pointerResizeDirection && !isActive ? 'is-native-resize' : ''}`} style={{ transform: `translate3d(${pointer.x}px, ${pointer.y}px, 0)` }}>
                  {pointerResizeDirection && !isActive ? (
                    <span className="resize-pointer-glyph">{resizePointerGlyph(pointerResizeDirection)}</span>
                  ) : (
                    <MousePointer2 className="size-6 fill-[#08100d] text-white" />
                  )}
                  {isActive && <span className="pointer-label">drag + roll</span>}
                </div>

                {!hasInteracted && windowVisible && <div className="stage-hint">Pull any edge for standard resize—or hold the activator and roll</div>}
                {windowMode === 'minimized' && <div className="stage-hint">Window minimized · click its taskbar icon to restore</div>}

                <div className="taskbar">
                  <span className="windows-mark"><i /><i /><i /><i /></span>
                  {windowMode !== 'closed' && (
                    <button
                      type="button"
                      className={`taskbar-app ${windowMode !== 'minimized' ? 'active' : ''}`}
                      aria-label={windowMode === 'minimized' ? 'Restore Project Notes' : 'Project Notes is open'}
                      onClick={restoreMinimizedWindow}
                    >
                      <CornerDownRight />
                    </button>
                  )}
                  <span className="taskbar-app" aria-hidden="true" /><span className="taskbar-app" aria-hidden="true" />
                </div>
              </div>
            </div>

            <aside className="border-t border-white/8 p-5 lg:border-l lg:border-t-0 lg:p-6">
              <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Live geometry</p>
              <div className="space-y-4">
                <Metric label="Window" value={windowVisible ? `${Math.round(rect.width)} × ${Math.round(rect.height)}` : windowMode === 'minimized' ? 'Minimized' : 'Closed'} suffix={windowVisible ? 'px' : undefined} />
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
              <div className="comparison-note">
                <strong>Compare both methods</strong>
                <p>Drag any window edge or corner for normal freeform resizing. Hold the activator and use the wheel for Scroll Sizer.</p>
              </div>
            </aside>
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
