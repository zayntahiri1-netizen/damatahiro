// ╔══════════════════════════════════════════════════════════════╗
//  DAMA TAHIRO — MULTIPLAYER NETWORK LAYER  v5  "TAHIRO NET HYPER"
//
//  🔐 Firebase Auth   → هوية ثابتة مجهولة لكل لاعب
//  🗄️  Supabase        → قاعدة البيانات + طابور البحث + قناة نقل احتياطية
//  📡  Ably            → Matchmaking سريع + Presence + قناة نقل أساسية
//  ⚡  PeerJS(WebRTC)  → نقل مباشر P2P (أقل زمن استجابة)
//  📣  PubNub          → بث للمتفرجين + قناة نقل احتياطية ثانية
//  📊  Firebase Analytics → تتبع (HTTPS فقط)
//
//  ► الجديد في v5:
//    1) ReliablePipe: تسليم مضمون exactly-once بالترتيب عبر كل القنوات
//       (أرقام تسلسلية + ACK + إعادة إرسال + طلب المفقود + إزالة التكرار)
//    2) إرسال متعدد القنوات: كل حدث يُبث على كل القنوات الصحية معاً —
//       أسرع قناة تفوز، والبقية تأمين ضد سقوط أي مزوّد.
//    3) بحث مزدوج المسار: Ably (فوري) + طابور Supabase (مصدر الحقيقة)
//       مع توسيع نافذة ELO تدريجياً — أفضل تغطية عالمية.
//    4) إشعارات مزدوجة: Ably + Supabase Realtime (الدعوات وإيجاد المباراة).
//    5) نبض حضور دوري إلى Supabase (last_seen) طوال الجلسة.
//
//  ► Photon Engine: المعرّف محفوظ أدناه كاحتياط، لكنه غير مُفعَّل عمداً —
//    SDK الويب الخاص به لا يوزَّع عبر npm ويكرّر دور Ably في لعبة أدوار،
//    وأربع قنوات مستقلة (P2P + Ably + PubNub + Supabase RT) تتجاوز فعلاً
//    موثوقية أي مزوّد خامس. يمكن تفعيله لاحقاً عند الحاجة.
// ╚══════════════════════════════════════════════════════════════╝

import Ably from 'ably';
import { Peer } from 'peerjs';
import { createClient } from '@supabase/supabase-js';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import PubNub from 'pubnub';

// ══════════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBOZDqHj4lwcThY_e4XQ_Uf08NmE35YXxk",
  authDomain: "dama-tahiro.firebaseapp.com",
  projectId: "dama-tahiro",
  storageBucket: "dama-tahiro.firebasestorage.app",
  messagingSenderId: "590835413930",
  appId: "1:590835413930:web:d82e5d002e260b8ba0f1d3",
  measurementId: "G-T2C2XNCZ49"
};

const SUPABASE_URL  = 'https://khouuouyrqbqinbuqtzq.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtob3V1b3V5cnFicWluYnVxdHpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjcxMTUsImV4cCI6MjA5NzkwMzExNX0.3w8Qb6QjrFH7VUA00HCWE6gNuwN1ujDS2uuVSFVZ3TU';
const ABLY_KEY      = 'Q5lYAQ._zwMaw:Ynj1E7ejtPC7NrFG5QgcMqCEWCOGTqhyhgxKhitzcI8';
const PUBNUB_PUB    = 'pub-c-8856e527-2542-4190-b998-a7b53e7d2f74';
const PUBNUB_SUB    = 'sub-c-d943df62-83da-4314-8144-4ce888e8df2e';
// const PHOTON_APP_ID = 'b79c00aa-7cc9-4082-8fb4-e11a6ec6b680'; // reserved — see header

// نافذة ELO تتوسع مع الانتظار: 250 → +150 كل 5 ثوانٍ → حد أقصى 650
const ELO_WINDOW_BASE = 250;
const ELO_WINDOW_STEP = 150;
const ELO_WINDOW_MAX  = 650;

// ══════════════════════════════════════════════════════════════
//  ENVIRONMENT DETECTION
// ══════════════════════════════════════════════════════════════

const _env = (() => {
  if (typeof window === 'undefined') return 'server';
  const p = window.location.protocol;
  const h = window.location.hostname;
  if (p === 'file:') return 'local-file';
  if (h === 'localhost' || h === '127.0.0.1') return 'localhost';
  if (p === 'https:') return 'production';
  return 'other';
})();

const _canUseAnalytics   = _env === 'production';
const _canUseAblySockets = _env !== 'local-file';
const _isOfflineMode     = _env === 'local-file';

// ══════════════════════════════════════════════════════════════
//  ANALYTICS — Dynamic import لتجنب DataCloneError
// ══════════════════════════════════════════════════════════════

type AnalyticsType = import('firebase/analytics').Analytics;
let _analyticsInstance: AnalyticsType | null = null;

async function _initAnalytics(app: ReturnType<typeof initializeApp>) {
  if (!_canUseAnalytics) return;
  try {
    const mod = await import('firebase/analytics');
    _analyticsInstance = mod.getAnalytics(app);
  } catch { /* بيئات محدودة */ }
}

let _analyticsEnabled = true;
export function setAnalyticsEnabled(v: boolean) { _analyticsEnabled = v; }

function _logEvent(name: string, params?: Record<string, any>) {
  if (!_analyticsInstance || !_analyticsEnabled) return;
  import('firebase/analytics').then(mod => {
    try { mod.logEvent(_analyticsInstance!, name, params); } catch { /* ignore */ }
  }).catch(() => {});
}

// ══════════════════════════════════════════════════════════════
//  SERVICES
// ══════════════════════════════════════════════════════════════

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
export const firebaseAuth = getAuth(firebaseApp);
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let _currentPlayerId = '';
export function setCurrentPlayerId(id: string): void { _currentPlayerId = id; }
export function getCurrentPlayerId(): string { return _currentPlayerId; }

