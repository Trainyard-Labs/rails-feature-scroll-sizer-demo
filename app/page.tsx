'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
  Keyboard,
  Minus,
  Plus,
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
type WindowId = 'primary' | 'secondary';
type ActivationMode = 'hold' | 'toggle' | 'sequence';
type SequenceAxis = 'both' | 'horizontal' | 'vertical';
type MonitorPreset = 'standard' | 'portrait' | 'ultrawide';
type DemoWindow = {
  id: WindowId;
  title: string;
  rect: Rect;
  restoreRect: Rect;
  mode: WindowMode;
  modeBeforeMinimize: Exclude<WindowMode, 'minimized' | 'closed'>;
};

const MIN_WIDTH = 190;
const MIN_HEIGHT = 128;
const INITIAL_RECT: Rect = { x: 102, y: 72, width: 410, height: 274 };
const SECONDARY_RECT: Rect = { x: 250, y: 128, width: 360, height: 240 };
const CORNERS = ['top left', 'top right', 'bottom left', 'bottom right'];
const DEFAULT_SHORTCUT = ['Ctrl', 'Shift', 'R'];
const SHORTCUT_STORAGE_KEY = 'scroll-sizer-demo-shortcut';
const ACTIVATION_MODE_STORAGE_KEY = 'scroll-sizer-demo-activation-mode';
const MONITOR_PRESET_STORAGE_KEY = 'scroll-sizer-demo-monitor-preset';
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

const MONITOR_LABELS: Record<MonitorPreset, string> = {
  standard: '16:9 standard',
  portrait: '16:9 portrait',
  ultrawide: 'Ultrawide',
};

const SEQUENCE_AXIS_LABELS: Record<SequenceAxis, string> = {
  both: 'Normal',
  horizontal: 'Horizontal only',
  vertical: 'Vertical only',
};
const SEQUENCE_AXIS_ORDER: SequenceAxis[] = ['both', 'horizontal', 'vertical'];

function createWindow(id: WindowId): DemoWindow {
  const isPrimary = id === 'primary';
  const rect = isPrimary ? INITIAL_RECT : SECONDARY_RECT;
  return {
    id,
    title: isPrimary ? 'Project Notes' : 'Reference Board',
    rect,
    restoreRect: rect,
    mode: 'normal',
    modeBeforeMinimize: 'normal',
  };
}

function clampRect(rect: Rect, bounds: { width: number; height: number }, margin = 0): Rect {
  const availableWidth = Math.max(MIN_WIDTH, bounds.width - margin * 2);
  const availableHeight = Math.max(MIN_HEIGHT, bounds.height - margin * 2);
  const width = Math.min(rect.width, availableWidth);
  const height = Math.min(rect.height, availableHeight);
  return {
    x: Math.max(margin, Math.min(bounds.width - width - margin, rect.x)),
    y: Math.max(margin, Math.min(bounds.height - height - margin, rect.y)),
    width,
    height,
  };
}

function resizePointerGlyph(direction: ResizeDirection) {
  if (direction === 'e' || direction === 'w') return <MoveHorizontal aria-hidden="true" />;
  if (direction === 'n' || direction === 's') return <MoveVertical aria-hidden="true" />;
  if (direction === 'ne' || direction === 'sw') return <MoveDiagonal aria-hidden="true" />;
  return <MoveDiagonal2 aria-hidden="true" />;
}

