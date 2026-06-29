import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Line as SvgLine, Rect, Polygon, G, Text as SvgText } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Radius, Shadow, PaletteType } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

type Point = { x: number; y: number };
type BrushType = 'pen' | 'marker' | 'highlighter' | 'spray' | 'eraser'
  | 'calligraphy' | 'watercolor' | 'pencil' | 'charcoal' | 'airbrush'
  | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'eyedropper' | 'select' | 'fill';

type WatercolorLayer = { points: Point[]; offset: Point; opacity: number };
type CharcoalLayer = { points: Point[]; offset: Point; opacity: number };

type Stroke = {
  points: Point[];
  color: string;
  width: number;
  brush: BrushType;
  layer?: string;
  shapeType?: 'rect' | 'circle' | 'line' | 'arrow';
  text?: string;
  fontSize?: number;
  sprayDots?: { x: number; y: number; r: number; o: number }[];
  watercolorData?: WatercolorLayer[];
  pencilData?: Point[];
  charcoalData?: CharcoalLayer[];
  airbrushData?: { x: number; y: number; r: number; o: number }[];
};

const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#ffffff',
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6',
  '#8B5CF6', '#EC4899', '#FCA5A5', '#FED7AA', '#FEF08A', '#BBF7D0',
  '#A5F3FC', '#BFDBFE', '#C4B5FD', '#F9A8D4', '#e6b8af', '#f4cccc',
];

const WIDTHS = [2, 4, 6, 10, 16, 24];

const BRUSH_TYPES: { key: BrushType; label: string; icon: string }[] = [
  { key: 'pen', label: 'Pen', icon: '✒️' },
  { key: 'calligraphy', label: 'Calligraphy', icon: '🖊️' },
  { key: 'watercolor', label: 'Watercolor', icon: '🎨' },
  { key: 'pencil', label: 'Pencil', icon: '✏️' },
  { key: 'charcoal', label: 'Charcoal', icon: '🖤' },
  { key: 'airbrush', label: 'Airbrush', icon: '💨' },
  { key: 'marker', label: 'Marker', icon: '🖍️' },
  { key: 'highlighter', label: 'Hi-Lite', icon: '🌟' },
  { key: 'spray', label: 'Spray', icon: '💦' },
  { key: 'eraser', label: 'Eraser', icon: '🧹' },
  { key: 'rectangle', label: 'Rect', icon: '⬜' },
  { key: 'circle', label: 'Circle', icon: '⭕' },
  { key: 'line', label: 'Line', icon: '📏' },
  { key: 'arrow', label: 'Arrow', icon: '➡️' },
  { key: 'text', label: 'Text', icon: '🔤' },
  { key: 'eyedropper', label: 'Pick', icon: '💉' },
  { key: 'select', label: 'Select', icon: '👆' },
  { key: 'fill', label: 'Fill', icon: '🪣' },
];

const screenW = Dimensions.get('window').width;
const MAX_W = 40;

const WS_URL = (() => {
  try { if (typeof window !== 'undefined' && window.location) return `ws://${window.location.hostname}:8080`; } catch {}
  return 'ws://localhost:8080';
})();