// ══════════════════════════════════════════════════════════════
//  TYPES  (مطابقة تماماً لواجهة v4 التي يعتمدها App.tsx)
// ══════════════════════════════════════════════════════════════

export interface NetworkMove {
  from: number;
  to: number;
  captures: number[];
  isKingPromotion: boolean;
  timestamp: number;
  playerId: string;
  seq: number;
}

export interface PlayerInfo {
  userId: string;
  displayName: string;
  avatar: string;
  elo: number;
  country: string;
}

export interface MatchmakingEntry extends PlayerInfo {
  betAmount: number;
  gameMode: string;
  timestamp: number;
  peerId: string;
}

export interface RoomState {
  roomId: string;
  player1: MatchmakingEntry;
  player2?: MatchmakingEntry;
  status: 'waiting' | 'ready' | 'playing' | 'finished';
  betAmount: number;
  gameMode: string;
}

export type ConnectionQuality = 'p2p' | 'relay' | 'connecting' | 'offline';

export type NetworkEvent =
  | { type: 'match_found';        room: RoomState; isHost: boolean }
  | { type: 'move';               move: NetworkMove }
  | { type: 'opponent_connected' }
  | { type: 'opponent_disconnected' }
  | { type: 'game_over';          winner: 'white' | 'black' | 'draw'; reason?: string }
  | { type: 'draw_offer' }
  | { type: 'draw_accepted' }
  | { type: 'draw_rejected' }
  | { type: 'emoji';              emoji: string }
  | { type: 'rematch_request' }
  | { type: 'rematch_accepted' }
  | { type: 'rematch_rejected' }
  | { type: 'connection_quality'; quality: ConnectionQuality }
  | { type: 'live_viewers';       count: number }
  | { type: 'error';              message: string };

// ══════════════════════════════════════════════════════════════
//  ▼▼ RELIABLE PIPE CORE — منطق نقيّ قابل للاختبار المعزول ▼▼
//
//  المسؤوليات:
//   • ترقيم الأحداث الصادرة (seq) وحفظها في outbox حتى وصول ACK
//   • بثّ كل رسالة على كل القنوات الصحية (أسرع قناة تفوز)
//   • عند الاستقبال: إسقاط التكرار، التسليم بالترتيب، تخزين ما سبق دوره
//   • ACK دوري للطرف الآخر، وطلب إعادة إرسال (req) عند اكتشاف فجوة
//   • إعادة إرسال ما لم يُؤكَّد بعد مهلة
//  لا يعرف شيئاً عن SDKs — القنوات تُحقن كدوال.
// ══════════════════════════════════════════════════════════════

export interface PipeLane {
  name: string;
  ok(): boolean;
  send(msg: any): void;   // يجب ألا ترمي استثناء إلى الأعلى
}

export interface WireMsg<TEv = any> {
  v: 2;
  rid: string;            // معرّف الغرفة — يمنع أشباح الغرف السابقة
  sid: string;            // معرّف المرسل
  kind: 'ev' | 'ack' | 'req';
  seq?: number;           // للـ ev
  ev?: TEv;               // للـ ev
  upTo?: number;          // للـ ack: آخر تسلسل مُسلَّم
  from?: number;          // للـ req: أعد الإرسال بدءاً من هذا التسلسل
  t: number;
}

export class ReliablePipe<TEv = any> {
  private selfId: string;
  private rid = '';
  private lanesProvider: () => PipeLane[];
  private deliver: (ev: TEv) => void;

  private outSeq = 0;
  private outbox = new Map<number, WireMsg<TEv>>();   // بانتظار ACK
  private lastDelivered = 0;                          // آخر تسلسل وارد سُلِّم
  private buffer = new Map<number, TEv>();            // وصل قبل دوره
  private gapSince = 0;
  private lastResendAt = 0;
  private lastAckSentAt = 0;
  private lastAckSentVal = -1;

  // مقاييس تشخيصية
  public stats = { sent: 0, delivered: 0, dups: 0, resends: 0, reqs: 0 };

  constructor(opts: {
    selfId: string;
    lanesProvider: () => PipeLane[];
    deliver: (ev: TEv) => void;
  }) {
    this.selfId = opts.selfId;
    this.lanesProvider = opts.lanesProvider;
    this.deliver = opts.deliver;
  }

  /** يُستدعى عند دخول غرفة (يصفّر حالة التدفق للطرفين) */
  reset(roomId: string) {
    this.rid = roomId;
    this.outSeq = 0;
    this.outbox.clear();
    this.lastDelivered = 0;
    this.buffer.clear();
    this.gapSince = 0;
    this.lastResendAt = 0;
    this.lastAckSentAt = 0;
    this.lastAckSentVal = -1;
  }

  get roomId() { return this.rid; }
  get pendingOut() { return this.outbox.size; }

  /** إرسال حدث لعب — يُرجع التسلسل المخصص له */
  send(ev: TEv, now = Date.now()): number {
    if (!this.rid) return -1;
    const seq = ++this.outSeq;
    const msg: WireMsg<TEv> = { v: 2, rid: this.rid, sid: this.selfId, kind: 'ev', seq, ev, t: now };
    this.outbox.set(seq, msg);
    this.stats.sent++;
    this._fanout(msg);
    return seq;
  }