function ResizeModeIcon({ axis }: { axis: SequenceAxis }) {
  if (axis === 'both') {
    return (
      <span className="resize-mode-icon axis-both">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.5 10.5 5.5 5.5m0 3.75V5.5h3.75m4.25 8 5 5m-3.75 0h3.75v-3.75m-8-1.25-5 5m0-3.75v3.75h3.75m4.25-8 5-5m-3.75 0h3.75v3.75" />
        </svg>
      </span>
    );
  }

  if (axis === 'horizontal') {
    return (
      <span className="resize-mode-icon axis-horizontal">
        <svg viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(24 0) scale(-1 1)">
            <path d="M13.2328 16.4569C12.9328 16.7426 12.9212 17.2173 13.2069 17.5172C13.4926 17.8172 13.9673 17.8288 14.2672 17.5431L13.2328 16.4569ZM19.5172 12.5431C19.8172 12.2574 19.8288 11.7827 19.5431 11.4828C19.2574 11.1828 18.7827 11.1712 18.4828 11.4569L19.5172 12.5431ZM18.4828 12.5431C18.7827 12.8288 19.2574 12.8172 19.5431 12.5172C19.8288 12.2173 19.8172 11.7426 19.5172 11.4569L18.4828 12.5431ZM14.2672 6.4569C13.9673 6.17123 13.4926 6.18281 13.2069 6.48276C12.9212 6.78271 12.9328 7.25744 13.2328 7.5431L14.2672 6.4569ZM19 12.75C19.4142 12.75 19.75 12.4142 19.75 12C19.75 11.5858 19.4142 11.25 19 11.25V12.75ZM5 11.25C4.58579 11.25 4.25 11.5858 4.25 12C4.25 12.4142 4.58579 12.75 5 12.75V11.25ZM14.2672 17.5431L19.5172 12.5431L18.4828 11.4569L13.2328 16.4569L14.2672 17.5431ZM19.5172 11.4569L14.2672 6.4569L13.2328 7.5431L18.4828 12.5431L19.5172 11.4569ZM19 11.25L5 11.25V12.75L19 12.75V11.25Z" />
          </g>
          <g transform="translate(24 0)">
            <path d="M13.2328 16.4569C12.9328 16.7426 12.9212 17.2173 13.2069 17.5172C13.4926 17.8172 13.9673 17.8288 14.2672 17.5431L13.2328 16.4569ZM19.5172 12.5431C19.8172 12.2574 19.8288 11.7827 19.5431 11.4828C19.2574 11.1828 18.7827 11.1712 18.4828 11.4569L19.5172 12.5431ZM18.4828 12.5431C18.7827 12.8288 19.2574 12.8172 19.5431 12.5172C19.8288 12.2173 19.8172 11.7426 19.5172 11.4569L18.4828 12.5431ZM14.2672 6.4569C13.9673 6.17123 13.4926 6.18281 13.2069 6.48276C12.9212 6.78271 12.9328 7.25744 13.2328 7.5431L14.2672 6.4569ZM19 12.75C19.4142 12.75 19.75 12.4142 19.75 12C19.75 11.5858 19.4142 11.25 19 11.25V12.75ZM5 11.25C4.58579 11.25 4.25 11.5858 4.25 12C4.25 12.4142 4.58579 12.75 5 12.75V11.25ZM14.2672 17.5431L19.5172 12.5431L18.4828 11.4569L13.2328 16.4569L14.2672 17.5431ZM19.5172 11.4569L14.2672 6.4569L13.2328 7.5431L18.4828 12.5431L19.5172 11.4569ZM19 11.25L5 11.25V12.75L19 12.75V11.25Z" />
          </g>
        </svg>
      </span>
    );
  }

  return (
    <span className="resize-mode-icon axis-vertical">
      <svg viewBox="0 0 24 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.4569 9.73276C6.17123 10.0327 6.18281 10.5074 6.48276 10.7931C6.78271 11.0788 7.25744 11.0672 7.5431 10.7672L6.4569 9.73276ZM12.5431 5.51724C12.8288 5.21729 12.8172 4.74256 12.5172 4.4569C12.2173 4.17123 11.7426 4.18281 11.4569 4.48276L12.5431 5.51724ZM12.5431 4.48276C12.2574 4.18281 11.7827 4.17123 11.4828 4.4569C11.1828 4.74256 11.1712 5.21729 11.4569 5.51724L12.5431 4.48276ZM16.4569 10.7672C16.7426 11.0672 17.2173 11.0788 17.5172 10.7931C17.8172 10.5074 17.8288 10.0327 17.5431 9.73276L16.4569 10.7672ZM12.75 5C12.75 4.58579 12.4142 4.25 12 4.25C11.5858 4.25 11.25 4.58579 11.25 5H12.75ZM11.25 19C11.25 19.4142 11.5858 19.75 12 19.75C12.4142 19.75 12.75 19.4142 12.75 19H11.25ZM7.5431 10.7672L12.5431 5.51724L11.4569 4.48276L6.4569 9.73276L7.5431 10.7672ZM11.4569 5.51724L16.4569 10.7672L17.5431 9.73276L12.5431 4.48276L11.4569 5.51724ZM11.25 5V19H12.75V5H11.25Z" />
        <g transform="translate(0 48) scale(1 -1)">
          <path d="M6.4569 9.73276C6.17123 10.0327 6.18281 10.5074 6.48276 10.7931C6.78271 11.0788 7.25744 11.0672 7.5431 10.7672L6.4569 9.73276ZM12.5431 5.51724C12.8288 5.21729 12.8172 4.74256 12.5172 4.4569C12.2173 4.17123 11.7426 4.18281 11.4569 4.48276L12.5431 5.51724ZM12.5431 4.48276C12.2574 4.18281 11.7827 4.17123 11.4828 4.4569C11.1828 4.74256 11.1712 5.21729 11.4569 5.51724L12.5431 4.48276ZM16.4569 10.7672C16.7426 11.0672 17.2173 11.0788 17.5172 10.7931C17.8172 10.5074 17.8288 10.0327 17.5431 9.73276L16.4569 10.7672ZM12.75 5C12.75 4.58579 12.4142 4.25 12 4.25C11.5858 4.25 11.25 4.58579 11.25 5H12.75ZM11.25 19C11.25 19.4142 11.5858 19.75 12 19.75C12.4142 19.75 12.75 19.4142 12.75 19H11.25ZM7.5431 10.7672L12.5431 5.51724L11.4569 4.48276L6.4569 9.73276L7.5431 10.7672ZM11.4569 5.51724L16.4569 10.7672L17.5431 9.73276L12.5431 4.48276L11.4569 5.51724ZM11.25 5V19H12.75V5H11.25Z" />
        </g>
      </svg>
    </span>
  );
}