function toSvgPath(pts: Point[]) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const mx = (prev.x + pts[i].x) / 2;
    const my = (prev.y + pts[i].y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${mx} ${my}`;
  }
  return d;
}

function jitterPoints(pts: Point[], amount: number) {
  return pts.map(p => ({ x: p.x + (Math.random() - 0.5) * amount, y: p.y + (Math.random() - 0.5) * amount }));
}

function generateWatercolorData(pts: Point[], w: number): WatercolorLayer[] {
  const count = Math.min(5, Math.max(3, Math.floor(w / 2)));
  return Array.from({ length: count }, () => ({
    points: jitterPoints(pts, w * 0.3),
    offset: { x: (Math.random() - 0.5) * w * 0.6, y: (Math.random() - 0.5) * w * 0.6 },
    opacity: 0.12 + Math.random() * 0.08,
  }));
}

function generateCharcoalData(pts: Point[], w: number): CharcoalLayer[] {
  const count = Math.min(6, Math.max(3, Math.floor(w / 3)));
  return Array.from({ length: count }, () => ({
    points: jitterPoints(pts, w * 0.5),
    offset: { x: (Math.random() - 0.5) * w * 0.8, y: (Math.random() - 0.5) * w * 0.8 },
    opacity: 0.08 + Math.random() * 0.07,
  }));
}

function generateCalligraphyPath(pts: Point[], baseW: number): string {
  if (pts.length < 2) return '';
  const widths = pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return baseW * 0.3;
    return baseW * (0.2 + 0.8 * Math.abs(Math.sin(Math.atan2(p.y - pts[i - 1].y, p.x - pts[i - 1].x))));
  });
  const left: Point[] = [], right: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = i === 0 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x)
      : i === pts.length - 1 ? Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x)
      : Math.atan2(pts[i + 1].y - pts[i - 1].y, pts[i + 1].x - pts[i - 1].x);
    const p = a + Math.PI / 2, hw = widths[i] / 2;
    left.push({ x: pts[i].x + Math.cos(p) * hw, y: pts[i].y + Math.sin(p) * hw });
    right.push({ x: pts[i].x - Math.cos(p) * hw, y: pts[i].y - Math.sin(p) * hw });
  }
  let d = `M ${left[0].x} ${left[0].y}`;
  for (let i = 1; i < left.length; i++) d += ` L ${left[i].x} ${left[i].y}`;
  for (let i = right.length - 1; i >= 0; i--) d += ` L ${right[i].x} ${right[i].y}`;
  return d + ' Z';
}

function generateSprayDots(pts: Point[], w: number) {
  return Array.from({ length: pts.length * 8 }, () => {
    const pi = Math.floor(Math.random() * pts.length);
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * w * 3;
    const p = pts[pi];
    return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: Math.random() * 3 + 1, o: Math.random() * 0.6 + 0.2 };
  });
}

function generateAirbrushData(pts: Point[], w: number) {
  const dots: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const count = Math.round(12 * (i === 0 ? 1 : Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)));
    for (let j = 0; j < Math.min(count, 40); j++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.abs(gaussRandom()) * w * 2.5;
      dots.push({ x: pts[i].x + Math.cos(angle) * dist, y: pts[i].y + Math.sin(angle) * dist, r: Math.random() * 2.5 + 0.5, o: Math.random() * 0.15 + 0.05 });
    }
  }
  return dots;
}

function stringToColor(s: string) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

function gaussRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function hslToHex(h: number) {
  const s = 100, l = 50;
  const c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100);
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l / 100 - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const hx = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

const HUE_COLORS = Array.from({ length: 60 }, (_, i) => hslToHex(i * 6));

function getStrokeBounds(s: Stroke): { minX: number; minY: number; maxX: number; maxY: number } {
  let pts = s.points;
  if (s.airbrushData?.length) pts = s.airbrushData;
  if (s.sprayDots?.length) pts = s.sprayDots;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = s.width * 3;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function findStrokeAt(pt: Point, allStrokes: Stroke[]): number | null {
  let bestIdx: number | null = null;
  let bestDist = 20;
  for (let i = allStrokes.length - 1; i >= 0; i--) {
    const s = allStrokes[i];
    const b = getStrokeBounds(s);
    if (pt.x < b.minX || pt.x > b.maxX || pt.y < b.minY || pt.y > b.maxY) continue;
    let minD = Infinity;
    for (const p of s.points) {
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d < minD) minD = d;
    }
    if (s.airbrushData) for (const p of s.airbrushData) { const d = Math.hypot(pt.x - p.x, pt.y - p.y); if (d < minD) minD = d; }
    if (s.sprayDots) for (const p of s.sprayDots) { const d = Math.hypot(pt.x - p.x, pt.y - p.y); if (d < minD) minD = d; }
    if (minD < bestDist) { bestDist = minD; bestIdx = i; }
  }
  return bestIdx;
}

function findNearestStroke(pt: Point, allStrokes: Stroke[]): Stroke | null {
  const idx = findStrokeAt(pt, allStrokes);
  return idx !== null ? allStrokes[idx] : null;
}

async function doFloodFillWeb(pt: Point, allStrokes: Stroke[], w: number, h: number, fillColor: string): Promise<Stroke | null> {
  if (typeof document === 'undefined') return null;
  try {
    const svgEl = document.getElementById('canvas-svg') as unknown as SVGSVGElement;
    if (!svgEl) return null;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.width = w;
    img.height = h;
    return new Promise<Stroke | null>((resolve) => {
      img.onload = () => {
        URL.revokeObjectURL(url);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h);
        const data = id.data;
        const ix = Math.round(pt.x);
        const iy = Math.round(pt.y);
        const tgtIdx = (iy * w + ix) * 4;
        const tgtR = data[tgtIdx], tgtG = data[tgtIdx + 1], tgtB = data[tgtIdx + 2];
        if (Math.abs(tgtR - 255) < 5 && Math.abs(tgtG - 255) < 5 && Math.abs(tgtB - 255) < 5) { resolve(null); return; }
        const visited = new Uint8Array(w * h);
        const fillR = parseInt(fillColor.slice(1, 3), 16);
        const fillG = parseInt(fillColor.slice(3, 5), 16);
        const fillB = parseInt(fillColor.slice(5, 7), 16);
        const stack: number[] = [ix + iy * w];
        const boundary: Point[] = [];
        while (stack.length) {
          const idx2 = stack.pop()!;
          if (visited[idx2]) continue;
          visited[idx2] = 1;
          const px = idx2 % w, py = Math.floor(idx2 / w);
          const di = (py * w + px) * 4;
          const dr = Math.abs(data[di] - tgtR), dg = Math.abs(data[di + 1] - tgtG), db = Math.abs(data[di + 2] - tgtB);
          if (dr > 30 || dg > 30 || db > 30) { boundary.push({ x: px, y: py }); continue; }
          if (px > 0 && !visited[idx2 - 1]) stack.push(idx2 - 1);
          if (px < w - 1 && !visited[idx2 + 1]) stack.push(idx2 + 1);
          if (py > 0 && !visited[idx2 - w]) stack.push(idx2 - w);
          if (py < h - 1 && !visited[idx2 + w]) stack.push(idx2 + w);
        }
        if (boundary.length < 3) { resolve(null); return; }
        const cx = boundary.reduce((a, b) => a + b.x, 0) / boundary.length;
        const cy = boundary.reduce((a, b) => a + b.y, 0) / boundary.length;
        boundary.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
        let fillPts = boundary;
        if (fillPts.length > 500) {
          const step = Math.ceil(fillPts.length / 500);
          fillPts = fillPts.filter((_, i) => i % step === 0);
        }
        resolve({ points: fillPts, color: fillColor, width: 1, brush: 'pen' as BrushType, layer: 'default' });
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    }) as unknown as Stroke | null;
  } catch { return null; }
}

function renderShapeStroke(s: Stroke, i: number) {
  const sc = s.color;
  const [p1, p2] = [s.points[0], s.points[s.points.length - 1]];
  const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y);
  const sw = Math.abs(p2.x - p1.x), sh = Math.abs(p2.y - p1.y);
  switch (s.shapeType) {
    case 'rect':
      return <Rect key={i} x={x} y={y} width={sw} height={sh} stroke={sc} strokeWidth={s.width} fill="none" />;
    case 'circle': {
      const cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2;
      const r = Math.hypot(sw, sh) / 2;
      return <Circle key={i} cx={cx} cy={cy} r={r} stroke={sc} strokeWidth={s.width} fill="none" />;
    }
    case 'line':
      return <SvgLine key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={sc} strokeWidth={s.width} />;
    case 'arrow': {
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return null;
      const nx = dx / len, ny = dy / len;
      const headLen = Math.min(20, s.width * 4);
      const ax = p2.x - nx * headLen, ay = p2.y - ny * headLen;
      const hx1 = ax - ny * headLen * 0.4, hy1 = ay + nx * headLen * 0.4;
      const hx2 = ax + ny * headLen * 0.4, hy2 = ay - nx * headLen * 0.4;
      return (
        <G key={i}>
          <SvgLine x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={sc} strokeWidth={s.width} />
          <Polygon points={`${p2.x},${p2.y} ${hx1},${hy1} ${hx2},${hy2}`} fill={sc} />
        </G>
      );
    }
    default:
      return null;
  }
}

export default function CanvasScreen() {
  const { P, isDark, toggleDark } = useTheme();
  const { id, room: roomParam } = useLocalSearchParams<{ id?: string; room?: string }>();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(4);
  const [brush, setBrush] = useState<BrushType>('pen');
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  canvasSizeRef.current = canvasSize;
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [traceImage, setTraceImage] = useState<string | null>(null);
  const [traceOpacity, setTraceOpacity] = useState(0.3);
  const [drawingId, setDrawingId] = useState<string | null>(id || null);
  const [title, setTitle] = useState('Untitled');
  const [room, setRoom] = useState(roomParam || (id ? '' : Math.random().toString(36).slice(2, 7).toUpperCase()));
  const [docSize, setDocSize] = useState({ w: 1200, h: 800 });
  const [showSizePicker, setShowSizePicker] = useState(!id);
  const [sizePreset, setSizePreset] = useState('landscape');
  const svgRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string; time: number }[]>([]);
  const chatInputRef = useRef<TextInput>(null);
  const chatAnim = useRef(new Animated.Value(0)).current;
  const [replaying, setReplaying] = useState(false);
  const [replayIdx, setReplayIdx] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const replayIdxRef = useRef(0);
  const [panning, setPanning] = useState(false);
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const panningRef = useRef(false);

  const [layers, setLayers] = useState<{ id: string; name: string; visible: boolean }[]>([{ id: 'default', name: 'Layer 1', visible: true }]);
  const [activeLayer, setActiveLayer] = useState('default');
  const [showLayers, setShowLayers] = useState(false);
  const [showBrushMenu, setShowBrushMenu] = useState(false);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [textModal, setTextModal] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textFontSize, setTextFontSize] = useState(24);
  const textPos = useRef({ x: 0, y: 0 });
  const shapeStart = useRef<Point | null>(null);
  const shapeEndRef = useRef<Point | null>(null);
  const [shapePreview, setShapePreview] = useState<{ start: Point; end: Point } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragOrigPoints = useRef<Point[]>([]);
  const fitDone = useRef(false);
  const sliderTrackWidth = useRef(100);
  const canvasRef = useRef<any>(null);
  const sliderPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const loc = e.nativeEvent.locationX;
      setWidth(Math.round(1 + (loc / Math.max(sliderTrackWidth.current, 1)) * (MAX_W - 1)));
    },
    onPanResponderMove: (e) => {
      const loc = e.nativeEvent.locationX;
      setWidth(Math.max(1, Math.min(MAX_W, Math.round(1 + (loc / Math.max(sliderTrackWidth.current, 1)) * (MAX_W - 1)))));
    },
  })).current;

  const connectWs = useCallback((r: string) => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => { ws.send(JSON.stringify({ type: 'join', room: r })); setConnected(true); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'stroke') setStrokes((prev) => [...prev, msg.stroke]);
        if (msg.type === 'chat') setChatMessages((prev) => [...prev, { from: msg.from || 'Anonymous', text: msg.text, time: msg.time || Date.now() }]);
      } catch {}
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
  }, []);

  const changeRoom = () => {
    if (Platform.OS === 'web') {
      const r = window.prompt('Room name:', room);
      if (r && r.trim()) setRoom(r.trim().toUpperCase());
    } else {
      Alert.prompt?.('Room', 'Enter a room name to join', (r) => { if (r?.trim()) setRoom(r.trim().toUpperCase()); }, 'plain-text', room);
    }
  };

  const userRef = useRef('');
  useEffect(() => { getToken().then(async () => { const u = await import('@/lib/auth').then(m => m.getUser()); if (u) userRef.current = u.email; }); }, []);

  const sendChat = useCallback(() => {
    const text = chatMsg.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'chat', text, from: userRef.current || 'Anonymous', time: Date.now() }));
    setChatMsg('');
  }, [chatMsg]);

  const startReplay = useCallback(() => {
    if (strokes.length === 0) return;
    setReplaying(true);
    if (replayIdx >= strokes.length) { setReplayIdx(0); replayIdxRef.current = 0; }
    if (replayTimer.current) clearInterval(replayTimer.current);
    replayTimer.current = setInterval(() => {
      const next = replayIdxRef.current + 1;
      replayIdxRef.current = next;
      setReplayIdx(next);
      if (next >= strokes.length && replayTimer.current) {
        clearInterval(replayTimer.current);
        replayTimer.current = null;
      }
    }, 400 / replaySpeed);
  }, [strokes.length, replaySpeed, replayIdx]);

  const stopReplay = useCallback(() => {
    setReplaying(false);
    if (replayTimer.current) { clearInterval(replayTimer.current); replayTimer.current = null; }
  }, []);

  const toggleReplay = useCallback(() => {
    if (replaying) { stopReplay(); }
    else if (replayIdx >= strokes.length) { setReplayIdx(0); replayIdxRef.current = 0; setTimeout(() => startReplay(), 50); }
    else { startReplay(); }
  }, [replaying, replayIdx, strokes.length, startReplay, stopReplay]);

  useEffect(() => {
    connectWs(room);
    return () => { if (wsRef.current) wsRef.current.close(); if (replayTimer.current) clearInterval(replayTimer.current); };
  }, [room, connectWs]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const el = document.getElementById('canvas-wrap');
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setScale((s) => Math.max(0.25, Math.min(4, s + -e.deltaY * 0.01)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (canvasSize.w > 0 && canvasSize.h > 0 && docSize.w > 0 && docSize.h > 0 && !fitDone.current) {
      fitDone.current = true;
      setPanOffset({ x: (canvasSize.w - docSize.w) / 2, y: (canvasSize.h - docSize.h) / 2 });
    }
  }, [canvasSize, docSize]);

  panningRef.current = panning;
  panOffsetRef.current = panOffset;
  scaleRef.current = scale;
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  const brushRef = useRef(brush);
  colorRef.current = color;
  widthRef.current = width;
  brushRef.current = brush;

  useEffect(() => {
    if (!id) return;
    (async () => {
      const token = await getToken();
      if (!token) return router.replace('/login');
      try {
        const drawing = await api.getDrawing(token, id);
        if (drawing.strokes?.length) setStrokes(drawing.strokes);
        if (drawing.title) setTitle(drawing.title);
        if (drawing.docSize) setDocSize(drawing.docSize);
        setRoom(drawing.room || Math.random().toString(36).slice(2, 7).toUpperCase());
        setShowSizePicker(false);
      } catch {}
    })();
  }, [id]);

  const sendStroke = useCallback((stroke: Stroke) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stroke', stroke }));
    }
  }, []);

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [...r, strokes]);
    setHistory((h) => h.slice(0, -1));
    setStrokes(prev);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((h) => [...h, strokes]);
    setRedoStack((r) => r.slice(0, -1));
    setStrokes(next);
  };

  const addStroke = useCallback((newStroke: Stroke) => {
    setStrokes((prev) => {
      setHistory((h) => [...h, prev]);
      return [...prev, newStroke];
    });
    setRedoStack([]);
    sendStroke(newStroke);
  }, [sendStroke]);

  const finishStroke = useCallback((pts: Point[]) => {
    if (pts.length < 2) return;
    const b = brushRef.current, c = colorRef.current, w = widthRef.current;
    const stroke: Stroke = { points: pts, color: c, width: w, brush: b };
    switch (b) {
      case 'spray': stroke.sprayDots = generateSprayDots(pts, w); break;
      case 'watercolor': stroke.watercolorData = generateWatercolorData(pts, w); break;
      case 'pencil': stroke.pencilData = jitterPoints(pts, 0.8); break;
      case 'charcoal': stroke.charcoalData = generateCharcoalData(pts, w); break;
      case 'airbrush': stroke.airbrushData = generateAirbrushData(pts, w); break;
    }
    addStroke(stroke);
  }, [addStroke]);

  const pointsRef = useRef<Point[]>([]);
  const MIN_DIST = 3;

  const getPoint = (e: any): Point => {
    const { x: ox, y: oy } = panOffsetRef.current;
    const s = scaleRef.current;
    if (Platform.OS === 'web') {
      const el = canvasRef.current;
      if (el && typeof el.getBoundingClientRect === 'function') {
        const r = el.getBoundingClientRect();
        const px = typeof e.nativeEvent.pageX === 'number' ? e.nativeEvent.pageX : e.nativeEvent.locationX;
        const py = typeof e.nativeEvent.pageY === 'number' ? e.nativeEvent.pageY : e.nativeEvent.locationY;
        const sx = window.scrollX || 0, sy = window.scrollY || 0;
        return { x: ((px - sx) - r.left - ox) / s, y: ((py - sy) - r.top - oy) / s };
      }
    }
    return { x: (e.nativeEvent.locationX - ox) / s, y: (e.nativeEvent.locationY - oy) / s };
  };

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, gs) => {
        if (panningRef.current) {
          panStart.current = { x: gs.x0, y: gs.y0 };
          panOffsetStart.current = { ...panOffsetRef.current };
          return;
        }
        const pt = getPoint(e);
        const b = brush;

        if (b === 'text') {
          textPos.current = pt;
          setTextModal(true);
          return;
        }
        if (b === 'eyedropper') {
          const nearest = findNearestStroke(pt, strokes);
          if (nearest) setColor(nearest.color);
          return;
        }
        if (b === 'fill') {
          doFloodFill(pt);
          return;
        }
        if (b === 'select') {
          const idx = findStrokeAt(pt, strokes);
          setSelectedId(idx);
          if (idx !== null) {
            dragOffset.current = { x: pt.x - strokes[idx].points[0].x, y: pt.y - strokes[idx].points[0].y };
            dragOrigPoints.current = strokes[idx].points.map(p => ({ ...p }));
          }
          return;
        }
        if (['rectangle', 'circle', 'line', 'arrow'].includes(b)) {
          shapeStart.current = pt;
          shapeEndRef.current = pt;
          setShapePreview({ start: pt, end: pt });
          return;
        }
        pointsRef.current = [pt];
        setCurrentPoints([pt]);
      },
      onPanResponderMove: (e, gs) => {
        if (panningRef.current) {
          setPanOffset({ x: panOffsetStart.current.x + gs.dx, y: panOffsetStart.current.y + gs.dy });
          return;
        }
        const pt = getPoint(e);
        const b = brush;

        if (['rectangle', 'circle', 'line', 'arrow'].includes(b)) {
          const ep = { x: Math.max(0, Math.min(canvasSize.w, pt.x)), y: Math.max(0, Math.min(canvasSize.h, pt.y)) };
          shapeEndRef.current = ep;
          setShapePreview({ start: shapeStart.current!, end: ep });
          setCurrentPoints([shapeStart.current!, ep]);
          return;
        }
        if (b === 'select' && selectedId !== null) {
          const dx = pt.x - strokes[selectedId].points[0].x - dragOffset.current.x;
          const dy = pt.y - strokes[selectedId].points[0].y - dragOffset.current.y;
          const moved = dragOrigPoints.current.map(p => ({ x: p.x + dx, y: p.y + dy }));
          setStrokes((prev) => {
            const copy = [...prev];
            copy[selectedId] = { ...copy[selectedId], points: moved };
            return copy;
          });
          return;
        }
        const prev = pointsRef.current[pointsRef.current.length - 1];
        if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < MIN_DIST) return;
        pointsRef.current.push(pt);
        setCurrentPoints([...pointsRef.current]);
      },
      onPanResponderRelease: () => {
        if (panningRef.current) return;
        const b = brush;
        if (['rectangle', 'circle', 'line', 'arrow'].includes(b) && shapeStart.current && shapeEndRef.current) {
          const start = shapeStart.current;
          const end = shapeEndRef.current;
          if (Math.hypot(end.x - start.x, end.y - start.y) > 3) {
            const sp = brushRef.current === 'arrow' ? end : start;
            const ep = brushRef.current === 'arrow' ? end : start;
            const stroke: Stroke = {
              points: [start, end],
              color: colorRef.current,
              width: widthRef.current,
              brush: brushRef.current,
              layer: activeLayer,
              shapeType: b as 'rect' | 'circle' | 'line' | 'arrow',
            };
            addStroke(stroke);
          }
          shapeStart.current = null;
          shapeEndRef.current = null;
          setShapePreview(null);
          setCurrentPoints([]);
          return;
        }
        if (b === 'select') {
          dragOrigPoints.current = [];
          return;
        }
        const pts = pointsRef.current;
        pointsRef.current = [];
        if (pts.length < 2) return;
        finishStroke(pts);
        setCurrentPoints([]);
      },
    }), [finishStroke, strokes, brush, selectedId, activeLayer, docSize]);

  const doFloodFill = async (pt: Point) => {
    if (Platform.OS !== 'web') { Alert.alert('Fill', 'Only available on web'); return; }
    const result = doFloodFillWeb(pt, strokes, docSize.w, docSize.h, color);
    if (result instanceof Promise) {
      const stroke = await result;
      if (stroke) addStroke(stroke);
    } else if (result) {
      addStroke(result);
    }
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled) setTraceImage(result.assets[0].uri);
    } catch {}
  };

  const clearAll = () => {
    setHistory((h) => [...h, strokes]);
    setStrokes([]);
    setRedoStack([]);
  };

  const captureThumbnail = useCallback((): string | null => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
    try {
      const svgEl = document.getElementById('canvas-svg');
      if (!svgEl) return null;
      const svgData = new XMLSerializer().serializeToString(svgEl);
      return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch { return null; }
  }, []);

  const [showExport, setShowExport] = useState(false);

  const doExport = (fmt: 'png' | 'jpeg') => {
    setShowExport(false);
    if (Platform.OS !== 'web' || typeof document === 'undefined') { Alert.alert('Export', 'Only supported on web'); return; }
    try {
      const s = new XMLSerializer();
      const svgEl = document.querySelector('svg[id="canvas-svg"]') || document.getElementById('canvas-svg');
      if (!svgEl) { Alert.alert('SVG element not found'); return; }
      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const rect = svgEl.getBoundingClientRect();
      const w = Math.round(rect.width) || 800;
      const h = Math.round(rect.height) || 600;
      clone.setAttribute('width', String(w));
      clone.setAttribute('height', String(h));
      clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const svgString = s.serializeToString(clone);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        if (fmt === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        const a = document.createElement('a');
        a.href = c.toDataURL(fmt === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92);
        a.download = `${title || 'drawing'}.${fmt}`;
        a.click();
      };
      img.onerror = () => { URL.revokeObjectURL(url); Alert.alert('Export failed', 'Could not render the image'); };
      img.src = url;
    } catch (e: any) { Alert.alert('Export error', e?.message || 'Unknown error'); }
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return router.replace('/login');
      const thumbnail = captureThumbnail();
      const result = await api.saveDrawing(token, { title, strokes, thumbnail, room, docSize }, drawingId || undefined);
      if (!drawingId) setDrawingId(result.id);
    } catch (e: any) { Alert.alert('Save failed', e.message); }
    finally { setSaving(false); }
  }, [strokes, drawingId, title, captureThumbnail, room]);

  const saveRef = useRef(save);
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  saveRef.current = save;
  undoRef.current = undo;
  redoRef.current = redo;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveRef.current(); }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.shiftKey ? redoRef.current() : undoRef.current(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId !== null) {
        setHistory((h) => [...h, strokes]);
        setStrokes((prev) => prev.filter((_, i) => i !== selectedId));
        setSelectedId(null);
        setRedoStack([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const renderStroke = (stroke: Stroke, i: number) => {
    const layerVisible = layers.find(l => l.id === stroke.layer)?.visible ?? true;
    if (!layerVisible) return null;
    const isSelected = selectedId === i;
    const sc = stroke.brush === 'eraser' ? '#FFFFFF' : stroke.color;
    if (['rect', 'circle', 'line', 'arrow'].includes(stroke.shapeType || '')) {
      return renderShapeStroke(stroke, i);
    }
    if (stroke.text) {
      return (
        <SvgText key={i} x={stroke.points[0]?.x ?? 0} y={stroke.points[0]?.y ?? 0} fill={sc} fontSize={stroke.fontSize || 24}>
          {stroke.text}
        </SvgText>
      );
    }
    switch (stroke.brush) {
      case 'calligraphy':
        return <Path key={i} d={generateCalligraphyPath(stroke.points, stroke.width)} fill={sc} opacity={0.9} />;
      case 'spray':
        return stroke.sprayDots?.map((d, j) => <Circle key={`${i}-${j}`} cx={d.x} cy={d.y} r={d.r} fill={sc} opacity={d.o} />);
      case 'watercolor':
        return stroke.watercolorData?.map((l, li) => (
          <Path key={`${i}-${li}`} d={toSvgPath(l.points.map(p => ({ x: p.x + l.offset.x, y: p.y + l.offset.y })))} stroke={sc} strokeWidth={stroke.width * 1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={l.opacity} />
        ));
      case 'pencil':
        return stroke.pencilData ? <Path d={toSvgPath(stroke.pencilData)} stroke={sc} strokeWidth={stroke.width} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} /> : null;
      case 'charcoal':
        return stroke.charcoalData?.map((l, li) => (
          <Path key={`${i}-${li}`} d={toSvgPath(l.points.map(p => ({ x: p.x + l.offset.x, y: p.y + l.offset.y })))} stroke={sc} strokeWidth={stroke.width * 1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={l.opacity} />
        ));
      case 'airbrush':
        return stroke.airbrushData?.map((d, j) => <Circle key={`${i}-${j}`} cx={d.x} cy={d.y} r={d.r} fill={sc} opacity={d.o} />);
      default: {
        const sw = stroke.brush === 'highlighter' || stroke.brush === 'eraser' ? stroke.width * 3 : stroke.brush === 'marker' ? stroke.width * 1.5 : stroke.width;
        return <Path key={i} d={toSvgPath(stroke.points)} stroke={sc} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={stroke.brush === 'highlighter' ? 0.3 : stroke.brush === 'marker' ? 0.5 : 1} />;
      }
    }
  };

  const replayStrokes = useMemo(() => strokes.slice(0, replayIdx), [strokes, replayIdx]);
  const completedSvg = useMemo(() => (replaying ? replayStrokes : strokes).map((s, i) => renderStroke(s, i)), [replaying, replayStrokes, strokes]);

  const renderCurrent = () => {
    if (shapePreview) {
      const { start, end } = shapePreview;
      const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y);
      const sw = Math.abs(end.x - start.x), sh = Math.abs(end.y - start.y);
      const c = brush === 'eraser' ? '#FFFFFF' : color;
      switch (brush) {
        case 'rectangle': return <Rect x={x} y={y} width={sw} height={sh} stroke={c} strokeWidth={width} fill="none" strokeDasharray="6,3" />;
        case 'circle': {
          const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
          const r = Math.hypot(sw, sh) / 2;
          return <Circle cx={cx} cy={cy} r={r} stroke={c} strokeWidth={width} fill="none" strokeDasharray="6,3" />;
        }
        case 'line': return <SvgLine x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={c} strokeWidth={width} strokeDasharray="6,3" />;
        case 'arrow': {
          const dx = end.x - start.x, dy = end.y - start.y;
          const len = Math.hypot(dx, dy);
          if (len > 1) {
            const nx = dx / len, ny = dy / len;
            const hl = Math.min(20, width * 4);
            const ax = end.x - nx * hl, ay = end.y - ny * hl;
            return (
              <>
                <SvgLine x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={c} strokeWidth={width} strokeDasharray="6,3" />
                <Polygon points={`${end.x},${end.y} ${ax - ny * hl * 0.4},${ay + nx * hl * 0.4} ${ax + ny * hl * 0.4},${ay - nx * hl * 0.4}`} fill={c} />
              </>
            );
          }
          return null;
        }
        default: return null;
      }
    }
    if (currentPoints.length < 2) return null;
    const b = brush, c = b === 'eraser' ? '#FFFFFF' : color, w = width;
    switch (b) {
      case 'calligraphy': return <Path d={generateCalligraphyPath(currentPoints, w)} fill={c} opacity={0.9} />;
      case 'spray': return generateSprayDots(currentPoints, w).map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={c} opacity={0.6} />);
      case 'watercolor': return <Path d={toSvgPath(currentPoints)} stroke={c} strokeWidth={w * 2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.25} />;
      case 'pencil': return <Path d={toSvgPath(jitterPoints(currentPoints, 0.8))} stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />;
      case 'charcoal': return <Path d={toSvgPath(jitterPoints(currentPoints, w * 0.3))} stroke={c} strokeWidth={w * 1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.2} />;
      case 'airbrush': return generateAirbrushData(currentPoints, w).map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={c} opacity={d.o} />);
      default: {
        const sw = b === 'highlighter' || b === 'eraser' ? w * 3 : b === 'marker' ? w * 1.5 : w;
        return <Path d={toSvgPath(currentPoints)} stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={b === 'highlighter' ? 0.3 : b === 'marker' ? 0.5 : 1} />;
      }
    }
  };

  const styles = useMemo(() => makeStyles(P), [P]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.hBtn}><Text style={styles.hBack}>←</Text></Pressable>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Untitled"
            placeholderTextColor={P.textMuted}
            selectTextOnFocus
          />
          <Pressable onPress={changeRoom} style={styles.roomBadge}>
            <Text style={styles.roomBadgeText}>{room}</Text>
          </Pressable>
          <View style={[styles.wsDot, connected ? styles.wsOn : styles.wsOff]} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerActions} contentContainerStyle={styles.headerActionsContent}>
            <Pressable onPress={save} disabled={saving} style={styles.saveBtn}>
              <Text style={styles.saveText}>{saving ? '...' : 'Save'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowExport(true)} style={styles.hBtnSm}><Text style={styles.hIconSm}>⬇</Text></Pressable>
            <Pressable onPress={toggleReplay} style={styles.hBtnSm}><Text style={[styles.hIconSm, strokes.length === 0 && styles.hDisabled]}>{replaying ? '⏹' : '▶'}</Text></Pressable>
            <Pressable onPress={() => { setPanning((p) => !p); }} style={[styles.hBtnSm, panning && { backgroundColor: P.purple + '30', borderRadius: 6 }]}><Text style={styles.hIconSm}>✋</Text></Pressable>
            <Pressable onPress={() => { setScale((s) => Math.min(4, s + 0.25)); }} style={styles.hBtnSm}><Text style={[styles.hIconSm, { fontSize: 11 }]}>🔍+</Text></Pressable>
            <Pressable onPress={() => { setScale((s) => Math.max(0.25, s - 0.25)); }} style={styles.hBtnSm}><Text style={[styles.hIconSm, { fontSize: 11 }]}>🔍−</Text></Pressable>
            {scale !== 1 && <Pressable onPress={() => { setScale(1); setPanOffset({ x: 0, y: 0 }); }} style={styles.hBtnSm}><Text style={[styles.hIconSm, { fontSize: 9, color: P.textMuted }]}>RST</Text></Pressable>}
            <Pressable onPress={undo} style={styles.hBtnSm}><Text style={[styles.hIconSm, history.length === 0 && styles.hDisabled]}>↩</Text></Pressable>
            <Pressable onPress={redo} style={styles.hBtnSm}><Text style={[styles.hIconSm, redoStack.length === 0 && styles.hDisabled]}>↪</Text></Pressable>
            <Pressable onPress={pickImage} style={styles.hBtnSm}><Text style={styles.hIconSm}>🖼</Text></Pressable>
            {traceImage && <Pressable onPress={() => setTraceImage(null)} style={styles.hBtnSm}><Text style={[styles.hIconSm, { color: '#EF4444' }]}>✕</Text></Pressable>}
            <Pressable onPress={clearAll} style={styles.hBtnSm}><Text style={[styles.hIconSm, { color: '#EF4444' }]}>🗑</Text></Pressable>
            <Pressable onPress={() => { setChatOpen(!chatOpen); Animated.timing(chatAnim, { toValue: chatOpen ? 0 : 1, duration: 250, useNativeDriver: false }).start(); }} style={[styles.hBtnSm, chatOpen && { backgroundColor: P.purple + '30', borderRadius: 6 }]}><Text style={styles.hIconSm}>💬</Text></Pressable>
            <Pressable onPress={() => setShowLayers(true)} style={styles.hBtnSm}><Text style={styles.hIconSm}>📑</Text></Pressable>
            <Pressable onPress={toggleDark} style={styles.hBtnSm}><Text style={styles.hIconSm}>{isDark ? '☀️' : '🌙'}</Text></Pressable>
          </ScrollView>
        </View>

        {replaying && (
          <View style={styles.replayBar}>
            <View style={styles.replayTrack}>
              <View style={[styles.replayFill, { width: `${(replayIdx / Math.max(strokes.length, 1)) * 100}%` }]} />
            </View>
            <Text style={styles.replayLabel}>{replayIdx}/{strokes.length}</Text>
            <Pressable onPress={toggleReplay} style={styles.hBtnSm}><Text style={styles.hIconSm}>{replaying ? '⏸' : '▶'}</Text></Pressable>
            <Pressable onPress={() => { setReplaySpeed((s) => (s >= 4 ? 0.5 : s * 2)); }} style={styles.replaySpeedBtn}><Text style={styles.replaySpeedText}>{replaySpeed}x</Text></Pressable>
          </View>
        )}

        {traceImage && (
          <View style={styles.traceBar}>
            <Text style={styles.traceLabel}>Trace</Text>
            <View style={styles.traceSlider}>
              {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((o) => (
                <Pressable key={o} style={[styles.traceSeg, traceOpacity === o && styles.traceSegActive]} onPress={() => setTraceOpacity(o)}>
                  <View style={[styles.traceSegFill, { opacity: o, backgroundColor: '#333' }]} />
                </Pressable>
              ))}
            </View>
            <Text style={styles.tracePct}>{Math.round(traceOpacity * 100)}%</Text>
          </View>
        )}

        <View style={styles.canvasWrap} id="canvas-wrap" onLayout={(e) => setCanvasSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <View ref={canvasRef} style={styles.canvas} {...panResponder.panHandlers}>
            <View style={[StyleSheet.absoluteFill, { transform: [{ translateX: panOffset.x }, { translateY: panOffset.y }, { scale }] }]}>
            {traceImage && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Image source={{ uri: traceImage }} style={{ width: docSize.w, height: docSize.h, opacity: traceOpacity }} resizeMode="contain" />
              </View>
            )}
            <Svg ref={svgRef} width={docSize.w} height={docSize.h} viewBox={`0 0 ${docSize.w} ${docSize.h}`} id="canvas-svg">
              {completedSvg}
              {renderCurrent()}
              {selectedId !== null && strokes[selectedId] && (() => {
                const b = getStrokeBounds(strokes[selectedId]);
                return (
                  <>
                    <Rect x={b.minX} y={b.minY} width={b.maxX - b.minX} height={b.maxY - b.minY} stroke={P.purple} strokeWidth={1.5} fill="none" strokeDasharray="5,3" />
                    {[
                      { x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY },
                      { x: b.minX, y: b.maxY }, { x: b.maxX, y: b.maxY },
                    ].map((h, hi) => (
                      <Rect key={hi} x={h.x - 4} y={h.y - 4} width={8} height={8} fill="#fff" stroke={P.purple} strokeWidth={1.5} rx={2} />
                    ))}
                  </>
                );
              })()}
            </Svg>
            </View>
          </View>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.toolModeRow}>
            <Pressable style={[styles.toolModeBtn, styles.toolModeBrush, !['rectangle','circle','line','arrow','text','eyedropper','select','fill','eraser'].includes(brush) && styles.toolModeActive]} onPress={() => setShowBrushMenu(true)}>
              <Text style={styles.toolModeLabel}>Brush</Text>
              <Text style={styles.toolModeArrow}>▼</Text>
            </Pressable>
            <Pressable style={[styles.toolModeBtn, styles.toolModeShape, ['rectangle','circle','line','arrow'].includes(brush) && styles.toolModeActive]} onPress={() => setShowShapeMenu(true)}>
              <Text style={styles.toolModeLabel}>Shape</Text>
              <Text style={styles.toolModeArrow}>▼</Text>
            </Pressable>
            <View style={styles.toolMiniRow}>
              {[
                { key: 'eraser', icon: '🧹' },
                { key: 'text', icon: '🔤' },
                { key: 'eyedropper', icon: '💉' },
                { key: 'select', icon: '👆' },
                { key: 'fill', icon: '🪣' },
              ].map((t) => (
                <Pressable key={t.key} style={[styles.toolMiniBtn, brush === t.key && styles.toolMiniActive]} onPress={() => setBrush(t.key as BrushType)}>
                  <Text style={styles.toolMiniIcon}>{t.icon}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorContent}>
            {COLORS.map((c) => (
              <Pressable key={c} style={[styles.colorBtn, { backgroundColor: c }, color === c && styles.colorSelected, c === '#ffffff' && styles.colorWhite]} onPress={() => setColor(c)} />
            ))}
          </ScrollView>

          <View style={styles.bottomRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hueContent}>
              {HUE_COLORS.map((hc, i) => (
                <Pressable key={i} style={[styles.hueSeg, { backgroundColor: hc }]} onPress={() => setColor(hc)} />
              ))}
            </ScrollView>
            <View style={styles.widthRow}>
              <Text style={styles.widthLabel}>{width}px</Text>
              <View style={styles.sliderTrack}
                onLayout={(e) => { sliderTrackWidth.current = e.nativeEvent.layout.width; }}
                {...sliderPanResponder.panHandlers}
              >
                <View style={[styles.sliderFill, { width: `${((width - 1) / (MAX_W - 1)) * 100}%` }]} />
                <View style={[styles.sliderThumb, { left: `${((width - 1) / (MAX_W - 1)) * 100}%`, width: Math.min(20, 4 + width * 0.8), height: Math.min(20, 4 + width * 0.8), borderRadius: Math.min(10, 2 + width * 0.4) }]} />
              </View>
            </View>
          </View>
        </View>

        <Animated.View style={[styles.chatPanel, { height: chatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 240] }) }]}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatHeaderText}>Room Chat</Text>
            <Text style={styles.chatHeaderCount}>{chatMessages.length} msg</Text>
          </View>
          <ScrollView style={styles.chatList} ref={(ref) => { if (ref) { const sc = ref; setTimeout(() => sc?.scrollToEnd({ animated: false }), 100); }}}>
            {chatMessages.length === 0 && (
              <View style={styles.chatEmptyWrap}>
                <Text style={styles.chatEmptyIcon}>💬</Text>
                <Text style={styles.chatEmpty}>No messages yet</Text>
              </View>
            )}
              {chatMessages.map((m, i) => (
                <View key={i} style={m.from === userRef.current ? styles.chatRowOwn : styles.chatRowOther}>
                  <View style={[styles.chatBubble, m.from === userRef.current ? styles.chatBubbleOwn : styles.chatBubbleOther]}>
                    <View style={styles.chatBubbleHeader}>
                      <Text style={styles.chatFrom}>{m.from === userRef.current ? 'You' : m.from.split('@')[0]}</Text>
                      <Text style={styles.chatTime}>{new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <Text style={styles.chatText}>{m.text}</Text>
                  </View>
                </View>
              ))}
          </ScrollView>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.chatInputRow}>
              <TextInput
                ref={chatInputRef}
                style={styles.chatInput}
                value={chatMsg}
                onChangeText={setChatMsg}
                placeholder="Type a message..."
                placeholderTextColor={P.textMuted}
                onSubmitEditing={sendChat}
                returnKeyType="send"
              />
              <Pressable style={styles.chatSendBtn} onPress={sendChat}>
                <Text style={styles.chatSendText}>→</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>

        <Modal visible={showExport} transparent animationType="fade" onRequestClose={() => setShowExport(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Export Drawing</Text>
              <Text style={styles.modalSub}>Choose a format</Text>
              <Pressable style={styles.modalBtn} onPress={() => doExport('png')}>
                <Text style={styles.modalBtnLabel}>PNG</Text>
                <Text style={styles.modalBtnHint}>Lossless, supports transparency</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: P.offWhite }]} onPress={() => doExport('jpeg')}>
                <Text style={[styles.modalBtnLabel, { color: P.textPrimary }]}>JPEG</Text>
                <Text style={styles.modalBtnHint}>Smaller file size</Text>
              </Pressable>
              <Pressable style={styles.modalCancel} onPress={() => setShowExport(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={textModal} transparent animationType="fade" onRequestClose={() => setTextModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Add Text</Text>
              <TextInput
                style={styles.textModalInput}
                value={textContent}
                onChangeText={setTextContent}
                placeholder="Type something..."
                placeholderTextColor={P.textMuted}
                autoFocus
                multiline
              />
              <View style={styles.textModalSizeRow}>
                {[16, 20, 24, 32, 48, 64].map((s) => (
                  <Pressable key={s} onPress={() => setTextFontSize(s)} style={[styles.textModalSizeBtn, textFontSize === s && styles.textModalSizeActive]}>
                    <Text style={[styles.textModalSizeText, { fontSize: Math.min(s, 24) }]}>A</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.textModalActions}>
                <Pressable style={[styles.modalBtn, { flex: 1 }]} onPress={() => {
                  if (textContent.trim()) {
                    addStroke({ points: [textPos.current], color, width: 1, brush: 'text', layer: activeLayer, text: textContent.trim(), fontSize: textFontSize });
                  }
                  setTextContent(''); setTextModal(false);
                }}>
                  <Text style={styles.modalBtnLabel}>Add</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { flex: 1, backgroundColor: P.offWhite }]} onPress={() => { setTextContent(''); setTextModal(false); }}>
                  <Text style={[styles.modalBtnLabel, { color: P.textPrimary }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showSizePicker} transparent animationType="fade" onRequestClose={() => { if (drawingId) setShowSizePicker(false); }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Canvas Size</Text>
              <Text style={styles.modalSub}>Choose your canvas dimensions</Text>
              <View style={styles.sizePresetRow}>
                {[
                  { key: 'square', label: 'Square', w: 800, h: 800 },
                  { key: 'landscape', label: 'Landscape', w: 1200, h: 800 },
                  { key: 'portrait', label: 'Portrait', w: 800, h: 1200 },
                  { key: 'a4', label: 'A4', w: 1123, h: 794 },
                  { key: 'wide', label: 'Wide', w: 1600, h: 900 },
                ].map((p) => (
                  <Pressable key={p.key} style={[styles.sizePreset, sizePreset === p.key && styles.sizePresetActive]} onPress={() => { setSizePreset(p.key); setDocSize({ w: p.w, h: p.h }); }}>
                    <View style={[styles.sizePresetIcon, { aspectRatio: p.w / p.h }]} />
                    <Text style={[styles.sizePresetLabel, sizePreset === p.key && styles.sizePresetLabelActive]}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.sizeCustomRow}>
                <TextInput style={styles.sizeInput} value={String(docSize.w)} onChangeText={(t) => { const v = parseInt(t) || 400; setDocSize((s) => ({ ...s, w: Math.max(200, Math.min(4000, v)) })); }} keyboardType="number-pad" selectTextOnFocus />
                <Text style={styles.sizeInputX}>×</Text>
                <TextInput style={styles.sizeInput} value={String(docSize.h)} onChangeText={(t) => { const v = parseInt(t) || 400; setDocSize((s) => ({ ...s, h: Math.max(200, Math.min(4000, v)) })); }} keyboardType="number-pad" selectTextOnFocus />
                <Text style={styles.sizeInputPx}>px</Text>
              </View>
              <Pressable style={styles.modalBtn} onPress={() => { fitDone.current = false; setShowSizePicker(false); }}>
                <Text style={styles.modalBtnLabel}>Start Drawing</Text>
              </Pressable>
              {drawingId && (
                <Pressable style={styles.modalCancel} onPress={() => setShowSizePicker(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={showLayers} transparent animationType="slide" onRequestClose={() => setShowLayers(false)}>
          <View style={styles.layerOverlay}>
            <View style={styles.layerPanel}>
              <View style={styles.layerHeader}>
                <Text style={styles.layerTitle}>Layers</Text>
                <Pressable onPress={() => setShowLayers(false)}><Text style={styles.layerClose}>✕</Text></Pressable>
              </View>
              <ScrollView style={styles.layerList}>
                {layers.map((l, i) => (
                  <Pressable key={l.id} style={[styles.layerItem, activeLayer === l.id && styles.layerItemActive]} onPress={() => setActiveLayer(l.id)}>
                    <Pressable onPress={() => setLayers((prev) => prev.map((ly, j) => j === i ? { ...ly, visible: !ly.visible } : ly))}>
                      <Text style={styles.layerVis}>{l.visible ? '👁' : '🚫'}</Text>
                    </Pressable>
                    <Text style={styles.layerName}>{l.name}</Text>
                    <View style={styles.layerArrows}>
                      {i > 0 && <Pressable onPress={() => setLayers((prev) => { const c = [...prev]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })}><Text style={styles.layerArrow}>↑</Text></Pressable>}
                      {i < layers.length - 1 && <Pressable onPress={() => setLayers((prev) => { const c = [...prev]; [c[i], c[i + 1]] = [c[i + 1], c[i]]; return c; })}><Text style={styles.layerArrow}>↓</Text></Pressable>}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.layerAdd} onPress={() => {
                const newId = `layer_${Date.now()}`;
                setLayers((prev) => [...prev, { id: newId, name: `Layer ${prev.length + 1}`, visible: true }]);
                setActiveLayer(newId);
              }}>
                <Text style={styles.layerAddText}>+ Add Layer</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={showBrushMenu} transparent animationType="fade" onRequestClose={() => setShowBrushMenu(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowBrushMenu(false)}>
            <View style={styles.brushMenuBox}>
              {BRUSH_TYPES.filter((b) => !['rectangle','circle','line','arrow','text','eyedropper','select','fill','eraser'].includes(b.key)).map((b) => (
                <Pressable key={b.key} style={[styles.brushMenuBtn, brush === b.key && styles.brushMenuActive]} onPress={() => { setBrush(b.key); setShowBrushMenu(false); }}>
                  <Text style={styles.brushMenuIcon}>{b.icon}</Text>
                  <Text style={[styles.brushMenuLabel, brush === b.key && styles.brushMenuLabelActive]}>{b.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        <Modal visible={showShapeMenu} transparent animationType="fade" onRequestClose={() => setShowShapeMenu(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowShapeMenu(false)}>
            <View style={styles.brushMenuBox}>
              {[
                { key: 'rectangle', label: 'Rectangle', icon: '⬜' },
                { key: 'circle', label: 'Circle', icon: '⭕' },
                { key: 'line', label: 'Line', icon: '📏' },
                { key: 'arrow', label: 'Arrow', icon: '➡️' },
              ].map((b) => (
                <Pressable key={b.key} style={[styles.brushMenuBtn, brush === b.key && styles.brushMenuActive]} onPress={() => { setBrush(b.key as BrushType); setShowShapeMenu(false); }}>
                  <Text style={styles.brushMenuIcon}>{b.icon}</Text>
                  <Text style={[styles.brushMenuLabel, brush === b.key && styles.brushMenuLabelActive]}>{b.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(P: PaletteType) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 7,
    backgroundColor: '#fff', gap: 6, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  hBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hBack: { fontSize: 20, color: P.textPrimary, fontWeight: '600' },
  hDisabled: { opacity: 0.25 },
  headerActions: { flexShrink: 0 },
  headerActionsContent: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  hBtnSm: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  hIconSm: { fontSize: 13, color: P.textSecondary },
  titleInput: { flex: 1, fontSize: 13, fontWeight: '600', color: P.textPrimary, paddingVertical: 4, paddingHorizontal: 8, minWidth: 60 },
  roomBadge: { paddingHorizontal: 7, paddingVertical: 3, backgroundColor: P.offWhite, borderRadius: Radius.full, marginRight: 2, flexShrink: 0 },
  roomBadgeText: { fontSize: 9, fontWeight: '800', color: P.purple, letterSpacing: 1 },
  wsDot: { width: 6, height: 6, borderRadius: 3, marginRight: 2, flexShrink: 0 },
  wsOn: { backgroundColor: P.success },
  wsOff: { backgroundColor: P.error },

  replayBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: P.offWhite, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  replayTrack: { flex: 1, height: 4, backgroundColor: P.border, borderRadius: 2, overflow: 'hidden' },
  replayFill: { height: '100%', backgroundColor: P.purple, borderRadius: 2 },
  replayLabel: { fontSize: 10, color: P.textMuted, fontWeight: '600', minWidth: 40, textAlign: 'right' },
  replaySpeedBtn: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: P.offWhite, borderRadius: 4, borderWidth: 1, borderColor: P.border },
  replaySpeedText: { fontSize: 9, fontWeight: '700', color: P.purple },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: P.purple, borderRadius: Radius.sm },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },

  traceBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: P.offWhite, borderBottomWidth: 1, borderBottomColor: P.border, gap: 8,
  },
  traceLabel: { fontSize: 10, fontWeight: '700', color: P.textSecondary, letterSpacing: 0.3 },
  traceSlider: { flex: 1, flexDirection: 'row', height: 16, gap: 2, alignItems: 'center' },
  traceSeg: { flex: 1, height: 14, borderRadius: 2, borderWidth: 1, borderColor: P.border, overflow: 'hidden' },
  traceSegActive: { borderColor: P.purple, borderWidth: 2 },
  traceSegFill: { flex: 1, borderRadius: 1 },
  tracePct: { fontSize: 10, fontWeight: '600', color: P.textSecondary, width: 28, textAlign: 'right' },

  canvasWrap: { flex: 1, backgroundColor: '#fff' },
  canvas: { flex: 1, overflow: 'hidden', position: 'relative' },

  toolbar: {
    backgroundColor: '#fff', paddingTop: 5, paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    borderTopWidth: 1, borderTopColor: P.border,
  },
  toolModeRow: { flexDirection: 'row', paddingHorizontal: 8, gap: 4, alignItems: 'center' },
  toolModeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: P.offWhite },
  toolModeBrush: {},
  toolModeShape: {},
  toolModeActive: { backgroundColor: P.purple },
  toolModeLabel: { fontSize: 10, fontWeight: '700', color: P.textMuted },
  toolModeArrow: { fontSize: 7, color: P.textMuted, marginTop: 1 },
  toolMiniRow: { flexDirection: 'row', gap: 0, marginLeft: 2, alignItems: 'center' },
  toolMiniBtn: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  toolMiniActive: { backgroundColor: P.purple + '20' },
  toolMiniIcon: { fontSize: 11 },

  brushMenuBox: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderRadius: Radius.xl, padding: 12, marginHorizontal: 32, gap: 4, justifyContent: 'center' },
  brushMenuBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: P.offWhite },
  brushMenuActive: { backgroundColor: P.purple },
  brushMenuIcon: { fontSize: 12 },
  brushMenuLabel: { fontSize: 10, fontWeight: '700', color: P.textMuted },
  brushMenuLabelActive: { color: '#fff' },
  colorContent: { paddingHorizontal: 8, paddingVertical: 4, gap: 5, alignItems: 'center' },
  colorBtn: { width: 22, height: 22, borderRadius: 11 },
  colorSelected: { borderWidth: 2.5, borderColor: P.purple },
  colorWhite: { borderWidth: 1, borderColor: P.border },
  bottomRow: { paddingHorizontal: 8, paddingTop: 3, gap: 4 },
  hueContent: { gap: 0, alignItems: 'center' },
  hueSeg: { width: screenW / 60 - 0.3, height: 10 },

  chatPanel: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: P.border, overflow: 'hidden' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: P.border },
  chatHeaderText: { fontSize: 12, fontWeight: '700', color: P.textPrimary },
  chatHeaderCount: { fontSize: 10, color: P.textMuted, fontWeight: '600' },
  chatList: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  chatEmptyWrap: { alignItems: 'center', paddingVertical: 20 },
  chatEmptyIcon: { fontSize: 24, marginBottom: 6, opacity: 0.4 },
  chatEmpty: { color: P.textMuted, fontSize: 12, textAlign: 'center' },
  chatBubble: { marginBottom: 8, padding: 8, borderRadius: Radius.sm, backgroundColor: P.offWhite, maxWidth: '80%' },
  chatBubbleOwn: { backgroundColor: P.purple + '12', alignSelf: 'flex-end', borderTopRightRadius: 2 },
  chatBubbleOther: { alignSelf: 'flex-start', borderTopLeftRadius: 2 },
  chatRowOwn: { alignItems: 'flex-end' },
  chatRowOther: { alignItems: 'flex-start' },
  chatBubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  chatFrom: { fontSize: 10, fontWeight: '700', color: P.purple },
  chatTime: { fontSize: 9, color: P.textMuted },
  chatText: { fontSize: 13, color: P.textPrimary },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: P.border },
  chatInput: { flex: 1, backgroundColor: P.offWhite, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, borderWidth: 1, borderColor: P.border, color: P.textPrimary },
  chatSendBtn: { backgroundColor: P.purple, borderRadius: Radius.sm, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  chatSendText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalBox: { backgroundColor: '#fff', borderRadius: Radius.xl, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: P.textPrimary },
  modalSub: { fontSize: 13, color: P.textSecondary, marginTop: 4, marginBottom: 20 },
  modalBtn: { backgroundColor: P.purple, borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', width: '100%', marginBottom: 10 },
  modalBtnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalBtnHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  modalCancel: { paddingVertical: 8, marginTop: 4 },
  modalCancelText: { color: P.textMuted, fontSize: 14, fontWeight: '600' },

  widthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingTop: 3 },
  widthLabel: { fontSize: 9, fontWeight: '700', color: P.textMuted, minWidth: 24 },
  sliderTrack: { flex: 1, height: 20, backgroundColor: P.offWhite, borderRadius: 10, justifyContent: 'center', position: 'relative', borderWidth: 1, borderColor: P.border },
  sliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: P.purple + '30', borderRadius: 10 },
  sliderThumb: { position: 'absolute', top: '50%', transform: [{ translateY: -10 }], backgroundColor: P.purple, borderRadius: 10, borderWidth: 2, borderColor: '#fff' },

  textModalInput: { width: '100%', backgroundColor: P.offWhite, borderRadius: Radius.sm, padding: 10, fontSize: 16, borderWidth: 1, borderColor: P.border, color: P.textPrimary, minHeight: 60, textAlignVertical: 'top', marginBottom: 12 },
  textModalSizeRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  textModalSizeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: P.offWhite, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.border },
  textModalSizeActive: { borderColor: P.purple, borderWidth: 2 },
  textModalSizeText: { fontWeight: '700', color: P.textPrimary },
  textModalActions: { flexDirection: 'row', gap: 8, width: '100%' },

  layerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  layerPanel: { backgroundColor: '#fff', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: 16, maxHeight: '50%' },
  layerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  layerTitle: { fontSize: 16, fontWeight: '800', color: P.textPrimary },
  layerClose: { fontSize: 18, color: P.textMuted, padding: 4 },
  layerList: { maxHeight: 200 },
  layerItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderRadius: Radius.sm, marginBottom: 4 },
  layerItemActive: { backgroundColor: P.purple + '15' },
  layerVis: { fontSize: 14, width: 28 },
  layerName: { flex: 1, fontSize: 13, fontWeight: '600', color: P.textPrimary },
  layerArrows: { flexDirection: 'row', gap: 4 },
  layerArrow: { fontSize: 14, color: P.textSecondary, padding: 2 },
  layerAdd: { alignItems: 'center', paddingVertical: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: P.border },
  layerAddText: { fontSize: 13, fontWeight: '700', color: P.purple },

  sizePresetRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 },
  sizePreset: { alignItems: 'center', gap: 4, padding: 8, borderRadius: Radius.sm, borderWidth: 1, borderColor: P.border, width: 72 },
  sizePresetActive: { borderColor: P.purple, borderWidth: 2 },
  sizePresetIcon: { width: 40, height: 32, backgroundColor: P.offWhite, borderRadius: 3, borderWidth: 1, borderColor: P.border },
  sizePresetLabel: { fontSize: 9, fontWeight: '700', color: P.textMuted },
  sizePresetLabelActive: { color: P.purple },
  sizeCustomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  sizeInput: { width: 60, backgroundColor: P.offWhite, borderRadius: Radius.sm, paddingVertical: 6, paddingHorizontal: 8, fontSize: 14, fontWeight: '700', textAlign: 'center', borderWidth: 1, borderColor: P.border, color: P.textPrimary },
  sizeInputX: { fontSize: 14, color: P.textMuted, fontWeight: '600' },
  sizeInputPx: { fontSize: 12, color: P.textMuted, fontWeight: '500' },
}); }