  /** تُستدعى من كل قناة عند وصول رسالة خام */
  onReceive(raw: any, now = Date.now()) {
    const msg = raw as WireMsg<TEv>;
    if (!msg || msg.v !== 2) return;
    if (msg.sid === this.selfId) return;          // صدى ذاتي من قنوات البث
    if (msg.rid !== this.rid) return;             // شبح غرفة قديمة

    if (msg.kind === 'ack') {
      const upTo = msg.upTo ?? 0;
      for (const s of Array.from(this.outbox.keys())) {
        if (s <= upTo) this.outbox.delete(s);
      }
      return;
    }

    if (msg.kind === 'req') {
      const from = msg.from ?? 1;
      const seqs = Array.from(this.outbox.keys()).filter(s => s >= from).sort((a, b) => a - b);
      for (const s of seqs) this._fanout(this.outbox.get(s)!);
      return;
    }

    // kind === 'ev'
    const seq = msg.seq ?? 0;
    if (seq <= 0 || msg.ev === undefined) return;

    if (seq <= this.lastDelivered) {
      // تكرار (وصل من قناة أخرى أو إعادة إرسال) — أكّد ليتوقف الطرف الآخر
      this.stats.dups++;
      this._maybeAck(now, /*force*/ false);
      return;
    }

    if (seq === this.lastDelivered + 1) {
      this._deliverOne(msg.ev);
      // أفرغ ما تجمّع في الترتيب
      let next = this.lastDelivered + 1;
      while (this.buffer.has(next)) {
        const ev = this.buffer.get(next)!;
        this.buffer.delete(next);
        this._deliverOne(ev);
        next = this.lastDelivered + 1;
      }
      if (this.buffer.size === 0) this.gapSince = 0;
      this._maybeAck(now, /*force*/ true);
      return;
    }

    // فجوة: خزّن وانتظر — tick سيطلب المفقود إن طالت
    if (!this.buffer.has(seq)) this.buffer.set(seq, msg.ev);
    if (!this.gapSince) this.gapSince = now;
    this._maybeAck(now, false);
  }

  /** نبضة دورية (كل ~700ms): إعادة إرسال غير المؤكَّد + طلب المفقود */
  tick(now = Date.now()) {
    if (!this.rid) return;

    if (this.outbox.size > 0 && now - this.lastResendAt > 2500) {
      this.lastResendAt = now;
      const seqs = Array.from(this.outbox.keys()).sort((a, b) => a - b).slice(0, 8);
      for (const s of seqs) { this._fanout(this.outbox.get(s)!); this.stats.resends++; }
    }

    if (this.buffer.size > 0 && this.gapSince && now - this.gapSince > 1200) {
      this.gapSince = now; // خنق الطلبات
      this.stats.reqs++;
      this._fanout({ v: 2, rid: this.rid, sid: this.selfId, kind: 'req', from: this.lastDelivered + 1, t: now });
    }
  }

  private _deliverOne(ev: TEv) {
    this.lastDelivered++;
    this.stats.delivered++;
    try { this.deliver(ev); } catch { /* لا نكسر التدفق بخطأ المستهلك */ }
  }

  private _maybeAck(now: number, force: boolean) {
    // ACK مخنوق: عند تقدم التسليم أو كل 300ms على الأكثر عند التكرار/الفجوة
    if (!force && now - this.lastAckSentAt < 300 && this.lastAckSentVal === this.lastDelivered) return;
    this.lastAckSentAt = now;
    this.lastAckSentVal = this.lastDelivered;
    this._fanout({ v: 2, rid: this.rid, sid: this.selfId, kind: 'ack', upTo: this.lastDelivered, t: now });
  }

