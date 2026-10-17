import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { network, supabase, setAnalyticsEnabled, type NetworkEvent } from './network';
import * as ads from './ads';
import { useLang, LANGS, t, tf, fmtNum, type Lang } from './i18n';
import * as cosmetics from './cosmetics';
import { puzzleOfDay, decodeBoard, todayKey } from './puzzles';
import { loadPuzzleRecord, savePuzzleRecord, recordSolve, solvedToday } from './puzzlestate';
import { requestMove, resetMemory, releaseWorker } from './ai';
import {
  checkDrawCondition,
  createInitialBoard,
  createRandomMidGameBoard,
  evalWhitePOV,
  executeMove,
  getAllValidMoves,
  getCol,
  getRow,
  isBlack,
  isKing,
  isPlayerPiece,
  isWhite,
  positionKey,
  progressSignature,
  puzzleBestDefence,
  puzzleHoldsWin,
  type PieceType, type BoardType, type Move,
} from './engine';

// ==================== TYPES ====================
type Screen = 'home' | 'game' | 'friends' | 'leaderboard' | 'live' | 'profile' | 'training' | 'shop' | 'puzzle' | 'analysis';
type GameMode = 'quick' | 'series' | 'training' | 'friend' | 'watch';
type FriendStatus = 'accepted' | 'pending-out' | 'pending-in';
type FriendTab = 'accepted' | 'outgoing' | 'incoming';
type MatchAction = 'surrender-match' | 'surrender-series' | 'draw' | null;

interface Player {
  id: string;
  name: string;
  avatar: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  country: string;
  isOnline: boolean;
  isPlaying: boolean;
  isGeneral: boolean;
  level: number;
  winRate: number;
}

interface Friend extends Player {
  friendStatus: FriendStatus;
  lastSeen?: string;
}

interface LiveMatch {
  id: string;
  player1: Player;
  player2: Player;
  viewers: number;
  moveCount: number;
  betAmount?: number;
  featured?: boolean;
  rating?: string;
  startTime?: number;
  gameState?: any;
  isReal?: boolean;
}

// ==================== CONSTANTS ====================
const ARABIC_NAMES = [
  'الصقر_الذهبي', 'نمر_الصحراء', 'أسد_الأطلس', 'الذئب_الفضي', 'صقر_قريش',
  'فارس_العرب', 'سلطان_الرقعة', 'أسطورة_الميدان', 'سيد_الملوك', 'بطل_الضامة',
  'نجم_الشرق', 'عاصفة_الرمال', 'فهد_الليل', 'ملك_التحدي', 'حارس_القلعة',
  'محمد_العمري', 'أحمد_السعيد', 'خالد_المنصور', 'يوسف_المهدي', 'عمر_الشريف',
  'طارق_الأندلسي', 'حسن_البصري', 'علي_الحربي', 'سعد_الغامدي', 'فيصل_الدوسري',
  'عبدالله_القحطاني', 'ماجد_الراشد', 'نايف_العتيبي', 'تركي_آل_سعود', 'بدر_الشمري',
  'رائد_الحلبي', 'أنس_الدمشقي', 'زياد_البغدادي', 'كريم_المصري', 'ياسين_التونسي',
  'رشيد_المغربي', 'سفيان_الجزائري', 'حمزة_الليبي', 'إبراهيم_السوداني', 'مصطفى_العراقي',
  'وليد_اللبناني', 'أمين_الأردني', 'هشام_الفلسطيني', 'جمال_اليمني', 'سامي_العماني',
  'نادر_البحريني', 'فؤاد_الكويتي', 'حاتم_القطري', 'منير_الإماراتي', 'رامي_الموريتاني',
  'سيف_الدين', 'بهاء_الدين', 'نور_الهدى', 'شمس_الدين', 'ضياء_الحق',
  'ساري_الليل', 'نسر_الجبل', 'غزال_البر', 'رعد_الشمال', 'برق_الشرق',
  'عثمان_النجار', 'فارس_الهواري', 'طلال_المري', 'زكريا_الفهد', 'جواد_الباشا',
  'سيف_النصر', 'غانم_الدوسري', 'محمود_الحسن', 'فاروق_الزين', 'راشد_الماجد'
];

const ENGLISH_NAMES = [
  'Dragon_Master', 'Shadow_Knight', 'Phoenix_Elite', 'Golden_Eagle', 'Storm_Rider',
  'Thunder_Bolt', 'Dark_Wolf', 'Silver_Fox', 'Iron_King', 'Crystal_Queen',
  'Michael_King', 'Alex_Thunder', 'James_Wilson', 'Sarah_Connor', 'Emma_Johnson', 
  'Chris_Brown', 'Laura_Davis', 'Daniel_Taylor', 'Robert_Anderson', 'Lisa_Thomas', 
  'Mark_Jackson', 'Jennifer_White', 'Steven_Harris', 'Jessica_Martin', 'Andrew_Thompson',
  'Ashley_Robinson', 'Joshua_Clark', 'Amanda_Lewis', 'Ryan_Walker', 'Stephanie_Hall',
  'Titan_Slayer', 'Ghost_Rider', 'Cyber_Ninja', 'Venom_Strike', 'Alpha_Wolf',
  'William_Blake', 'David_Miller', 'Richard_Moore', 'Joseph_Taylor', 'Thomas_Anderson'
];

const SPANISH_NAMES = [
  'Carlos_Leo', 'Miguel_Pro', 'Pedro_Rex', 'Diego_Star', 'Pablo_Moon',
  'Alejandro_Cruz', 'Javier_Silva', 'Mateo_Ruiz', 'Isabella_Gomez', 'Sofia_Ortiz',
  'Valentina_Diaz', 'Camila_Reyes', 'Matias_Alvarez', 'Sebastian_Romero', 'Nicolas_Herrera',
  'Elena_Torres', 'Lucia_Flores', 'Victoria_Ramos', 'Gabriel_Molina', 'Daniela_Castro',
  'Fernando_Rios', 'Jorge_Morales', 'Ricardo_Ortiz', 'Hugo_Dominguez', 'Martin_Vazquez'
];

const FRENCH_NAMES = [
  'Pierre_Jet', 'Louis_Max', 'François_H', 'Antoine_Dupont', 'Julien_Laurent',
  'Camille_Roux', 'Chloé_Moreau', 'Marie_Simon', 'Léa_Michel', 'Mathilde_Leroy',
  'Nicolas_García', 'Thomas_David', 'Alexandre_Richard', 'Lucas_Bernard', 'Hugo_Petit',
  'Emma_Durand', 'Juliette_Dubois', 'Sarah_Morel', 'Clément_Lefebvre', 'Arthur_Mercier',
  'Gabriel_Blanc', 'Raphael_Garnier', 'Leo_Chevalier', 'Nathan_Francois', 'Paul_Legrand'
];

const ASIAN_NAMES = [
  'Wei_Chen', 'Li_Wei', 'Zhang_Min', 'Wang_Fang', 'Liu_Jing', // Chinese
  'Yuki_Tanaka', 'Haruto_Sato', 'Sota_Suzuki', 'Yui_Takahashi', 'Hina_Watanabe', // Japanese
  'Min_Jun', 'Seo_Yeon', 'Ji_Hoon', 'Ha_Eun', 'Do_Yoon', // Korean
  'Ryu_Jin', 'Kenji_Storm', 'Hiroshi_X', 'Mei_Ling', 'Sakura_Y',
  'Chen_Bo', 'Yang_Lin', 'Toshiro_M', 'Akira_K', 'Ji_Woo'
];

const PORTUGUESE_NAMES = [
  'Joao_Silva', 'Maria_Santos', 'Ana_Oliveira', 'Pedro_Souza', 'Lucas_Rodrigues',
  'Mateus_Ferreira', 'Julia_Alves', 'Beatriz_Lima', 'Gabriel_Gomes', 'Enzo_Costa',
  'Lara_Ribeiro', 'Manuela_Martins', 'Arthur_Carvalho', 'Miguel_Almeida', 'Heitor_Lopes',
  'Rafael_Fernandes', 'Gustavo_Pereira', 'Alice_Gomes', 'Sophia_Martins', 'Laura_Barbosa'
];

const RUSSIAN_NAMES = [
  'Ivan_Ivanov', 'Dmitry_Smirnov', 'Sergey_Popov', 'Andrey_Sokolov', 'Alexey_Volkov',
  'Alexander_Lebedev', 'Maxim_Kozlov', 'Vladimir_Novikov', 'Ilya_Morozov', 'Anna_Petrova'
];

// Combine all names (Over 200 total)
const ALL_NAMES = [
  ...ARABIC_NAMES, 
  ...ENGLISH_NAMES, 
  ...SPANISH_NAMES, 
  ...FRENCH_NAMES, 
  ...ASIAN_NAMES, 
  ...PORTUGUESE_NAMES,
  ...RUSSIAN_NAMES
];

const AVATARS = ['🦅', '🐉', '🦁', '🐺', '🦊', '🐯', '🦈', '🦉', '🐻', '🦇',
  '👤', '👨', '👩', '🧑', '👦', '👧', '🧔', '👱', '🧕', '🎭',
  '⚡', '🔥', '💎', '🌟', '🎯', '🏆', '👑', '🛡️', '⚔️', '🎪'];

const COUNTRIES = ['🇲🇦', '🇸🇦', '🇪🇬', '🇩🇿', '🇹🇳', '🇮🇶', '🇯🇴', '🇱🇧', '🇦🇪', '🇶🇦',
  '🇰🇼', '🇧🇭', '🇴🇲', '🇾🇪', '🇸🇩', '🇱🇾', '🇲🇷', '🇵🇸', '🇸🇾', '🇺🇸',
  '🇬🇧', '🇫🇷', '🇪🇸', '🇩🇪', '🇮🇹', '🇧🇷', '🇦🇷', '🇲🇽', '🇨🇦', '🇦🇺',
  '🇯🇵', '🇰🇷', '🇨🇳', '🇷🇺', '🇵🇹'];

const BET_OPTIONS = [0, 100, 500, 1000, 5000, 10000, 50000, 100000];

// ==================== GENERATE PLAYERS ====================
function generatePlayers(): Player[] {
  // Get all unique names
  const uniqueNames = [...new Set(ALL_NAMES)];
  
  // Shuffle names so we get a good mix of nationalities in the first 200
  for (let i = uniqueNames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueNames[i], uniqueNames[j]] = [uniqueNames[j], uniqueNames[i]];
  }
  
  // Take exactly 200 players
  const selectedNames = uniqueNames.slice(0, 200);
  
  // Shuffle avatars and countries to be more random
  const shuffledAvatars = [...AVATARS].sort(() => Math.random() - 0.5);
  const shuffledCountries = [...COUNTRIES].sort(() => Math.random() - 0.5);
  
  return selectedNames.map((name, i) => {
    // Generate realistic ELO distribution (bell curve around 1400)
    let elo = 800;
    const r = Math.random();
    if (r < 0.1) elo = 800 + Math.floor(Math.random() * 400); // 10% Noobs (800-1200)
    else if (r < 0.6) elo = 1200 + Math.floor(Math.random() * 400); // 50% Average (1200-1600)
    else if (r < 0.9) elo = 1600 + Math.floor(Math.random() * 400); // 30% Good (1600-2000)
    else elo = 2000 + Math.floor(Math.random() * 400); // 10% Pros (2000-2400)

    const totalGames = Math.floor(elo * 0.5 + Math.random() * 500);
    const winRateVal = 0.3 + (elo / 4000) + (Math.random() * 0.1); // Higher elo = higher win rate
    const wins = Math.floor(totalGames * winRateVal);
    const losses = totalGames - wins;
    const level = Math.max(1, Math.floor(elo / 100) - 5);

    return {
      id: `p${i}`,
      name,
      avatar: shuffledAvatars[i % shuffledAvatars.length],
      elo,
      wins,
      losses,
      draws: Math.floor(totalGames * 0.05),
      coins: Math.floor(Math.random() * 50000) + (elo * 10),
      country: shuffledCountries[i % shuffledCountries.length],
      isOnline: Math.random() > 0.4,
      isPlaying: Math.random() > 0.7,
      isGeneral: true,
      level,
      winRate: Math.round(winRateVal * 100)
    };
  });
}