function ResizeModeOverlay({ axis, sequence }: { axis: SequenceAxis; sequence: boolean }) {
  if (!sequence) {
    return (
      <div className="window-resize-mode" aria-hidden="true">
        <ResizeModeIcon axis="both" />
      </div>
    );
  }

  const currentIndex = SEQUENCE_AXIS_ORDER.indexOf(axis);
  const previousAxis = SEQUENCE_AXIS_ORDER[(currentIndex + SEQUENCE_AXIS_ORDER.length - 1) % SEQUENCE_AXIS_ORDER.length];
  const nextAxis = SEQUENCE_AXIS_ORDER[(currentIndex + 1) % SEQUENCE_AXIS_ORDER.length];

  return (
    <div className="window-resize-mode is-carousel" aria-hidden="true">
      <div className="resize-mode-track">
        <div className="resize-mode-option is-previous">
          <ResizeModeIcon axis={previousAxis} />
          <span>{SEQUENCE_AXIS_LABELS[previousAxis]}</span>
        </div>
        <div className="resize-mode-option is-current">
          <ResizeModeIcon axis={axis} />
          <span>{SEQUENCE_AXIS_LABELS[axis]}</span>
        </div>
        <div className="resize-mode-option is-next">
          <ResizeModeIcon axis={nextAxis} />
          <span>{SEQUENCE_AXIS_LABELS[nextAxis]}</span>
        </div>
      </div>
      <span className="resize-mode-prompt">Right-click to change modes.</span>
    </div>
  );
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
  const [windows, setWindows] = useState<DemoWindow[]>([createWindow('primary')]);
  const [focusedWindowId, setFocusedWindowId] = useState<WindowId>('primary');
  const [activeWindowId, setActiveWindowId] = useState<WindowId | null>(null);
  const [pointer, setPointer] = useState<Point>({ x: 486, y: 324 });
  const [monitorBounds, setMonitorBounds] = useState({ width: 720, height: 430 });
  const [corner, setCorner] = useState(3);
  const [wheelDirection, setWheelDirection] = useState<'up' | 'down' | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [shortcut, setShortcut] = useState(DEFAULT_SHORTCUT);
  const [activationMode, setActivationMode] = useState<ActivationMode>('hold');
  const [sequenceAxis, setSequenceAxis] = useState<SequenceAxis>('both');
  const [monitorPreset, setMonitorPreset] = useState<MonitorPreset>('standard');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
  const [recordingError, setRecordingError] = useState('');
  const [titleDraggingWindowId, setTitleDraggingWindowId] = useState<WindowId | null>(null);
  const [nativeResizeState, setNativeResizeState] = useState<{ windowId: WindowId; direction: ResizeDirection } | null>(null);
  const [hoveredResizeState, setHoveredResizeState] = useState<{ windowId: WindowId; direction: ResizeDirection } | null>(null);
  const heldKeys = useRef(new Set<string>());
  const capturedKeys = useRef(new Set<string>());
  const recordingInvalid = useRef(false);
  const historyGuardInstalled = useRef(false);
  const shortcutEngaged = useRef(false);
  const suppressNextClick = useRef(false);
  const titleDrag = useRef<{
    pointerId: number;
    windowId: WindowId;
    relativeX: number;
    relativeY: number;
    pointerX: number;
    pointerY: number;
  } | null>(null);
  const nativeResize = useRef<{
    pointerId: number;
    windowId: WindowId;
    direction: ResizeDirection;
    startX: number;
    startY: number;
    startRect: Rect;
  } | null>(null);

  const isActive = activeWindowId !== null;
  const isTitleDragging = titleDraggingWindowId !== null;

  const getBounds = useCallback(() => {
    const stage = stageRef.current;
    return {
      width: stage?.clientWidth ?? 720,
      height: stage?.clientHeight ?? 430,
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      setMonitorBounds({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const updateWindow = useCallback((windowId: WindowId, updater: (window: DemoWindow) => DemoWindow) => {
    setWindows((current) => current.map((window) => window.id === windowId ? updater(window) : window));
  }, []);

  const focusWindow = useCallback((windowId: WindowId) => {
    setFocusedWindowId(windowId);
  }, []);

  const activate = useCallback(() => {
    if (activeWindowId) return;
    const target = windows.find((window) => window.id === focusedWindowId && (window.mode === 'normal' || window.mode === 'maximized'))
      ?? [...windows].reverse().find((window) => window.mode === 'normal' || window.mode === 'maximized');
    if (!target) return;
    const bounds = getBounds();
    const sourceRect = target.mode === 'maximized' ? target.restoreRect : target.rect;
    const selectedCorner = nearestCorner(sourceRect, pointer);
    const nextRect = rectWithCornerAtPointer(sourceRect, pointer, selectedCorner, bounds);
    setCorner(selectedCorner);
    updateWindow(target.id, (window) => ({ ...window, rect: nextRect, restoreRect: nextRect, mode: 'normal' }));
    setFocusedWindowId(target.id);
    setActiveWindowId(target.id);
    setHasInteracted(true);
  }, [activeWindowId, focusedWindowId, getBounds, pointer, updateWindow, windows]);

  const deactivate = useCallback(() => {
    setActiveWindowId(null);
    setWheelDirection(null);
    setSequenceAxis('both');
  }, []);

  const cycleSequenceAxis = useCallback(() => {
    setSequenceAxis((current) => current === 'both' ? 'horizontal' : current === 'horizontal' ? 'vertical' : 'both');
  }, []);

  const triggerShortcut = useCallback(() => {
    if (activationMode !== 'hold' && isActive) {
      deactivate();
      return;
    }
    if (activationMode === 'sequence') setSequenceAxis('both');
    activate();
  }, [activate, activationMode, deactivate, isActive]);

  const saveShortcut = useCallback((inputs: string[]) => {
    const nextShortcut = sortShortcut(inputs);
    setShortcut(nextShortcut);
    window.localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(nextShortcut));
    capturedKeys.current.clear();
    heldKeys.current.clear();
    setRecordingKeys([]);
    setRecordingError('');
    setIsRecording(false);
    shortcutEngaged.current = false;
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const savedShortcut = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);
        if (savedShortcut) {
          const parsed = JSON.parse(savedShortcut);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 3 && parsed.every((key) => typeof key === 'string')) {
            setShortcut(sortShortcut(parsed));
          }
        }
      } catch {
        window.localStorage.removeItem(SHORTCUT_STORAGE_KEY);
      }
      const savedMode = window.localStorage.getItem(ACTIVATION_MODE_STORAGE_KEY);
      if (savedMode === 'hold' || savedMode === 'toggle' || savedMode === 'sequence') setActivationMode(savedMode);
      const savedMonitor = window.localStorage.getItem(MONITOR_PRESET_STORAGE_KEY);
      if (savedMonitor === 'standard' || savedMonitor === 'portrait' || savedMonitor === 'ultrawide') setMonitorPreset(savedMonitor);
    });
    return () => window.cancelAnimationFrame(frame);
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
      if (shortcut.every((shortcutKey) => heldKeys.current.has(shortcutKey)) && !shortcutEngaged.current) {
        shortcutEngaged.current = true;
        triggerShortcut();
      }
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

      if (!shortcut.every((shortcutKey) => heldKeys.current.has(shortcutKey))) {
        shortcutEngaged.current = false;
        if (activationMode === 'hold') deactivate();
      }
    };

    const onBlur = () => {
      heldKeys.current.clear();
      capturedKeys.current.clear();
      recordingInvalid.current = false;
      setRecordingKeys([]);
      setRecordingError('');
      setIsRecording(false);
      shortcutEngaged.current = false;
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
  }, [activationMode, deactivate, isRecording, saveShortcut, shortcut, triggerShortcut]);

  useEffect(() => {
    const consume = (event: MouseEvent | PointerEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0 && !isRecording && activationMode !== 'hold' && isActive) {
        consume(event);
        suppressNextClick.current = true;
        deactivate();
        return;
      }
      if (event.button === 2 && !isRecording && activationMode === 'sequence' && isActive) {
        consume(event);
        cycleSequenceAxis();
        return;
      }
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

      if (shortcut.every((shortcutInput) => heldKeys.current.has(shortcutInput)) && !shortcutEngaged.current) {
        shortcutEngaged.current = true;
        triggerShortcut();
      }
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

      if (!shortcut.every((shortcutInput) => heldKeys.current.has(shortcutInput))) {
        shortcutEngaged.current = false;
        if (activationMode === 'hold') deactivate();
      }
    };

    const onClick = (event: MouseEvent) => {
      if (!suppressNextClick.current || event.button !== 0) return;
      suppressNextClick.current = false;
      consume(event);
    };

    const onContextMenu = (event: MouseEvent) => {
      if (activationMode === 'sequence' && isActive) consume(event);
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
    window.addEventListener('click', onClick, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('mousedown', swallowCompatibilityEvent, true);
      window.removeEventListener('mouseup', swallowCompatibilityEvent, true);
      window.removeEventListener('auxclick', swallowCompatibilityEvent, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, [activationMode, cycleSequenceAxis, deactivate, isActive, isRecording, saveShortcut, shortcut, triggerShortcut]);

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
      setWindows((current) => current.map((window) => window.mode === 'maximized'
        ? { ...window, rect: { x: 0, y: 0, width: bounds.width, height: Math.max(MIN_HEIGHT, bounds.height - 52) } }
        : { ...window, rect: clampRect(window.rect, bounds) }));
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [getBounds]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const bounds = getBounds();
      setWindows((current) => current.map((demoWindow) => demoWindow.mode === 'maximized'
        ? { ...demoWindow, rect: { x: 0, y: 0, width: bounds.width, height: Math.max(MIN_HEIGHT, bounds.height - 52) } }
        : { ...demoWindow, rect: clampRect(demoWindow.rect, bounds, 8) }));
      setPointer((current) => ({
        x: Math.max(0, Math.min(bounds.width, current.x)),
        y: Math.max(0, Math.min(bounds.height, current.y)),
      }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [getBounds, monitorPreset]);

  const movePointer = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageBounds = stage.getBoundingClientRect();
    const nextPointer = {
      x: Math.max(0, Math.min(stageBounds.width, clientX - stageBounds.left)),
      y: Math.max(0, Math.min(stageBounds.height, clientY - stageBounds.top)),
    };
    setPointer(nextPointer);

    if (activeWindowId) {
      setWindows((current) => current.map((window) => {
        if (window.id !== activeWindowId) return window;
        const position = positionFromGrab(
          nextPointer,
          corner,
          window.rect.width,
          window.rect.height,
          { width: stageBounds.width, height: stageBounds.height },
        );
        const rect = { ...window.rect, ...position };
        return { ...window, rect, restoreRect: rect };
      }));
    }
  };

  const resizeWithWheel = useCallback((deltaY: number) => {
    if (!activeWindowId) return;
    const bounds = getBounds();
    const growing = deltaY < 0;
    const factor = growing ? 1.1 : 0.9;
    setWheelDirection(growing ? 'up' : 'down');
    window.setTimeout(() => setWheelDirection(null), 180);

    setWindows((current) => current.map((window) => {
      if (window.id !== activeWindowId) return window;
      const activeAxis = activationMode === 'sequence' ? sequenceAxis : 'both';
      const width = activeAxis === 'vertical'
        ? window.rect.width
        : Math.min(bounds.width, Math.max(MIN_WIDTH, window.rect.width * factor));
      const height = activeAxis === 'horizontal'
        ? window.rect.height
        : Math.min(bounds.height, Math.max(MIN_HEIGHT, window.rect.height * factor));
      const position = positionFromGrab(pointer, corner, width, height, bounds);
      const rect = { ...position, width, height };
      return { ...window, rect, restoreRect: rect };
    }));
  }, [activationMode, activeWindowId, corner, getBounds, pointer, sequenceAxis]);

  const resizeTitleDragWithWheel = useCallback((deltaY: number) => {
    const dragState = titleDrag.current;
    if (!dragState) return;
    const bounds = getBounds();
    const growing = deltaY < 0;
    const factor = growing ? 1.1 : 0.9;
    setWheelDirection(growing ? 'up' : 'down');
    window.setTimeout(() => setWheelDirection(null), 180);
    setWindows((current) => current.map((window) => {
      if (window.id !== dragState.windowId) return window;
      const width = Math.min(bounds.width, Math.max(MIN_WIDTH, window.rect.width * factor));
      const height = Math.min(bounds.height, Math.max(MIN_HEIGHT, window.rect.height * factor));
      const x = Math.max(0, Math.min(bounds.width - width, dragState.pointerX - width * dragState.relativeX));
      const y = Math.max(0, Math.min(bounds.height - height, dragState.pointerY - height * dragState.relativeY));
      const rect = { x, y, width, height };
      return { ...window, rect, restoreRect: rect };
    }));
    setHasInteracted(true);
  }, [getBounds]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const blockPageScroll = (event: WheelEvent) => {
      event.preventDefault();
      if (activeWindowId) resizeWithWheel(event.deltaY);
      else if (titleDrag.current) resizeTitleDragWithWheel(event.deltaY);
    };
    stage.addEventListener('wheel', blockPageScroll, { passive: false });
    return () => stage.removeEventListener('wheel', blockPageScroll);
  }, [activeWindowId, resizeTitleDragWithWheel, resizeWithWheel]);

  const beginShortcutRecording = () => {
    deactivate();
    heldKeys.current.clear();
    capturedKeys.current.clear();
    recordingInvalid.current = false;
    setRecordingKeys([]);
    setRecordingError('');
    setIsRecording(true);
  };

  const toggleMaximize = (windowId: WindowId) => {
    const stageBounds = getBounds();
    deactivate();
    focusWindow(windowId);
    updateWindow(windowId, (window) => window.mode === 'maximized'
      ? { ...window, rect: clampRect(window.restoreRect, stageBounds), mode: 'normal' }
      : {
          ...window,
          restoreRect: window.rect,
          rect: { x: 0, y: 0, width: stageBounds.width, height: Math.max(MIN_HEIGHT, stageBounds.height - 52) },
          mode: 'maximized',
        });
  };

  const minimizeWindow = (windowId: WindowId) => {
    deactivate();
    updateWindow(windowId, (window) => ({
      ...window,
      modeBeforeMinimize: window.mode === 'maximized' ? 'maximized' : 'normal',
      mode: 'minimized',
    }));
    const fallback = [...windows].reverse().find((window) => window.id !== windowId && (window.mode === 'normal' || window.mode === 'maximized'));
    if (fallback) setFocusedWindowId(fallback.id);
  };

  const restoreMinimizedWindow = (windowId: WindowId) => {
    const stageBounds = getBounds();
    updateWindow(windowId, (window) => {
      if (window.mode !== 'minimized') return window;
      const mode = window.modeBeforeMinimize;
      const rect = mode === 'maximized'
        ? { x: 0, y: 0, width: stageBounds.width, height: Math.max(MIN_HEIGHT, stageBounds.height - 52) }
        : clampRect(window.rect, stageBounds);
      return { ...window, rect, mode };
    });
    focusWindow(windowId);
  };

  const closeWindow = (windowId: WindowId) => {
    if (activeWindowId === windowId) deactivate();
    updateWindow(windowId, (window) => ({ ...window, mode: 'closed' }));
    const fallback = [...windows].reverse().find((window) => window.id !== windowId && (window.mode === 'normal' || window.mode === 'maximized'));
    if (fallback) setFocusedWindowId(fallback.id);
  };

  const reopenWindow = (windowId: WindowId) => {
    const stageBounds = getBounds();
    updateWindow(windowId, (window) => ({ ...window, rect: clampRect(window.restoreRect, stageBounds, 12), mode: 'normal' }));
    focusWindow(windowId);
  };

  const openSecondWindow = () => {
    const existing = windows.find((window) => window.id === 'secondary');
    if (existing) {
      reopenWindow('secondary');
      return;
    }
    const bounds = getBounds();
    const second = createWindow('secondary');
    second.rect = clampRect(second.rect, bounds, 12);
    second.restoreRect = second.rect;
    setWindows((current) => [...current, second]);
    setFocusedWindowId('secondary');
    setHasInteracted(true);
  };

  const startTitleDrag = (event: React.PointerEvent<HTMLDivElement>, windowId: WindowId) => {
    const demoWindow = windows.find((window) => window.id === windowId);
    if (event.button !== 0 || !demoWindow || demoWindow.mode !== 'normal' || isActive) return;
    const stage = stageRef.current;
    if (!stage) return;
    const stageBounds = stage.getBoundingClientRect();
    const pointerX = event.clientX - stageBounds.left;
    const pointerY = event.clientY - stageBounds.top;
    titleDrag.current = {
      pointerId: event.pointerId,
      windowId,
      relativeX: Math.max(0, Math.min(1, (pointerX - demoWindow.rect.x) / demoWindow.rect.width)),
      relativeY: Math.max(0, Math.min(1, (pointerY - demoWindow.rect.y) / demoWindow.rect.height)),
      pointerX,
      pointerY,
    };
    setHoveredResizeState(null);
    focusWindow(windowId);
    event.currentTarget.setPointerCapture(event.pointerId);
    setTitleDraggingWindowId(windowId);
  };

  const moveTitleDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = titleDrag.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const stage = stageRef.current;
    if (!stage) return;
    const stageBounds = stage.getBoundingClientRect();
    dragState.pointerX = event.clientX - stageBounds.left;
    dragState.pointerY = event.clientY - stageBounds.top;
    setWindows((current) => current.map((window) => {
      if (window.id !== dragState.windowId) return window;
      const rect = {
        ...window.rect,
        x: Math.max(0, Math.min(stageBounds.width - window.rect.width, dragState.pointerX - window.rect.width * dragState.relativeX)),
        y: Math.max(0, Math.min(stageBounds.height - window.rect.height, dragState.pointerY - window.rect.height * dragState.relativeY)),
      };
      return { ...window, rect, restoreRect: rect };
    }));
  };

  const endTitleDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (titleDrag.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    titleDrag.current = null;
    setTitleDraggingWindowId(null);
  };

  const startNativeResize = (event: React.PointerEvent<HTMLElement>, windowId: WindowId, direction: ResizeDirection) => {
    const demoWindow = windows.find((window) => window.id === windowId);
    if (event.button !== 0 || !demoWindow || demoWindow.mode !== 'normal' || isActive) return;
    event.preventDefault();
    event.stopPropagation();
    nativeResize.current = {
      pointerId: event.pointerId,
      windowId,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startRect: demoWindow.rect,
    };
    focusWindow(windowId);
    event.currentTarget.setPointerCapture(event.pointerId);
    setNativeResizeState({ windowId, direction });
    setHoveredResizeState({ windowId, direction });
  };

  const moveNativeResize = (event: React.PointerEvent<HTMLElement>) => {
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
    updateWindow(resizeState.windowId, (window) => ({ ...window, rect: nextRect, restoreRect: nextRect }));
    setHasInteracted(true);
  };

  const endNativeResize = (event: React.PointerEvent<HTMLElement>) => {
    if (nativeResize.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    nativeResize.current = null;
    setNativeResizeState(null);
  };

  const focusedWindow = windows.find((window) => window.id === focusedWindowId) ?? windows[0];
  const bounds = monitorBounds;
  const focusedWindowVisible = focusedWindow.mode === 'normal' || focusedWindow.mode === 'maximized';
  const widthLocked = focusedWindowVisible && Math.abs(focusedWindow.rect.width - bounds.width) < 1;
  const heightLocked = focusedWindowVisible && Math.abs(focusedWindow.rect.height - bounds.height) < 1;
  const ratioLabel = `${(focusedWindow.rect.width / focusedWindow.rect.height).toFixed(2)} : 1`;

  const reset = () => {
    const nextBounds = getBounds();
    const primary = createWindow('primary');
    primary.rect = clampRect(primary.rect, nextBounds, 12);
    primary.restoreRect = primary.rect;
    setWindows([primary]);
    setFocusedWindowId('primary');
    setPointer({ x: nextBounds.width * 0.72, y: nextBounds.height * 0.74 });
    titleDrag.current = null;
    nativeResize.current = null;
    shortcutEngaged.current = false;
    setTitleDraggingWindowId(null);
    setNativeResizeState(null);
    setHoveredResizeState(null);
    deactivate();
    setHasInteracted(false);
  };

  const chooseActivationMode = (mode: ActivationMode) => {
    deactivate();
    shortcutEngaged.current = false;
    setActivationMode(mode);
    window.localStorage.setItem(ACTIVATION_MODE_STORAGE_KEY, mode);
  };

  const chooseMonitorPreset = (preset: MonitorPreset) => {
    deactivate();
    titleDrag.current = null;
    nativeResize.current = null;
    setTitleDraggingWindowId(null);
    setNativeResizeState(null);
    setHoveredResizeState(null);
    setMonitorPreset(preset);
    window.localStorage.setItem(MONITOR_PRESET_STORAGE_KEY, preset);
  };

  const lockLabel = useMemo(() => {
    if (widthLocked && heightLocked) return 'Monitor filled';
    if (widthLocked) return 'Width locked · height is still fluid';
    if (heightLocked) return 'Height locked · width is still fluid';
    return 'Proportional resize';
  }, [heightLocked, widthLocked]);

  const statusLabel = isRecording
    ? 'Recording shortcut'
    : nativeResizeState
      ? `Standard resize · ${RESIZE_LABELS[nativeResizeState.direction]}`
      : isTitleDragging
        ? `Moving ${focusedWindow.title} · wheel enabled`
        : isActive
          ? activationMode === 'sequence'
            ? `Sequence · ${SEQUENCE_AXIS_LABELS[sequenceAxis]}`
            : `${activationMode === 'toggle' ? 'Toggled on' : 'Holding'} · ${CORNERS[corner]}`
          : focusedWindow.mode === 'minimized'
            ? `${focusedWindow.title} minimized`
            : focusedWindow.mode === 'closed'
              ? `${focusedWindow.title} closed`
              : focusedWindow.mode === 'maximized'
                ? `${focusedWindow.title} maximized`
                : `${focusedWindow.title} focused`;
  const pointerResizeDirection = nativeResizeState?.direction || hoveredResizeState?.direction || null;
  const visibleWindows = windows.filter((window) => window.mode === 'normal' || window.mode === 'maximized');

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
            Focus a window, use the activator to catch its nearest corner, then move and roll through monitor limits—or resize while dragging its title bar.
          </p>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[var(--panel)] shadow-[0_30px_100px_rgba(0,0,0,0.38)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <span className={`status-dot ${isActive || isRecording || nativeResizeState || isTitleDragging ? 'is-active' : ''}`} />
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
              <output className="shortcut-recorder" aria-live="polite">
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
              </output>
            )}

            <div className="demo-options" aria-label="Demo settings">
              <div className="demo-option-group">
                <span>Activation</span>
                <div className="demo-segmented">
                  {(['hold', 'toggle', 'sequence'] as ActivationMode[]).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      aria-pressed={activationMode === mode}
                      className={activationMode === mode ? 'is-selected' : ''}
                      onClick={() => chooseActivationMode(mode)}
                    >
                      {mode === 'hold' ? 'Hold' : mode === 'toggle' ? 'Toggle' : 'Sequence'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="demo-option-group">
                <span>Monitor</span>
                <div className="demo-segmented">
                  {(['standard', 'portrait', 'ultrawide'] as MonitorPreset[]).map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      aria-pressed={monitorPreset === preset}
                      className={monitorPreset === preset ? 'is-selected' : ''}
                      onClick={() => chooseMonitorPreset(preset)}
                    >
                      {MONITOR_LABELS[preset]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_286px]">
            <div className="monitor-shell p-3 sm:p-5">
              <div
                ref={stageRef}
                className={`monitor-stage monitor-${monitorPreset} ${isActive ? 'is-active' : ''}`}
                onPointerMove={(event) => movePointer(event.clientX, event.clientY)}
              >
                <div className="desktop-light desktop-light-one" />
                <div className="desktop-light desktop-light-two" />
                <div className="desktop-grid" />

                {visibleWindows.map((demoWindow, windowIndex) => {
                  const isFocused = focusedWindowId === demoWindow.id;
                  const isGrabbed = activeWindowId === demoWindow.id;
                  const isMoving = titleDraggingWindowId === demoWindow.id;
                  return (
                    <div
                      key={demoWindow.id}
                      className={`demo-window window-${demoWindow.id} ${isFocused ? 'is-focused' : ''} ${isGrabbed ? 'is-grabbed' : ''} ${isMoving ? 'is-moving' : ''} ${demoWindow.mode === 'maximized' ? 'is-maximized' : ''}`}
                      style={{
                        left: demoWindow.rect.x,
                        top: demoWindow.rect.y,
                        width: demoWindow.rect.width,
                        height: demoWindow.rect.height,
                        zIndex: isFocused ? 12 : 6 + windowIndex,
                      }}
                      onPointerDown={() => focusWindow(demoWindow.id)}
                    >
                      <div
                        className="window-bar"
                        onPointerDown={(event) => startTitleDrag(event, demoWindow.id)}
                        onPointerMove={moveTitleDrag}
                        onPointerUp={endTitleDrag}
                        onPointerCancel={endTitleDrag}
                        onDoubleClick={() => toggleMaximize(demoWindow.id)}
                      >
                        <div className="window-title">
                          <span className="window-app-icon"><CornerDownRight /></span>
                          <span>{demoWindow.title}</span>
                          {isFocused && <span className="focused-badge">Focused</span>}
                        </div>
                        <div
                          className="window-controls"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            focusWindow(demoWindow.id);
                          }}
                          onDoubleClick={(event) => event.stopPropagation()}
                        >
                          <button type="button" className="window-control" aria-label={`Minimize ${demoWindow.title}`} onClick={() => minimizeWindow(demoWindow.id)}>
                            <Minus />
                          </button>
                          <button type="button" className="window-control" aria-label={demoWindow.mode === 'maximized' ? `Restore ${demoWindow.title}` : `Maximize ${demoWindow.title}`} onClick={() => toggleMaximize(demoWindow.id)}>
                            {demoWindow.mode === 'maximized' ? <span className="restore-glyph" /> : <Square />}
                          </button>
                          <button type="button" className="window-control window-close" aria-label={`Close ${demoWindow.title}`} onClick={() => closeWindow(demoWindow.id)}>
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
                      {isGrabbed && <span className={`corner-node corner-${corner}`} />}
                      {isGrabbed && <span className={`corner-ring corner-${corner}`} />}
                      <ResizeModeOverlay axis={activationMode === 'sequence' ? sequenceAxis : 'both'} sequence={activationMode === 'sequence'} />
                      {demoWindow.mode === 'normal' && RESIZE_DIRECTIONS.map((direction) => (
                        <hr
                          key={direction}
                          className={`native-resize-handle resize-${direction}`}
                          aria-label={`Resize ${demoWindow.title} from ${RESIZE_LABELS[direction]}`}
                          onPointerEnter={() => setHoveredResizeState({ windowId: demoWindow.id, direction })}
                          onPointerLeave={() => {
                            if (!nativeResize.current) setHoveredResizeState(null);
                          }}
                          onPointerDown={(event) => startNativeResize(event, demoWindow.id, direction)}
                          onPointerMove={moveNativeResize}
                          onPointerUp={endNativeResize}
                          onPointerCancel={endNativeResize}
                        />
                      ))}
                    </div>
                  );
                })}

                {focusedWindowVisible && <div className="dimension width-dimension" style={{ left: focusedWindow.rect.x + focusedWindow.rect.width / 2, top: Math.max(8, focusedWindow.rect.y - 24) }}>{Math.round(focusedWindow.rect.width)} px</div>}
                {focusedWindowVisible && <div className="dimension height-dimension" style={{ left: Math.min(bounds.width - 54, focusedWindow.rect.x + focusedWindow.rect.width + 12), top: focusedWindow.rect.y + focusedWindow.rect.height / 2 }}>{Math.round(focusedWindow.rect.height)} px</div>}

                {visibleWindows.length === 0 && (
                  <Button className="reopen-window" onClick={() => reopenWindow('primary')} variant="outline">
                    <CornerDownRight data-icon="inline-start" />
                    Open Project Notes
                  </Button>
                )}

                <div className={`sim-pointer ${isActive ? 'is-active' : ''} ${pointerResizeDirection && !isActive ? 'is-native-resize' : ''} ${isTitleDragging ? 'is-hidden' : ''}`} style={{ transform: `translate3d(${pointer.x}px, ${pointer.y}px, 0)` }}>
                  {pointerResizeDirection && !isActive && !isTitleDragging ? (
                    <span className="resize-pointer-glyph">{resizePointerGlyph(pointerResizeDirection)}</span>
                  ) : (
                    <MousePointer2 className="size-6 fill-[#08100d] text-white" />
                  )}
                  {isActive && activationMode !== 'sequence' && (
                    <span className="pointer-label">
                      {activationMode === 'toggle' ? 'active · click to finish' : 'drag + roll'}
                    </span>
                  )}
                </div>

                {visibleWindows.length === 0 && windows.some((window) => window.mode === 'minimized') && <div className="stage-hint">Windows minimized · click a taskbar icon to restore</div>}

                <div className="taskbar">
                  <span className="windows-mark"><i /><i /><i /><i /></span>
                  {windows.filter((window) => window.mode !== 'closed').map((demoWindow) => (
                    <button
                      key={demoWindow.id}
                      type="button"
                      className={`taskbar-app ${focusedWindowId === demoWindow.id && demoWindow.mode !== 'minimized' ? 'active' : ''}`}
                      aria-label={demoWindow.mode === 'minimized' ? `Restore ${demoWindow.title}` : `Focus ${demoWindow.title}`}
                      onClick={() => demoWindow.mode === 'minimized' ? restoreMinimizedWindow(demoWindow.id) : focusWindow(demoWindow.id)}
                    >
                      <CornerDownRight />
                    </button>
                  ))}
                  {(!windows.some((window) => window.id === 'secondary') || windows.find((window) => window.id === 'secondary')?.mode === 'closed') && (
                    <button type="button" className="taskbar-app taskbar-new-window" onClick={openSecondWindow} aria-label="Open a second sample window">
                      <Plus />
                    </button>
                  )}
                  <span className="taskbar-app" aria-hidden="true" />
                </div>
              </div>
            </div>

            <aside className="border-t border-white/8 p-5 lg:border-l lg:border-t-0 lg:p-6">
              <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Focused window</p>
              <div className="space-y-4">
                <Metric label="Title" value={focusedWindow.title} />
                <Metric label="Window" value={focusedWindowVisible ? `${Math.round(focusedWindow.rect.width)} × ${Math.round(focusedWindow.rect.height)}` : focusedWindow.mode === 'minimized' ? 'Minimized' : 'Closed'} suffix={focusedWindowVisible ? 'px' : undefined} />
                <Metric label="Aspect ratio" value={ratioLabel} />
                {activationMode === 'sequence' && <Metric label="Sequence axis" value={SEQUENCE_AXIS_LABELS[sequenceAxis]} accent={isActive} />}
                <Metric label="Limit state" value={lockLabel} accent={widthLocked || heightLocked} />
              </div>
              <div className="my-6 h-px bg-white/8" />
              <ol className="space-y-4 text-sm">
                <Instruction active={!isActive && !hasInteracted} number="01" title="Focus" detail="Click the window you want Scroll Sizer to control." />
                <Instruction active={isActive && !wheelDirection} number="02" title={activationMode === 'hold' ? 'Hold + drag' : activationMode === 'toggle' ? 'Toggle + drag' : 'Sequence + drag'} detail={activationMode === 'sequence' ? 'Right-click cycles normal, horizontal-only, and vertical-only resizing.' : 'The focused window follows at its current size.'} />
                <Instruction active={Boolean(wheelDirection)} number="03" title="Roll" detail={activationMode === 'sequence' && sequenceAxis !== 'both' ? `The wheel changes the ${sequenceAxis} dimension only.` : 'Up grows. Down shrinks at the live ratio.'} />
              </ol>
              <div className={`wheel-readout ${isActive || isTitleDragging ? 'is-ready' : ''}`}>
                <ArrowUp className={wheelDirection === 'up' ? 'is-lit' : ''} />
                <span>mouse wheel</span>
                <ArrowDown className={wheelDirection === 'down' ? 'is-lit' : ''} />
              </div>
              <div className="comparison-note">
                <strong>Three ways to work</strong>
                <p>Pull an edge for freeform resizing, roll while dragging the title bar, or use the {activationMode} activator on the focused window.</p>
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