  private _fanout(msg: WireMsg<TEv>) {
    const lanes = this.lanesProvider();
    for (const lane of lanes) {
      if (!lane.ok()) continue;
      try { lane.send(msg); } catch { /* القناة قد تكون سقطت للتو */ }
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  ▲▲ RELIABLE PIPE CORE ▲▲
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  NETWORK MANAGER v5
// ══════════════════════════════════════════════════════════════

export class NetworkManager {
  private ably: any = null;                 // Ably.Realtime
  private peer: any = null;                 // PeerJS Peer
  private peerConn: any = null;             // PeerJS DataConnection
  private ablyGameCh: any = null;
  private ablyMatchmakingCh: any = null;
  private pubnub: any = null;
  private sbGameCh: any = null;             // Supabase Realtime — قناة اللعب
  private sbNotifyCh: any = null;           // Supabase Realtime — إشعاراتي
  private _sbGameReady = false;

  private _seekingRepublishTimer: ReturnType<typeof setInterval> | null = null;
  private _queuePollTimer:        ReturnType<typeof setInterval> | null = null;
  private _pipeTimer:             ReturnType<typeof setInterval> | null = null;
  private _heartbeatTimer:        ReturnType<typeof setInterval> | null = null;

  private _userId   = '';
  private _peerId   = '';
  private _roomId   = '';
  private _isHost   = false;
  private _p2pActive = false;
  private _quality: ConnectionQuality = 'offline';
  private _viewers  = 0;
  private _searchStartedAt = 0;
  private _pubnubSubbedRoom = '';
  private _opponentSeen = false;
  private _oppWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private _inviteDedup = new Set<string>();

  private pipe: ReliablePipe<NetworkEvent>;
  private listeners: ((e: NetworkEvent) => void)[] = [];

  constructor() {
    this.pipe = new ReliablePipe<NetworkEvent>({
      selfId: 'uninit',
      lanesProvider: () => this._lanes(),
      deliver: (ev) => this._handleDelivered(ev),
    });
  }

  // ── Init ─────────────────────────────────────────────────────
  async init(info: Omit<PlayerInfo, 'userId'>): Promise<string> {

    // 🔐 Firebase Auth (مع مهلة أمان وهوية محلية احتياطية)
    this._userId = await new Promise<string>((resolve) => {
      const unsub = onAuthStateChanged(firebaseAuth, async (user: any) => {
        unsub();
        if (user) { resolve(user.uid); return; }
        try {
          const r = await signInAnonymously(firebaseAuth);
          resolve(r.user.uid);
        } catch {
          const local = localStorage.getItem('_dt_uid') ?? `local_${Date.now()}`;
          localStorage.setItem('_dt_uid', local);
          resolve(local);
        }
      });
      setTimeout(() => {
        const local = localStorage.getItem('_dt_uid') ?? `local_${Date.now()}`;
        localStorage.setItem('_dt_uid', local);
        resolve(local);
      }, 5000);
    });

    // إعادة بناء الأنبوب بهوية حقيقية
    this.pipe = new ReliablePipe<NetworkEvent>({
      selfId: this._userId,
      lanesProvider: () => this._lanes(),
      deliver: (ev) => this._handleDelivered(ev),
    });

    // 🗄️ Supabase profile
    setCurrentPlayerId(this._userId);
    void this._upsertProfile(info);

    // 📊 Analytics
    void _initAnalytics(firebaseApp);

    // 📡 Ably
    if (_canUseAblySockets) {
      try {
        this.ably = new Ably.Realtime({
          key: ABLY_KEY,
          clientId: this._userId,
          disconnectedRetryTimeout: 15000,
          suspendedRetryTimeout: 30000,
        });
        this.ably.connection.on('connected', () => {
          if (this._userId) {
            void supabase.from('players')
              .update({ is_online: true, last_seen: new Date().toISOString() })
              .eq('id', this._userId);
          }
          this._recomputeQuality();
        });
        this.ably.connection.on('disconnected', () => this._recomputeQuality());
        this.ably.connection.on('suspended',    () => this._recomputeQuality());
        await new Promise<void>((res) => {
          this.ably.connection.once('connected', () => res());
          this.ably.connection.once('failed',    () => res());
          setTimeout(res, 8000);
        });
      } catch {
        this.ably = null;
      }
    }

    // ⚡ PeerJS P2P
    this._peerId = `dt_${this._userId.substring(0, 10)}_${Date.now().toString(36)}`;
    await this._initPeer();

    // 📣 PubNub — مستمع جذري واحد يوزّع حسب اسم القناة
    try {
      this.pubnub = new PubNub({
        publishKey:   PUBNUB_PUB,
        subscribeKey: PUBNUB_SUB,
        userId:       this._userId
      });
      this.pubnub.addListener({
        message: (e: any) => {
          const ch = String(e.channel ?? '');
          if (ch.startsWith('g_')) {
            this.pipe.onReceive(e.message);
          } else if (ch.startsWith('live_')) {
            if (e.message?.type === 'viewer_count') {
              this._viewers = e.message.count;
              this._emit({ type: 'live_viewers', count: this._viewers });
            }
          }
        },
        presence: (e: any) => {
          const ch = String(e.channel ?? '');
          if (ch.startsWith('live_')) {
            this._viewers = e.occupancy ?? this._viewers;
            this._emit({ type: 'live_viewers', count: this._viewers });
          }
        }
      });
    } catch { /* بيئة محدودة */ }

    // 🛰️ قناة إشعاراتي على Supabase Realtime (مسار احتياطي لإيجاد المباراة والدعوات)
    this._subscribeSbNotify();

    // 🫀 نبض حضور دوري
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = setInterval(() => {
      if (!this._userId) return;
      void supabase.from('players')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', this._userId);
    }, 25000);

    // نبضة الأنبوب (إعادة الإرسال/طلب المفقود)
    if (this._pipeTimer) clearInterval(this._pipeTimer);
    this._pipeTimer = setInterval(() => this.pipe.tick(), 700);

    this._recomputeQuality();
    _logEvent('player_init', { elo: info.elo, env: _env });
    return this._userId;
  }

  private _subscribeSbNotify() {
    try {
      if (this.sbNotifyCh) { void supabase.removeChannel(this.sbNotifyCh); this.sbNotifyCh = null; }
      this.sbNotifyCh = supabase
        .channel(`nf_${this._userId}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'match_found' }, (p: any) => {
          const d = p?.payload;
          if (d?.room) void this._joinRoom(d.room as RoomState, !!d.isHost);
        })
        .on('broadcast', { event: 'friend_invite' }, (p: any) => {
          const d = p?.payload;
          if (d?.from && typeof d.roomCode === 'string') {
            this._dispatchInvite(d.from as PlayerInfo, d.roomCode as string);
          }
        })
        .subscribe(() => { /* الحالة غير حرجة — مسار احتياطي */ });
    } catch { /* ignore */ }
  }

  // ── PeerJS ───────────────────────────────────────────────────
  private _initPeer(): Promise<void> {
    return new Promise((resolve) => {
      try {
        this.peer = new Peer(this._peerId, {
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ]
          }
        });
        this.peer.on('open', () => resolve());
        this.peer.on('connection', (conn: any) => this._setupPeerConn(conn));
        this.peer.on('error', () => { this.peer = null; resolve(); });
        setTimeout(resolve, 6000);
      } catch { resolve(); }
    });
  }

  private _setupPeerConn(conn: any) {
    this.peerConn = conn;
    conn.on('open', () => {
      this._p2pActive = true;
      this._opponentSeen = true;
      this._recomputeQuality();
      this._emit({ type: 'opponent_connected' });
    });
    conn.on('data', (d: unknown) => this.pipe.onReceive(d));
    conn.on('close', () => {
      this._p2pActive = false;
      this._recomputeQuality();
      // Presence على Ably هو الحكم في انقطاع المنافس؛ سقوط P2P وحده = تخفيض جودة فقط.
      if (!this._ablyConnected()) this._emit({ type: 'opponent_disconnected' });
    });
    conn.on('error', () => {
      this._p2pActive = false;
      this._recomputeQuality();
    });
  }

  // ── القنوات (تُقدَّم للأنبوب) ────────────────────────────────
  private _ablyConnected(): boolean {
    return !!this.ably && this.ably.connection?.state === 'connected';
  }

  private _lanes(): PipeLane[] {
    const lanes: PipeLane[] = [];
    // ⚡ P2P — الأسرع
    lanes.push({
      name: 'p2p',
      ok: () => !!(this._p2pActive && this.peerConn?.open),
      send: (m) => { try { this.peerConn.send(m); } catch { /* */ } }
    });
    // 📡 Ably
    lanes.push({
      name: 'ably',
      ok: () => !!(this.ablyGameCh && this._ablyConnected()),
      send: (m) => { try { void this.ablyGameCh.publish('game_event', m); } catch { /* */ } }
    });
    // 📣 PubNub
    lanes.push({
      name: 'pubnub',
      ok: () => !!(this.pubnub && this._pubnubSubbedRoom),
      send: (m) => { try { void this.pubnub.publish({ channel: `g_${this._pubnubSubbedRoom}`, message: m }); } catch { /* */ } }
    });
    // 🛰️ Supabase Realtime
    lanes.push({
      name: 'sbrt',
      ok: () => !!(this.sbGameCh && this._sbGameReady),
      send: (m) => { try { void this.sbGameCh.send({ type: 'broadcast', event: 'm', payload: m }); } catch { /* */ } }
    });
    return lanes;
  }

  // ── Matchmaking (مسار مزدوج) ─────────────────────────────────
  private _eloWindow(): number {
    const waited = Math.max(0, Date.now() - this._searchStartedAt);
    return Math.min(ELO_WINDOW_MAX, ELO_WINDOW_BASE + Math.floor(waited / 5000) * ELO_WINDOW_STEP);
  }

  async findMatch(
    params: Omit<MatchmakingEntry, 'userId' | 'timestamp' | 'peerId'>,
    onEvent: (e: NetworkEvent) => void
  ): Promise<void> {
    if (_isOfflineMode) return;
    this.on(onEvent);
    this._searchStartedAt = Date.now();

    const myEntry: MatchmakingEntry = {
      userId:      this._userId,
      displayName: params.displayName,
      avatar:      params.avatar,
      elo:         params.elo,
      country:     params.country,
      betAmount:   params.betAmount,
      gameMode:    params.gameMode,
      timestamp:   Date.now(),
      peerId:      this._peerId
    };

    // ── المسار 1: Ably (فوري لمن يبحث الآن) ──
    if (this._ablyConnected()) {
      const poolId = `mm_${params.gameMode}_b${params.betAmount}`;
      this.ablyMatchmakingCh = this.ably.channels.get(poolId);

      this.ablyMatchmakingCh.subscribe('seeking', async (msg: any) => {
        const other = msg.data as MatchmakingEntry;
        if (!other || other.userId === this._userId) return;
        if (Math.abs(other.elo - params.elo) > this._eloWindow()) return;
        if (this._roomId) return;
        // كسر التعادل الحتمي: الأصغر معجمياً يستضيف (Fix #38)
        if (this._userId > other.userId) return;
        await this._createRoomAsHost(myEntry, other, params);
      });

      const notifyCh = this.ably.channels.get(`notify_${this._userId}`);
      notifyCh.subscribe('match_found', async (msg: any) => {
        if (this._roomId) return;
        void notifyCh.unsubscribe();
        const { room, isHost } = msg.data as { room: RoomState; isHost: boolean };
        await this._joinRoom(room, isHost);
      });

      void this.ablyMatchmakingCh.publish('seeking', myEntry);
      // إعادة النشر كل 3 ثوانٍ (Ably لا يعيد التاريخ للمشتركين المتأخرين — Fix #39)
      this._seekingRepublishTimer = setInterval(() => {
        if (this._roomId) { this._clearSearchTimers(); return; }
        void this.ablyMatchmakingCh?.publish('seeking', { ...myEntry, timestamp: Date.now() });
      }, 3000);
    }

    // ── المسار 2: طابور Supabase (مصدر الحقيقة — يعمل حتى بدون Ably) ──
    const upsertQueueRow = () => Promise.resolve(supabase.from('matchmaking_queue').upsert({
      player_id:   this._userId,
      player_name: params.displayName,
      elo:         params.elo,
      bet_amount:  params.betAmount,
      game_mode:   params.gameMode,
      room_code:   this._peerId,          // العمود يحمل peerId للاتصال المباشر
      created_at:  new Date().toISOString()
    }, { onConflict: 'player_id' })).catch(() => {});

    const pollQueue = async () => {
      if (this._roomId) { this._clearSearchTimers(); return; }
      try {
        await upsertQueueRow(); // يجدّد created_at حتى لا يعتبرنا الآخرون قديمين
        const win = this._eloWindow();
        const { data } = await supabase.from('matchmaking_queue')
          .select('player_id,player_name,elo,bet_amount,game_mode,room_code,created_at')
          .eq('game_mode', params.gameMode)
          .eq('bet_amount', params.betAmount)
          .neq('player_id', this._userId)
          .gte('elo', params.elo - win)
          .lte('elo', params.elo + win)
          .gte('created_at', new Date(Date.now() - 30000).toISOString())
          .order('created_at', { ascending: true })
          .limit(10);
        if (!data || data.length === 0 || this._roomId) return;
        // الأقرب تقييماً أولاً
        data.sort((a: any, b: any) => Math.abs(a.elo - params.elo) - Math.abs(b.elo - params.elo));
        const other = data[0];
        // نفس كاسر التعادل — طرف واحد فقط يستضيف
        if (this._userId > other.player_id) return;
        const otherEntry: MatchmakingEntry = {
          userId: other.player_id, displayName: other.player_name,
          avatar: '👤', elo: other.elo, country: '🌍',
          betAmount: other.bet_amount, gameMode: other.game_mode,
          timestamp: Date.now(), peerId: other.room_code
        };
        await this._createRoomAsHost(myEntry, otherEntry, params);
      } catch { /* شبكة متقلبة — سنحاول في النبضة التالية */ }
    };

    void pollQueue();
    this._queuePollTimer = setInterval(() => { void pollQueue(); }, 3000);
  }

  private async _createRoomAsHost(
    myEntry: MatchmakingEntry,
    other: MatchmakingEntry,
    params: { betAmount: number; gameMode: string }
  ) {
    if (this._roomId) return;
    this._isHost = true;
    const roomId = `room_${Date.now()}_${this._userId.substring(0, 6)}`;
    const room: RoomState = {
      roomId, player1: myEntry, player2: other,
      status: 'ready', betAmount: params.betAmount, gameMode: params.gameMode
    };
    // إبلاغ الطرف الآخر عبر القناتين معاً — أول واحدة تصل تكفي (عنده حارس _roomId)
    if (this._ablyConnected()) {
      try { void this.ably.channels.get(`notify_${other.userId}`).publish('match_found', { room, isHost: false }); } catch { /* */ }
    }
    try {
      const ch = supabase.channel(`nf_${other.userId}`, { config: { broadcast: { self: false } } });
      ch.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          void ch.send({ type: 'broadcast', event: 'match_found', payload: { room, isHost: false } });
          setTimeout(() => { void supabase.removeChannel(ch); }, 4000);
        }
      });
    } catch { /* */ }
    await this._joinRoom(room, true);
  }

  cancelMatchmaking() {
    this._clearSearchTimers();
    void this.ablyMatchmakingCh?.unsubscribe();
    this.ablyMatchmakingCh = null;
    void Promise.resolve(
      supabase.from('matchmaking_queue').delete().eq('player_id', this._userId)
    ).catch(() => {});
    this._roomId = '';
  }

  private _clearSearchTimers() {
    if (this._seekingRepublishTimer) { clearInterval(this._seekingRepublishTimer); this._seekingRepublishTimer = null; }
    if (this._queuePollTimer)        { clearInterval(this._queuePollTimer);        this._queuePollTimer = null; }
  }

  // ── Room Code ────────────────────────────────────────────────
  async hostRoomCode(
    code: string,
    info: Omit<MatchmakingEntry, 'userId' | 'timestamp' | 'peerId'>,
    onEvent: (e: NetworkEvent) => void
  ): Promise<void> {
    if (!this.ably) return;
    this.on(onEvent);
    const ch = this.ably.channels.get(`rc_${code}`);
    ch.subscribe('joined', async (msg: any) => {
      void ch.unsubscribe();
      const guest = msg.data as MatchmakingEntry;
      const room: RoomState = {
        roomId: `rc_${code}_${Date.now().toString(36)}`,   // فريد لكل جلسة — يمنع أشباح الجلسات السابقة
        player1: { ...info, userId: this._userId, timestamp: Date.now(), peerId: this._peerId },
        player2: guest,
        status: 'ready',
        betAmount: info.betAmount,
        gameMode:  info.gameMode
      };
      void ch.publish('room_ready', room);
      await this._joinRoom(room, true);
    });
  }

  async joinByRoomCode(
    code: string,
    info: Omit<MatchmakingEntry, 'userId' | 'timestamp' | 'peerId'>,
    onEvent: (e: NetworkEvent) => void
  ): Promise<void> {
    if (!this.ably) return;
    this.on(onEvent);
    const ch = this.ably.channels.get(`rc_${code}`);
    ch.subscribe('room_ready', async (msg: any) => {
      void ch.unsubscribe();
      await this._joinRoom(msg.data as RoomState, false);
    });
    void ch.publish('joined', {
      ...info, userId: this._userId, timestamp: Date.now(), peerId: this._peerId
    });
  }

  // ── Join Room ────────────────────────────────────────────────
  private async _joinRoom(room: RoomState, isHost: boolean) {
    if (this._roomId === room.roomId) return;
    if (this._roomId && this._roomId !== room.roomId) return;
    this.cancelMatchmaking();
    this._teardownRoomLanes();
    this._roomId = room.roomId;
    this._isHost = isHost;
    this.pipe.reset(room.roomId);

    if (isHost) {
      void Promise.resolve(supabase.from('matches').upsert({
        id:          room.roomId,
        player1_id:  room.player1.userId,
        player2_id:  room.player2?.userId,
        bet_amount:  room.betAmount,
        game_mode:   room.gameMode,
        status:      'playing',
        winner:      null,
        started_at:  new Date().toISOString(),
        finished_at: null
      }, { onConflict: 'id' })).catch(() => {});
    }

    // 📡 Ably: قناة اللعب + Presence (الحكم في اتصال/انقطاع المنافس)
    if (this._ablyConnected()) {
      this.ablyGameCh = this.ably.channels.get(`game_${room.roomId}`);
      this.ablyGameCh.subscribe('game_event', (msg: any) => {
        if (msg.clientId === this._userId) return;   // صدى ذاتي (Fix #37)
        this.pipe.onReceive(msg.data);
      });
      void this.ablyGameCh.presence.enter({ userId: this._userId });
      this.ablyGameCh.presence.subscribe('leave', (m: any) => {
        if (m.clientId !== this._userId) this._emit({ type: 'opponent_disconnected' });
      });
      this.ablyGameCh.presence.subscribe('enter', (m: any) => {
        if (m.clientId !== this._userId) { this._opponentSeen = true; this._emit({ type: 'opponent_connected' }); }
      });
    }

    // 🛰️ Supabase Realtime: قناة نقل احتياطية
    try {
      this._sbGameReady = false;
      this.sbGameCh = supabase
        .channel(`g_${room.roomId}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'm' }, (p: any) => { this.pipe.onReceive(p?.payload); })
        .subscribe((status: string) => { this._sbGameReady = status === 'SUBSCRIBED'; });
    } catch { this.sbGameCh = null; }

    // 📣 PubNub: قناة نقل احتياطية + قناة المتفرجين
    if (this.pubnub) {
      try {
        this.pubnub.subscribe({ channels: [`g_${room.roomId}`, `live_${room.roomId}`], withPresence: true });
        this._pubnubSubbedRoom = room.roomId;
      } catch { /* */ }
    }

    // ⚡ P2P: المضيف يبادر بالاتصال
    if (isHost && room.player2?.peerId && this.peer) {
      this._quality = 'connecting';
      this._emit({ type: 'connection_quality', quality: 'connecting' });
      const doConnect = () => {
        try {
          const conn = this.peer.connect(room.player2!.peerId, { reliable: true, serialization: 'json' });
          this._setupPeerConn(conn);
        } catch { /* سنبقى على القنوات السحابية */ }
      };
      if (this.peer.id) doConnect();
      else this.peer.on('open', doConnect);
    }

    // حارس الغياب: إن لم يظهر الخصم إطلاقاً (لا presence ولا أي رسالة) خلال 12ث
    // نعلن الانقطاع ليتكفل تدفق الهجر في App (حالة نادرة في سباق توفيق ثلاثي)
    this._opponentSeen = false;
    if (this._oppWaitTimer) clearTimeout(this._oppWaitTimer);
    this._oppWaitTimer = setTimeout(() => {
      if (!this._opponentSeen && this._roomId === room.roomId) {
        this._emit({ type: 'opponent_disconnected' });
      }
    }, 12000);

    this._recomputeQuality();
    this._emit({ type: 'match_found', room, isHost });
    _logEvent('match_started', { game_mode: room.gameMode, bet_amount: room.betAmount });
  }

  private _teardownRoomLanes() {
    try { void this.ablyGameCh?.presence.leave(); } catch { /* */ }
    try { void this.ablyGameCh?.unsubscribe(); } catch { /* */ }
    this.ablyGameCh = null;
    if (this.sbGameCh) { try { void supabase.removeChannel(this.sbGameCh); } catch { /* */ } }
    this.sbGameCh = null;
    this._sbGameReady = false;
    if (this.pubnub && this._pubnubSubbedRoom) {
      try { this.pubnub.unsubscribe({ channels: [`g_${this._pubnubSubbedRoom}`, `live_${this._pubnubSubbedRoom}`] }); } catch { /* */ }
      this._pubnubSubbedRoom = '';
    }
    if (this._oppWaitTimer) { clearTimeout(this._oppWaitTimer); this._oppWaitTimer = null; }
    try { this.peerConn?.close(); } catch { /* */ }
    this.peerConn = null;
    this._p2pActive = false;
  }

  // ── Send ─────────────────────────────────────────────────────
  private _moveSeqShadow = 0; // توافقية: NetworkMove.seq كما في v4

  sendMove(move: Pick<NetworkMove, 'from' | 'to' | 'captures' | 'isKingPromotion'>) {
    const packet: NetworkMove = {
      ...move, playerId: this._userId, seq: this._moveSeqShadow++, timestamp: Date.now()
    };
    const event: NetworkEvent = { type: 'move', move: packet };
    this.pipe.send(event);
    this._broadcastToViewers({ type: 'move', move: packet });
  }

  sendGameEvent(event: NetworkEvent) { this.pipe.send(event); }

  private _broadcastToViewers(data: any) {
    if (!this.pubnub || !this._roomId) return;
    try { void this.pubnub.publish({ channel: `live_${this._roomId}`, message: data }); } catch { /* */ }
  }

  // ── تسليم الأنبوب (مرتَّب ومنزوع التكرار سلفاً) ─────────────
  private _handleDelivered(event: NetworkEvent) {
    this._opponentSeen = true;
    this._emit(event);
  }

  // ── Finish Match ─────────────────────────────────────────────
  async finishMatch(winner: 'white' | 'black' | 'draw', eloChange: number) {
    if (!this._roomId) return;
    void Promise.resolve(supabase.from('matches')
      .update({ status: 'finished', winner, finished_at: new Date().toISOString() })
      .eq('id', this._roomId)).catch(() => {});
    Promise.resolve(
      supabase.rpc('update_elo', { player_id: this._userId, elo_change: eloChange })
    ).then(({ error }: any) => {
      if (!error) return;
      return Promise.resolve(
        supabase.from('players').select('elo').eq('id', this._userId).single()
      ).then(({ data }: any) => {
        if (data?.elo !== undefined) {
          void supabase.from('players')
            .update({ elo: Math.max(0, (data.elo as number) + eloChange) })
            .eq('id', this._userId);
        }
      });
    }).catch(() => { /* Supabase غير متاح */ });
    _logEvent('match_finished', { winner, elo_change: eloChange });
    this._broadcastToViewers({ type: 'game_over', winner });
    // القنوات تبقى حية عمداً — أحداث الإعادة (rematch) تستمر على نفس الغرفة،
    // والتفكيك الفعلي يحدث في disconnect() أو عند دخول غرفة جديدة.
    this._roomId = '';
  }

  // ── Leaderboard ──────────────────────────────────────────────
  async getLeaderboard(limit = 100): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id,display_name,avatar,elo,wins,losses,draws,country,is_online')
        .order('elo', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    } catch {
      return [];
    }
  }

  // ── Presence (الأصدقاء) ──────────────────────────────────────
  subscribeToPresence(friendIds: string[], onUpdate: (id: string, online: boolean) => void): () => void {
    if (!this.ably) return () => {};
    const ch = this.ably.channels.get('presence_global');
    const enterHandler = (m: any) => { if (friendIds.includes(m.clientId)) onUpdate(m.clientId, true); };
    const leaveHandler = (m: any) => { if (friendIds.includes(m.clientId)) onUpdate(m.clientId, false); };
    ch.presence.subscribe('enter', enterHandler);
    ch.presence.subscribe('leave', leaveHandler);
    void ch.presence.enter({ userId: this._userId });
    return () => {
      void ch.presence.unsubscribe('enter', enterHandler);
      void ch.presence.unsubscribe('leave', leaveHandler);
      void ch.presence.leave();
    };
  }

  // ── Watch Live (متفرجون) ─────────────────────────────────────
  watchLiveMatch(roomId: string, onEvent: (e: any) => void): () => void {
    if (!this.pubnub) return () => {};
    const ch = `live_${roomId}`;
    const listener = {
      message:  (e: any) => { if (e.channel === ch) onEvent(e.message); },
      presence: (e: any) => { if (e.channel === ch) onEvent({ type: 'viewer_count', count: e.occupancy }); }
    };
    this.pubnub.addListener(listener);
    try { this.pubnub.subscribe({ channels: [ch], withPresence: true }); } catch { /* */ }
    return () => {
      try { this.pubnub.removeListener(listener); } catch { /* */ }
      try { this.pubnub.unsubscribe({ channels: [ch] }); } catch { /* */ }
    };
  }

  // ── Friend Invite (قناتان) ───────────────────────────────────
  sendFriendInvite(toUserId: string, roomCode: string, myInfo: PlayerInfo) {
    const payload = { from: myInfo, roomCode, timestamp: Date.now() };
    if (this._ablyConnected()) {
      try { void this.ably.channels.get(`notify_${toUserId}`).publish('friend_invite', payload); } catch { /* */ }
    }
    try {
      const ch = supabase.channel(`nf_${toUserId}`, { config: { broadcast: { self: false } } });
      ch.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          void ch.send({ type: 'broadcast', event: 'friend_invite', payload });
          setTimeout(() => { void supabase.removeChannel(ch); }, 4000);
        }
      });
    } catch { /* */ }
  }

  private _onInvite: ((from: PlayerInfo, code: string) => void) | null = null;

  listenForInvites(onInvite: (from: PlayerInfo, code: string) => void) {
    this._onInvite = onInvite;
    if (this.ably) {
      this.ably.channels.get(`notify_${this._userId}`).subscribe('friend_invite', (msg: any) => {
        this._dispatchInvite(msg.data?.from, msg.data?.roomCode);
      });
    }
    // مسار Supabase مُفعَّل سلفاً في _subscribeSbNotify()
  }

  private _dispatchInvite(from: PlayerInfo | undefined, code: string | undefined) {
    if (!from || typeof code !== 'string' || !this._onInvite) return;
    // إزالة تكرار (نفس الدعوة قد تصل من القناتين)
    const key = `${from.userId}|${code}|${Math.floor(Date.now() / 10000)}`;
    if (this._inviteDedup.has(key)) return;
    this._inviteDedup.add(key);
    if (this._inviteDedup.size > 64) {
      this._inviteDedup = new Set(Array.from(this._inviteDedup).slice(-32));
    }
    this._onInvite(from, code);
  }

  // ── Upsert Profile ───────────────────────────────────────────
  private async _upsertProfile(info: Omit<PlayerInfo, 'userId'>) {
    if (!this._userId) return;
    try {
      await supabase.from('players').upsert({
        id:           this._userId,
        display_name: info.displayName,
        avatar:       info.avatar,
        elo:          info.elo,
        country:      info.country,
        is_online:    true,
        last_seen:    new Date().toISOString()
      }, { onConflict: 'id' });
    } catch { /* ignore */ }
  }

  // ── Cleanup ──────────────────────────────────────────────────
  async disconnect() {
    try {
      if (this._userId) {
        void supabase.from('players')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', this._userId);
      }
    } catch { /* ignore */ }
    this._clearSearchTimers();
    if (this._pipeTimer)      { clearInterval(this._pipeTimer);      this._pipeTimer = null; }
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    void Promise.resolve(
      supabase.from('matchmaking_queue').delete().eq('player_id', this._userId)
    ).catch(() => {});
    this._teardownRoomLanes();
    try { this.peer?.destroy(); } catch { /* */ }
    void this.ablyMatchmakingCh?.unsubscribe();
    try { void this.ably?.channels.get('presence_global').presence.leave(); } catch { /* */ }
    try { this.ably?.connection.close(); } catch { /* */ }
    if (this.sbNotifyCh) { try { void supabase.removeChannel(this.sbNotifyCh); } catch { /* */ } this.sbNotifyCh = null; }
    try { this.pubnub?.unsubscribeAll(); } catch { /* */ }
    this._roomId = '';
    this.listeners = [];
    this._quality = 'offline';
  }

  // ── Helpers ──────────────────────────────────────────────────
  private _recomputeQuality() {
    let q: ConnectionQuality;
    if (this._p2pActive && this.peerConn?.open) q = 'p2p';
    else if (this._ablyConnected() || this._sbGameReady || this.pubnub) q = 'relay';
    else q = 'offline';
    if (this._quality === q) return;
    this._quality = q;
    this._emit({ type: 'connection_quality', quality: q });
  }

  private _emit(event: NetworkEvent) {
    this.listeners.forEach(fn => fn(event));
  }

  on(listener: (event: NetworkEvent) => void): () => void {
    if (!this.listeners.includes(listener)) this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  // ── Getters (مطابقة لواجهة v4) ───────────────────────────────
  get myUserId()          { return this._userId; }
  get myPeerId()          { return this._peerId; }
  get isP2PActive()       { return this._p2pActive; }
  get connectionQuality() { return this._quality; }
  get currentRoomId()     { return this._roomId; }
  get amHost()            { return this._isHost; }
  get viewers()           { return this._viewers; }
  get isOnline()          { return !_isOfflineMode && (this._ablyConnected() || this._sbGameReady); }
  get environment()       { return _env; }
  get pipeStats()         { return this.pipe.stats; }
}

export const network = new NetworkManager();
export default network;