// ==================== MAIN APP ====================
const App: React.FC = () => {
  // Auth & Global state — profile persisted in localStorage (Fix #1)
  const _saved = (() => { try { return JSON.parse(localStorage.getItem('damaProfile') || '{}'); } catch { return {}; } })();
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!_saved.isLoggedIn);
  const [screen, setScreen] = useState<Screen>('home');
  const [players] = useState<Player[]>(() => generatePlayers());

  const [coins,    setCoins]    = useState<number>(() => _saved.coins    ?? 5420);
  const [myElo,    setMyElo]    = useState<number>(() => _saved.myElo    ?? 1200);
  const [myWins,   setMyWins]   = useState<number>(() => _saved.myWins   ?? 45);
  const [myLosses, setMyLosses] = useState<number>(() => _saved.myLosses ?? 23);
  const [myDraws,  setMyDraws]  = useState<number>(() => _saved.myDraws  ?? 8);
  // myLevel derives from myWins — no useState needed
  // const [myLevel] removed: computed below

  // Friends state
  const [friends, setFriends] = useState<Friend[]>(() => {
    // Fix 5: persist real friends across sessions; seed AI friends for new users
    try {
      const saved = localStorage.getItem('damaFriends');
      if (saved) return JSON.parse(saved) as Friend[];
    } catch { /* ignore parse errors */ }
    // First launch — seed with AI friends only
    const f: Friend[] = [];
    for (let i = 0; i < 5; i++) {
      f.push({ ...players[i], friendStatus: 'accepted', lastSeen: 'متصل الآن' });
    }
    for (let i = 5; i < 8; i++) {
      f.push({ ...players[i], friendStatus: 'pending-out', lastSeen: 'منذ ساعة' });
    }
    for (let i = 8; i < 11; i++) {
      f.push({ ...players[i], friendStatus: 'pending-in', lastSeen: 'منذ دقائق' });
    }
    return f;
  });

  // Game state
  const [board, setBoard] = useState<BoardType>(createInitialBoard);
  const [isWhiteTurn, setIsWhiteTurn] = useState(true);
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [validMoves, setValidMoves] = useState<number[]>([]);
  const [selectedMoves, setSelectedMoves] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>('quick');
  const [opponent, setOpponent] = useState<Player | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'white' | 'black' | 'draw' | null>(null);
  const [timer, setTimer] = useState(15);
  const [autoPlay, setAutoPlay] = useState(false);
  const [movesSinceLastCapture, setMovesSinceLastCapture] = useState(0);
  // تتبّع التعادل: تكرار ثلاثي + ركود بلا تقدّم (مكان واحد يغطّي كل مسارات الحركة)
  const drawRef = useRef({ seen: new Map<string, number>(), sig: '', stall: 0, lastKey: '' });
  const [betAmount, setBetAmount] = useState(0);
  const [trainingLevel, setTrainingLevel] = useState(5);

  // Settings state
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('damaSettings');
    try {
      return saved ? JSON.parse(saved) : {
        notifications: true, privacy: false,
        sounds: true, vibration: true, analytics: true
      };
    } catch {
      return { notifications: true, privacy: false, sounds: true, vibration: true, analytics: true };
    }
  });

  useEffect(() => {
    localStorage.setItem('damaSettings', JSON.stringify(settings));
    // FIX3: sync analytics toggle to network layer
    setAnalyticsEnabled(settings.analytics ?? true);
  }, [settings]);

  // ── المتجر: الأطقم المملوكة والمُجهَّزة ───────────────────────────────
  // كل ما في المتجر تجميلي: لا يغيّر قاعدة ولا يمنح ميزة في اللعب.
  const [cos, setCos] = useState<cosmetics.CosState>(() => cosmetics.load());
  useEffect(() => { cosmetics.save(cos); }, [cos]);
  const [shopTab, setShopTab] = useState<cosmetics.CosCat>('board');
  const [shopAdAt, setShopAdAt] = useState(0);        // آخر إعلان بمكافأة (لمنع الضغط المتكرر)
  const boardSkin    = useMemo(() => cosmetics.boardOf(cos),    [cos]);
  const pieceSkin    = useMemo(() => cosmetics.piecesOf(cos),   [cos]);
  const backdropSkin = useMemo(() => cosmetics.backdropOf(cos), [cos]);
  const backdropCss  = useMemo(() => cosmetics.backdropStyle(backdropSkin), [backdropSkin]);

  // ── لغز اليوم ─────────────────────────────────────────────────────────
  // لغز واحد لكل العالم كل يوم (يُحسب بالتوقيت العالمي). الحالة مستقلة
  // تماماً عن حالة المباراة: لا مؤقّت ولا شبكة ولا خصم آلي — فلا يمكن
  // لوضع الألغاز أن يُعطّل اللعب العادي.
  const todayPuzzle = useMemo(() => puzzleOfDay(), []);
  const [pzBoard, setPzBoard]   = useState<BoardType>(() => decodeBoard(todayPuzzle.b));
  const [pzSel, setPzSel]       = useState<number | null>(null);
  const [pzLeft, setPzLeft]     = useState(todayPuzzle.n);
  const [pzState, setPzState]   = useState<'play' | 'won' | 'lost'>('play');
  const [pzClean, setPzClean]   = useState(true);     // بلا خطأ واحد؟
  const [pzBusy, setPzBusy]     = useState(false);
  const [pzRecord, setPzRecord] = useState(() => loadPuzzleRecord());

  // ── تحليل المباراة ────────────────────────────────────────────────────
  interface LogItem { before: BoardType; from: number; to: number; captures: number[]; byWhite: boolean }
  interface Verdict {
    ply: number;          // رقم حركة اللاعب كما يراها (1، 2، 3…)
    from: number; to: number;
    lost: number;         // قطع خسرها اللاعب في ردّ الخصم المباشر
    gained: number;       // قطع أكلها في حركته
    drop: number;         // فرق تقييم المحرّك بين الأفضل وما لُعب
    best: { from: number; to: number } | null;
    grade: 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
    board: BoardType;     // الموضع قبل الحركة — لعرضه على رقعة مصغّرة
  }
  const logRef = useRef<{ prev: BoardType | null; items: LogItem[] }>({ prev: null, items: [] });
  const [analysis, setAnalysis] = useState<Verdict[] | null>(null);
  const [anProgress, setAnProgress] = useState(0);   // 0..100، 0 = لا تحليل جارٍ
  const [anPick, setAnPick] = useState<number | null>(null);
  const anCancel = useRef(false);

  const resetPuzzle = useCallback(() => {
    setPzBoard(decodeBoard(todayPuzzle.b));
    setPzSel(null);
    setPzLeft(todayPuzzle.n);
    setPzState('play');
    setPzBusy(false);
  }, [todayPuzzle]);

  // Series state
  const [seriesWins, setSeriesWins] = useState(0);
  const [seriesLosses, setSeriesLosses] = useState(0);
  const [, setSeriesRounds] = useState<('win' | 'loss' | 'draw')[]>([]);


  // UI state
  const [showBetModal, setShowBetModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<MatchAction>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [friendRequestStatus, setFriendRequestStatus] = useState<string>('');
  const [pendingGameMode, setPendingGameMode] = useState<GameMode>('quick');
  const [friendTab, setFriendTab] = useState<FriendTab>('accepted');
  const [notification, setNotification] = useState('');

  // Profile Edit State — persisted (Fix #1)
  const [myName,    setMyName]   = useState<string>(() => _saved.myName    || 'لاعب_مستعار');
  const [myAvatar,  setMyAvatar] = useState<string>(() => _saved.myAvatar  || '👤');
  const [myCountry, setMyCountry]= useState<string>(() => _saved.myCountry || '🇲🇦');
  const [referralCode, setReferralCode] = useState('');
  const [enteredReferral, setReferralInput] = useState('');
  const [showInviteSentModal, setShowInviteSentModal] = useState(false);
  const [inviteOpponent, setInviteOpponent] = useState<Player | null>(null);
  const [roomCode, setRoomCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const refreshRoomCode = () => setRoomCode(Math.random().toString(36).substring(2, 8).toUpperCase());
  const [showRoomCodeInput, setShowRoomCodeInput] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [showFriendPlayModal, setShowFriendPlayModal] = useState(false);
  const [showMatchmakingModal, setShowMatchmakingModal] = useState(false);
  const [matchmakingTimer, setMatchmakingTimer] = useState(20);
  const matchmakingRef = useRef<any>(null);
  // Ref mirror of pendingGameMode — always current inside network callbacks (Fix #11)
  const pendingGameModeRef = useRef<GameMode>('quick');
  // Ref mirror of opponent — avoids stale closure in handleNetworkEvent (Fix #31)
  const opponentRef = useRef<Player | null>(null);
  // Fix #27: grace-period timer for opponent disconnection (forfeit-by-abandonment)
  const disconnectTimerRef = useRef<any>(null);
  // Ref mirror of gameOver — always current inside network callbacks (stale closure fix)
  const gameOverRef = useRef(false);
  // CRITICAL: stable ref to handleNetworkEvent — prevents accumulating listeners
  // when isRealMatch changes and handleNetworkEvent gets a new identity
  const handleNetworkEventRef = useRef<((e: any) => void) | null>(null);
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [reconnectSecondsLeft, setReconnectSecondsLeft] = useState(45);
  // Fix #29: real incoming draw offer from a human opponent (needs accept/reject UI)
  const [incomingDrawOffer, setIncomingDrawOffer] = useState(false);
  // Fix G: incoming game invite from friend
  const [incomingInvite, setIncomingInvite] = useState<{ from: any; code: string } | null>(null);
  // Fix #31: replace window.prompt with inline pickers
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  // Fix #33: leaderboard fetches real Supabase data
  const [lbPlayers, setLbPlayers] = useState<any[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  // Fix #31: real-match rematch/next-round coordination state
  const [incomingRematchOffer, setIncomingRematchOffer] = useState(false);
  const [waitingForRematch, setWaitingForRematch] = useState(false);
  // Fix #33: auto-cancel a rematch request that nobody answers within 20s
  const rematchTimeoutRef = useRef<any>(null);

  // Watch state
  const [watchBoard, setWatchBoard] = useState<BoardType>(createInitialBoard);
  const [watchTurn, setWatchTurn] = useState(true);
  const [watchMatch, setWatchMatch] = useState<LiveMatch | null>(null);
  const [watchGameOver, setWatchGameOver] = useState(false);
  const [watchWinner, setWatchWinner] = useState<'white' | 'black' | 'draw' | null>(null);

  const timerRef = useRef<any>(null);
  const generalTimerRef = useRef<any>(null);

  // ── نظام اللغات: أربع لغات مع كشف تلقائي حسب الدولة ──
  const { lang, dir, setLang: switchLang } = useLang();
  const [showLangPicker, setShowLangPicker] = useState(false);
  // تناوب البادئ في المباريات المحلية (ضد الجنرال والتدريب) — يُحفظ بين الجلسات.
  // المباريات الشبكية لا تُمَس: تغيير الدور فيها يحتاج اتفاق الطرفين وإلا حدث تنافر.
  const startParityRef = useRef<number>((() => {
    try { return parseInt(localStorage.getItem('damaStartParity') || '0', 10) || 0; } catch { return 0; }
  })());

  // ── الإعلانات: ارتفاع البانر يُحجز له مساحة حتى لا يغطّي أي زر ──
  const [bannerH, setBannerH] = useState(0);
  const [adPrivacyRequired, setAdPrivacyRequired] = useState(false);

  // اختيار المنافس: الأقرب تصنيفاً أولاً (عشوائي بين أقرب ثلاثة) —
  // يعطي تزويجاً معقولاً ومباراة متكافئة بدل خصم عشوائي بعيد المستوى.
  const pickOpponent = (): Player => {
    if (players.length > 0) {
      const sorted = [...players].sort(
        (a, b) => Math.abs(a.elo - myElo) - Math.abs(b.elo - myElo)
      );
      const pool = sorted.slice(0, Math.min(3, sorted.length));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return { ...pick, isOnline: true, isPlaying: false };
    }
    const drift = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.floor(Math.random() * 60));
    const elo = Math.max(800, myElo + drift);
    return {
      id: 'opp_' + Date.now(), name: t('منافس'), avatar: '👤', elo,
      wins: 0, losses: 0, draws: 0, country: '🌍',
      isOnline: true, isPlaying: false, isGeneral: true,
      level: Math.floor(elo / 100), winRate: 50,
    };
  };

  // ── NETWORK / MULTIPLAYER STATE ───────────────────────
  const [netStatus, setNetStatus] = useState<'offline' | 'connecting' | 'online'>('offline');
  const [isRealMatch, setIsRealMatch] = useState(false);  // true = real human opponent
  const [p2pLabel, setP2pLabel] = useState<string>('');   // 'P2P' | 'Ably' | ''
  const netInitialized = useRef(false);
  // Keep ref in sync with state (Fix #11)
  useEffect(() => { pendingGameModeRef.current = pendingGameMode; }, [pendingGameMode]);
  useEffect(() => { opponentRef.current = opponent; }, [opponent]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  // Daily Reward & Chat State
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [dailyRewardClaimed, setDailyRewardClaimed] = useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{id: number, emoji: string, isOpponent: boolean}[]>([]);
  const [floatingPoints, setFloatingPoints] = useState<{id: number, pos: number, text: string}[]>([]);
  const emojiIdCounter = useRef(0);
  const floatTimersRef = useRef<any[]>([]); // track floating element timeouts
  const pointsIdCounter = useRef(0);

  // Show notification
  const notifTimerRef = useRef<any>(null);
  const showNotif = useCallback((msg: string) => {
    if (!settings.notifications) return;
    setNotification(msg);
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => { setNotification(''); notifTimerRef.current = null; }, 3000);
  }, [settings.notifications]);

  // Fix #1: persist profile & progress to localStorage (after all states declared)
  useEffect(() => {
    localStorage.setItem('damaProfile', JSON.stringify({
      isLoggedIn, coins, myElo, myWins, myLosses, myDraws,
      myName, myAvatar, myCountry
    }));
  }, [isLoggedIn, coins, myElo, myWins, myLosses, myDraws, myName, myAvatar, myCountry]);

  // Fix 5: persist friends list (only accepted+pending, not AI seeds)
  useEffect(() => {
    try { localStorage.setItem('damaFriends', JSON.stringify(friends)); } catch { /* quota */ }
  }, [friends]);

  // Derived level — auto-updates as wins grow (1 level per 5 wins, cap 50)
  const myLevel = Math.min(50, 1 + Math.floor(myWins / 5));

  // ── NETWORK INIT ─────────────────────────────────────
  useEffect(() => {
    if (netInitialized.current || !isLoggedIn) return;
    netInitialized.current = true;
    setNetStatus('connecting');

    network.init({ displayName: myName, avatar: myAvatar, elo: myElo, country: myCountry })
      .then(() => {
        setNetStatus('online');
        // Fix #22: register global event listener right after init
        // so events from joinByRoomCode and hostRoomCode also arrive
        // CRITICAL: register ONE stable wrapper — delegates to ref so we never
        // accumulate duplicate listeners when handleNetworkEvent identity changes
        network.on((e) => { handleNetworkEventRef.current?.(e); });
        // Fix G: route incoming Ably invites — empty code = friend request, non-empty = game invite
        network.listenForInvites((from, code) => {
          if (!code) {
            // Friend request or acceptance
            setFriends(prev => {
              const exists = prev.find(f => f.id === from.userId);
              if (exists) {
                // They accepted our request — upgrade to accepted
                return prev.map(f => f.id === from.userId ? { ...f, friendStatus: 'accepted' as const } : f);
              }
              // New incoming request
              return [...prev, {
                id: from.userId, name: from.displayName, avatar: from.avatar,
                elo: from.elo, country: from.country, level: Math.floor(from.elo / 100),
                wins: 0, losses: 0, draws: 0, winRate: 50, coins: 0,
                isOnline: true, isPlaying: false, isGeneral: false,
                friendStatus: 'pending-in' as const, lastSeen: t('الآن')
              }];
            });
            showNotif(tf('👋 طلب صداقة جديد من {0}!', from.displayName));
          } else {
            // Game invite — show popup
            setIncomingInvite({ from, code });
            showNotif(tf('📨 دعوة لعب من {0}!', from.displayName));
          }
        });
      })
      .catch(() => {
        setNetStatus('offline');
      });

    // Mark offline when user closes tab or hides app
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void supabase.from('players')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', network.myUserId);
      } else {
        void supabase.from('players')
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq('id', network.myUserId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      network.disconnect();
      // Clean up all intervals/timers on unmount
      if (matchmakingRef.current) { clearInterval(matchmakingRef.current); }
      if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); }
      if (notifTimerRef.current) { clearTimeout(notifTimerRef.current); }
      if (rematchTimeoutRef.current) { clearTimeout(rematchTimeoutRef.current); }
      if (generalTimerRef.current) { clearTimeout(generalTimerRef.current); }
      if (timerRef.current) { clearInterval(timerRef.current); }
      floatTimersRef.current.forEach(clearTimeout);
      floatTimersRef.current = [];
    };
  }, [isLoggedIn]);

  // Fix #5: keep Supabase profile in sync when name/elo changes mid-session
  useEffect(() => {
    if (!isLoggedIn || netStatus !== 'online') return;
    void supabase.from('players').update({
      display_name: myName, avatar: myAvatar, elo: myElo, country: myCountry,
      last_seen: new Date().toISOString()
    }).eq('id', network.myUserId);
  }, [myName, myAvatar, myElo, myCountry, isLoggedIn, netStatus]);
  // Fix #33 (moved here - Rules of Hooks): fetch leaderboard when screen opens
  useEffect(() => {
    if (screen !== 'leaderboard') return;
    setLbLoading(true);
    setLbPlayers([]); // clear stale data while fetching
    const fallback = () => {
      const local = [...players].sort((a, b) => b.elo - a.elo).slice(0, 20);
      setLbPlayers(local.map(p => ({
        id: p.id, display_name: p.name, avatar: p.avatar,
        elo: p.elo, wins: p.wins, losses: p.losses, country: p.country,
        is_online: p.isOnline
      })));
      setLbLoading(false);
    };
    network.getLeaderboard(50).then(data => {
      if (data && data.length > 0) { setLbPlayers(data); setLbLoading(false); }
      else fallback();
    }).catch(fallback);
  }, [screen]);

  // ── NETWORK EVENT HANDLER ─────────────────────────────
  const handleNetworkEvent = useCallback((event: NetworkEvent) => {
    switch (event.type) {
      case 'match_found': {
        const { room, isHost } = event;
        const opp = isHost ? room.player2! : room.player1;
        const oppPlayer = {
          id: opp.userId,
          name: opp.displayName,
          avatar: opp.avatar,
          elo: opp.elo,
          wins: 0, losses: 0, draws: 0,
          country: opp.country,
          isOnline: true, isPlaying: true,
          isGeneral: false, level: Math.floor(opp.elo / 100),
          winRate: 50
        };
        // Cancel local interval — network won the race (Fix #10)
        if (matchmakingRef.current) { clearInterval(matchmakingRef.current); matchmakingRef.current = null; }
        setShowMatchmakingModal(false);
        setShowFriendPlayModal(false);
        setShowInviteSentModal(false);
        // Use ref for always-current game mode (Fix #11), realMatch=true silences AI (Fix #18)
        // isNewSeries only if starting fresh — not continuing a rematch
        const _newS = pendingGameModeRef.current === 'series' && !waitingForRematch;
        startGame(pendingGameModeRef.current, oppPlayer, true, _newS);
        showNotif(tf('🌍 تم إيجاد منافس حقيقي: {0}!', opp.displayName));
        break;
      }
      case 'move': {
        if (!isRealMatch) break;
        // Fix #27: any incoming move proves the opponent is alive — cancel forfeit watchdog
        if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
        if (showReconnecting) setShowReconnecting(false);
        const m = event.move;
        // Only apply opponent's move (not ours)
        if (m.playerId !== network.myUserId) {
          const mv = { from: m.from, to: m.to, captures: m.captures, isKingPromotion: m.isKingPromotion };
          setBoard(prev => {
            // Anti-cheat (Fix #24): validate the incoming move against the legal move list
            // before ever touching the board. A forged/out-of-protocol move is silently rejected
            // and we ask the opponent's client to resync instead of trusting raw coordinates.
            const legalMoves = getAllValidMoves(prev, false); // opponent is always black
            const isLegal = legalMoves.some(lm =>
              lm.from === mv.from &&
              lm.to === mv.to &&
              lm.captures.length === mv.captures.length &&
              lm.captures.every(c => mv.captures.includes(c))
            );
            if (!isLegal) {
              // [anti-cheat] illegal move rejected silently in production
              network.sendGameEvent({ type: 'error', message: 'ILLEGAL_MOVE_REJECTED' });
              return prev; // board unchanged — protects local state integrity
            }
            const newBoard = executeMove(prev, mv, false);
            setLastMove({ from: mv.from, to: mv.to });
            const nextMoves = getAllValidMoves(newBoard, true);
            if (nextMoves.length === 0) {
              setGameOver(true); setWinner('black'); handleGameEnd('black');
            } else {
              setIsWhiteTurn(true);
            }
            return newBoard;
          });
        }
        setP2pLabel(network.isP2PActive ? '⚡P2P' : '☁️Ably');
        break;
      }
      case 'opponent_connected':
        // Fix #35: this event now fires both from P2P 'open' and Ably presence 'enter',
        // so the label/message must reflect what's actually active, not assume P2P.
        setP2pLabel(network.isP2PActive ? '⚡P2P' : '☁️Ably');
        if (network.isP2PActive) showNotif(t('⚡ اتصال مباشر P2P نشط!'));
        else showNotif(t('✅ المنافس متصل (عبر السيرفر)'));
        // Fix #27: opponent is back — cancel any pending forfeit-by-abandonment countdown
        if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
        setShowReconnecting(false);
        break;
      case 'opponent_disconnected':
        setP2pLabel(network.isP2PActive ? '⚡P2P' : '');
        setIncomingDrawOffer(false); // Fix J: clear draw offer — can't respond to disconnected player
        showNotif(network.isP2PActive ? t('⚠️ انقطع الاتصال المباشر') : t('⚠️ انقطع اتصال المنافس بالسيرفر'));
        // Fix #27 (creative): grace-period watchdog — if the opponent never reconnects
        // and sends no further moves within 45s, declare them forfeited so the match
        // doesn't freeze forever waiting on a dead peer.
        if (isRealMatch && !gameOverRef.current) { // use ref — avoids stale closure
          setReconnectSecondsLeft(45);
          setShowReconnecting(true);
          if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
          disconnectTimerRef.current = setInterval(() => {
            setReconnectSecondsLeft(prev => {
              if (prev <= 1) {
                clearInterval(disconnectTimerRef.current);
                disconnectTimerRef.current = null;
                setShowReconnecting(false);
                // Opponent abandoned — local player wins by forfeit
                setGameOver(true);
                setWinner('white');
                handleGameEnd('white');
                // Tell the opponent they lost by abandonment (in case they reconnect)
                network.sendGameEvent({ type: 'game_over', winner: 'white', reason: 'abandonment' });
                void network.finishMatch('white', 25);
                showNotif(t('🏆 انسحب المنافس، فوز بالاستسلام!'));
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
        break;
      case 'game_over':
        if (isRealMatch) {
          setGameOver(true);
          setWinner(event.winner);
          handleGameEnd(event.winner);
          // Fix #26: persist result to Supabase from the receiving side too.
          // Whoever gets this event is 'white' locally and 'black' to the sender,
          // so we mirror the ELO delta accordingly instead of leaving Supabase stale.
          const myDelta = event.winner === 'white' ? 25 : event.winner === 'draw' ? 0 : -15;
          void network.finishMatch(event.winner, myDelta);
        }
        break;
      case 'draw_offer':
        // Fix #29: surface a real accept/reject prompt instead of a passive notification
        setIncomingDrawOffer(true);
        showNotif(t('🤝 منافسك يطلب التعادل!'));
        break;
      case 'draw_accepted':
        setGameOver(true);
        setWinner('draw');
        handleGameEnd('draw');
        if (isRealMatch) void network.finishMatch('draw', 0);
        showNotif(t('🤝 وافق المنافس على التعادل!'));
        break;
      case 'draw_rejected':
        showNotif(t('❌ رفض المنافس طلب التعادل'));
        break;
      case 'rematch_request':
        // Fix #31: opponent wants the next round of a real-match series
        setIncomingRematchOffer(true);
        showNotif(t('🔄 المنافس يطلب المباراة التالية!'));
        break;
      case 'rematch_accepted':
        // Fix #31: opponent agreed — both sides start the next round together
        setWaitingForRematch(false);
        if (rematchTimeoutRef.current) { clearTimeout(rematchTimeoutRef.current); rematchTimeoutRef.current = null; }
        if (opponentRef.current) startGame(pendingGameModeRef.current, opponentRef.current, true, false);
        showNotif(t('✅ وافق المنافس، بدأت الجولة التالية!'));
        break;
      case 'rematch_rejected':
        // Fix #32: stop waiting if the opponent declined the next round
        setWaitingForRematch(false);
        if (rematchTimeoutRef.current) { clearTimeout(rematchTimeoutRef.current); rematchTimeoutRef.current = null; }
        showNotif(t('❌ رفض المنافس الجولة التالية'));
        break;
      case 'emoji':
        { const id = Date.now();
          setFloatingEmojis(prev => [...prev, { id, emoji: event.emoji, isOpponent: true }]);
          floatTimersRef.current.push(setTimeout(() => setFloatingEmojis(prev => prev.filter(x => x.id !== id)), 2500)); }
        break;
      case 'connection_quality':
        // Fix L: show quality in the P2P label
        if (event.quality === 'p2p')       setP2pLabel('⚡P2P');
        else if (event.quality === 'relay') setP2pLabel('☁️Ably');
        else if (event.quality === 'connecting') setP2pLabel('🔄...');
        else                                setP2pLabel('');
        break;
      case 'live_viewers':
        // Fix M: could show viewer count overlay on game screen (stored in network.viewers)
        break;
      case 'error':
        if (event.message === 'TIMEOUT_NO_OPPONENT') {
          // Already handled in matchmaking modal
        } else if (event.message === 'ILLEGAL_MOVE_REJECTED') {
          showNotif(t('⚠️ تم رفض حركة غير قانونية من المنافس'));
        }
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealMatch, showNotif]); // startGame/handleGameEnd are stable; pendingGameMode via ref (Fix #11)

  // Keep stable ref in sync — must be AFTER handleNetworkEvent is declared
  useEffect(() => { handleNetworkEventRef.current = handleNetworkEvent; }, [handleNetworkEvent]);

  useEffect(() => {
    const hasClaimed = localStorage.getItem('damaDailyReward');
    if (!hasClaimed) {
      setTimeout(() => setShowDailyReward(true), 1500);
    } else {
      // Check if it's a new day
      const lastDate = new Date(parseInt(hasClaimed)).toDateString();
      if (lastDate !== new Date().toDateString()) {
        setTimeout(() => setShowDailyReward(true), 1500);
      }
    }
  }, []);

  // Opponent random emojis — AI-only simulation (Fix #34: must never run in real matches,
  // where actual emoji events arrive via the network 'emoji' case in handleNetworkEvent)
  useEffect(() => {
    if (screen !== 'game' || gameOver || gameMode === 'watch' || !opponent || isRealMatch) return;
    
    // Opponent sends random emojis sometimes
    const interval = setInterval(() => {
      if (Math.random() > 0.85) {
        const emojis = ['👍', '😠', '😂', '👏', '🎯', '🤔'];
        const e = emojis[Math.floor(Math.random() * emojis.length)];
        const id = emojiIdCounter.current++;
        setFloatingEmojis(prev => [...prev, { id, emoji: e, isOpponent: true }]);
        floatTimersRef.current.push(setTimeout(() => setFloatingEmojis(prev => prev.filter(x => x.id !== id)), 2500));
      }
    }, 8000);
    
    return () => clearInterval(interval);
  }, [screen, gameOver, gameMode, opponent, isRealMatch]);

  const sendEmoji = (emoji: string) => {
    const id = emojiIdCounter.current++;
    setFloatingEmojis(prev => [...prev, { id, emoji, isOpponent: false }]);
    setShowEmojiMenu(false);
    floatTimersRef.current.push(setTimeout(() => setFloatingEmojis(prev => prev.filter(x => x.id !== id)), 2500));
    if (isRealMatch) {
      network.sendGameEvent({ type: 'emoji', emoji });
    }
  };

  const triggerVibration = () => {
    if (settings.vibration && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  // Fix E: Web Audio API — click/capture sounds (no assets needed)
  const playSound = (type: 'move' | 'capture' | 'king' | 'win' | 'lose') => {
    if (!settings.sounds) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      const freqs: Record<string, [number, number, string]> = {
        move:    [440, 0.08, 'sine'],
        capture: [280, 0.15, 'sawtooth'],
        king:    [660, 0.20, 'sine'],
        win:     [523, 0.30, 'sine'],
        lose:    [200, 0.25, 'sine'],
      };
      const [freq, dur, wave] = freqs[type];
      o.type = wave as OscillatorType;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (type === 'win') { o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + dur); }
      if (type === 'lose') { o.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + dur); }
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + dur);
    } catch { /* AudioContext not available — ignore */ }
  };

  // --- LOGIN SCREEN ---
  const renderLogin = () => (
    <div className="h-full w-full relative overflow-hidden carbon-bg flex flex-col items-center justify-center p-6 text-white bg-slate-950">
      {/* Cinematic Lighting */}
      <div className="absolute top-[-20%] left-[-20%] w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,_var(--manly-gold)_0%,_transparent_40%)] opacity-10 pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none" />
      
      {/* زر تغيير اللغة — أعلى الشاشة، بعيد عن حقول الإدخال والأزرار */}
      <div
        onClick={() => setShowLangPicker(true)}
        className="absolute top-5 z-30 flex items-center gap-1.5 bg-slate-900/80 border border-amber-600/30 rounded-full px-3 py-1.5 cursor-pointer active:scale-95 transition-all backdrop-blur-sm"
        style={dir === 'rtl' ? { left: '1.25rem' } : { right: '1.25rem' }}
      >
        <span className="text-sm">🌐</span>
        <span className="text-amber-300 text-[11px] font-black tracking-wide">
          {LANGS.find(l => l.code === lang)?.native}
        </span>
      </div>

      {/* Brand Section */}
      <div className="relative z-10 text-center mb-8">
        <div className="w-24 h-24 mx-auto bg-slate-900 border border-amber-600/30 rounded-[2rem] flex items-center justify-center shadow-[0_0_80px_rgba(180,83,9,0.2)] animate-float mb-4 relative overflow-hidden">
          <span className="text-5xl drop-shadow-[0_0_15px_rgba(217,119,6,0.6)]">♟️</span>
          <div className="absolute inset-0 bg-gradient-to-t from-amber-600/10 to-transparent" />
        </div>
        <h1 className="text-4xl font-black tracking-tighter mb-1 uppercase gold-text italic">
          Dama Tahiro
        </h1>
        <p className="text-slate-500 text-[9px] font-black tracking-[0.5em] uppercase">Elite Spanish Checkers</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm manly-panel rounded-3xl p-8 border border-white/5 animate-slideUp shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="space-y-5">
          {/* Guest Name Input */}
          <div className="space-y-2 text-start">
            <label className="text-[10px] font-black text-slate-500 uppercase me-2 tracking-widest">{t('الاسم المستعار')}</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder={t('أدخل اسمك هنا...')}
                value={myName === 'لاعب_مستعار' ? '' : myName}
                onChange={(e) => setMyName(e.target.value.slice(0, 20))}
                maxLength={20}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 px-5 text-white focus:border-amber-600/50 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
              />
              <span className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-700">👤</span>
            </div>
          </div>

          {/* Referral Input */}
          <div className="space-y-2 text-start">
            <label className="text-[10px] font-black text-slate-500 uppercase me-2 tracking-widest">{t('رمز الإحالة (اختياري)')}</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="DAMA-XXXX"
                value={enteredReferral}
                onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 px-5 text-amber-500 focus:border-amber-600/50 outline-none transition-all placeholder:text-slate-800 text-sm font-mono font-bold"
              />
              <span className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-700">🎟️</span>
            </div>
          </div>
          
          <div className="pt-2">
            <button onClick={() => {
              // Fix #3: validate referral format & prevent re-claim after logout
              const _ref = enteredReferral.trim().toUpperCase();
              const alreadyClaimed = localStorage.getItem('damaReferralClaimed');
              if (_ref.length >= 5 && _ref.startsWith('DAMA') && !alreadyClaimed) {
                setCoins(c => c + 1000);
                localStorage.setItem('damaReferralClaimed', '1');
                showNotif(t('🎁 مكافأة الإحالة: +1000 عملة!'));
              }
              // Fix #2: ensure a name is set
              if (!myName.trim() || myName === 'لاعب_مستعار') setMyName('لاعب_' + Math.random().toString(36).substring(2,5).toUpperCase());
              setIsLoggedIn(true);
            }}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 py-4 rounded-2xl font-black text-white transition-all active:scale-95 shadow-xl shadow-amber-900/20 border border-amber-500/20">
              {t('دخول الميدان')}
            </button>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-[9px] text-slate-600 font-bold tracking-widest uppercase">
        Powered by <span className="text-slate-400">Tahiro</span>
      </p>

      {/* صفحة الدخول تعود مبكراً قبل الحاوية الرئيسية — فنعرض التوست والنافذة هنا أيضاً */}
      {renderToast()}
      {showLangPicker && renderLangPicker()}
    </div>
  );

  // ==================== TIMER LOGIC ====================
  useEffect(() => {
    if (screen !== 'game' || gameOver || gameMode === 'watch') return;

    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(15);

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (isRealMatch) {
            // Fix D: in real matches, timeout = forfeit (lose on time — official rules)
            setGameOver(true);
            setWinner('black');
            handleGameEnd('black');
            network.sendGameEvent({ type: 'game_over', winner: 'black', reason: 'timeout' });
            void network.finishMatch('black', -15);
          } else {
            // vs AI: auto-play a forced random move to keep game flowing
            handleAutoPlay();
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isWhiteTurn, screen, gameOver, gameMode, isRealMatch]); // handleAutoPlay stable via useCallback

  // ==================== ADS ====================
  // تهيئة واحدة عند الإقلاع: موافقة UMP أولاً، ولا يُطلب أي إعلان قبل حلّها.
  useEffect(() => {
    let alive = true;
    ads.onBannerHeight((h) => { if (alive) setBannerH(h); });
    ads.initAds()
      .then(() => { if (alive) setAdPrivacyRequired(ads.privacyOptionsRequired()); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // ضمان صريح: أي نافذة منبثقة تُخفي البانر — النوافذ fixed لا تتأثر
  // بحجز المساحة، فلا نسمح للبانر بأن يغطّي أي زر داخلها.
  const anyModalOpen =
    showDailyReward || showMatchmakingModal || showRoomCodeInput ||
    showInviteSentModal || showFriendPlayModal || showAvatarPicker ||
    showCountryPicker || showBetModal || showActionModal || showPlayerModal;

  // البانر في الشاشات الساكنة فقط: لا رقعة، ولا تدريب، ولا مشاهدة، ولا نوافذ
  useEffect(() => {
    if (anyModalOpen) { ads.hideBanner().catch(() => {}); return; }
    ads.showBannerFor(screen).catch(() => {});
  }, [screen, anyModalOpen]);

  // خيط المحرّك يُحرَّر عند الخروج من شاشة الرقعة: لا داعي لإبقائه
  // وذاكرته (جدول تحويل بنصف مليون خانة) محجوزةً في اللوبي.
  useEffect(() => {
    if (screen === 'game') return;
    const idle = setTimeout(() => releaseWorker(), 15_000);
    return () => clearTimeout(idle);
  }, [screen]);

  // ==================== OPPONENT (AI) PLAY ====================
  useEffect(() => {
    if (screen !== 'game' || gameOver || gameMode === 'watch') return;
    if (isWhiteTurn) return; // Player is white
    if (isRealMatch) return; // Real opponent plays via network, not AI

    // يُرفع في التنظيف: يُلغي أي بحث ما زال جارياً في الخيط المنفصل
    let cancelled = false;

    if (generalTimerRef.current) clearTimeout(generalTimerRef.current);

    // إيقاع بشري: رد سريع حين لا خيار، تمهّل حين يكون الموضع غنياً،
    // ووقفة تفكير أطول من حين لآخر. (زمن البحث الحقيقي يُضاف فوق هذا،
    // والمجموع مقيَّد ليبقى بعيداً عن مؤقّت الـ15 ثانية.)
    const optionCount = getAllValidMoves(board, false).length;
    let delay: number;
    if (optionCount <= 1)      delay = 450  + Math.random() * 450;
    else if (optionCount <= 4) delay = 900  + Math.random() * 1000;
    else                       delay = 1300 + Math.random() * 1500;
    if (Math.random() < 0.12)  delay += 800 + Math.random() * 1200;
    delay = Math.min(delay, 5200);
    generalTimerRef.current = setTimeout(() => {
      // Dynamic level based on opponent's ELO — floors raised so quick/series
      // opponents always play strong, strategic checkers (levels 7-11)
      let dynamicLevel = 8;
      const oppElo = opponent?.elo ?? 1200; // safe null guard
      if (oppElo >= 2000)      dynamicLevel = 11;
      else if (oppElo >= 1800) dynamicLevel = 10;
      else if (oppElo >= 1500) dynamicLevel = 9;
      else if (oppElo >= 1200) dynamicLevel = 8;
      else                     dynamicLevel = 7;
      
      const level = gameMode === 'training' ? trainingLevel : dynamicLevel;

      // البحث يجري في خيط منفصل، فهو غير متزامن الآن. وبين إرسال الطلب
      // ووصول الجواب قد تتغيّر المباراة: اللاعب يستسلم، أو يعود للرئيسية،
      // أو تنتهي بالتعادل. لذا نحمل علَم إلغاء يرفعه تنظيفُ التأثير —
      // ولولاه لعادت حركةُ خصمٍ على رقعةِ مباراةٍ أخرى.
      void (async () => {
        const move = await requestMove(board, false, level);
        if (cancelled || !move) return;

        const newBoard = executeMove(board, move, false);
        setBoard(newBoard);
        setLastMove({ from: move.from, to: move.to });
        setSelectedPiece(null);
        setValidMoves([]);
        setSelectedMoves([]);

        if (move.captures.length > 0) {
          setMovesSinceLastCapture(0);
        } else {
          setMovesSinceLastCapture(prev => prev + 1);
        }

        // Check game end
        // Fix H: AI piece sounds
        if (move.captures.length > 0) { playSound('capture'); triggerVibration(); }
        else if (move.isKingPromotion) { playSound('king'); }
        else { playSound('move'); }

        const nextMoves = getAllValidMoves(newBoard, true);
        if (nextMoves.length === 0) {
          setGameOver(true);
          setWinner('black');
          handleGameEnd('black');
        } else if (checkDrawCondition(newBoard, movesSinceLastCapture + 1)) {
          setGameOver(true);
          setWinner('draw');
          handleGameEnd('draw');
        } else {
          setIsWhiteTurn(true);
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      if (generalTimerRef.current) clearTimeout(generalTimerRef.current);
    };
  }, [isWhiteTurn, board, screen, gameOver, gameMode, isRealMatch, opponent, movesSinceLastCapture]);

  // ==================== AUTO PLAY FOR PLAYER ====================
  const handleAutoPlay = useCallback(() => {
    if (!isWhiteTurn || gameOver) return;

    const moves = getAllValidMoves(board, true);
    if (moves.length === 0) return;

    const move = moves[Math.floor(Math.random() * moves.length)];
    const newBoard = executeMove(board, move, true);
    setBoard(newBoard);
    setLastMove({ from: move.from, to: move.to });
    setSelectedPiece(null);
    setValidMoves([]);
    setSelectedMoves([]);

    if (move.captures.length > 0) {
      setMovesSinceLastCapture(0);
    } else {
      setMovesSinceLastCapture(prev => prev + 1);
    }

    const nextMoves = getAllValidMoves(newBoard, false);
    if (nextMoves.length === 0) {
      setGameOver(true);
      setWinner('white');
      handleGameEnd('white');
      if (isRealMatch) {
        network.sendGameEvent({ type: 'game_over', winner: 'white' });
        void network.finishMatch('white', 25);
      }
    } else if (checkDrawCondition(newBoard, movesSinceLastCapture + 1)) {
      setGameOver(true);
      setWinner('draw');
      handleGameEnd('draw');
      if (isRealMatch) {
        network.sendGameEvent({ type: 'game_over', winner: 'draw' });
        void network.finishMatch('draw', 0);
      }
    } else {
      // Fix B: send the auto-played move to the real opponent (timer expiry move)
      if (isRealMatch) {
        network.sendMove({ from: move.from, to: move.to, captures: move.captures, isKingPromotion: move.isKingPromotion });
      }
      setIsWhiteTurn(false);
    }
  }, [board, isWhiteTurn, gameOver, movesSinceLastCapture, isRealMatch]);

  // Auto play when enabled
  useEffect(() => {
    if (autoPlay && isWhiteTurn && !gameOver && screen === 'game' && gameMode !== 'watch') {
      const t = setTimeout(handleAutoPlay, 1000);
      return () => clearTimeout(t);
    }
  }, [autoPlay, isWhiteTurn, gameOver, screen, gameMode]); // handleAutoPlay reads board via its own deps

  // ==================== WATCH MODE ====================
  useEffect(() => {
    if (screen !== 'game' || gameMode !== 'watch' || !watchMatch || watchGameOver) return;

    // خطوة واحدة في كل تشغيل، لا حلقة داخلية:
    // المشاهدة تبحث في المستوى 11 (أثقل مستوى) كل ثانية ونصف، فكانت
    // أعنف مُجمِّد في التطبيق. والبحث الآن غير متزامن، فلا يصحّ أن يجري
    // داخل setWatchBoard(prev => …). الحلّ: التأثير يعتمد على الرقعة
    // والدور، فكل حركة تُعيد تشغيله، وهو يجدول الحركة التالية وحدها.
    // الحالة كلها في React — لا نسخة محلّية متغيّرة تتقادم.
    let cancelled = false;
    const turn = watchTurn;

    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        if (getAllValidMoves(watchBoard, turn).length === 0) {
          setWatchWinner(turn ? 'black' : 'white');
          setWatchGameOver(true);
          return;
        }

        const move = await requestMove(watchBoard, turn, 11);
        if (cancelled) return;
        if (!move) {
          setWatchWinner(turn ? 'black' : 'white');
          setWatchGameOver(true);
          return;
        }

        const newBoard = executeMove(watchBoard, move, turn);
        setWatchBoard(newBoard);
        setLastMove({ from: move.from, to: move.to });
        setWatchTurn(!turn);

        if (getAllValidMoves(newBoard, !turn).length === 0) {
          setWatchWinner(turn ? 'white' : 'black');
          setWatchGameOver(true);
        }
      })();
    }, 1500 + Math.random() * 2500);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [screen, gameMode, watchMatch, watchGameOver, watchBoard, watchTurn]);

  // Handle watch mode restart
  useEffect(() => {
    if (watchGameOver) {
      const timeout = setTimeout(() => {
        setWatchGameOver(false);
        setWatchWinner(null);
        setWatchBoard(createInitialBoard()); // Start from beginning
        setWatchTurn(true);
        setLastMove(null);
      }, 4000);
      return () => clearTimeout(timeout);
    }
  }, [watchGameOver]);


  // ==================== LIVE MATCHES GENERATION ====================
  const liveMatches: LiveMatch[] = useMemo(() => {
    const count = 50 + Math.floor(Math.random() * 21); // 50 to 70 live matches
    return Array.from({ length: count }, (_, i) => {
      // Pick random players
      const p1Idx = Math.floor(Math.random() * players.length);
      let p2Idx = Math.floor(Math.random() * players.length);
      while (p2Idx === p1Idx) p2Idx = Math.floor(Math.random() * players.length);
      
      const isReal = i < count * 0.3; // Make 30% of them "real" matches
      const bets = isReal ? [5000, 10000, 50000] : [0, 100, 500, 1000];
      
      return {
        id: `live${i}`,
        player1: players[p1Idx],
        player2: players[p2Idx],
        viewers: isReal ? Math.floor(Math.random() * 1000) + 100 : Math.floor(Math.random() * 100) + 10,
        moveCount: Math.floor(Math.random() * 40) + 5,
        betAmount: bets[Math.floor(Math.random() * bets.length)],
        featured: isReal,
        rating: isReal ? 'ranked' : 'casual',
        startTime: Date.now() - Math.floor(Math.random() * 300000),
        gameState: null as any, // Generated when watched
        isReal
      };
    });
  }, [players]);

  // ==================== GAME FUNCTIONS ====================
  const startGame = useCallback((mode: GameMode, opp: Player, realMatch = false, isNewSeries = false) => {
    // Reset real-match flag so AI never fires in a non-network game (Fix #18)
    setIsRealMatch(realMatch);
    // Stop any pending local matchmaking interval (Fix #10)
    if (matchmakingRef.current) { clearInterval(matchmakingRef.current); matchmakingRef.current = null; }
    setP2pLabel('');
    // Fix #27/#29: clear any leftover watchdog/draw-offer state from a previous match
    if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
    setShowReconnecting(false);
    setIncomingDrawOffer(false);
    setIncomingRematchOffer(false);
    setWaitingForRematch(false);
    setFloatingEmojis([]);   // Fix 8: clear leftover floating UI from previous match
    setFloatingPoints([]);
    setShowEmojiMenu(false); // close emoji tray if open from previous game
    floatTimersRef.current.forEach(clearTimeout); // cancel pending animations from previous game
    floatTimersRef.current = [];
    if (rematchTimeoutRef.current) { clearTimeout(rematchTimeoutRef.current); rematchTimeoutRef.current = null; }
    // Fix #20: escrow the bet upfront — ONLY for real betting modes (not training)
    // Series: deduct only on first game; subsequent rounds are free.
    if (mode !== 'training' && (isNewSeries || mode !== 'series')) {
      // Guard: clamp bet to current coins to prevent negative balance
      setBetAmount(prev => {
        setCoins(c => { const deduct = Math.min(prev, c); return c - deduct; });
        return prev;
      });
    }
    // Training always resets bet to 0 (no gambling in training)
    if (mode === 'training') setBetAmount(0);
    setBoard(createInitialBoard());
    // تصفير سجل المباراة والتحليل: كل مباراة تبدأ بصفحة بيضاء
    logRef.current = { prev: null, items: [] };
    anCancel.current = true;
    setAnalysis(null); setAnProgress(0); setAnPick(null);
    resetMemory();   // تصفير ذاكرة التكرار في الخيطين: المحلّي والمنفصل

    // تصفير تتبّع التعادل لكل مباراة جديدة
    drawRef.current = { seen: new Map<string, number>(), sig: '', stall: 0, lastKey: '' };

    // من يبدأ؟ في المباريات المحلية يتناوب الطرفان جولةً بجولة.
    // في المباريات الشبكية يبقى الأبيض البادئ (الطرفان يجب أن يتفقا).
    let playerStarts = true;
    if (!realMatch) {
      playerStarts = startParityRef.current % 2 === 0;
      startParityRef.current++;
      try { localStorage.setItem('damaStartParity', String(startParityRef.current)); } catch { /* quota */ }
      if (!playerStarts) showNotif(t('🔄 الخصم يبدأ هذه الجولة'));
    }
    setIsWhiteTurn(playerStarts);
    setSelectedPiece(null);
    setValidMoves([]);
    setSelectedMoves([]);
    setLastMove(null);
    setGameOver(false);
    gameOverRef.current = false; // Sync reset — prevents handleGameEnd from being blocked
    setWinner(null);
    setTimer(15);
    setAutoPlay(false);
    setMovesSinceLastCapture(0);
    // Fix #19: reset series counters only when explicitly starting a new series
    if (isNewSeries) {
      setSeriesWins(0);
      setSeriesLosses(0);
      setSeriesRounds([]);
    }
    setGameMode(mode);
    setOpponent(opp);
    setScreen('game');
  }, []);

  const handleGameEnd = useCallback((result: 'white' | 'black' | 'draw') => {
    // Guard against double-invocation (AI effect + timer can both fire on same frame)
    if (gameOverRef.current) return; // already ended — prevent any double-count
    // Clear any reconnecting overlay — game is now definitively over
    setShowReconnecting(false);
    if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
    // Fix #20: bet already deducted at game start (escrow).
    // Win  → return bet + equal prize  (+betAmount*2)
    // Draw → return bet only           (+betAmount)
    // Loss → nothing (bet already gone)
    if (result === 'white') {
      playSound('win');
      // Series: no per-round payout; coins settle when 4 wins reached (below)
      if (betAmount > 0 && gameMode !== 'series') setCoins(prev => prev + betAmount * 2);
      setMyWins(w => {
        // Sync inside setter — captures current wins without stale closure
        setMyElo(elo => {
          const next = elo + 25;
          void supabase.from('players').update({ elo: next, wins: w + 1, last_seen: new Date().toISOString() }).eq('id', network.myUserId);
          return next;
        });
        return w + 1;
      });
      if (gameMode === 'series') {
        setSeriesWins(prev => {
          const next = prev + 1;
          // Series won at 4 wins — pay 2× the upfront bet
          if (next >= 4 && betAmount > 0) setCoins(c => c + betAmount * 2);
          return next;
        });
        setSeriesRounds(prev => [...prev, 'win']);
      }
    } else if (result === 'black') {
      playSound('lose');
      setMyLosses(l => {
        setMyElo(elo => {
          const next = Math.max(0, elo - 15);
          void supabase.from('players').update({ elo: next, losses: l + 1, last_seen: new Date().toISOString() }).eq('id', network.myUserId);
          return next;
        });
        return l + 1;
      });
      if (gameMode === 'series') {
        setSeriesLosses(prev => {
          const next = prev + 1;
          if (next >= 4) {
            // Series lost — show notification (bet already gone via escrow)
            showNotif(t('💔 خسرت السلسلة! الرهان ذهب للمنافس.'));
          }
          return next;
        });
        setSeriesRounds(prev => [...prev, 'loss']);
      }
    } else {
      // Draw: refund bet in single games; series settles at end
      if (betAmount > 0 && gameMode !== 'series') setCoins(prev => prev + betAmount);
      setMyDraws(prev => {
        void supabase.from('players').update({ draws: prev + 1, last_seen: new Date().toISOString() }).eq('id', network.myUserId);
        return prev + 1;
      });
      if (gameMode === 'series') {
        setSeriesRounds(prev => {
          const next = [...prev, 'draw' as const];
          // Fix4: if 4+ rounds are draws, declare the series drawn (prevent infinite series)
          const drawCount = next.filter(r => r === 'draw').length;
          if (drawCount >= 4) {
            // Series drawn — refund bet
            if (betAmount > 0) setCoins(c => c + betAmount);
            setTimeout(() => {
              setGameOver(true);
              setWinner('draw');
            }, 100);
          }
          return next;
        });
      }
    }
  }, [betAmount, gameMode]); // stats via functional setters — no stale closure

  // ==================== DRAW DETECTION ====================
  // يراقب الرقعة نفسها، فيغطّي حركة اللاعب والجنرال والشبكة معاً:
  //  • تكرار الموضع ثلاث مرات  → تعادل
  //  • 50 نصف-حركة بلا تقدّم   → تعادل (checkDrawCondition تتكفّل بها أيضاً)
  useEffect(() => {
    if (screen !== 'game' || gameOver || gameMode === 'watch') return;
    const d = drawRef.current;
    const key = positionKey(board, isWhiteTurn);
    if (key === d.lastKey) return;          // لا تغيّر فعلي
    d.lastKey = key;

    const sig = progressSignature(board);
    if (sig !== d.sig) { d.sig = sig; d.stall = 0; d.seen.clear(); }
    else { d.stall++; }

    const times = (d.seen.get(key) ?? 0) + 1;
    d.seen.set(key, times);

    if (times >= 3 || d.stall >= 50) {
      setGameOver(true);
      setWinner('draw');
      handleGameEnd('draw');
      if (isRealMatch) {
        network.sendGameEvent({ type: 'game_over', winner: 'draw' });
        void network.finishMatch('draw', 0);
      }
      showNotif(times >= 3 ? t('🤝 تعادل بتكرار الموضع ثلاث مرات') : t('🤝 تعادل: 25 حركة بلا تقدّم'));
    }
  }, [board, isWhiteTurn, screen, gameOver, gameMode, isRealMatch, handleGameEnd, showNotif]);

  // ==================== MATCH RECORDER ====================
  // يسجّل كل حركة باستنباطها من فرق الرقعتين، لا بالتعليق على مسارات
  // الحركة. السبب: الحركة تُطبَّق في خمسة مواضع مختلفة (نقر، جنرال،
  // شبكة، سلسلة، مشاهدة)، ووضع سطر تسجيل في كلٍّ منها يعني خمس فرص
  // للنسيان. مراقبة الرقعة نقطةٌ واحدة تغطّيها كلها، ولا تمسّ منطق اللعب
  // بحرف — فلا يمكن للتحليل أن يُعطّل مباراةً.
  useEffect(() => {
    if (screen !== 'game' || gameMode === 'watch') return;
    const rec = logRef.current;
    const prev = rec.prev;
    rec.prev = board;
    if (!prev || prev.length !== board.length) return;

    // الوصول أولاً: المربع الذي كان فارغاً وصار مشغولاً — وحيدٌ دائماً،
    // ومنه نعرف أيّ الطرفين لعب (أدقّ من قراءة الدور، فالدور يكون قد
    // انقلب حين يصل هذا التأثير).
    let to = -1;
    for (let i = 0; i < board.length; i++) {
      if (!prev[i] && board[i]) { to = i; break; }
    }
    if (to < 0) return;                      // ليست حركة (إعادة تعيين مثلاً)
    const byWhite = isWhite(board[to]);

    // الانطلاق والمأكولات تُفرزان باللون لا بالترتيب: المربعات المأكولة
    // تفرغ هي أيضاً، فلو أخذنا «أوّل مربع فرغ» لسُجّل مربع عدوٍّ أصغر
    // رقماً انطلاقاً — وهذا ما كان يُفسد نحو عُشر الحركات.
    let from = -1;
    const captures: number[] = [];
    for (let i = 0; i < board.length; i++) {
      const a = prev[i], b = board[i];
      if (a === b || !a) continue;           // لا تغيّر، أو كان فارغاً
      if (isWhite(a) === byWhite) { if (i !== to) from = i; }
      else captures.push(i);                 // قطعة خصم زالت = أُكلت
    }
    if (from < 0) return;                    // أكل دائري عاد إلى مبدئه — نادر، نتخطّاه
    rec.items.push({ before: prev, from, to, captures, byWhite });
    if (rec.items.length > 160) rec.items.shift();   // سقف للذاكرة
  }, [board, screen, gameMode]);


  const handleCellClick = useCallback((pos: number) => {
    if (!isWhiteTurn || gameOver || gameMode === 'watch') return;

    const piece = board[pos];

    if (selectedPiece !== null) {
      // Check if clicking on a valid move destination
      const move = selectedMoves.find(m => m.to === pos);
      if (move) {
        // Execute the move
        const newBoard = executeMove(board, move, true);
        setBoard(newBoard);
        setLastMove({ from: move.from, to: move.to });
        setSelectedPiece(null);
        setValidMoves([]);
        setSelectedMoves([]);

        if (move.captures.length > 0) {
          triggerVibration();
          const id = pointsIdCounter.current++;
          setFloatingPoints(prev => [...prev, { id, pos: move.to, text: `+${move.captures.length}` }]);
          floatTimersRef.current.push(setTimeout(() => setFloatingPoints(prev => prev.filter(x => x.id !== id)), 1500));
          setMovesSinceLastCapture(0);
        } else {
          setMovesSinceLastCapture(prev => prev + 1);
        }
        
        if (move.isKingPromotion) {
          const id = pointsIdCounter.current++;
          setFloatingPoints(prev => [...prev, { id, pos: move.to, text: '👑' }]);
          floatTimersRef.current.push(setTimeout(() => setFloatingPoints(prev => prev.filter(x => x.id !== id)), 1500));
        }

        // Check game end
        const nextMoves = getAllValidMoves(newBoard, false);
        if (nextMoves.length === 0) {
          // Fix C: send final move before game_over so opponent sees last move
          if (isRealMatch) {
            network.sendMove({ from: move.from, to: move.to, captures: move.captures, isKingPromotion: move.isKingPromotion });
            network.sendGameEvent({ type: 'game_over', winner: 'white' });
            void network.finishMatch('white', 25);
          }
          setGameOver(true);
          setWinner('white');
          handleGameEnd('white');
        } else if (checkDrawCondition(newBoard, movesSinceLastCapture + 1)) {
          if (isRealMatch) {
            network.sendMove({ from: move.from, to: move.to, captures: move.captures, isKingPromotion: move.isKingPromotion });
            network.sendGameEvent({ type: 'game_over', winner: 'draw' });
            void network.finishMatch('draw', 0);
          }
          setGameOver(true);
          setWinner('draw');
          handleGameEnd('draw');
        } else {
          // Fix F: play sounds
          if (move.captures.length > 0) { playSound('capture'); triggerVibration(); }
          else if (move.isKingPromotion) { playSound('king'); }
          else { playSound('move'); }
          // Send move to real opponent
          if (isRealMatch) {
            network.sendMove({ from: move.from, to: move.to, captures: move.captures, isKingPromotion: move.isKingPromotion });
            setP2pLabel(network.isP2PActive ? '⚡P2P' : '☁️Ably');
          }
          // It's now black's (opponent's) turn regardless of match type
          setIsWhiteTurn(false);
        }
        return;
      }

      // If clicking on own piece, select it instead
      if (piece && isPlayerPiece(piece, true)) {
        const allMoves = getAllValidMoves(board, true);
        const pieceMoves = allMoves.filter(m => m.from === pos);
        if (pieceMoves.length > 0) {
          setSelectedPiece(pos);
          setSelectedMoves(pieceMoves);
          setValidMoves(pieceMoves.map(m => m.to));
        }
        return;
      }

      // Deselect
      setSelectedPiece(null);
      setValidMoves([]);
      setSelectedMoves([]);
    } else {
      // Select a piece
      if (piece && isPlayerPiece(piece, true)) {
        const allMoves = getAllValidMoves(board, true);
        const pieceMoves = allMoves.filter(m => m.from === pos);
        if (pieceMoves.length > 0) {
          setSelectedPiece(pos);
          setSelectedMoves(pieceMoves);
          setValidMoves(pieceMoves.map(m => m.to));
        }
      }
    }
  }, [board, isWhiteTurn, selectedPiece, selectedMoves, gameOver, gameMode, movesSinceLastCapture, handleGameEnd, isRealMatch]); // playSound/triggerVibration are stable (no closure over state)

  // ==================== FRIEND FUNCTIONS ====================
  const acceptFriend = (id: string) => {
    setFriends(prev => prev.map(f => f.id === id ? { ...f, friendStatus: 'accepted' as FriendStatus } : f));
    showNotif(t('تم قبول طلب الصداقة ✅'));
    // Fix 5: notify the requester that we accepted (via Ably — real players only)
    if (netStatus === 'online') {
      network.sendFriendInvite(id, '', { userId: network.myUserId, displayName: myName, avatar: myAvatar, elo: myElo, country: myCountry });
    }
  };

  const rejectFriend = (id: string) => {
    setFriends(prev => prev.filter(f => f.id !== id));
    showNotif(t('تم رفض الطلب'));
  };

  const cancelRequest = (id: string) => {
    setFriends(prev => prev.filter(f => f.id !== id));
    showNotif(t('تم إلغاء الطلب'));
  };

  const sendFriendRequest = (player: Player) => {
    const exists = friends.find(f => f.id === player.id);
    if (exists) return;
    setFriends(prev => [...prev, { ...player, friendStatus: 'pending-out' as FriendStatus, lastSeen: t('الآن') }]);
    setFriendRequestStatus('pending');
    showNotif(t('تم إرسال طلب الصداقة'));

    if (player.isGeneral) {
      // AI auto-accepts after 3 seconds
      setTimeout(() => {
        setFriends(prev => prev.map(f => f.id === player.id ? { ...f, friendStatus: 'accepted' as FriendStatus } : f));
        setFriendRequestStatus('accepted');
        showNotif(tf('{0} قبل طلب صداقتك ✅', player.name));
      }, 3000);
    } else {
      // Fix F: send real friend request via Ably to the other player's device
      network.sendFriendInvite(
        player.id,
        roomCode,
        { userId: network.myUserId, displayName: myName, avatar: myAvatar, elo: myElo, country: myCountry }
      );
    }
  };

  // ==================== RENDER HELPERS ====================
  const renderPiece = (piece: PieceType, size: string = 'text-3xl') => {
    if (!piece) return null;
    const isK = isKing(piece);
    const w = isWhite(piece);
    const color = w ? pieceSkin.white : pieceSkin.black;
    const glyph = isK ? pieceSkin.glyphK : (w ? pieceSkin.glyphW : pieceSkin.glyphB);

    return (
      <div className={`rounded-full ${size === 'text-3xl' ? 'w-9 h-9' : 'w-6 h-6'} flex items-center justify-center border-2 ${color} shadow-lg ${isK ? 'ring-2 ' + pieceSkin.kingRing : ''}`}>
        {/* طقم «حجر الغو» بلا رمز: القطعة حجر أصمّ، فنتخطّى span بالكامل */}
        {glyph && (
          <span className={size === 'text-3xl' ? 'text-lg' : 'text-xs'}>{glyph}</span>
        )}
      </div>
    );
  };

  const currentBoard = gameMode === 'watch' ? watchBoard : board;
  const whiteCount = currentBoard.filter(p => isWhite(p)).length;
  const blackCount = currentBoard.filter(p => isBlack(p)).length;

  // ==================== SCREENS ====================

  // ---- HOME SCREEN ----
  const renderHome = () => (
    <div className={`flex flex-col h-full ${backdropSkin.shell}`} style={backdropCss}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-black/30 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xl shrink-0">🎮</div>
          <div className="min-w-0">
            <div className="text-orange-400 font-bold text-lg truncate">Dama Tahiro</div>
            <div className="text-gray-400 text-xs truncate">{t('الضامة التنافسية')}</div>
          </div>
        </div>

        {/* زر تغيير اللغة — أعلى وسط الصفحة */}
        <div
          onClick={() => setShowLangPicker(true)}
          className="flex items-center gap-1 bg-gray-800/80 border border-amber-600/30 rounded-full px-2.5 py-1.5 cursor-pointer active:scale-95 transition-all shrink-0"
        >
          <span className="text-sm">🌐</span>
          <span className="text-amber-300 text-[11px] font-bold">{lang.toUpperCase()}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* شريحة الرصيد هي باب المتجر: المكان الذي ينظر فيه اللاعب
              إلى عملاته هو أنسب مكان ليعرف أن لها ما تُشترى به. */}
          <div
            onClick={() => setScreen('shop')}
            className="bg-yellow-600/30 border border-yellow-500/30 px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
          >
            <span className="text-yellow-400 font-bold">{fmtNum(Math.max(0, coins))}</span>
            <span>💰</span>
            <span className="text-yellow-200/70 text-[10px]">🛍️</span>
          </div>
        </div>
      </div>

      {/* Player Info */}
      <div className="mx-3 mt-2 p-3 bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-xl border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="text-start">
            <div className="text-white font-bold">{t('مرحباً، أنت! 👋')}</div>
            <div className="text-gray-400 text-sm">{t('هل أنت مستعد للتحدي؟')}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-center">
              <div className="text-yellow-400 font-bold">{myElo}</div>
              <div className="text-gray-500 text-xs">ELO</div>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-bold">Lv.{myLevel}</div>
              <div className="text-gray-500 text-xs">{t('المستوى')}</div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full border-2 ${
              netStatus === 'online' ? 'bg-green-400 border-green-600 animate-pulse' :
              netStatus === 'connecting' ? 'bg-yellow-400 border-yellow-600 animate-pulse' :
              'bg-red-400 border-red-600'
            }`} title={netStatus === 'online' ? t('متصل بالإنترنت') : netStatus === 'connecting' ? t('جاري الاتصال...') : t('غير متصل')} />
          </div>
        </div>
      </div>

      {/* Game Mode Cards - Professional Slider */}
      <div className="flex-1 overflow-y-auto mt-4 pb-20">
        <div className="flex items-center justify-between mb-4 px-4">
           <h2 className="text-slate-100 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-3">
             <span className="w-2 h-2 bg-amber-600 rounded-sm rotate-45" />
             {t('اختيار الميدان')}
           </h2>
        </div>

        <div className="flex overflow-x-auto gap-5 px-4 pb-6 scrollbar-hide snap-x snap-mandatory" dir="ltr">
          {/* Quick Match Card */}
          <div className="flex-shrink-0 w-[82%] snap-center bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group active:scale-[0.98] transition-all"
            onClick={() => { setPendingGameMode('quick'); setShowBetModal(true); }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl shadow-inner border border-white/5">⚡</div>
                <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded-full text-[8px] font-black uppercase">Battle Ready</span>
              </div>
              <div className="flex-1 text-end" dir="rtl">
                <h2 className="text-2xl font-black text-white mb-1 tracking-tighter">{t('مباراة سريعة')}</h2>
                <p className="text-slate-500 text-xs font-bold">{t('اشتباك فوري مباشر في الحلبة')}</p>
              </div>
              <div className="mt-6 bg-gradient-to-r from-orange-600 to-red-700 py-4 rounded-2xl text-center text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-900/20">
                {t('ابدأ المعركة')}
              </div>
            </div>
          </div>

          {/* Series Mode Card */}
          <div className="flex-shrink-0 w-[82%] snap-center bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group active:scale-[0.98] transition-all"
            onClick={() => { setPendingGameMode('series'); setShowBetModal(true); }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl shadow-inner border border-white/5">🏆</div>
                <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[8px] font-black uppercase">Elite Status</span>
              </div>
              <div className="flex-1 text-end" dir="rtl">
                <h2 className="text-2xl font-black text-white mb-1 tracking-tighter">{t('سلسلة المباريات')}</h2>
                <p className="text-slate-500 text-xs font-bold">{t('أثبت جدارتك في 7 جولات نارية')}</p>
              </div>
              <div className="mt-6 bg-gradient-to-r from-blue-600 to-purple-700 py-4 rounded-2xl text-center text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20">
                {t('دخول التحدي')}
              </div>
            </div>
          </div>

          {/* Training Card */}
          <div className="flex-shrink-0 w-[82%] snap-center bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group active:scale-[0.98] transition-all"
            onClick={() => setScreen('training')}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-600/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl shadow-inner border border-white/5">🎯</div>
                <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-[8px] font-black uppercase">Tactical Drills</span>
              </div>
              <div className="flex-1 text-end" dir="rtl">
                <h2 className="text-2xl font-black text-white mb-1 tracking-tighter">{t('تدريب الجنرالات')}</h2>
                <p className="text-slate-500 text-xs font-bold">{t('اصقل مهاراتك ضد أقوى الأنظمة')}</p>
              </div>
              <div className="mt-6 bg-gradient-to-r from-emerald-600 to-teal-700 py-4 rounded-2xl text-center text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-green-900/20">
                {t('ابدأ التدريب')}
              </div>
            </div>
          </div>
        </div>

        {/* لغز اليوم — الخطّاف اليومي، فيستحقّ عرضاً كاملاً لا بلاطة صغيرة */}
        <div
          onClick={() => setScreen('puzzle')}
          className={`mx-0 mb-3 p-3 rounded-2xl border flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer ${
            solvedToday(pzRecord, todayKey())
              ? 'bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border-emerald-500/30'
              : 'bg-gradient-to-r from-violet-900/60 to-fuchsia-900/50 border-violet-500/40'
          }`}>
          <div className="text-3xl shrink-0">🧩</div>
          <div className="flex-1 min-w-0 text-start">
            <div className="text-white font-black text-sm">{t('لغز اليوم')}</div>
            <div className="text-gray-300 text-[11px] truncate">
              {solvedToday(pzRecord, todayKey())
                ? tf('✅ حُلّ · سلسلة {0} يوماً', fmtNum(pzRecord.streak))
                : tf('الأبيض يفوز في {0} حركة · {1} عملة', fmtNum(todayPuzzle.n), fmtNum(todayPuzzle.reward))}
            </div>
          </div>
          {!solvedToday(pzRecord, todayKey()) && (
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
          )}
        </div>

        {/* Quick Access */}
        <div className="text-white font-bold text-start mb-2 text-sm">{t('⚡ وصول سريع')}</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gradient-to-br from-red-600 to-pink-700 rounded-xl p-3 text-center active:scale-95 transition-transform"
            onClick={() => {
              setPendingGameMode('quick');
              setBetAmount(0);
              setMatchmakingTimer(20);
              setShowMatchmakingModal(true);
              // Fix #8: try real network matchmaking (same as "أتحدى العالم")
              if (netStatus === 'online') {
                network.findMatch({
                  displayName: myName, avatar: myAvatar, elo: myElo, country: myCountry,
                  betAmount: 0, gameMode: 'quick'
                }, handleNetworkEvent).catch(() => {});
              }
              // Fix #10: only AI fallback on timeout, no fake random find
              if (matchmakingRef.current) clearInterval(matchmakingRef.current);
              matchmakingRef.current = setInterval(() => {
                setMatchmakingTimer(prev => {
                  if (prev <= 1) {
                    clearInterval(matchmakingRef.current);
                    matchmakingRef.current = null;
                    network.cancelMatchmaking();
                    setShowMatchmakingModal(false);
                    const opp = pickOpponent();
                    startGame('quick', opp, false, false);
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
            }}>
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-white font-bold text-xs">{t('لعب فوري')}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-3 text-center active:scale-95 transition-transform relative"
            onClick={() => setScreen('live')}>
            <div className="text-2xl mb-1">👁️</div>
            <div className="text-white font-bold text-xs">{t('مشاهدة')}</div>
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full absolute top-2 right-2 animate-pulse border-2 border-purple-600" />
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl p-3 text-center active:scale-95 transition-transform shadow-lg shadow-orange-500/20 relative"
            onClick={() => setScreen('shop')}>
            <div className="text-2xl mb-1">🛒</div>
            <div className="text-white font-bold text-xs">{t('المتجر')}</div>
            {/* نقطة تنبيه ما دام هناك طقم يستطيع اللاعب شراءه الآن */}
            {cosmetics.remainingValue(cos) > 0 && coins >= 1200 && (
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full absolute top-2 right-2 animate-pulse border-2 border-orange-600" />
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="text-white font-bold text-start mb-2">{t('📊 إحصائياتك')}</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-green-900/40 rounded-xl p-2 text-center border border-green-500/20">
            <div className="text-green-400 font-bold text-lg">{myWins}</div>
            <div className="text-gray-400 text-xs">{t('فوز')}</div>
          </div>
          <div className="bg-red-900/40 rounded-xl p-2 text-center border border-red-500/20">
            <div className="text-red-400 font-bold text-lg">{myLosses}</div>
            <div className="text-gray-400 text-xs">{t('خسارة')}</div>
          </div>
          <div className="bg-yellow-900/40 rounded-xl p-2 text-center border border-yellow-500/20">
            <div className="text-yellow-400 font-bold text-lg">{myDraws}</div>
            <div className="text-gray-400 text-xs">{t('تعادل')}</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ---- BET MODAL ----
  const renderBetModal = () => showBetModal && (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
      <div className="w-full bg-gray-900 rounded-t-3xl p-4 border-t border-yellow-500/30 animate-slideUp max-h-[85vh] overflow-y-auto">
        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-3"></div>
        <div className="text-center text-white font-bold text-xl mb-1">
          {pendingGameMode === 'quick' ? t('⚡ مباراة سريعة') : t('🏆 سلسلة المباريات')}
        </div>
        <div className="text-gray-400 text-center text-sm mb-4">{t('اختر الرهان وطريقة اللعب')}</div>

        {/* Bet Selection */}
        <div className="text-yellow-400 font-bold text-start mb-2">{t('💰 الرهان')}</div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {BET_OPTIONS.map(bet => (
            <div key={bet}
              onClick={() => setBetAmount(bet)}
              className={`rounded-xl py-2 text-center text-sm font-bold cursor-pointer transition-all ${
                betAmount === bet
                  ? 'bg-yellow-500 text-black scale-105'
                  : 'bg-gray-800 text-gray-300 border border-gray-700'
              }`}>
              {bet === 0 ? t('مجاني') : bet >= 1000 ? `${bet / 1000}K` : bet}
            </div>
          ))}
        </div>

        {betAmount > 0 && (
          <div className="bg-yellow-900/30 rounded-xl p-2 mb-4 text-center border border-yellow-600/30">
            <span className="text-yellow-400">{t('الفائز يحصل على:')}</span>
            <span className="text-yellow-300 font-bold">{fmtNum((betAmount * 2))} 💰</span>
          </div>
        )}

        {/* Play Mode Selection */}
        <div className="text-blue-400 font-bold text-start mb-2">{t('🎮 طريقة اللعب')}</div>

        {/* Challenge the World */}
        <div className="mb-2 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-3 cursor-pointer"
          onClick={() => {
            if (betAmount > coins && betAmount > 0) { showNotif(t('رصيدك غير كافٍ! ❌')); return; }
            setShowBetModal(false);
            setMatchmakingTimer(20);
            setShowMatchmakingModal(true);

            // Try REAL matchmaking via Ably first
            if (netStatus === 'online') {
              network.findMatch({
                displayName: myName,
                avatar: myAvatar,
                elo: myElo,
                country: myCountry,
                betAmount,
                gameMode: pendingGameMode
              }, handleNetworkEvent).catch(() => {});
            }

            // Local countdown — network closes modal via handleNetworkEvent if real player found
            // This interval ONLY fires the AI fallback when timer expires (Fix #10)
            if (matchmakingRef.current) clearInterval(matchmakingRef.current);
            matchmakingRef.current = setInterval(() => {
              setMatchmakingTimer(prev => {
                if (prev <= 1) {
                  clearInterval(matchmakingRef.current);
                  matchmakingRef.current = null;
                  network.cancelMatchmaking();       // Fix #12: always cancel Ably search
                  setShowMatchmakingModal(false);
                  // AI fallback — startGame resets isRealMatch to false (Fix #18)
                  const opp = pickOpponent();
                  startGame(pendingGameMode, opp, false, true); // new game
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          }}>
          <div className="flex items-center justify-between">
            <span className="text-white text-2xl">🌍</span>
            <div className="text-start">
              <div className="text-white font-bold">{t('أتحدى العالم')}</div>
              <div className="text-orange-200 text-xs">
                {netStatus === 'online' ? t('🟢 متصل — بحث عبر الإنترنت') : t('🔴 وضع offline')}
              </div>
            </div>
          </div>
        </div>

        {/* Play with Friend */}
        <div className="mb-2 bg-gradient-to-r from-green-600 to-teal-600 rounded-xl p-3 cursor-pointer"
          onClick={() => {
            if (betAmount > coins && betAmount > 0) { showNotif(t('رصيدك غير كافٍ! ❌')); return; }
            setShowBetModal(false);
            refreshRoomCode(); // Fix K: fresh code each session prevents accidental room reuse
            setShowFriendPlayModal(true);
            // Fix #22 host side: register room on Ably so friend can join via room code
            if (netStatus === 'online') {
              network.hostRoomCode(roomCode, {
                displayName: myName, avatar: myAvatar, elo: myElo, country: myCountry,
                betAmount, gameMode: pendingGameMode
              }, handleNetworkEvent).catch(() => {});
            }
          }}>
          <div className="flex items-center justify-between">
            <span className="text-white text-2xl">👥</span>
            <div className="text-start">
              <div className="text-white font-bold">{t('العب مع صديق')}</div>
              <div className="text-green-200 text-xs">{t('دعوة من قائمة الأصدقاء')}</div>
            </div>
          </div>
        </div>

        {/* Room Code Input */}
        <div className="mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-3 cursor-pointer"
          onClick={() => {
            setShowBetModal(false);
            setShowRoomCodeInput(true);
            setRoomCodeInput('');
          }}>
          <div className="flex items-center justify-between">
            <span className="text-white text-2xl">🔑</span>
            <div className="text-start">
              <div className="text-white font-bold">{t('إدخال رمز الغرفة')}</div>
              <div className="text-purple-200 text-xs">{t('أدخل رمز الغرفة للانضمام')}</div>
            </div>
          </div>
        </div>

        <div onClick={() => { setShowBetModal(false); setBetAmount(0); }}
          className="bg-gray-800 rounded-xl py-3 text-center text-gray-400 font-bold cursor-pointer active:scale-95 transition-all">
          {t('إلغاء')}
        </div>
      </div>
    </div>
  );



  // ---- TRAINING SCREEN ----
  const renderTraining = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-black">
      <div className="flex items-center justify-between p-3 bg-black/30">
        <div onClick={() => { setScreen('home'); void ads.maybeShowInterstitial(gameMode); }} className="text-gray-400 text-2xl">→</div>
        <div className="text-white font-bold text-lg">{t('🎯 تدريب')}</div>
        <div></div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-20">
        <div className="text-gray-400 text-center mb-4">{t('اختر مستوى الصعوبة')}</div>

        {Array.from({ length: 11 }, (_, i) => i + 1).map(level => (
          <div key={level}
            onClick={() => {
              setTrainingLevel(level);
              const opp = players[level - 1];
              setGameMode('training');
              startGame('training', opp, false, false);
            }}
            className={`mb-2 rounded-xl p-3 border cursor-pointer transition-all ${
              level <= 3 ? 'bg-green-900/30 border-green-500/30' :
              level <= 6 ? 'bg-yellow-900/30 border-yellow-500/30' :
              level <= 9 ? 'bg-orange-900/30 border-orange-500/30' :
              'bg-red-900/30 border-red-500/30'
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(level, 5) }, (_, i) => (
                  <span key={i} className="text-yellow-400">⭐</span>
                ))}
                {level > 5 && <span className="text-yellow-400 text-sm">+{level - 5}</span>}
              </div>
              <div className="text-start">
                <div className="text-white font-bold">المستوى {level}</div>
                <div className="text-gray-400 text-xs">
                  {level <= 3 ? t('مبتدئ') : level <= 6 ? t('متوسط') : level <= 9 ? t('متقدم') : level === 10 ? t('خبير') : t('أسطورة')}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ---- GAME SCREEN ----
  const renderGame = () => {
    const isWatch = gameMode === 'watch';
    const displayBoard = isWatch ? watchBoard : board;
    const displayTurn = isWatch ? watchTurn : isWhiteTurn;
    const p1Name = isWatch ? watchMatch?.player1.name : t('أنت');
    const p2Name = isWatch ? watchMatch?.player2.name : (opponent?.name ?? '...');
    const p1Avatar = isWatch ? watchMatch?.player1.avatar : myAvatar;
    const p2Avatar = isWatch ? watchMatch?.player2.avatar : (opponent?.avatar ?? '👤');

    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-black">
        {/* Top Bar */}
        <div className="flex items-center justify-between p-2 bg-black/50">
          <div onClick={() => {
              setScreen('home');
              void ads.maybeShowInterstitial(gameMode);
              setGameOver(false);
              setFloatingEmojis([]); // clear animations immediately on exit
              setFloatingPoints([]);
              // Fix #23/#30: only forfeit if the match was actually still in progress.
              // If gameOver is already true (player already won/lost/drew), this is just
              // a normal "go home" tap — sending another game_over would double-count ELO/Supabase.
              if (isRealMatch && !gameOver) {
                network.sendGameEvent({ type: 'game_over', winner: 'black' }); // opponent wins on forfeit
                void network.finishMatch('black', -15);
              }
              setIsRealMatch(false);
              setP2pLabel('');
              // Fix #27: stop any pending abandonment watchdog when leaving the game ourselves
              if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
              setShowReconnecting(false);
              setIncomingDrawOffer(false);
              setIncomingRematchOffer(false);
              setWaitingForRematch(false);
              if (rematchTimeoutRef.current) { clearTimeout(rematchTimeoutRef.current); rematchTimeoutRef.current = null; }
            }}
            className="text-gray-400 text-xl px-2">✕</div>
          <div className="flex items-center gap-2">
            {/* Network status badge */}
            {isRealMatch && p2pLabel && (
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                p2pLabel.includes('P2P')
                  ? 'bg-green-900/50 text-green-400 border-green-500/30'
                  : 'bg-blue-900/50 text-blue-400 border-blue-500/30'
              }`}>
                {p2pLabel}
              </div>
            )}
            {isRealMatch && !p2pLabel && (
              <div className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-900/50 text-orange-400 border border-orange-500/30 animate-pulse">
                {t('🔄 جاري الاتصال...')}
              </div>
            )}
            {gameMode === 'series' && (
              <div className="bg-blue-900/50 px-3 py-1 rounded-full text-sm">
                <span className="text-green-400">{seriesWins}</span>
                <span className="text-gray-400"> - </span>
                <span className="text-red-400">{seriesLosses}</span>
              </div>
            )}
            {betAmount > 0 && (
              <div className="bg-yellow-900/50 px-3 py-1 rounded-full text-sm text-yellow-400">
                💰 {fmtNum(betAmount)}
              </div>
            )}
            {isWatch && (
              <div className="bg-red-600/50 px-3 py-1 rounded-full text-sm text-red-300 animate-pulse">
                {t('🔴 مباشر')}
              </div>
            )}
          </div>
          {!isWatch && !isRealMatch && (
            <div onClick={() => setAutoPlay(!autoPlay)}
              className={`px-3 py-1 rounded-full text-sm font-bold ${autoPlay ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
              {t('⚡ تلقائي')}
            </div>
          )}
        </div>

        {/* Opponent Info (Black - Top) */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50">
          <div className="flex items-center gap-1">
            <div className="text-sm text-gray-400">
              {tf('{0} قطعة', displayBoard.filter(p => isBlack(p)).length)}
            </div>
          </div>
          <div className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              if (!isWatch && opponent) {
                setSelectedPlayer(opponent);
                setShowPlayerModal(true);
              }
            }}>
            <div className="text-start">
              <div className="text-white font-bold text-sm">{p2Name}</div>
              {!displayTurn && !isWatch && (
                <div className="text-yellow-400 text-xs flex items-center gap-1 justify-end">
                  <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                  {isRealMatch ? t('⏳ انتظار المنافس...') : tf('يفكر... {0}ث', timer)}
                </div>
              )}
              {isWatch && !displayTurn && (
                <div className="text-yellow-400 text-xs">{tf('دور {0}', p2Name)}</div>
              )}
            </div>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl border-2 border-gray-600">
                {p2Avatar}
              </div>
              {floatingEmojis.filter(e => e.isOpponent).map(e => (
                <div key={e.id} className="absolute -bottom-4 -left-4 text-3xl animate-slideUp pointer-events-none z-50">
                  {e.emoji}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Captured pieces by opponent (white pieces captured) */}
        <div className="flex justify-end px-3 gap-1 h-5">
          {Array.from({ length: 12 - whiteCount }, (_, i) => (
            <div key={i} className="w-4 h-4 rounded-full bg-yellow-300/50 border border-yellow-500/30"></div>
          ))}
        </div>

        {/* Board */}
        <div className="flex-1 flex items-center justify-center px-2">
          <div
            // اتجاه ثابت للرقعة: شبكة CSS تنعكس مع dir، فلو تُرك للاتجاه
            // العام لانقلبت الرقعة أفقياً عند التبديل إلى لغة LTR وتغيّر
            // موضع كل قطعة بصرياً. الرقعة تبقى كما هي في العربية دائماً.
            dir="rtl"
            className={`aspect-square w-full max-w-[380px] grid grid-cols-8 gap-0 rounded-lg overflow-hidden shadow-2xl border-2 ${boardSkin.frame}`}
          >
            {displayBoard.map((piece, i) => {
              const row = getRow(i);
              const col = getCol(i);
              const isDark = (row + col) % 2 === 1;
              const isSelected = selectedPiece === i;
              const isValidMove = validMoves.includes(i);
              const isLastFrom = !!lastMove && lastMove.from === i;
              const isLastTo   = !!lastMove && lastMove.to === i;
              const isLastMoveSquare = isLastFrom || isLastTo;
              // شبح القطعة في مربع الانطلاق: يرى الخصم ماذا تحرّك بالضبط
              const ghost = isLastFrom && !piece && lastMove ? displayBoard[lastMove.to] : null;
              const hasCapture = selectedMoves.some(m => m.to === i && m.captures.length > 0);

              return (
                  <div key={i}
                  role={isDark && !isWatch ? 'button' : undefined}
                  aria-label={isDark && piece ? tf('قطعة {0} في صف {1} عمود {2}', (piece.includes('white') ? t('بيضاء') : t('سوداء')) + (piece.includes('King') ? t(' ملك') : ''), Math.floor(i/8)+1, i%8+1) : (isDark && isValidMove ? tf('حرك هنا: صف {0} عمود {1}', Math.floor(i/8)+1, i%8+1) : undefined)}
                  onClick={() => !isWatch && handleCellClick(i)}
                  className={`aspect-square flex items-center justify-center relative transition-all
                    ${/* ألوان الحالة (تحديد/أكل/حركة ممكنة) وظيفية لا تجميلية:
                          تبقى كما هي في كل الأطقم لئلا يفقد اللاعب دلالتها. */''}
                    ${isDark
                      ? isSelected ? 'bg-green-600' :
                        isLastMoveSquare ? boardSkin.hl :
                        isValidMove ? (hasCapture ? 'bg-red-700/70' : 'bg-green-800/70') :
                        boardSkin.dark
                      : boardSkin.light}
                    ${isValidMove && !isWatch ? 'cursor-pointer' : ''}
                    ${isDark && piece && !isWatch && isPlayerPiece(piece, true) ? 'cursor-pointer' : ''}
                  `}>
                  {piece && renderPiece(piece)}
                  {ghost && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-25 pointer-events-none">
                      {renderPiece(ghost)}
                    </div>
                  )}
                  {isLastFrom && (
                    <div className={`absolute inset-0 ring-2 ring-inset ${boardSkin.ring} opacity-60 rounded-sm pointer-events-none`}></div>
                  )}
                  {isLastTo && (
                    <div className={`absolute inset-0 ring-[3px] ring-inset ${boardSkin.ring} rounded-sm pointer-events-none`}></div>
                  )}
                  {isValidMove && !piece && (
                    <div className={`w-3 h-3 rounded-full ${hasCapture ? 'bg-red-400/60 ring-2 ring-red-400' : 'bg-green-400/50'}`}></div>
                  )}
                  {isValidMove && piece && (
                    <div className="absolute inset-0 ring-2 ring-red-500 rounded-sm"></div>
                  )}
                  {floatingPoints.filter(p => p.pos === i).map(p => (
                    <div key={p.id} className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                      <span className="text-yellow-400 font-bold text-xl drop-shadow-md animate-slideUp">{p.text}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Captured pieces by player (black pieces captured) */}
        <div className="flex justify-start px-3 gap-1 h-5">
          {Array.from({ length: 12 - blackCount }, (_, i) => (
            <div key={i} className="w-4 h-4 rounded-full bg-gray-600/50 border border-gray-500/30"></div>
          ))}
        </div>

        {/* Player Info (White - Bottom) */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div onClick={() => !isWatch && setShowEmojiMenu(!showEmojiMenu)} 
                className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xl border-2 border-orange-400 cursor-pointer active:scale-95 transition-all">
                {p1Avatar}
              </div>
              {floatingEmojis.filter(e => !e.isOpponent).map(e => (
                <div key={e.id} className="absolute -top-4 -right-4 text-3xl animate-slideUp pointer-events-none z-50">
                  {e.emoji}
                </div>
              ))}
            </div>
            <div>
              <div className="text-white font-bold text-sm">{p1Name}</div>
              {displayTurn && !isWatch && (
                <div className="flex items-center gap-1">
                  <div className={`text-sm font-bold ${timer <= 5 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                    {tf('⏱️ {0}ث', timer)}
                  </div>
                </div>
              )}
              {isWatch && displayTurn && (
                <div className="text-yellow-400 text-xs">{tf('دور {0}', p1Name)}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="text-sm text-gray-400">
              {tf('{0} قطعة', displayBoard.filter(p => isWhite(p)).length)}
            </div>
          </div>
        </div>

        {/* Emoji Menu */}
        {showEmojiMenu && !isWatch && !gameOver && (
          <div className="flex gap-2 px-4 py-3 bg-gray-800/80 backdrop-blur-sm border-t border-gray-700/50 justify-center animate-slideUp">
            {['👍', '👎', '😂', '😠', '👏', '🎯', '🤔'].map(emoji => (
              <button key={emoji} onClick={() => sendEmoji(emoji)}
                className="text-2xl hover:scale-125 transition-transform active:scale-95 bg-white/5 p-2 rounded-full">
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        {!isWatch && !gameOver && (
          <div className="flex gap-2 px-3 py-2 bg-black/50">
            <div onClick={() => { setActionType('draw'); setShowActionModal(true); }}
              className="flex-1 bg-yellow-600/30 rounded-lg py-2 text-center text-yellow-400 text-sm font-bold border border-yellow-600/30">
              {t('🤝 تعادل')}
            </div>
            <div onClick={() => { setActionType('surrender-match'); setShowActionModal(true); }}
              className="flex-1 bg-red-600/30 rounded-lg py-2 text-center text-red-400 text-sm font-bold border border-red-600/30">
              {t('🏳️ استسلام')}
            </div>
            {gameMode === 'series' && (
              <div onClick={() => { setActionType('surrender-series'); setShowActionModal(true); }}
                className="flex-1 bg-purple-600/30 rounded-lg py-2 text-center text-purple-400 text-sm font-bold border border-purple-600/30">
                {t('🚫 ترك السلسلة')}
              </div>
            )}
          </div>
        )}

        {/* Watch mode - back button */}
        {isWatch && (
          <div className="flex gap-2 px-3 py-2 bg-black/50">
            <div onClick={() => { setScreen('live'); setGameMode('quick'); }}
              className="flex-1 bg-gray-700 rounded-lg py-2 text-center text-gray-300 text-sm font-bold">
              {t('← رجوع للمباريات')}
            </div>
          </div>
        )}

        {/* Incoming Rematch Request Modal (Fix #31) */}
        {!isWatch && incomingRematchOffer && gameOver && (
          <div className="fixed inset-0 bg-black/85 z-[95] flex items-center justify-center p-6 animate-fadeIn">
            <div className="bg-slate-900 rounded-[2rem] p-7 w-full max-w-xs border border-blue-500/30 shadow-2xl text-center">
              <div className="text-4xl mb-3">🔄</div>
              <h3 className="text-white font-black text-base mb-1">{t('طلب جولة جديدة')}</h3>
              <p className="text-slate-400 text-xs mb-5">منافسك يريد بدء الجولة التالية من السلسلة ({seriesWins}-{seriesLosses})</p>
              <div className="grid grid-cols-2 gap-2">
                <div onClick={() => {
                  setIncomingRematchOffer(false);
                  network.sendGameEvent({ type: 'rematch_rejected' });
                  showNotif(t('رفضت الجولة التالية'));
                }} className="bg-red-600/80 rounded-xl py-3 text-white font-bold text-sm cursor-pointer active:scale-95 transition-all">
                  {t('رفض ❌')}
                </div>
                <div onClick={() => {
                  setIncomingRematchOffer(false);
                  network.sendGameEvent({ type: 'rematch_accepted' });
                  if (opponentRef.current) startGame(pendingGameModeRef.current, opponentRef.current, true, false);
                }} className="bg-green-600/80 rounded-xl py-3 text-white font-bold text-sm cursor-pointer active:scale-95 transition-all">
                  {t('قبول ✅')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Waiting for opponent to accept rematch (Fix #31) */}
        {!isWatch && waitingForRematch && gameOver && (
          <div className="fixed inset-0 bg-black/85 z-[90] flex items-center justify-center p-6 animate-fadeIn">
            <div className="bg-slate-900 rounded-[2rem] p-7 w-full max-w-xs border border-blue-500/30 shadow-2xl text-center">
              <div className="flex justify-center gap-2 mb-4">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <h3 className="text-white font-black text-base mb-1">{t('⏳ بانتظار المنافس...')}</h3>
              <p className="text-slate-400 text-xs mb-4">{t('طلبنا تأكيد الجولة التالية')}</p>
              <div onClick={() => {
                setWaitingForRematch(false);
                if (rematchTimeoutRef.current) { clearTimeout(rematchTimeoutRef.current); rematchTimeoutRef.current = null; }
                // Fix #36: tell the opponent we withdrew the request, so their modal doesn't hang
                network.sendGameEvent({ type: 'rematch_rejected' });
              }}
                className="bg-slate-800 rounded-xl py-2.5 text-slate-400 font-bold text-xs cursor-pointer active:scale-95 transition-all">
                {t('إلغاء الانتظار')}
              </div>
            </div>
          </div>
        )}

        {/* Incoming Draw Offer Modal (Fix #29) */}
        {!isWatch && incomingDrawOffer && !gameOver && (
          <div className="fixed inset-0 bg-black/85 z-[90] flex items-center justify-center p-6 animate-fadeIn">
            <div className="bg-slate-900 rounded-[2rem] p-7 w-full max-w-xs border border-yellow-500/30 shadow-2xl text-center">
              <div className="text-4xl mb-3">🤝</div>
              <h3 className="text-white font-black text-base mb-1">{t('طلب تعادل')}</h3>
              <p className="text-slate-400 text-xs mb-5">{t('منافسك يعرض إنهاء المباراة بالتعادل')}</p>
              <div className="grid grid-cols-2 gap-2">
                <div onClick={() => {
                  setIncomingDrawOffer(false);
                  network.sendGameEvent({ type: 'draw_rejected' });
                  showNotif(t('رفضت طلب التعادل'));
                }} className="bg-red-600/80 rounded-xl py-3 text-white font-bold text-sm cursor-pointer active:scale-95 transition-all">
                  {t('رفض ❌')}
                </div>
                <div onClick={() => {
                  setIncomingDrawOffer(false);
                  network.sendGameEvent({ type: 'draw_accepted' });
                  setGameOver(true);
                  setWinner('draw');
                  handleGameEnd('draw');
                  void network.finishMatch('draw', 0);
                }} className="bg-green-600/80 rounded-xl py-3 text-white font-bold text-sm cursor-pointer active:scale-95 transition-all">
                  {t('قبول 🤝')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reconnecting / Abandonment Watchdog Overlay (Fix #27) */}
        {!isWatch && showReconnecting && !gameOver && !incomingDrawOffer && (
          <div className="fixed inset-0 bg-black/85 z-[90] flex items-center justify-center p-6 animate-fadeIn">
            <div className="bg-slate-900 rounded-[2rem] p-7 w-full max-w-xs border border-orange-500/30 shadow-2xl text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="6" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f97316" strokeWidth="6"
                    strokeDasharray={`${(reconnectSecondsLeft / 45) * 264} 264`}
                    strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s linear' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-orange-400">{reconnectSecondsLeft}</span>
                </div>
              </div>
              <h3 className="text-white font-black text-base mb-1">{t('⚠️ انقطع اتصال المنافس')}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                {t('ننتظر عودته... إذا لم يعد سيُعتبر مستسلماً تلقائياً وتفوز بالمباراة 🏆')}
              </p>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {!isWatch && gameOver && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
            <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 text-center shadow-2xl animate-scaleIn">
              <div className="text-5xl mb-3">
                {winner === 'white' ? '🏆' : winner === 'draw' ? '🤝' : '😔'}
              </div>
              <div className="text-white font-bold text-2xl mb-2">
                {winner === 'white' ? t('فوز! 🎉') : winner === 'draw' ? t('تعادل') : t('خسارة')}
              </div>
              {betAmount > 0 && gameMode !== 'series' && (
                <div className={`text-lg font-bold mb-3 ${winner === 'white' ? 'text-green-400' : winner === 'draw' ? 'text-yellow-400' : 'text-red-400'}`}>
                  {winner === 'white' ? `+${fmtNum((betAmount * 2))} 💰` : winner === 'draw' ? t('💰 استرجاع الرهان') : `-${fmtNum(betAmount)} 💰`}
                </div>
              )}
              {betAmount > 0 && gameMode === 'series' && (
                <div className="text-sm text-slate-400 mb-3">
                  {seriesWins >= 4 ? tf('🏆 ربحت +{0} 💰', fmtNum((betAmount * 2))) :
                   seriesLosses >= 4 ? tf('💔 خسرت {0} 💰', fmtNum(betAmount)) :
                   tf('الرهان الإجمالي: {0} 💰 • {1}/{2}', fmtNum(betAmount), seriesWins, seriesLosses)}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="text-yellow-400 font-bold">{whiteCount}</div>
                  <div className="text-gray-500 text-xs">{t('قطعك')}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="text-gray-400 font-bold">{blackCount}</div>
                  <div className="text-gray-500 text-xs">{t('قطع الخصم')}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="text-blue-400 font-bold">{12 - blackCount}</div>
                  <div className="text-gray-500 text-xs">{t('أسرت')}</div>
                </div>
              </div>

              {gameMode === 'series' && (() => {
                const seriesOver = seriesWins >= 4 || seriesLosses >= 4;
                if (seriesOver) {
                  const wonSeries = seriesWins >= 4;
                  return (
                    <div className={`rounded-xl p-4 mb-2 text-center border ${wonSeries ? 'bg-gradient-to-r from-yellow-900/50 to-amber-900/50 border-yellow-500/40' : 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-600/40'}`}>
                      <div className="text-3xl mb-1">{wonSeries ? '🏆' : '😔'}</div>
                      <div className={`font-black text-lg mb-1 ${wonSeries ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {wonSeries ? t('فزت بالسلسلة!') : t('خسرت السلسلة')}
                      </div>
                      <div className="text-gray-400 text-sm">{seriesWins} - {seriesLosses}</div>
                    </div>
                  );
                }
                return (
                <div onClick={() => {
                  if (isRealMatch) {
                    network.sendGameEvent({ type: 'rematch_request' });
                    setWaitingForRematch(true);
                    showNotif(t('⏳ بانتظار موافقة المنافس على الجولة التالية...'));
                    if (rematchTimeoutRef.current) clearTimeout(rematchTimeoutRef.current);
                    rematchTimeoutRef.current = setTimeout(() => {
                      setWaitingForRematch(false);
                      showNotif(t('⏱️ انتهت مهلة انتظار رد المنافس'));
                    }, 20000);
                  } else {
                    startGame('series', opponent!, false, false);
                  }
                }}
                  className="bg-blue-600 rounded-xl py-3 text-white font-bold mb-2 cursor-pointer active:scale-95 transition-all">
                  {tf('🏆 المباراة التالية ({0}-{1})', seriesWins, seriesLosses)}
                </div>
                );
              })()}

              {/* تحليل المباراة — يُعرض فقط إن كان هناك ما يُحلَّل.
                  (المشاهدة مستبعدة سلفاً في هذا الفرع: لها نافذتها الخاصة،
                   ولذا لا شرط إضافي عليها هنا.) */}
              {logRef.current.items.some(it => it.byWhite) && (
                <div onClick={() => { setScreen('analysis'); runAnalysis(); }}
                  className="bg-gradient-to-r from-indigo-700 to-violet-700 rounded-xl py-3 text-white font-bold mb-2 cursor-pointer active:scale-95 transition-all text-center border border-indigo-400/20">
                  {t('🔍 تحليل المباراة')}
                </div>
              )}

              <div onClick={() => {
                // Full cleanup when going home from game-over modal (Fix 4)
                setScreen('home');
                void ads.maybeShowInterstitial(gameMode);
                setGameOver(false);
                setBetAmount(0); // prevent stale bet escrow on next game
                setIsRealMatch(false);
                setP2pLabel('');
                setWaitingForRematch(false);
                setIncomingRematchOffer(false);
                setIncomingDrawOffer(false);
                setShowReconnecting(false);
                if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
                if (rematchTimeoutRef.current) { clearTimeout(rematchTimeoutRef.current); rematchTimeoutRef.current = null; }
                if (gameMode === 'series') {
                  setSeriesWins(0);
                  setSeriesLosses(0);
                  setSeriesRounds([]);
                }
              }}
                className="bg-gray-700 rounded-xl py-3 text-gray-300 font-bold cursor-pointer active:scale-95 transition-all">
                {t('🏠 الرئيسية')}
              </div>
            </div>
          </div>
        )}

        {/* Watch Mode Game Over Modal */}
        {isWatch && watchGameOver && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
            <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl p-8 w-full max-w-xs border border-slate-700/50 text-center shadow-2xl animate-scaleIn">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 
                ${watchWinner === 'white' ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-gradient-to-br from-red-400 to-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)]'}`}>
                <span className="text-4xl">🏆</span>
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{t('انتهت المباراة!')}</h2>
              <div className="bg-slate-700/40 rounded-2xl p-4 mb-6 border border-slate-600/30">
                <p className="text-slate-300 text-sm mb-1">{t('الفائز هو:')}</p>
                <p className={`text-xl font-black ${watchWinner === 'white' ? 'text-amber-400' : 'text-red-400'}`}>
                  {watchWinner === 'white' ? watchMatch?.player1.name : watchMatch?.player2.name}
                </p>
              </div>
              <p className="text-slate-500 text-[10px] uppercase tracking-widest animate-pulse font-black">{t('جاري تحضير بث جديد من البداية...')}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---- ACTION MODAL ----
  const renderActionModal = () => showActionModal && (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
        <div className="text-center mb-4">
          <div className="text-3xl mb-2">
            {actionType === 'draw' ? '🤝' : actionType === 'surrender-series' ? '🚫' : '🏳️'}
          </div>
          <div className="text-white font-bold text-lg">
            {actionType === 'draw' ? t('اقتراح تعادل') :
             actionType === 'surrender-series' ? t('الانسحاب من السلسلة') :
             t('الاستسلام')}
          </div>
          <div className="text-gray-400 text-sm mt-1">
            {actionType === 'draw' ? t('سيتم إرسال اقتراح التعادل للخصم') :
             actionType === 'surrender-series' ? t('ستخسر السلسلة بالكامل وتفقد الرهان') :
             t('ستخسر هذه المباراة')}
          </div>
        </div>

        <div onClick={() => {
          setShowActionModal(false);
          // Fix #27: any manual action ends the watchdog wait
          if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
          setShowReconnecting(false);

          if (actionType === 'draw') {
            if (isRealMatch) {
              // Fix #28: send a real draw offer to the opponent over the network
              network.sendGameEvent({ type: 'draw_offer' });
              showNotif(t('🤝 تم إرسال طلب التعادل للمنافس...'));
            } else {
              // AI accepts draw 40% of the time
              if (Math.random() < 0.4) {
                setGameOver(true);
                setWinner('draw');
                handleGameEnd('draw');
                showNotif(t('الخصم وافق على التعادل! 🤝'));
              } else {
                showNotif(t('الخصم رفض التعادل ❌'));
              }
            }
          } else if (actionType === 'surrender-match') {
            setGameOver(true);
            setWinner('black');
            handleGameEnd('black');
            // Fix #28: tell the real opponent we surrendered & persist the result
            if (isRealMatch) {
              network.sendGameEvent({ type: 'game_over', winner: 'white', reason: 'surrender' });
              void network.finishMatch('black', -15);
            }
          } else if (actionType === 'surrender-series') {
            setGameOver(true);
            setWinner('black');
            handleGameEnd('black');
            setSeriesLosses(4);
            if (isRealMatch) {
              network.sendGameEvent({ type: 'game_over', winner: 'white', reason: 'surrender' });
              void network.finishMatch('black', -15);
            }
          }
        }}
          className="bg-red-600 rounded-xl py-3 text-white font-bold text-center mb-2">
          {t('تأكيد')}
        </div>
        <div onClick={() => setShowActionModal(false)}
          className="bg-gray-700 rounded-xl py-3 text-gray-300 font-bold text-center">
          {t('إلغاء')}
        </div>
      </div>
    </div>
  );

  // ---- PLAYER MODAL ----
  const renderPlayerModal = () => showPlayerModal && selectedPlayer && (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800 to-gray-900 rounded-3xl p-5 w-full max-w-sm border border-gray-700 shadow-2xl relative overflow-hidden animate-scaleIn">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        
        <div className="relative z-10">
          {/* Header & Badges */}
          <div className="flex justify-between items-start mb-2">
            <div className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-1 rounded-lg border border-amber-500/30">
              {tf('# {0} عالمياً', Math.floor(Math.random() * 5000) + 1)}
            </div>
            <div className="flex gap-1">
              {['🏆', '💎', '🔥'].slice(0, Math.max(1, Math.floor(selectedPlayer.level / 3))).map((icon, i) => (
                <div key={i} className="bg-gray-800 rounded-md w-6 h-6 flex items-center justify-center text-xs border border-gray-700">{icon}</div>
              ))}
            </div>
          </div>

          {/* Profile Info */}
          <div className="text-center mb-5">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-5xl mx-auto mb-3 border-2 border-gray-600 shadow-lg shadow-gray-900/50 transform hover:rotate-3 transition-transform">
              {selectedPlayer.avatar}
            </div>
            <div className="text-white font-black text-2xl">{selectedPlayer.name}</div>
            <div className="text-gray-400 text-sm mt-1">{selectedPlayer.country} • ELO {selectedPlayer.elo}</div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-gradient-to-b from-green-900/40 to-green-900/20 rounded-xl p-3 text-center border border-green-500/20 shadow-inner">
              <div className="text-green-400 font-black text-xl">{selectedPlayer.wins}</div>
              <div className="text-gray-400 text-[10px] mt-1">{t('انتصار')}</div>
            </div>
            <div className="bg-gradient-to-b from-red-900/40 to-red-900/20 rounded-xl p-3 text-center border border-red-500/20 shadow-inner">
              <div className="text-red-400 font-black text-xl">{selectedPlayer.losses}</div>
              <div className="text-gray-400 text-[10px] mt-1">{t('هزيمة')}</div>
            </div>
            <div className="bg-gradient-to-b from-blue-900/40 to-blue-900/20 rounded-xl p-3 text-center border border-blue-500/20 shadow-inner">
              <div className="text-blue-400 font-black text-xl">{Math.round((selectedPlayer.wins / Math.max(1, selectedPlayer.wins + selectedPlayer.losses)) * 100)}%</div>
              <div className="text-gray-400 text-[10px] mt-1">{t('نسبة الفوز')}</div>
            </div>
          </div>
          
          {/* Progress & Highlights */}
          <div className="bg-gray-800/80 rounded-2xl p-4 mb-5 border border-gray-700/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-300 text-xs font-bold">{t('التقدم والاحترافية')}</span>
              <span className="text-amber-400 text-xs font-black bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">المستوى {selectedPlayer.level}</span>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-gray-400">{t('الإنجازات المكتملة')}</span>
                  <span className="text-white font-bold">{Math.min(100, Math.floor((selectedPlayer.wins / 50) * 100))} / 100</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400" style={{ width: `${Math.min(100, Math.floor((selectedPlayer.wins / 50) * 100))}%` }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-[10px] mb-1.5">
                  <span className="text-gray-400">{t('التحديات المكتملة')}</span>
                  <span className="text-white font-bold">{Math.min(100, Math.floor((selectedPlayer.elo / 2500) * 100))} / 100</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${Math.min(100, Math.floor((selectedPlayer.elo / 2500) * 100))}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {(() => {
            const friend = friends.find(f => f.id === selectedPlayer.id);
            if (friend?.friendStatus === 'accepted') {
              return (
                <div className="bg-green-900/30 rounded-xl py-2.5 text-center text-green-400 font-bold mb-2 border border-green-500/30">
                  {t('✅ صديقك بالفعل')}
                </div>
              );
            } else if (friend?.friendStatus === 'pending-out') {
              return (
                <div className="bg-yellow-900/30 rounded-xl py-2.5 text-center text-yellow-400 font-bold mb-2 border border-yellow-500/30">
                  {t('⏳ في انتظار الموافقة')}
                </div>
              );
            } else if (friendRequestStatus === 'accepted') {
              return (
                <div className="bg-green-900/30 rounded-xl py-2.5 text-center text-green-400 font-bold mb-2 border border-green-500/30">
                  {t('✅ تم القبول!')}
                </div>
              );
            } else {
              return (
                <button onClick={() => sendFriendRequest(selectedPlayer)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl py-3 text-center text-white font-bold mb-2 cursor-pointer active:scale-95 transition-all shadow-lg shadow-blue-500/20 border border-blue-400/30">
                  {t('👥 إضافة صديق')}
                </button>
              );
            }
          })()}

          <button onClick={() => { setShowPlayerModal(false); setFriendRequestStatus(''); }}
            className="w-full bg-slate-700/50 hover:bg-slate-700 rounded-xl py-3 text-center text-gray-300 font-bold active:scale-[0.98] transition-all">
            {t('إغلاق')}
          </button>
        </div>
      </div>
    </div>
  );

  // ---- FRIENDS SCREEN ----
  // Memoized friend lists — recompute only when friends array changes (not on every render)
  const friendsAccepted = useMemo(() =>
    friends.filter(f => f.friendStatus === 'accepted')
           .map(f => f.isGeneral ? { ...f, isOnline: (f.elo % 7) < 4, isPlaying: (f.elo % 11) < 3 } : f),
    [friends]
  );
  const friendsOutgoing = useMemo(() => friends.filter(f => f.friendStatus === 'pending-out'), [friends]);
  const friendsIncoming = useMemo(() => friends.filter(f => f.friendStatus === 'pending-in'), [friends]);

  const renderFriends = () => {
    const accepted = friendsAccepted;
    const outgoing = friendsOutgoing;
    const incoming = friendsIncoming;

    const currentList = friendTab === 'accepted' ? accepted : friendTab === 'outgoing' ? outgoing : incoming;

    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-black">
        <div className="p-3 bg-black/30">
          <div className="text-white font-bold text-lg text-center mb-3">{t('👥 الأصدقاء')}</div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
            <div onClick={() => setFriendTab('accepted')}
              className={`flex-1 py-2 rounded-lg text-center text-sm font-bold transition-all ${
                friendTab === 'accepted' ? 'bg-green-600 text-white' : 'text-gray-400'
              }`}>
              {tf('✅ الأصدقاء ({0})', accepted.length)}
            </div>
            <div onClick={() => setFriendTab('outgoing')}
              className={`flex-1 py-2 rounded-lg text-center text-sm font-bold transition-all ${
                friendTab === 'outgoing' ? 'bg-yellow-600 text-white' : 'text-gray-400'
              }`}>
              {tf('📤 صادرة ({0})', outgoing.length)}
            </div>
            <div onClick={() => setFriendTab('incoming')}
              className={`flex-1 py-2 rounded-lg text-center text-sm font-bold transition-all relative ${
                friendTab === 'incoming' ? 'bg-red-600 text-white' : 'text-gray-400'
              }`}>
              📥 واردة ({incoming.length})
              {incoming.length > 0 && friendTab !== 'incoming' && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                  {incoming.length}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-20">
          {currentList.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <div className="text-4xl mb-2">
                {friendTab === 'accepted' ? '👥' : friendTab === 'outgoing' ? '📤' : '📥'}
              </div>
              <div>
                {friendTab === 'accepted' ? t('لا يوجد أصدقاء بعد') :
                 friendTab === 'outgoing' ? t('لا توجد طلبات صادرة') :
                 t('لا توجد طلبات واردة')}
              </div>
            </div>
          ) : (
            currentList.map(friend => (
              <div key={friend.id} className="bg-gray-800/50 rounded-xl p-3 mb-2 border border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {friendTab === 'accepted' && (
                      <>
                        {friend.isOnline && (
                          <div onClick={() => {
                            setOpponent(friend);
                            setPendingGameMode('quick');
                            setShowBetModal(true);
                          }}
                            className="bg-green-600 rounded-lg px-3 py-1 text-white text-xs font-bold">
                            {t('تحدي ⚔️')}
                          </div>
                        )}
                      </>
                    )}
                    {friendTab === 'outgoing' && (
                      <div onClick={() => cancelRequest(friend.id)}
                        className="bg-red-600/30 rounded-lg px-3 py-1 text-red-400 text-xs font-bold border border-red-500/30">
                        {t('إلغاء')}
                      </div>
                    )}
                    {friendTab === 'incoming' && (
                      <div className="flex gap-1">
                        <div onClick={() => acceptFriend(friend.id)}
                          className="bg-green-600 rounded-lg px-3 py-1 text-white text-xs font-bold">
                          {t('قبول ✅')}
                        </div>
                        <div onClick={() => rejectFriend(friend.id)}
                          className="bg-red-600/30 rounded-lg px-3 py-1 text-red-400 text-xs font-bold border border-red-500/30">
                          {t('رفض ❌')}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 cursor-pointer"
                    onClick={() => { setSelectedPlayer(friend); setShowPlayerModal(true); }}>
                    <div className="text-start">
                      <div className="text-white font-bold text-sm">{friend.name}</div>
                      <div className="text-gray-400 text-xs flex items-center gap-1 justify-end">
                        {friend.isOnline && <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>}
                        <span>{friend.country}</span>
                        <span>ELO {friend.elo}</span>
                      </div>
                      {friendTab === 'accepted' && (
                        <div className="text-xs text-gray-500">
                          {friend.isOnline ? (friend.isPlaying ? t('🎮 يلعب الآن') : t('🟢 متصل')) : t('⚫ غير متصل')}
                        </div>
                      )}
                      {friendTab === 'outgoing' && (
                        <div className="text-xs text-yellow-500">{t('⏳ في انتظار الموافقة')}</div>
                      )}
                      {friendTab === 'incoming' && (
                        <div className="text-xs text-blue-400">{t('يريد إضافتك كصديق')}</div>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl relative">
                      {friend.avatar}
                      {friend.isOnline && friendTab === 'accepted' && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // ---- LEADERBOARD SCREEN ----
  // Memoized leaderboard — avoids recomputing on every render
  const lbSorted = useMemo(() => {
    if (lbLoading) return [];
    const myEntry = settings.privacy ? null : {
      id: network.myUserId || `local_${Date.now()}`,
      display_name: myName, avatar: myAvatar, elo: myElo,
      wins: myWins, losses: myLosses, country: myCountry,
      is_online: true, _isMe: true
    } as any;
    return (myEntry
      ? [...lbPlayers.filter((p: any) => p.id !== myEntry.id), myEntry]
      : [...lbPlayers]
    ).sort((a: any, b: any) => b.elo - a.elo).slice(0, 50);
  }, [lbLoading, lbPlayers, settings.privacy, myName, myAvatar, myElo, myWins, myLosses, myCountry, netStatus]); // netStatus triggers recompute after auth

  const renderLeaderboard = () => {
    const sorted = lbSorted;

    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-black">
        <div className="p-3 bg-black/30 flex items-center justify-between">
          <div className="w-8" />
          <div className="text-white font-bold text-lg text-center">{t('🏆 المتصدرين')}</div>
          <button
            onClick={() => { setLbPlayers([]); setLbLoading(true); network.getLeaderboard(50).then(d => { if(d?.length) setLbPlayers(d); }).finally(() => setLbLoading(false)); }}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-amber-400 active:scale-90 transition-all text-lg"
            title={t('تحديث')}>
            🔄
          </button>
        </div>

          {/* Loading */}
        {lbLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="flex gap-2">{[0,1,2].map(i=><div key={i} className="w-3 h-3 bg-amber-500 rounded-full animate-bounce" style={{animationDelay: i*0.15+'s'}}/>)}</div>
            <span className="text-slate-500 text-xs">{t('جاري تحميل المتصدرين...')}</span>
          </div>
        )}

        {!lbLoading && <>
        {/* Top 3 */}
        <div className="flex justify-center items-end gap-3 p-3">
          {sorted.slice(0, 3).map((p, i) => {
            const nm = p.display_name ?? p.name ?? t('؟');
            const av = p.avatar ?? '👤';
            const isMe = p._isMe;
            return (
            <div key={p.id} className={`text-center ${i === 0 ? 'order-2' : i === 1 ? 'order-1' : 'order-3'}`}>
              <div className="relative">
                <div className={`w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-2xl mx-auto mb-1 border-2 ${
                  i === 0 ? 'border-yellow-400' : i === 1 ? 'border-gray-400' : 'border-orange-400'
                } ${isMe ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-gray-900' : ''}`}>
                  {av}
                </div>
                {p.is_online && <div className="absolute bottom-1 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"/>}
              </div>
              <div className={`text-xs font-bold truncate max-w-[80px] ${isMe ? 'text-amber-400' : 'text-white'}`}>{nm}{isMe ? ' ⭐' : ''}</div>
              <div className="text-yellow-400 text-xs">{p.elo}</div>
              <div className="text-xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
            </div>
          );})}
        </div>

        {/* Rest */}
        <div className="flex-1 overflow-y-auto px-3 pb-20">
          {sorted.slice(3).map((p, i) => {
            const nm = p.display_name ?? p.name ?? t('؟');
            const av = p.avatar ?? '👤';
            const isMe = p._isMe;
            return (
            <div key={p.id} className={`rounded-xl p-3 mb-1 flex items-center justify-between border ${isMe ? 'bg-amber-900/20 border-amber-500/30' : 'bg-gray-800/50 border-gray-700/30'}`}>
              <div className="flex items-center gap-2">
                <div className="text-gray-500 text-sm font-bold w-6 text-center">#{i + 4}</div>
                <div className="bg-gray-700 rounded-lg px-2 py-1 text-yellow-400 text-sm font-bold">{p.elo}</div>
                <div className="text-green-400 text-xs">{p.wins ?? 0}W</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-start">
                  <div className={`text-sm font-bold ${isMe ? 'text-amber-400' : 'text-white'}`}>{nm}{isMe ? ' ⭐' : ''}</div>
                  <div className="text-gray-500 text-xs">{p.country ?? ''}</div>
                </div>
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-lg">{av}</div>
                  {p.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-gray-900"/>}
                </div>
              </div>
            </div>
          );})}
        </div>
        </>}
      </div>
    );
  };

  // ---- LIVE SCREEN ----
  const renderLive = () => {
    // Sort matches: Real matches first, then sort by viewers
    // Note: liveMatches already memoized via useMemo([players])
    const sortedLiveMatches = [...liveMatches].sort((a, b) => {
      if (a.isReal && !b.isReal) return -1;
      if (!a.isReal && b.isReal) return 1;
      return (b.viewers || 0) - (a.viewers || 0);
    });

    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-black">
        <div className="p-3 bg-black/30">
          <div className="text-white font-bold text-lg text-center flex items-center justify-center gap-2">
             <span className="text-red-500 animate-pulse">📡</span>
             <span>{t('البث المباشر للمباريات')}</span>
          </div>
          <div className="text-gray-400 text-center text-[10px] uppercase tracking-widest mt-1">
             <span className="text-red-500">LIVE</span> • {sortedLiveMatches.length} ARENA BATTLES
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-20 pt-2">
          {sortedLiveMatches.map(match => (
            <div key={match.id}
              onClick={() => {
                setWatchMatch(match);
                const midGame = createRandomMidGameBoard();
                setWatchBoard(midGame.board);
                setWatchTurn(midGame.turn);
                setGameMode('watch');
                setLastMove(null);
                setScreen('game');
              }}
              className="bg-gray-800/40 rounded-2xl p-4 mb-3 border border-gray-700/30 cursor-pointer hover:bg-gray-800/60 transition-all active:scale-[0.98] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-red-600/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform" />
              
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                    <span className="text-red-500 text-[8px] animate-pulse">●</span>
                    <span className="text-white text-[10px] font-black uppercase tracking-tighter">LIVE</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold">
                    <span className="text-xs">👁️</span>
                    <span>{match.viewers}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                   {match.isReal && <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black px-2 py-0.5 rounded border border-amber-500/20 uppercase">Pro Match</span>}
                   <span className="text-slate-500 text-[9px] font-bold uppercase tracking-tighter">{match.moveCount} Moves</span>
                </div>
              </div>

              <div className="flex items-center justify-between relative z-10">
                <div className="flex flex-col items-center gap-1 w-[35%]">
                   <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-2xl shadow-lg border border-white/5">{match.player1.avatar}</div>
                   <div className="text-white text-[10px] font-bold truncate w-full text-center">{match.player1.name}</div>
                   <div className="text-amber-500 text-[9px] font-black italic">ELO {match.player1.elo}</div>
                </div>

                <div className="flex flex-col items-center gap-1">
                   <div className="text-slate-600 font-black text-xs italic">VS</div>
                   <div className="h-[1px] w-8 bg-slate-800" />
                </div>

                <div className="flex flex-col items-center gap-1 w-[35%]">
                   <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-2xl shadow-lg border border-white/5">{match.player2.avatar}</div>
                   <div className="text-white text-[10px] font-bold truncate w-full text-center">{match.player2.name}</div>
                   <div className="text-amber-500 text-[9px] font-black italic">ELO {match.player2.elo}</div>
                </div>
              </div>

              {match.betAmount! > 0 && (
                <div className="mt-4 flex items-center justify-center gap-2 bg-yellow-500/5 py-1.5 rounded-xl border border-yellow-500/10">
                  <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Stake Pool: {fmtNum((match.betAmount! * 2))}</span>
                  <span className="text-xs">💰</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---- PROFILE SCREEN ----
  const renderProfile = () => {
    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-black">
        <div className="p-3 bg-black/30 flex items-center justify-between">
          <div className="w-8"></div>
          <div className="text-white font-bold text-lg text-center">{t('👤 حسابي')}</div>
          <div onClick={() => setScreen('home')} className="text-gray-400 text-xl cursor-pointer w-8 text-end">✕</div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-24">
          <div className="bg-gradient-to-br from-slate-800 to-gray-900 rounded-3xl p-5 mt-2 mb-4 border border-gray-700/50 shadow-xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl" />
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative group cursor-pointer" onClick={() => { setShowAvatarPicker(p => !p); setShowCountryPicker(false); }}>
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-red-600 p-1 shadow-lg shadow-orange-500/30 mb-3">
                  <div className="w-full h-full bg-gray-900 rounded-full flex items-center justify-center text-4xl overflow-hidden relative">
                    {myAvatar}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs">{t('تغيير')}</span>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-3 right-0 bg-blue-500 rounded-full w-7 h-7 flex items-center justify-center border-2 border-gray-900 shadow-lg text-xs">✏️</div>
              </div>
              
              <div className="flex items-center gap-2 mb-1">
                <input 
                  type="text" 
                  value={myName}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, 20);
                    if (v.trim()) setMyName(v);
                  }}
                  onBlur={(e) => { const t = e.target.value.trim(); if (t) setMyName(t); }}
                  maxLength={20}
                  className="bg-transparent text-white font-black text-2xl text-center border-b border-dashed border-gray-600 focus:border-amber-500 outline-none w-48"
                />
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                <span className="text-gray-400 text-sm cursor-pointer hover:text-white" onClick={() => { setShowCountryPicker(p => !p); setShowAvatarPicker(false); }}>{myCountry} {t('تغيير')}</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400 text-sm font-mono">ID: #{network.myUserId.slice(-6).toUpperCase()}</span>
              </div>
              
              <div className="w-full bg-gray-800/80 rounded-xl p-3 border border-gray-700/50">
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-gray-400">{t('المستوى')}<span className="text-white">{myLevel}</span></span>
                  <span className="text-blue-400">{Math.min(100, Math.floor((myElo / 2500) * 100))}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-1.5">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    style={{ width: `${Math.min(100, Math.floor((myElo / 2500) * 100))}%`, transition: 'width 0.5s ease' }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>ELO: {myElo}</span>
                  <span>{t('الهدف: 2500')}</span>
                </div>
              </div>

              {/* Avatar Picker (Fix #31) */}
              {showAvatarPicker && (
                <div className="w-full mt-3 bg-slate-800/90 rounded-2xl p-3 border border-slate-600/50">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest text-center mb-2">{t('اختر صورتك')}</p>
                  <div className="flex flex-wrap justify-center gap-1">
                    <span onClick={() => { setMyAvatar("👤"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">👤</span>
                    <span onClick={() => { setMyAvatar("😎"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">😎</span>
                    <span onClick={() => { setMyAvatar("🦁"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🦁</span>
                    <span onClick={() => { setMyAvatar("🐯"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🐯</span>
                    <span onClick={() => { setMyAvatar("🦊"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🦊</span>
                    <span onClick={() => { setMyAvatar("🐺"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🐺</span>
                    <span onClick={() => { setMyAvatar("🦅"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🦅</span>
                    <span onClick={() => { setMyAvatar("🐉"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🐉</span>
                    <span onClick={() => { setMyAvatar("👑"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">👑</span>
                    <span onClick={() => { setMyAvatar("⚡"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">⚡</span>
                    <span onClick={() => { setMyAvatar("🔥"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🔥</span>
                    <span onClick={() => { setMyAvatar("💎"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">💎</span>
                    <span onClick={() => { setMyAvatar("🌙"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🌙</span>
                    <span onClick={() => { setMyAvatar("🎭"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🎭</span>
                    <span onClick={() => { setMyAvatar("🥷"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🥷</span>
                    <span onClick={() => { setMyAvatar("🤴"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🤴</span>
                    <span onClick={() => { setMyAvatar("🫅"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🫅</span>
                    <span onClick={() => { setMyAvatar("🦸"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🦸</span>
                    <span onClick={() => { setMyAvatar("🧙"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🧙</span>
                    <span onClick={() => { setMyAvatar("🏆"); setShowAvatarPicker(false); }} className="text-3xl cursor-pointer p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-all">🏆</span>
                  </div>
                </div>
              )}
              {/* Country Picker (Fix #31) */}
              {showCountryPicker && (
                <div className="w-full mt-2 bg-slate-800/90 rounded-2xl p-3 border border-slate-600/50">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest text-center mb-2">{t('اختر دولتك')}</p>
                  <div className="flex flex-wrap justify-center gap-1">
                    <span onClick={() => { setMyCountry("🇲🇦"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇲🇦</span>
                    <span onClick={() => { setMyCountry("🇩🇿"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇩🇿</span>
                    <span onClick={() => { setMyCountry("🇹🇳"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇹🇳</span>
                    <span onClick={() => { setMyCountry("🇪🇬"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇪🇬</span>
                    <span onClick={() => { setMyCountry("🇸🇦"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇸🇦</span>
                    <span onClick={() => { setMyCountry("🇦🇪"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇦🇪</span>
                    <span onClick={() => { setMyCountry("🇶🇦"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇶🇦</span>
                    <span onClick={() => { setMyCountry("🇰🇼"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇰🇼</span>
                    <span onClick={() => { setMyCountry("🇮🇶"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇮🇶</span>
                    <span onClick={() => { setMyCountry("🇾🇪"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇾🇪</span>
                    <span onClick={() => { setMyCountry("🇯🇴"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇯🇴</span>
                    <span onClick={() => { setMyCountry("🇱🇧"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇱🇧</span>
                    <span onClick={() => { setMyCountry("🇸🇾"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇸🇾</span>
                    <span onClick={() => { setMyCountry("🇱🇾"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇱🇾</span>
                    <span onClick={() => { setMyCountry("🇸🇩"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇸🇩</span>
                    <span onClick={() => { setMyCountry("🇫🇷"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇫🇷</span>
                    <span onClick={() => { setMyCountry("🇩🇪"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇩🇪</span>
                    <span onClick={() => { setMyCountry("🇬🇧"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇬🇧</span>
                    <span onClick={() => { setMyCountry("🇺🇸"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇺🇸</span>
                    <span onClick={() => { setMyCountry("🇹🇷"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇹🇷</span>
                    <span onClick={() => { setMyCountry("🇷🇺"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇷🇺</span>
                    <span onClick={() => { setMyCountry("🇨🇳"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇨🇳</span>
                    <span onClick={() => { setMyCountry("🇯🇵"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇯🇵</span>
                    <span onClick={() => { setMyCountry("🇧🇷"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇧🇷</span>
                    <span onClick={() => { setMyCountry("🇦🇷"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇦🇷</span>
                    <span onClick={() => { setMyCountry("🇳🇬"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇳🇬</span>
                    <span onClick={() => { setMyCountry("🇬🇭"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇬🇭</span>
                    <span onClick={() => { setMyCountry("🇸🇳"); setShowCountryPicker(false); }} className="text-2xl cursor-pointer p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all">🇸🇳</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl p-4 mb-4 border border-amber-500/30">
            <h3 className="text-amber-400 font-bold mb-2 text-sm flex items-center gap-2">
              <span className="text-lg">🤝</span> {t('دعوة الأصدقاء (اكسب 1000 💰)')}
            </h3>
            <p className="text-gray-400 text-xs mb-3">{t('شارك رمزك مع أصدقائك، وعندما يسجلون به ستحصلان معاً على 1000 عملة ذهبية!')}</p>
            
            <div className="flex gap-2 mb-3">
              <div className="flex-1 bg-gray-900/50 rounded-xl p-2 border border-gray-700 text-center font-mono font-bold text-amber-500 tracking-widest">
                {(() => { let rc = localStorage.getItem('damaMyReferral'); if (!rc) { rc = 'DAMA' + Math.random().toString(36).substring(2,6).toUpperCase(); localStorage.setItem('damaMyReferral', rc); } return rc; })()}
              </div>
              <button onClick={() => { const rc = localStorage.getItem('damaMyReferral') || 'DAMA????'; navigator.clipboard.writeText(rc)
                            .then(() => showNotif(t('✅ تم نسخ رمز الإحالة: ') + rc))
                            .catch(() => showNotif(t('الرمز: ') + rc)); }} className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl px-4 text-xs font-bold transition-colors">
                {t('نسخ')}
              </button>
            </div>
            
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder={t('أدخل رمز إحالة صديقك هنا...')}
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="flex-1 bg-gray-900/50 rounded-xl p-2 border border-gray-700 text-center text-xs text-white focus:border-amber-500 outline-none"
              />
              <button 
                onClick={() => {
                  const _pr = referralCode.trim().toUpperCase();
                  const _claimed = localStorage.getItem('damaReferralClaimed');
                  const _myOwn = localStorage.getItem('damaMyReferral') || '';
                  if (_claimed) {
                    showNotif(t('⚠️ لقد استخدمت رمز إحالة من قبل'));
                  } else if (_pr.length < 5 || !_pr.startsWith('DAMA') || _pr === _myOwn) {
                    showNotif(t('❌ الرمز غير صالح'));
                  } else {
                    setCoins(c => c + 1000);
                    localStorage.setItem('damaReferralClaimed', '1');
                    showNotif(t('🎉 تم تفعيل الرمز! +1000 عملة'));
                    setReferralCode('');
                  }
                  if (false) {
                    showNotif(t('❌ الرمز غير صحيح'));
                  }
                }}
                className="bg-green-600 hover:bg-green-500 text-white rounded-xl px-4 text-xs font-bold transition-colors"
              >
                {t('تفعيل')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700/30">
              <div className="text-green-400 font-bold text-lg">{myWins}</div>
              <div className="text-gray-500 text-[10px] mt-0.5">{t('فوز')}</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700/30">
              <div className="text-red-400 font-bold text-lg">{myLosses}</div>
              <div className="text-gray-500 text-[10px] mt-0.5">{t('خسارة')}</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700/30">
              <div className="text-yellow-400 font-bold text-lg">{myDraws}</div>
              <div className="text-gray-500 text-[10px] mt-0.5">{t('تعادل')}</div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700/30">
              <div className="text-blue-400 font-bold text-lg">{Math.round((myWins / Math.max(1, myWins + myLosses + myDraws)) * 100)}%</div>
              <div className="text-gray-500 text-[10px] mt-0.5">{t('نسبة الفوز')}</div>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-2xl border border-gray-700/30 overflow-hidden mb-4">
            <div className="flex border-b border-gray-700/50 bg-gray-800/80">
              <div className="flex-1 py-3 text-center text-amber-400 font-bold text-sm border-b-2 border-amber-500">{t('🏆 100 إنجاز')}</div>
              <div className="flex-1 py-3 text-center text-gray-400 font-bold text-sm cursor-pointer hover:bg-gray-700/30 transition-colors" onClick={() => showNotif(t('قسم التحديات اليومية والأسبوعية يفتح في التحديث القادم'))}>{t('🎯 100 تحدي')}</div>
            </div>
            <div className="p-3 max-h-60 overflow-y-auto space-y-2">
              <div className="text-center text-xs text-gray-400 mb-2">{t('إنجازات صعبة للغاية (Hardcore)')}</div>
              {[
                { t: t('أسطورة العالم'), d: t('صل إلى تصنيف 2500 ELO'), p: myElo, m: 2500, i: '👑', r: 100000 },
                { t: t('الجيش الذي لا يُقهر'), d: tf('فُز بـ 100 مباراة — لديك {0} انتصار', myWins), p: Math.min(myWins, 100), m: 100, i: '⚔️', r: 50000 },
                { t: t('المُدمّر المتسلسل'), d: t('قم بأسر 6 قطع بضربة واحدة'), p: 0, m: 1, i: '🌪️', r: 10000 },
                { t: t('اكتساح تام'), d: t('فُز بمباراة دون أن تفقد أي قطعة من قطعك'), p: 0, m: 1, i: '🛡️', r: 15000 },
                { t: t('سيد السلاسل'), d: t('فُز بـ 50 سلسلة مباريات بنتيجة 4-0'), p: 2, m: 50, i: '🏆', r: 100000 },
                { t: t('خبير اللعب السريع'), d: t('فُز بـ 10 مباريات خلال أول دقيقتين'), p: 4, m: 10, i: '⏱️', r: 30000 },
                { t: t('رجل المليون'), d: t('اجمع 1,000,000 عملة ذهبية في رصيدك'), p: coins, m: 1000000, i: '💰', r: 500000 },
              ].map((a, i) => (
                <div key={i} className="bg-gray-900/50 rounded-xl p-3 border border-gray-700/50 flex gap-3 opacity-90 hover:opacity-100 transition-opacity">
                  <div className="text-3xl flex items-center justify-center bg-gray-800 rounded-lg w-12 h-12">{a.i}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-white font-bold text-xs">{a.t}</span>
                      <span className="text-yellow-400 text-[10px] font-bold">💰 {fmtNum(a.r)}</span>
                    </div>
                    <p className="text-gray-400 text-[9px] mb-2">{a.d}</p>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${a.p >= a.m ? 'bg-green-500' : 'bg-gradient-to-r from-amber-600 to-yellow-400'}`} style={{ width: `${Math.min(100, (a.p / a.m) * 100)}%` }} />
                    </div>
                    <div className={`text-[9px] text-start mt-1 ${a.p >= a.m ? 'text-green-400 font-bold' : 'text-gray-500'}`}>
                      {a.p >= a.m ? t('✅ مكتمل') : `${fmtNum(a.p)} / ${fmtNum(a.m)}`}
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-center text-xs text-blue-400 py-2 cursor-pointer hover:underline" onClick={() => showNotif(t('جاري تحميل باقي الإنجازات...'))}>{t('عرض الـ 93 إنجاز المتبقية...')}</div>
            </div>
          </div>

          <div className="text-white font-bold text-start mb-2 text-sm">{t('⚙️ الإعدادات')}</div>
          <div className="bg-gray-800/50 rounded-2xl border border-gray-700/30 overflow-hidden">
            {[
              { id: 'notifications', icon: '🔔', label: t('الإشعارات'), desc: t('تفعيل/تعطيل الإشعارات داخل اللعبة'), val: settings.notifications },
              { id: 'privacy', icon: '🔒', label: t('الخصوصية'), desc: t('إخفاء حالة الاتصال عن الأصدقاء'), val: settings.privacy },
              { id: 'sounds', icon: '🔊', label: t('الأصوات'), desc: t('مؤثرات الأكل، الحركة، والأنيميشن'), val: settings.sounds },
              { id: 'vibration', icon: '📳', label: t('الاهتزاز'), desc: t('الاهتزاز عند التنبيهات المهمة'), val: settings.vibration },
              { id: 'analytics', icon: '📊', label: t('التحليلات'), desc: t('مساعدة في تحسين اللعبة (بيانات مجهولة)'), val: settings.analytics ?? true },
            ].map((item) => (
              <div key={item.id} className="p-3 border-b border-gray-700/30 last:border-0 flex items-center justify-between">
                <div>
                  <div className="text-white text-sm flex items-center gap-2">
                    <span>{item.icon}</span> {item.label}
                  </div>
                  <div className="text-gray-500 text-[10px] mt-0.5">{item.desc}</div>
                </div>
                <div 
                  onClick={() => setSettings((prev: typeof settings) => ({ ...prev, [item.id]: !prev[item.id as keyof typeof settings] }))}
                  className={`w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-all ${item.val ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${item.val ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-white font-bold text-start mb-2 mt-5 text-sm">{t('🛡️ الخصوصية والبيانات')}</div>
          <div className="bg-gray-800/50 rounded-2xl border border-gray-700/30 overflow-hidden">
            {[
              { icon: '📜', label: t('سياسة الخصوصية'), desc: t('ما نجمعه من بيانات وكيف نحميه'), url: 'https://dama-tahiro.web.app/privacy-policy' },
              { icon: '🗑️', label: t('حذف الحساب والبيانات'), desc: t('اطلب حذف حسابك وجميع بياناتك'), url: 'https://dama-tahiro.web.app/data-deletion' },
              { icon: '📧', label: t('الدعم والتواصل'), desc: 'zayntahiri1@gmail.com', url: 'mailto:zayntahiri1@gmail.com' },
            ].map((item) => (
              <div
                key={item.label}
                onClick={() => {
                  try { window.open(item.url, '_blank'); }
                  catch { showNotif(t('تعذّر فتح الرابط — تحقّق من الاتصال')); }
                }}
                className="p-3 border-b border-gray-700/30 last:border-0 flex items-center justify-between cursor-pointer active:bg-gray-700/40 transition-colors"
              >
                <div>
                  <div className="text-white text-sm flex items-center gap-2">
                    <span>{item.icon}</span> {item.label}
                  </div>
                  <div className="text-gray-500 text-[10px] mt-0.5">{item.desc}</div>
                </div>
                <span className="text-gray-500 text-lg leading-none">&#8249;</span>
              </div>
            ))}
          </div>

          {/* يظهر فقط للمستخدمين داخل نطاق يشترط إدارة الموافقة (أوروبا/المملكة المتحدة) */}
          {adPrivacyRequired && (
            <div
              onClick={() => { ads.openPrivacyOptions().catch(() => {}); }}
              className="mt-2 bg-gray-800/50 rounded-2xl border border-gray-700/30 p-3 flex items-center justify-between cursor-pointer active:bg-gray-700/40 transition-colors"
            >
              <div>
                <div className="text-white text-sm flex items-center gap-2">
                  <span>⚙️</span> {t('إعدادات خصوصية الإعلانات')}
                </div>
                <div className="text-gray-500 text-[10px] mt-0.5">{t('تعديل موافقتك على الإعلانات المخصّصة')}</div>
              </div>
              <span className="text-gray-500 text-lg leading-none">&#8249;</span>
            </div>
          )}

          <button className="w-full mt-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-3.5 rounded-2xl border border-red-500/20 active:scale-95 transition-all mb-4 text-sm">
            {t('🗑️ تسجيل الخروج')}
          </button>
        </div>
      </div>
    );
  };

  // ==================== TOAST ====================
  // تُستدعى في الصفحتين: صفحة الدخول تعود مبكراً قبل الحاوية الرئيسية،
  // فلو بقي التوست فيها فقط لما ظهر أي إشعار قبل تسجيل الدخول.
  const renderToast = () => (
    notification && (
        <div className="fixed top-4 left-4 right-4 z-[60] bg-gray-800 border border-yellow-500/30 rounded-xl py-3 px-4 text-center text-white font-bold shadow-xl animate-slideDown max-w-md mx-auto">
          {notification}
        </div>
    )
  );

  // ==================== LANGUAGE PICKER ====================
  const renderLangPicker = () => (
    <div className="fixed inset-0 bg-black/90 z-[95] flex items-center justify-center p-6 animate-fadeIn"
         onClick={() => setShowLangPicker(false)}>
      <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-xs border border-slate-700/60 shadow-2xl animate-scaleIn"
           onClick={(e: any) => e.stopPropagation()}>
        <div className="text-center text-white font-black mb-4 text-sm tracking-wide">
          🌐 {t('اختر اللغة')}
        </div>
        <div className="space-y-2">
          {LANGS.map(l => (
            <div
              key={l.code}
              onClick={() => { switchLang(l.code as Lang); setShowLangPicker(false); }}
              className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all active:scale-95 border ${
                lang === l.code
                  ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                  : 'bg-gray-800/60 border-gray-700/40 text-gray-200 hover:bg-gray-700/60'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="text-xl">{l.flag}</span>
                <span className="font-bold text-sm">{l.native}</span>
              </span>
              {lang === l.code && <span className="text-amber-400">✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ---- MATCH ANALYSIS ----
  // يُشغَّل بطلب اللاعب فقط، ويُقطَّع حركةً حركةً عبر setTimeout:
  // المحرّك عند مستوى التحليل يستغرق ~300مل للحركة، ولو حلّلنا عشرين
  // حركة في نَفَسٍ واحد لتجمّدت الشاشة ستّ ثوانٍ. التقطيع يُبقي الواجهة
  // حيّة ويُظهر شريط تقدّم — ثمنه بعض التأخير، ومكسبه تطبيق لا يتجمّد.
  const AN_LEVEL = 6;
  const AN_MAX_MOVES = 30;

  const runAnalysis = useCallback(() => {
    const mine = logRef.current.items.filter(it => it.byWhite);
    const slice = mine.slice(-AN_MAX_MOVES);
    if (slice.length === 0) { showNotif(t('لا حركات لتحليلها')); return; }

    anCancel.current = false;
    setAnalysis(null);
    setAnPick(null);
    setAnProgress(1);
    const out: Verdict[] = [];
    const all = logRef.current.items;

    const step = async (k: number) => {
      if (anCancel.current) { setAnProgress(0); return; }
      if (k >= slice.length) {
        setAnalysis(out);
        setAnProgress(0);
        return;
      }
      const it = slice[k];

      // ما خسره اللاعب فعلاً: مأكولات الخصم في ردّه المباشر على هذه الحركة
      const myIdx = all.indexOf(it);
      const reply = myIdx >= 0 && myIdx + 1 < all.length && !all[myIdx + 1].byWhite
        ? all[myIdx + 1] : null;
      const lost = reply ? reply.captures.length : 0;
      const gained = it.captures.length;

      // رأي المحرّك في الموضع نفسه — في الخيط المنفصل، فشريط التقدّم يتحرّك
      const best = await requestMove(it.before, true, AN_LEVEL);
      if (anCancel.current) { setAnProgress(0); return; }
      let drop = 0;
      if (best) {
        const played = getAllValidMoves(it.before, true)
          .find(m => m.from === it.from && m.to === it.to);
        if (played) {
          const afterBest   = executeMove(it.before, best,   true);
          const afterPlayed = executeMove(it.before, played, true);
          // تقييم بوجهة نظر الأبيض: كم خسرنا باختيارنا بدل الأفضل؟
          drop = Math.max(0, evalWhitePOV(afterBest) - evalWhitePOV(afterPlayed));
        }
      }

      const sameAsBest = !!best && best.from === it.from && best.to === it.to;
      const grade: Verdict['grade'] =
        sameAsBest           ? 'best'
        : lost >= 2 || drop >= 300 ? 'blunder'
        : lost >= 1 || drop >= 130 ? 'mistake'
        : drop >= 55         ? 'inaccuracy'
        : 'good';

      out.push({
        ply: k + 1, from: it.from, to: it.to, lost, gained, drop,
        best: best ? { from: best.from, to: best.to } : null,
        grade, board: it.before,
      });
      setAnProgress(Math.round(((k + 1) / slice.length) * 100));
      setTimeout(() => void step(k + 1), 0);
    };
    setTimeout(() => void step(0), 0);
  }, [showNotif]);

  /** اسم المربع كما يراه اللاعب على الرقعة: صف وعمود، لا ترقيم اصطلاحي
   *  يحتاج تعلّماً. اللاعب العادي لا يعرف ترقيم 1-32. */
  const sqName = (i: number) => `${getRow(i) + 1}·${getCol(i) + 1}`;

  const GRADE_UI: Record<Verdict['grade'], { icon: string; cls: string; label: string }> = {
    best:       { icon: '★', cls: 'text-emerald-300 bg-emerald-900/30 border-emerald-500/30', label: 'أفضل حركة' },
    good:       { icon: '✓', cls: 'text-teal-300 bg-teal-900/25 border-teal-500/25',          label: 'جيدة' },
    inaccuracy: { icon: '?', cls: 'text-amber-300 bg-amber-900/25 border-amber-500/30',       label: 'عدم دقة' },
    mistake:    { icon: '✗', cls: 'text-orange-300 bg-orange-900/30 border-orange-500/30',    label: 'خطأ' },
    blunder:    { icon: '✘', cls: 'text-red-300 bg-red-900/30 border-red-500/40',             label: 'خطأ جسيم' },
  };

  /** رقعة مصغّرة تُظهر ما لُعب (أحمر) وما كان الأفضل (أخضر). */
  const renderMiniBoard = (v: Verdict) => (
    <div dir="rtl" className={`grid grid-cols-8 aspect-square w-full max-w-[260px] mx-auto rounded-md overflow-hidden border ${boardSkin.frame}`}>
      {v.board.map((piece, i) => {
        const isDark = (getRow(i) + getCol(i)) % 2 === 1;
        const onPlayed = i === v.from || i === v.to;
        const onBest = !!v.best && (i === v.best.from || i === v.best.to);
        return (
          <div key={i} className={`aspect-square flex items-center justify-center relative ${isDark ? boardSkin.dark : boardSkin.light}`}>
            {piece && renderPiece(piece, 'text-sm')}
            {onBest && <div className="absolute inset-0 ring-2 ring-inset ring-emerald-400 rounded-sm" />}
            {onPlayed && <div className="absolute inset-0 ring-2 ring-inset ring-red-500 rounded-sm" />}
          </div>
        );
      })}
    </div>
  );

  const renderAnalysis = () => {
    const v = anPick !== null && analysis ? analysis[anPick] : null;
    const worst = analysis
      ? analysis.filter(x => x.grade === 'blunder' || x.grade === 'mistake').length
      : 0;
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 bg-black/40 shrink-0">
          <div onClick={() => { anCancel.current = true; setScreen('home'); }}
            className="text-gray-300 text-xl cursor-pointer w-8 active:scale-90 transition-transform">✕</div>
          <div className="text-white font-black">{t('🔍 تحليل المباراة')}</div>
          <div className="w-8" />
        </div>

        {anProgress > 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-3">
            <div className="text-white font-bold text-sm">{t('يُحلّل حركاتك…')}</div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all"
                style={{ width: `${anProgress}%` }} />
            </div>
            <div className="text-gray-400 text-xs">{fmtNum(anProgress)}%</div>
          </div>
        ) : !analysis ? (
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="text-gray-400 text-sm text-center">{t('لا تحليل بعد')}</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="bg-black/30 border border-white/5 rounded-2xl p-3 mb-3 text-center">
              <div className="text-white font-bold text-sm">
                {worst === 0
                  ? t('✨ مباراة نظيفة — بلا خطأ واحد')
                  : tf('وجدتُ {0} حركة كلّفتك', fmtNum(worst))}
              </div>
              <div className="text-gray-500 text-[10px] mt-1">{t('اضغط أي حركة لترى الموضع والبديل الأفضل')}</div>
            </div>

            {v && (
              <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-3 mb-3">
                {renderMiniBoard(v)}
                <div className="flex items-center justify-center gap-4 mt-2 text-[10px]">
                  <span className="text-red-400">{t('▬ ما لعبتَه')}</span>
                  <span className="text-emerald-400">{t('▬ الأفضل')}</span>
                </div>
              </div>
            )}

            {analysis.map((x, k) => {
              const ui = GRADE_UI[x.grade];
              return (
                <div key={k} onClick={() => setAnPick(anPick === k ? null : k)}
                  className={`flex items-center gap-2.5 p-2.5 mb-1.5 rounded-xl border cursor-pointer active:scale-[0.99] transition-transform ${
                    anPick === k ? 'bg-slate-800 border-amber-500/40' : 'bg-black/25 border-white/5'
                  }`}>
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-black shrink-0 ${ui.cls}`}>
                    {ui.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-bold">
                      {tf('حركتك {0}: {1} → {2}', fmtNum(x.ply), sqName(x.from), sqName(x.to))}
                    </div>
                    <div className="text-gray-400 text-[10px] truncate">
                      {t(ui.label)}
                      {x.lost > 0 && ' · ' + tf('كلّفتك {0} قطعة', fmtNum(x.lost))}
                      {x.gained > 0 && ' · ' + tf('أكلتَ {0}', fmtNum(x.gained))}
                      {x.grade !== 'best' && x.best && ' · ' + tf('الأفضل: {0} → {1}', sqName(x.best.from), sqName(x.best.to))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ---- DAILY PUZZLE ----
  const pzLegal = useMemo(
    () => (pzState === 'play' && !pzBusy ? getAllValidMoves(pzBoard, true) : []),
    [pzBoard, pzState, pzBusy]
  );
  const pzDests = useMemo(
    () => (pzSel === null ? [] : pzLegal.filter(m => m.from === pzSel).map(m => m.to)),
    [pzLegal, pzSel]
  );

  const pzClick = (i: number) => {
    if (pzState !== 'play' || pzBusy) return;
    const piece = pzBoard[i];

    // اختيار قطعة
    if (pzSel === null || (piece && isWhite(piece) && !pzDests.includes(i))) {
      if (piece && isWhite(piece) && pzLegal.some(m => m.from === i)) setPzSel(i);
      else if (piece && isWhite(piece)) showNotif(t('هذه القطعة لا تستطيع الحركة الآن'));
      return;
    }
    if (!pzDests.includes(i)) { setPzSel(null); return; }

    const mv = pzLegal.find(m => m.from === pzSel && m.to === i)!;
    const after = executeMove(pzBoard, mv, true);
    setPzSel(null);

    // فوز: لم يبقَ للأسود حركة
    if (getAllValidMoves(after, false).length === 0) {
      setPzBoard(after);
      setPzState('won');
      const already = solvedToday(pzRecord, todayKey());
      if (!already) {
        const prize = pzClean ? todayPuzzle.reward : Math.floor(todayPuzzle.reward / 2);
        setCoins(c => c + prize);
        const next = recordSolve(pzRecord);
        setPzRecord(next);
        savePuzzleRecord(next);
        showNotif(tf('🎉 حُلّ اللغز! +{0} عملة', fmtNum(prize)));
      } else {
        showNotif(t('🎉 أحسنت! (مكافأة اليوم مُستلمة سلفاً)'));
      }
      return;
    }

    // هل أهدرت الحركة الفوز؟ نسمح بها ونُعلم اللاعب، ثم يُعيد.
    const stillWinning = puzzleHoldsWin(after, pzLeft - 1);
    if (!stillWinning) {
      setPzBoard(after);
      setPzState('lost');
      setPzClean(false);
      return;
    }

    // دفاع الأسود — يحسب أعند رد، ولذا نعطي الواجهة لحظةً تتنفّس فيها
    setPzBoard(after);
    setPzBusy(true);
    setTimeout(() => {
      const def = puzzleBestDefence(after, pzLeft - 1);
      if (!def) { setPzState('won'); setPzBusy(false); return; }
      setPzBoard(executeMove(after, def, false));
      setPzLeft(n => n - 1);
      setPzBusy(false);
    }, 420);
  };

  const renderPuzzle = () => {
    const done = solvedToday(pzRecord, todayKey());
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 bg-black/40 shrink-0">
          <div onClick={() => setScreen('home')} className="text-gray-300 text-xl cursor-pointer w-8 active:scale-90 transition-transform">✕</div>
          <div className="text-center">
            <div className="text-white font-black">{t('🧩 لغز اليوم')}</div>
            <div className="text-gray-400 text-[10px]">{todayKey()}</div>
          </div>
          <div className="text-center shrink-0 w-12">
            <div className="text-amber-400 font-black text-sm">{fmtNum(pzRecord.streak)}</div>
            <div className="text-gray-500 text-[9px]">{t('متتابع')}</div>
          </div>
        </div>

        {/* الهدف */}
        <div className={`mx-3 mt-2 p-2.5 rounded-xl border text-center ${
          pzState === 'won' ? 'bg-green-900/30 border-green-500/40'
          : pzState === 'lost' ? 'bg-red-900/30 border-red-500/40'
          : 'bg-amber-900/20 border-amber-500/30'}`}>
          <div className="text-white font-bold text-sm">
            {pzState === 'won' ? t('✅ أحسنت — فوز قسري!')
              : pzState === 'lost' ? t('✗ هذه الحركة أفلتت الفوز')
              : tf('الأبيض يفوز في {0} حركة', fmtNum(pzLeft))}
          </div>
          {pzState === 'play' && (
            <div className="text-gray-400 text-[10px] mt-0.5">
              {pzBusy ? t('الأسود يدافع…') : t('الأسود يدافع بأعند ما لديه')}
            </div>
          )}
        </div>

        {/* الرقعة */}
        <div className="flex-1 flex items-center justify-center px-2 py-2">
          <div dir="rtl"
            className={`aspect-square w-full max-w-[360px] grid grid-cols-8 rounded-lg overflow-hidden shadow-2xl border-2 ${boardSkin.frame}`}>
            {pzBoard.map((piece, i) => {
              const isDark = (getRow(i) + getCol(i)) % 2 === 1;
              const isSel = pzSel === i;
              const isDest = pzDests.includes(i);
              const cap = pzLegal.some(m => m.from === pzSel && m.to === i && m.captures.length > 0);
              return (
                <div key={i} onClick={() => pzClick(i)}
                  className={`aspect-square flex items-center justify-center relative transition-all
                    ${isDark
                      ? isSel ? 'bg-green-600'
                        : isDest ? (cap ? 'bg-red-700/70' : 'bg-green-800/70')
                        : boardSkin.dark
                      : boardSkin.light}
                    ${isDark && pzState === 'play' ? 'cursor-pointer' : ''}`}>
                  {piece && renderPiece(piece)}
                  {isDest && !piece && (
                    <div className={`w-3 h-3 rounded-full ${cap ? 'bg-red-400/60 ring-2 ring-red-400' : 'bg-green-400/50'}`} />
                  )}
                  {isDest && piece && <div className="absolute inset-0 ring-2 ring-red-500 rounded-sm" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* الأزرار */}
        <div className="px-3 pb-3 shrink-0">
          {pzState === 'play' ? (
            <button onClick={resetPuzzle}
              className="w-full py-3 rounded-2xl bg-slate-800 border border-slate-600 text-white text-xs font-black active:scale-95 transition-all">
              {t('⟲ ابدأ من جديد')}
            </button>
          ) : pzState === 'lost' ? (
            <button onClick={resetPuzzle}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-700 text-white text-xs font-black active:scale-95 transition-all">
              {t('⟲ حاول مرة أخرى')}
            </button>
          ) : (
            <button onClick={() => setScreen('home')}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-black active:scale-95 transition-all">
              {t('رجوع إلى الرئيسية')}
            </button>
          )}
          <div className="text-center text-gray-500 text-[10px] mt-2">
            {done
              ? tf('🔥 سلسلتك {0} يوماً · أطولها {1} · المجموع {2}', fmtNum(pzRecord.streak), fmtNum(pzRecord.best), fmtNum(pzRecord.total))
              : tf('مكافأة اليوم: {0} عملة', fmtNum(todayPuzzle.reward))}
          </div>
        </div>
      </div>
    );
  };

  // ---- SHOP SCREEN ----
  // مصرف العملات. كل ما هنا تجميلي بحت — لا يمسّ قاعدة ولا يمنح أي ميزة.
  const renderShop = () => {
    const items: cosmetics.BoardTheme[] | cosmetics.PieceTheme[] | cosmetics.BackdropTheme[] =
      shopTab === 'board' ? cosmetics.BOARDS : shopTab === 'pieces' ? cosmetics.PIECES : cosmetics.BACKDROPS;
    const equipped = shopTab === 'board' ? cos.board : shopTab === 'pieces' ? cos.pieces : cos.backdrop;
    const { have, all } = cosmetics.ownedCount(cos);

    /** معاينة صغيرة لكل طقم — تُرسم من بيانات الطقم نفسها، بلا أي صورة. */
    const preview = (it: cosmetics.BoardTheme | cosmetics.PieceTheme | cosmetics.BackdropTheme) => {
      if (shopTab === 'board') {
        const b = it as cosmetics.BoardTheme;
        return (
          <div className={`w-14 h-14 rounded-lg overflow-hidden grid grid-cols-4 border ${b.frame} shrink-0`}>
            {Array.from({ length: 16 }, (_, k) => (
              <div key={k} className={(Math.floor(k / 4) + k % 4) % 2 === 1 ? b.dark : b.light} />
            ))}
          </div>
        );
      }
      if (shopTab === 'pieces') {
        const p = it as cosmetics.PieceTheme;
        return (
          <div className="w-14 h-14 rounded-lg bg-amber-900 flex items-center justify-center gap-1 shrink-0 border border-amber-950">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${p.white}`}>
              <span className="text-[8px]">{p.glyphW}</span>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ring-1 ${p.black} ${p.kingRing}`}>
              <span className="text-[8px]">{p.glyphK}</span>
            </div>
          </div>
        );
      }
      const d = it as cosmetics.BackdropTheme;
      return (
        <div className={`w-14 h-14 rounded-lg shrink-0 border border-white/10 ${d.shell}`}
          style={cosmetics.backdropStyle(d)} />
      );
    };

    return (
      <div className="flex flex-col h-full">
        {/* رأس الشاشة */}
        <div className="flex items-center justify-between p-3 bg-black/40 shrink-0">
          <div onClick={() => setScreen('home')} className="text-gray-300 text-xl cursor-pointer w-8 active:scale-90 transition-transform">✕</div>
          <div className="text-center">
            <div className="text-white font-black">{t('🛍️ المتجر')}</div>
            <div className="text-gray-400 text-[10px]">{tf('{0} من {1} طقماً', fmtNum(have), fmtNum(all))}</div>
          </div>
          <div className="bg-yellow-600/30 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
            <span className="text-yellow-400 font-bold text-xs">{fmtNum(Math.max(0, coins))}</span>
            <span className="text-xs">💰</span>
          </div>
        </div>

        {/* تبويبات الفئات */}
        <div className="flex gap-1.5 px-3 py-2 shrink-0">
          {([
            { id: 'board'    as cosmetics.CosCat, icon: '🏁', label: t('الرقع') },
            { id: 'pieces'   as cosmetics.CosCat, icon: '⚪', label: t('القطع') },
            { id: 'backdrop' as cosmetics.CosCat, icon: '🖼️', label: t('الخلفيات') },
          ]).map(tb => (
            <div key={tb.id} onClick={() => setShopTab(tb.id)}
              className={`flex-1 text-center py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                shopTab === tb.id
                  ? 'bg-amber-600/25 border-amber-500/50 text-amber-200'
                  : 'bg-black/30 border-white/5 text-gray-400'
              }`}>
              <span className="me-1">{tb.icon}</span>{tb.label}
            </div>
          ))}
        </div>

        {/* الأطقم */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {items.map(it => {
            const mine = cosmetics.owns(cos, shopTab, it.id);
            const on   = equipped === it.id;
            const canAfford = coins >= it.price;
            return (
              <div key={it.id}
                className={`flex items-center gap-3 p-2.5 mb-2 rounded-2xl border ${
                  on ? 'bg-amber-900/25 border-amber-500/40' : 'bg-black/30 border-white/5'
                }`}>
                {preview(it)}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm truncate">{t(it.name)}</div>
                  <div className="text-gray-400 text-[10px] truncate">{t(it.culture)}</div>
                  {!mine && (
                    <div className={`text-[11px] font-bold mt-0.5 ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
                      {fmtNum(it.price)} 💰
                    </div>
                  )}
                </div>

                {on ? (
                  <span className="text-amber-300 text-[11px] font-black px-3 py-2 shrink-0">{t('مُجهَّز ✓')}</span>
                ) : mine ? (
                  <button
                    onClick={() => {
                      setCos(c => ({ ...c, [shopTab]: it.id }));
                      showNotif(tf('✨ جُهِّز: {0}', t(it.name)));
                    }}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-black px-3 py-2 rounded-xl shrink-0 active:scale-95 transition-all">
                    {t('تجهيز')}
                  </button>
                ) : (
                  <button
                    disabled={!canAfford}
                    onClick={() => {
                      // الحسم والملكية والتجهيز في تحديث واحد: لا نافذة يمكن
                      // أن يُضغط فيها الزر مرّتين فيُحسم الثمن مرّتين.
                      if (coins < it.price) { showNotif(t('رصيدك غير كافٍ! ❌')); return; }
                      setCoins(c => Math.max(0, c - it.price));
                      setCos(c => c.owned.includes(cosmetics.key(shopTab, it.id)) ? c : {
                        ...c,
                        owned: [...c.owned, cosmetics.key(shopTab, it.id)],
                        [shopTab]: it.id,
                      });
                      showNotif(tf('🎉 اشتريت: {0}', t(it.name)));
                    }}
                    className={`text-[11px] font-black px-3 py-2 rounded-xl shrink-0 transition-all ${
                      canAfford
                        ? 'bg-gradient-to-r from-yellow-600 to-amber-700 text-white active:scale-95'
                        : 'bg-gray-800 text-gray-500'
                    }`}>
                    {t('شراء')}
                  </button>
                )}
              </div>
            );
          })}

          {/* إعلان بمكافأة — الطريق المجاني إلى الأطقم */}
          {ads.rewardedAvailable() && (
            <button
              onClick={async () => {
                if (Date.now() - shopAdAt < 60_000) { showNotif(t('⏳ انتظر دقيقة قبل الإعلان التالي')); return; }
                setShopAdAt(Date.now());
                const earned = await ads.showRewarded();
                if (earned) { setCoins(c => c + 250); showNotif(t('🎁 +250 عملة')); }
                else showNotif(t('لم يكتمل الإعلان'));
              }}
              className="w-full mt-1 mb-2 py-3 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 text-white text-xs font-black active:scale-95 transition-all border border-emerald-500/30">
              {t('📺 شاهد إعلاناً واكسب 250 عملة')}
            </button>
          )}

          <div className="text-center text-gray-500 text-[10px] leading-relaxed px-4 pb-2">
            {t('كل ما في المتجر تجميلي فقط — لا يغيّر قواعد اللعب ولا يمنح أي ميزة على الخصم.')}
          </div>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  if (!isLoggedIn) return renderLogin();

  return (
    <div
      className={`h-screen w-screen max-w-md mx-auto flex flex-col ${backdropSkin.shell} text-white overflow-hidden relative`}
      dir={dir}
      // مساحة محجوزة للبانر: تدفع شريط التنقّل والأزرار للأعلى بدل أن يغطّيها
      style={{ ...backdropCss, ...(bannerH > 0 ? { paddingBottom: `${bannerH}px` } : {}) }}
    >
      {renderToast()}

      {/* Screen Content */}
      <div className="flex-1 overflow-hidden">
        {screen === 'home' && renderHome()}
        {screen === 'game' && renderGame()}
        {screen === 'friends' && renderFriends()}
        {screen === 'leaderboard' && renderLeaderboard()}
        {screen === 'live' && renderLive()}
        {screen === 'profile' && renderProfile()}
        {screen === 'training' && renderTraining()}
        {screen === 'shop' && renderShop()}
        {screen === 'puzzle' && renderPuzzle()}
        {screen === 'analysis' && renderAnalysis()}
      </div>

      {/* Bottom Navigation */}
      {screen !== 'game' && (
        <div className="flex items-center justify-around bg-black/90 border-t border-gray-800 py-2 px-1">
          {[
            { id: 'home' as Screen, icon: '🏠', label: t('الرئيسية') },
            { id: 'friends' as Screen, icon: '👥', label: t('الأصدقاء') },
            { id: 'live' as Screen, icon: '👁️', label: t('مباشر') },
            { id: 'leaderboard' as Screen, icon: '🏆', label: t('المتصدرين') },
            { id: 'profile' as Screen, icon: '👤', label: t('حسابي') },
          ].map(tab => (
            <div key={tab.id} onClick={() => setScreen(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all ${
                screen === tab.id ? 'text-orange-400 bg-orange-900/20' : 'text-gray-500'
              }`}>
              <span className="text-lg">{tab.icon}</span>
              <span className="text-xs">{tab.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {renderBetModal()}
      {renderActionModal()}
      {renderPlayerModal()}

      {/* ── Standalone Modals (independent of bet modal state) ── */}
      {/* Friend Play Modal - نافذة اللعب مع صديق */}
      {showFriendPlayModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 w-full max-w-md border-t border-slate-700 sm:border animate-slideUp max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center mb-5">
              <div className="w-1 h-12 bg-transparent" />
              <h3 className="text-xl font-black text-white mb-1 tracking-tighter">{t('👥 لعب مع صديق')}</h3>
              <p className="text-slate-400 text-xs">{t('شارك الرمز أو ادعُ صديقاً من القائمة')}</p>
            </div>

            {/* Room Code Card */}
            <div className="bg-slate-800 rounded-2xl p-4 mb-4 border border-amber-500/20 relative overflow-hidden">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 text-center">🔑 رمز الغرفة الخاص بك{netStatus !== 'online' && <span className="text-red-400 text-[9px] me-1">{t('(غير متصل - يعمل محلياً فقط)')}</span>}</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-black text-amber-400 tracking-[0.3em] font-mono">{roomCode}</span>
                <button onClick={() => {
                  navigator.clipboard.writeText(roomCode)
                    .then(() => showNotif(t('✅ تم نسخ الرمز!')))
                    .catch(() => showNotif(t('الرمز: ') + roomCode));
                }} className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 active:scale-90 transition-all border border-amber-500/20">
                  📋
                </button>
              </div>
              <p className="text-slate-500 text-[10px] text-center mt-2">{t('أرسل هذا الرمز لصديقك ليدخل الغرفة')}</p>
            </div>

            {/* Friends List Section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-[1px] flex-1 bg-slate-700" />
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{t('دعوة صديق من القائمة')}</span>
                <div className="h-[1px] flex-1 bg-slate-700" />
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto">
                {friendsAccepted.length === 0 ? (
                  <p className="text-slate-600 text-center text-xs py-4 italic">{t('قائمة أصدقائك فارغة حالياً')}</p>
                ) : (
                  friendsAccepted.map(f => (
                    <div key={f.id} className="bg-slate-800/60 rounded-xl p-3 flex items-center justify-between border border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center text-xl">{f.avatar}</div>
                          {f.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800" />}
                        </div>
                        <div className="text-start">
                          <p className="text-white font-bold text-xs">{f.name}</p>
                          <p className="text-slate-500 text-[9px]">
                            {f.isOnline ? (f.isPlaying ? t('🎮 في مباراة') : t('🟢 متصل')) : t('⚫ غير متصل')}
                            {' • '}{f.elo} ELO
                          </p>
                        </div>
                      </div>
                      <button
                        disabled={!f.isOnline || f.isPlaying}
                        onClick={() => {
                          setInviteOpponent(f);
                          setShowInviteSentModal(true);
                          setShowFriendPlayModal(false);
                          if (f.isGeneral) {
                            // Fix #15: capture a flag so we don't start if user cancelled
                            const inviteId = Date.now();
                            (window as any)._lastInviteId = inviteId;
                            setTimeout(() => {
                              // Only start if this invite wasn't cancelled
                              if ((window as any)._lastInviteId !== inviteId) return;
                              setShowInviteSentModal(false);
                              startGame(pendingGameMode || 'quick', f, false, true);
                              showNotif(tf('✅ {0} قبل الدعوة!', f.name));
                            }, 5000);
                          } else {
                            // Fix #13: send real invite via Ably to the actual player
                            if (netStatus === 'online') {
                              network.sendFriendInvite(f.id, roomCode, {
                                userId: network.myUserId,
                                displayName: myName,
                                avatar: myAvatar,
                                elo: myElo,
                                country: myCountry
                              });
                            }
                          }
                        }}
                        className={`text-[9px] font-black px-3 py-2 rounded-xl transition-all active:scale-95 uppercase tracking-wide ${
                          !f.isOnline || f.isPlaying
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30'
                        }`}>
                        {f.isPlaying ? t('في مباراة') : !f.isOnline ? t('غير متصل') : t('دعوة ⚔️')}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button onClick={() => { setShowFriendPlayModal(false); setInviteOpponent(null); }}
              className="w-full bg-slate-800/50 text-slate-400 font-black py-3 rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all border border-slate-700/50">
              {t('إلغاء')}
            </button>
          </div>
        </div>
      )}

      {/* Invite Sent Modal (Overlay) */}
      {showInviteSentModal && inviteOpponent && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-6 animate-fadeIn">
          <div className="text-center max-w-sm w-full">
            <div className="w-28 h-28 mx-auto relative mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
              <div className="w-full h-full bg-slate-800 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-2xl border border-white/5 transform rotate-3">
                {inviteOpponent.avatar}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-green-500 w-7 h-7 rounded-full border-4 border-slate-900 animate-pulse" />
            </div>
            <h3 className="text-xl font-black text-white mb-2 tracking-tighter">
              {inviteOpponent.isGeneral ? t('⏳ في انتظار الرد...') : t('📨 تم إرسال الدعوة!')}
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {inviteOpponent.isGeneral
                ? <>{t('دعوة أُرسلت لـ')}<span className="text-amber-400 font-bold">{inviteOpponent.name}</span>.<br />{t('سيرد خلال لحظات...')}</>
                : <>{t('في انتظار موافقة')}<span className="text-amber-400 font-bold">{inviteOpponent.name}</span>{t('على التحدي.')}</>}
            </p>

            {inviteOpponent.isGeneral ? (
              // AI auto-accept indicator
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4">
                <div className="flex justify-center gap-3 mb-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                <p className="text-amber-400 text-xs font-bold">{t('سيوافق تلقائياً خلال 5 ثوانٍ ⏳')}</p>
              </div>
            ) : (
              // Real player: show simulated accept/reject buttons (for demo, after 8s random accept)
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 mb-4">
                <p className="text-slate-400 text-xs mb-3">{t('في انتظار رد اللاعب...')}</p>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => {
              // Fix #15: invalidate any pending AI accept timeout
              (window as any)._lastInviteId = null;
              setShowInviteSentModal(false);
              setInviteOpponent(null);
            }} className="w-full mt-2 bg-red-600/20 text-red-400 font-black py-3 rounded-2xl text-xs uppercase tracking-widest border border-red-600/30 active:scale-95 transition-all">
              {t('إلغاء الدعوة ✕')}
            </button>
          </div>
        </div>
      )}

      {/* Room Code Input Modal */}
      {showRoomCodeInput && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-sm border border-slate-700/50 shadow-2xl animate-scaleIn">
            <div className="text-center mb-8">
              <div className="w-24 h-24 mx-auto bg-slate-800 rounded-[2rem] flex items-center justify-center text-5xl mb-4 border border-amber-500/20 shadow-lg">
                🔑
              </div>
              <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">{t('أدخل رمز الغرفة')}</h3>
              <p className="text-slate-500 text-sm">{t('أدخل الرمز الذي أرسله لك صديقك')}</p>
            </div>

            <div className="space-y-6">
              <div className="relative">
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))}
                  placeholder="XXXXXX"
                  maxLength={6}
                  className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-2xl py-5 px-6 text-white text-center text-3xl font-black font-mono tracking-[0.3em] focus:border-amber-500/50 outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRoomCodeInput(false);
                    setRoomCodeInput('');
                  }}
                  className="flex-1 bg-slate-800/50 text-slate-400 font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] active:scale-95 transition-all border border-slate-700/50"
                >
                  {t('إلغاء')}
                </button>
                <button
                  onClick={() => {
                    if (roomCodeInput.length === 6) {
                      setShowRoomCodeInput(false);
                      setRoomCodeInput('');
                      setShowBetModal(false);
                      if (netStatus === 'online') {
                        // Fix #16 & #22: real network join via Ably
                        network.joinByRoomCode(roomCodeInput, {
                          displayName: myName, avatar: myAvatar, elo: myElo, country: myCountry,
                          betAmount, gameMode: pendingGameMode || 'quick'
                        }, handleNetworkEvent).catch(() => {
                          // Fallback: AI placeholder if network fails
                          const roomPlayer = players.length > 0
                          ? { ...players[0], id: 'room_' + roomCodeInput, name: t('لاعب_') + roomCodeInput, avatar: '👤' }
                          : { id: 'room_' + roomCodeInput, name: t('لاعب_') + roomCodeInput, avatar: '👤', elo: 1200, level: 5, wins: 0, losses: 0, draws: 0, winRate: 50, isOnline: true, isPlaying: false, isGeneral: true, country: '🌍', coins: 5000, friendStatus: 'accepted' as const, lastSeen: t('الآن') };
                          startGame(pendingGameMode || 'quick', roomPlayer, false, true);
                        });
                        // Show waiting state — match_found event will call startGame
                        showNotif(t('🔑 جاري الانضمام للغرفة...'));
                      } else {
                        // Offline: AI placeholder
                        const roomPlayer = players.length > 0
                          ? { ...players[0], id: 'room_' + roomCodeInput, name: t('لاعب_') + roomCodeInput, avatar: '👤' }
                          : { id: 'room_' + roomCodeInput, name: t('لاعب_') + roomCodeInput, avatar: '👤', elo: 1200, level: 5, wins: 0, losses: 0, draws: 0, winRate: 50, isOnline: true, isPlaying: false, isGeneral: true, country: '🌍', coins: 5000, friendStatus: 'accepted' as const, lastSeen: t('الآن') };
                        startGame(pendingGameMode || 'quick', roomPlayer, false, true);
                      }
                    } else {
                      showNotif(t('❌ الرمز يجب أن يكون 6 أحرف'));
                    }
                  }}
                  disabled={roomCodeInput.length !== 6}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl text-xs uppercase tracking-[0.2em] active:scale-95 transition-all shadow-lg shadow-amber-900/20"
                >
                  {t('دخول الغرفة')}
                </button>
              </div>
            </div>

            <p className="text-center text-slate-600 text-[10px] mt-6 font-bold tracking-widest uppercase">
              {t('رمز الغرفة يتكون من 6 أحرف')}
            </p>
          </div>
        </div>
      )}

      {/* Matchmaking Search Modal */}
      {showMatchmakingModal && (
        <div className="fixed inset-0 bg-black/95 z-[80] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-sm border border-slate-700/50 shadow-2xl text-center animate-scaleIn">
            {/* Circular Timer */}
            <div className="relative w-36 h-36 mx-auto mb-6">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="6" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f59e0b" strokeWidth="6"
                  strokeDasharray={`${(matchmakingTimer / 20) * 314} 314`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-black text-amber-400">{matchmakingTimer}</div>
                <div className="text-slate-500 text-xs font-bold">{t('ثانية')}</div>
              </div>
            </div>

            <div className="text-3xl mb-2">🌍</div>
            <h3 className="text-lg font-black text-white mb-1 tracking-tighter">{t('البحث عن منافس')}</h3>
            <p className="text-slate-400 text-xs mb-5 leading-relaxed px-2">
              {matchmakingTimer > 14 ? t('جاري البحث عن لاعبين حول العالم...') :
               matchmakingTimer > 7 ? t('توسيع نطاق البحث الجغرافي...') :
               t('جاري الاتصال بأقرب منافس متاح...')}
            </p>

            {betAmount > 0 && (
              <div className="bg-amber-500/10 rounded-xl p-2 mb-4 border border-amber-500/20">
                <span className="text-amber-400 text-xs font-bold">💰 الرهان: {fmtNum(betAmount)}</span>
              </div>
            )}

            <div className="flex justify-center gap-2 mb-6">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>

            <button onClick={() => {
              // Fix #12: stop local interval AND cancel Ably matchmaking
              if (matchmakingRef.current) { clearInterval(matchmakingRef.current); matchmakingRef.current = null; }
              network.cancelMatchmaking();
              setShowMatchmakingModal(false);
              setMatchmakingTimer(20); // Fix 10: reset timer for next search
            }} className="w-full bg-red-600/20 text-red-400 font-black py-3 rounded-2xl text-xs uppercase tracking-widest border border-red-600/30 active:scale-95 transition-all">
              {t('إلغاء البحث ✕')}
            </button>
          </div>
        </div>
      )}


      {/* Incoming Game Invite Popup (Fix G) */}
      {incomingInvite && (
        <div className="fixed inset-0 bg-black/85 z-[150] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-slate-900 rounded-[2rem] p-7 w-full max-w-xs border border-green-500/30 shadow-2xl text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 border border-slate-700">
              {incomingInvite.from.avatar ?? '👤'}
            </div>
            <h3 className="text-white font-black text-base mb-1">{t('📨 دعوة لعب')}</h3>
            <p className="text-slate-400 text-xs mb-1">
              {tf('{0} يدعوك للعب!', incomingInvite.from.displayName)}
            </p>
            <p className="text-amber-400 text-xs font-mono mb-5">رمز الغرفة: {incomingInvite.code}</p>
            <div className="grid grid-cols-2 gap-2">
              <div onClick={() => setIncomingInvite(null)}
                className="bg-red-600/70 rounded-xl py-3 text-white font-bold text-sm cursor-pointer active:scale-95 transition-all">
                {t('رفض ❌')}
              </div>
              <div onClick={() => {
                const inv = incomingInvite;
                setIncomingInvite(null);
                setPendingGameMode('quick');
                setBetAmount(0);
                // Join via room code — the host is waiting
                network.joinByRoomCode(inv.code, {
                  displayName: myName, avatar: myAvatar, elo: myElo, country: myCountry,
                  betAmount: 0, gameMode: 'quick'
                }, handleNetworkEvent).catch(() => showNotif(t('فشل الانضمام للغرفة')));
                showNotif(t('جاري الانضمام...'));
              }} className="bg-green-600/80 rounded-xl py-3 text-white font-bold text-sm cursor-pointer active:scale-95 transition-all">
                {t('قبول ✅')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Reward Modal */}
      {showLangPicker && renderLangPicker()}

      {showDailyReward && !dailyRewardClaimed && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-slate-800 to-gray-900 rounded-3xl p-6 w-full max-w-sm border border-yellow-500/30 text-center shadow-[0_0_50px_rgba(251,191,36,0.15)] animate-scaleIn relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="text-6xl mb-4 animate-bounce">🎁</div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 mb-2 drop-shadow-md">
                {t('مكافأة يومية')}
              </h2>
              <p className="text-gray-300 mb-6 text-sm">
                {t('لقد حصلت على مكافأتك اليومية لتسجيل الدخول! عد غداً لمزيد من الجوائز.')}
              </p>
              
              <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl p-4 mb-6 border border-yellow-500/30 shadow-inner">
                <div className="text-5xl font-black text-yellow-400 drop-shadow-lg mb-1">+500</div>
                <div className="text-yellow-200 text-xs font-bold tracking-widest uppercase">{t('عملة مجانية')}</div>
              </div>
              
              <button 
                onClick={() => {
                  setCoins(c => c + 500);
                  setDailyRewardClaimed(true);
                  setShowDailyReward(false);
                  localStorage.setItem('damaDailyReward', Date.now().toString());
                  showNotif(t('تمت إضافة 500 💰 إلى رصيدك!'));
                }}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white font-bold py-3.5 rounded-2xl active:scale-95 transition-all shadow-[0_0_20px_rgba(251,191,36,0.3)] text-lg"
              >
                {t('استلام المكافأة 💎')}
              </button>

              {/* اختياري تماماً: المكافأة تُمنح فقط عند اكتمال الإعلان */}
              {ads.rewardedAvailable() && (
                <button
                  onClick={async () => {
                    showNotif(t('جاري تحميل الفيديو...'));
                    const earned = await ads.showRewarded();
                    if (earned) {
                      setCoins(c => c + 1500);
                      setDailyRewardClaimed(true);
                      setShowDailyReward(false);
                      localStorage.setItem('damaDailyReward', Date.now().toString());
                      showNotif(t('تمت إضافة 1500 💰 إلى رصيدك!'));
                    } else {
                      showNotif(t('لم يكتمل الفيديو — لم تُمنح المكافأة'));
                    }
                  }}
                  className="w-full mt-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold py-3 rounded-2xl border border-emerald-500/30 active:scale-95 transition-all text-sm"
                >
                  {t('🎬 شاهد فيديو واحصل على 1500 بدلاً من 500')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
