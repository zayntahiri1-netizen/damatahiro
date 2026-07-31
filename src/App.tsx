import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { network, supabase, setAnalyticsEnabled, type NetworkEvent } from './network';
import * as ads from './ads';
import { useLang, LANGS, t, tf, fmtNum, type Lang } from './i18n';

// ==================== TYPES ====================
type PieceType = 'white' | 'black' | 'whiteKing' | 'blackKing' | null;
type BoardType = PieceType[];
type Screen = 'home' | 'game' | 'friends' | 'leaderboard' | 'live' | 'profile' | 'training';
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

interface Move {
  from: number;
  to: number;
  captures: number[];
  isKingPromotion: boolean;
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

// ==================== SPANISH CHECKERS ENGINE ====================
function createInitialBoard(): BoardType {
  const board: BoardType = new Array(64).fill(null);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row * 8 + col] = 'black';
      }
    }
  }
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row * 8 + col] = 'white';
      }
    }
  }
  return board;
}

// Create a random mid-game board for watching (simulate a game already in progress)
function createRandomMidGameBoard(): { board: BoardType; turn: boolean } {
  let board = createInitialBoard();
  let turn = true;
  // Play 8-25 random moves to reach a mid-game position
  const movesToPlay = 8 + Math.floor(Math.random() * 18);
  for (let i = 0; i < movesToPlay; i++) {
    const moves = getAllValidMoves(board, turn);
    if (moves.length === 0) break;
    const move = moves[Math.floor(Math.random() * moves.length)];
    board = executeMove(board, move, turn);
    turn = !turn;
    // Make sure both sides still have pieces
    const wCount = board.filter(p => p === 'white' || p === 'whiteKing').length;
    const bCount = board.filter(p => p === 'black' || p === 'blackKing').length;
    if (wCount <= 1 || bCount <= 1) break;
  }
  return { board, turn };
}

function getRow(pos: number): number { return Math.floor(pos / 8); }
function getCol(pos: number): number { return pos % 8; }
function isValid(r: number, c: number): boolean { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function posOf(r: number, c: number): number { return r * 8 + c; }

function isWhite(p: PieceType): boolean { return p === 'white' || p === 'whiteKing'; }
function isBlack(p: PieceType): boolean { return p === 'black' || p === 'blackKing'; }
function isKing(p: PieceType): boolean { return p === 'whiteKing' || p === 'blackKing'; }
function isPlayerPiece(p: PieceType, isWhiteTurn: boolean): boolean {
  return isWhiteTurn ? isWhite(p) : isBlack(p);
}
function isOpponentPiece(p: PieceType, isWhiteTurn: boolean): boolean {
  return isWhiteTurn ? isBlack(p) : isWhite(p);
}

// Find all capture sequences for a piece (Spanish rules: must capture maximum)
function findCaptureSequences(
  board: BoardType,
  pos: number,
  piece: PieceType,
  isWhiteTurn: boolean,
  alreadyCaptured: number[] = []
): { moves: number[]; captures: number[] }[] {
  const results: { moves: number[]; captures: number[] }[] = [];
  const row = getRow(pos);
  const col = getCol(pos);
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  let foundCapture = false;

  if (isKing(piece)) {
    // King: can capture from distance (flying king)
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      // Move along diagonal until we hit something
      while (isValid(r, c) && board[posOf(r, c)] === null) {
        r += dr;
        c += dc;
      }
      // Check if we hit an opponent piece
      if (isValid(r, c)) {
        const capturedPos = posOf(r, c);
        const capturedPiece = board[capturedPos];
        if (capturedPiece && isOpponentPiece(capturedPiece, isWhiteTurn) && !alreadyCaptured.includes(capturedPos)) {
          // Check landing squares after the captured piece
          let lr = r + dr;
          let lc = c + dc;
          while (isValid(lr, lc) && board[posOf(lr, lc)] === null) {
            const landingPos = posOf(lr, lc);
            foundCapture = true;
            const newBoard = [...board];
            newBoard[pos] = null;
            newBoard[capturedPos] = null;
            newBoard[landingPos] = piece;
            const newCaptured = [...alreadyCaptured, capturedPos];

            // Try to continue capturing
            const continuations = findCaptureSequences(newBoard, landingPos, piece, isWhiteTurn, newCaptured);
            if (continuations.length > 0) {
              for (const cont of continuations) {
                results.push({
                  moves: [landingPos, ...cont.moves],
                  captures: [capturedPos, ...cont.captures]
                });
              }
            } else {
              results.push({
                moves: [landingPos],
                captures: [capturedPos]
              });
            }
            lr += dr;
            lc += dc;
          }
        }
      }
    }
  } else {
    // SPANISH RULES: Regular piece captures FORWARD ONLY (not backward!)
    const captureDirs = isWhiteTurn ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    for (const [dr, dc] of captureDirs) {
      const midR = row + dr;
      const midC = col + dc;
      const landR = row + 2 * dr;
      const landC = col + 2 * dc;

      if (!isValid(landR, landC)) continue;

      const midPos = posOf(midR, midC);
      const landPos = posOf(landR, landC);
      const midPiece = board[midPos];

      if (midPiece && isOpponentPiece(midPiece, isWhiteTurn) && !alreadyCaptured.includes(midPos) && board[landPos] === null) {
        foundCapture = true;
        const newBoard = [...board];
        newBoard[pos] = null;
        newBoard[midPos] = null;

        // SPANISH RULES: If man reaches back rank during capture, move ENDS and man promotes to king
        if ((isWhiteTurn && landR === 0) || (!isWhiteTurn && landR === 7)) {
          const promotedPiece = isWhiteTurn ? 'whiteKing' : 'blackKing';
          newBoard[landPos] = promotedPiece;
          // Move ends here - NO continuation after promotion (official Spanish rule)
          results.push({
            moves: [landPos],
            captures: [midPos]
          });
        } else {
          newBoard[landPos] = piece;
          const newCaptured = [...alreadyCaptured, midPos];
          const continuations = findCaptureSequences(newBoard, landPos, piece, isWhiteTurn, newCaptured);
          if (continuations.length > 0) {
            for (const cont of continuations) {
              results.push({
                moves: [landPos, ...cont.moves],
                captures: [midPos, ...cont.captures]
              });
            }
          } else {
            results.push({
              moves: [landPos],
              captures: [midPos]
            });
          }
        }
      }
    }
  }

  if (!foundCapture && alreadyCaptured.length === 0) {
    return [];
  }
  return results;
}

// Get all valid moves for a player (Spanish rules: mandatory capture, max captures)
function getAllValidMoves(board: BoardType, isWhiteTurn: boolean): Move[] {
  const allCaptures: Move[] = [];
  const allSimpleMoves: Move[] = [];

  for (let pos = 0; pos < 64; pos++) {
    const piece = board[pos];
    if (!piece || !isPlayerPiece(piece, isWhiteTurn)) continue;

    // Find captures
    const captures = findCaptureSequences(board, pos, piece, isWhiteTurn);
    for (const cap of captures) {
      const lastPos = cap.moves[cap.moves.length - 1];
      const isPromotion = !isKing(piece) && (
        (isWhiteTurn && getRow(lastPos) === 0) ||
        (!isWhiteTurn && getRow(lastPos) === 7)
      );
      allCaptures.push({
        from: pos,
        to: lastPos,
        captures: cap.captures,
        isKingPromotion: isPromotion
      });
    }

    // Find simple moves (only if no captures exist)
    if (isKing(piece)) {
      // King moves: multiple squares diagonally
      const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of directions) {
        let r = getRow(pos) + dr;
        let c = getCol(pos) + dc;
        while (isValid(r, c) && board[posOf(r, c)] === null) {
          allSimpleMoves.push({
            from: pos,
            to: posOf(r, c),
            captures: [],
            isKingPromotion: false
          });
          r += dr;
          c += dc;
        }
      }
    } else {
      // Regular piece: move forward diagonally only
      const forwardDir = isWhiteTurn ? -1 : 1;
      for (const dc of [-1, 1]) {
        const newR = getRow(pos) + forwardDir;
        const newC = getCol(pos) + dc;
        if (isValid(newR, newC) && board[posOf(newR, newC)] === null) {
          const isPromotion = (isWhiteTurn && newR === 0) || (!isWhiteTurn && newR === 7);
          allSimpleMoves.push({
            from: pos,
            to: posOf(newR, newC),
            captures: [],
            isKingPromotion: isPromotion
          });
        }
      }
    }
  }

  // SPANISH RULES: if captures are available, they are MANDATORY
  if (allCaptures.length > 0) {
    // SPANISH RULES: Must choose capture route with MAXIMUM VALUE
    // A captured king is worth more than a man (but less than 2 men)
    // King value = 1.5, Man value = 1.0 for comparison
    const getCaptureValue = (move: Move): number => {
      let value = 0;
      for (const capPos of move.captures) {
        const piece = board[capPos];
        if (piece && isKing(piece)) {
          value += 1.5; // King is worth more than a man
        } else {
          value += 1.0;
        }
      }
      return value;
    };

    const maxValue = Math.max(...allCaptures.map(m => getCaptureValue(m)));
    const bestCaptures = allCaptures.filter(m => getCaptureValue(m) === maxValue);

    // If still tied, among sequences with same value, 
    // prefer those that capture more kings (Spanish tournament rule)
    if (bestCaptures.length > 1) {
      const countKingsInCapture = (move: Move): number => {
        return move.captures.filter(capPos => {
          const piece = board[capPos];
          return piece && isKing(piece);
        }).length;
      };
      const maxKings = Math.max(...bestCaptures.map(m => countKingsInCapture(m)));
      const kingPriority = bestCaptures.filter(m => countKingsInCapture(m) === maxKings);
      if (kingPriority.length > 0) return kingPriority;
    }

    return bestCaptures;
  }

  return allSimpleMoves;
}

function executeMove(board: BoardType, move: Move, isWhiteTurn: boolean): BoardType {
  const newBoard = [...board];
  const piece = newBoard[move.from];

  newBoard[move.from] = null;

  // Remove captured pieces
  for (const capPos of move.captures) {
    newBoard[capPos] = null;
  }

  // Place piece and check for promotion
  if (move.isKingPromotion) {
    newBoard[move.to] = isWhiteTurn ? 'whiteKing' : 'blackKing';
  } else if (isKing(piece)) {
    newBoard[move.to] = piece;
  } else {
    // Check promotion
    if ((isWhiteTurn && getRow(move.to) === 0) || (!isWhiteTurn && getRow(move.to) === 7)) {
      newBoard[move.to] = isWhiteTurn ? 'whiteKing' : 'blackKing';
    } else {
      newBoard[move.to] = piece;
    }
  }

  return newBoard;
}

// Check draw conditions
function checkDrawCondition(board: BoardType, moveCount: number): boolean {
  const whites = board.filter(p => isWhite(p));
  const blacks = board.filter(p => isBlack(p));
  const whiteKings = whites.filter(p => isKing(p)).length;
  const blackKings = blacks.filter(p => isKing(p)).length;

  // 1 piece vs 3 kings = draw after 12 moves
  if ((whites.length === 1 && blacks.length <= 3 && blackKings === blacks.length) ||
      (blacks.length === 1 && whites.length <= 3 && whiteKings === whites.length)) {
    if (moveCount >= 12) return true;
  }

  // 1 piece vs 2 kings = draw after 12 moves
  if ((whites.length === 1 && blacks.length === 2 && blackKings === 2) ||
      (blacks.length === 1 && whites.length === 2 && whiteKings === 2)) {
    if (moveCount >= 12) return true;
  }

  return false;
}

// ==================== TAHIRO AI ENGINE v2 — Spanish Checkers ====================
// High-performance engine replacing the old fixed-depth minimax:
//   • Negamax + alpha-beta + PVS (Principal Variation Search)
//   • Iterative deepening with per-level time budgets + aspiration windows
//   • Zobrist hashing + fixed-size transposition table (typed arrays, ~512K slots)
//   • True quiescence search over forced-capture chains (kills horizon effect)
//   • Killer moves + history heuristic move ordering + forced-move extensions
//   • Strategic evaluation: material, piece-square tables, back-rank integrity,
//     runaway men, king activity/mobility, trapped kings, structure/defenders,
//     trade-down when ahead, tempo, and an endgame HUNT mode that actually
//     corners the opponent and converts winning endings instead of shuffling
//   • Game-level repetition memory: never shuffles kings back-and-forth when
//     winning; deliberately seeks repetition only when losing (draw-seeking)

const AI_WIN = 100000;
const AI_MATE_BOUND = 99000;
const AI_INF = 1000000000;
const AI_MAX_PLY = 64;

// ---------- Zobrist hashing (two 32-bit halves, deterministic seed) ----------
const Z_LO = new Int32Array(64 * 4);
const Z_HI = new Int32Array(64 * 4);
let zSideLo = 0, zSideHi = 0;
(() => {
  let s = 0x9E3779B9 | 0;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s | 0; };
  for (let i = 0; i < 64 * 4; i++) { Z_LO[i] = rnd(); Z_HI[i] = rnd(); }
  zSideLo = rnd(); zSideHi = rnd();
})();

function pieceIdx(p: PieceType): number {
  if (p === 'white') return 0;
  if (p === 'black') return 1;
  if (p === 'whiteKing') return 2;
  return 3; // blackKing
}

let gHashLo = 0, gHashHi = 0;
function computeHash(board: BoardType, whiteToMove: boolean): void {
  let lo = 0, hi = 0;
  for (let pos = 0; pos < 64; pos++) {
    const p = board[pos];
    if (!p) continue;
    const k = pieceIdx(p) * 64 + pos;
    lo ^= Z_LO[k]; hi ^= Z_HI[k];
  }
  if (!whiteToMove) { lo ^= zSideLo; hi ^= zSideHi; }
  gHashLo = lo | 0; gHashHi = hi | 0;
}

// ---------- Transposition table ----------
const TT_BITS = 19;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const ttKeyLo = new Int32Array(TT_SIZE);
const ttKeyHi = new Int32Array(TT_SIZE);
const ttDepth = new Int16Array(TT_SIZE);
const ttFlagA = new Int8Array(TT_SIZE);   // 0 empty, 1 exact, 2 lower, 3 upper
const ttScoreA = new Int32Array(TT_SIZE);
const ttMoveA = new Int32Array(TT_SIZE);  // from*64+to, -1 if none

function ttStore(lo: number, hi: number, depth: number, score: number, flag: number, moveCode: number, ply: number): void {
  const idx = ((lo ^ hi) >>> 0) & TT_MASK;
  // Depth-preferred replacement (small age tolerance keeps table fresh)
  if (ttFlagA[idx] !== 0 && ttDepth[idx] > depth + 3 && (ttKeyLo[idx] !== lo || ttKeyHi[idx] !== hi)) return;
  let s = score;
  if (s > AI_MATE_BOUND) s += ply; else if (s < -AI_MATE_BOUND) s -= ply;
  ttKeyLo[idx] = lo; ttKeyHi[idx] = hi;
  ttDepth[idx] = depth; ttFlagA[idx] = flag;
  ttScoreA[idx] = s | 0; ttMoveA[idx] = moveCode;
}

// ---------- Move ordering helpers ----------
const killer1 = new Int32Array(AI_MAX_PLY);
const killer2 = new Int32Array(AI_MAX_PLY);
const histTable = new Int32Array(64 * 64);

// ---------- Time management ----------
const aiNow: () => number = (typeof performance !== 'undefined' && typeof performance.now === 'function')
  ? () => performance.now() : () => Date.now();
let aiNodes = 0;
let aiStopTime = 0;
let aiAborted = false;
let aiReachedDepth = 0;   // last fully completed iteration depth (diagnostics)
function aiTimeUp(): boolean {
  if (aiAborted) return true;
  if ((aiNodes & 1023) === 0 && aiNow() >= aiStopTime) aiAborted = true;
  return aiAborted;
}

// ---------- Evaluation ----------
// White-man advancement by row (row 7 = home, row 1 = one step from crowning)
const W_MAN_ROW = [0, 62, 40, 26, 16, 10, 6, 4];
const COL_CENTER = [0, 2, 5, 8, 8, 5, 2, 0];
// King centralization table
const KING_PST = new Int32Array(64);
(() => {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const dr = Math.abs(2 * r - 7), dc = Math.abs(2 * c - 7);
    const cheb = (dr > dc ? dr : dc) / 2;             // 0.5 .. 3.5
    let v = Math.round((3.5 - cheb) * 8);             // center → +24, corner → 0
    if (r === c || r + c === 7) v += 6;               // long diagonals
    KING_PST[r * 8 + c] = v;
  }
})();

const evWKp = new Int32Array(16); const evBKp = new Int32Array(16);
const evWMp = new Int32Array(16); const evBMp = new Int32Array(16);

// Static evaluation from WHITE's perspective (no move generation — fast)
function evalWhitePOV(board: BoardType): number {
  let wMen = 0, bMen = 0, wK = 0, bK = 0;
  for (let pos = 0; pos < 64; pos++) {
    const p = board[pos];
    if (!p) continue;
    if (p === 'white') { evWMp[wMen++] = pos; }
    else if (p === 'black') { evBMp[bMen++] = pos; }
    else if (p === 'whiteKing') { evWKp[wK++] = pos; }
    else { evBKp[bK++] = pos; }
  }
  const wMat = wMen * 100 + wK * 330;
  const bMat = bMen * 100 + bK * 330;
  const matDiff = wMat - bMat;
  const total = wMen + bMen + wK + bK;
  let score = matDiff;

  // Trade down when ahead, keep pieces on when behind
  if (matDiff >= 90) score += (24 - total) * 4;
  else if (matDiff <= -90) score -= (24 - total) * 4;

  const backRankW = Math.min(bMen, 8) * 2;  // value of guarding home row decays as enemy men vanish
  const backRankB = Math.min(wMen, 8) * 2;

  let wRunaway = 0, bRunaway = 0;

  // ----- White men -----
  for (let i = 0; i < wMen; i++) {
    const pos = evWMp[i];
    const r = pos >> 3, c = pos & 7;
    score += W_MAN_ROW[r] + COL_CENTER[c];
    if (r === 7) score += backRankW;
    // defenders behind
    if (r < 7) {
      if (c > 0 && isWhite(board[pos + 7])) score += 4;
      if (c < 7 && isWhite(board[pos + 9])) score += 4;
    }
    // forward mobility
    let mob = 0;
    if (r > 0) {
      if (c > 0 && board[pos - 9] === null) mob++;
      if (c < 7 && board[pos - 7] === null) mob++;
    }
    score += mob * 2;
    // Runaway man: nothing black inside the forward cone and black has no kings
    if (bK === 0 && r <= 3 && wRunaway < 160) {
      let clear = true;
      for (let rr = r - 1; rr >= 0 && clear; rr--) {
        const spread = r - rr;
        const c0 = c - spread < 0 ? 0 : c - spread;
        const c1 = c + spread > 7 ? 7 : c + spread;
        for (let cc = c0; cc <= c1; cc++) {
          const q = board[rr * 8 + cc];
          if (q === 'black' || q === 'blackKing') { clear = false; break; }
        }
      }
      if (clear) { const b = 70 + (3 - r) * 15; wRunaway += b; score += b; }
    }
  }
  // ----- Black men (mirrored) -----
  for (let i = 0; i < bMen; i++) {
    const pos = evBMp[i];
    const r = pos >> 3, c = pos & 7;
    score -= W_MAN_ROW[7 - r] + COL_CENTER[c];
    if (r === 0) score -= backRankB;
    if (r > 0) {
      if (c > 0 && isBlack(board[pos - 9])) score -= 4;
      if (c < 7 && isBlack(board[pos - 7])) score -= 4;
    }
    let mob = 0;
    if (r < 7) {
      if (c > 0 && board[pos + 7] === null) mob++;
      if (c < 7 && board[pos + 9] === null) mob++;
    }
    score -= mob * 2;
    if (wK === 0 && r >= 4 && bRunaway < 160) {
      let clear = true;
      for (let rr = r + 1; rr <= 7 && clear; rr++) {
        const spread = rr - r;
        const c0 = c - spread < 0 ? 0 : c - spread;
        const c1 = c + spread > 7 ? 7 : c + spread;
        for (let cc = c0; cc <= c1; cc++) {
          const q = board[rr * 8 + cc];
          if (q === 'white' || q === 'whiteKing') { clear = false; break; }
        }
      }
      if (clear) { const b = 70 + (r - 4) * 15; bRunaway += b; score -= b; }
    }
  }
  // ----- Kings: centralization + sliding mobility, trapped-king penalty -----
  for (let i = 0; i < wK; i++) {
    const pos = evWKp[i];
    score += KING_PST[pos];
    score += kingSlideScore(board, pos);
  }
  for (let i = 0; i < bK; i++) {
    const pos = evBKp[i];
    score -= KING_PST[pos];
    score -= kingSlideScore(board, pos);
  }

  // ----- Endgame HUNT: corner the enemy and close in to convert the win -----
  if (total <= 8 && (matDiff >= 100 || matDiff <= -100)) {
    const whiteWinning = matDiff > 0;
    const huntKn = whiteWinning ? wK : bK;
    const huntKp = whiteWinning ? evWKp : evBKp;
    const preyMn = whiteWinning ? bMen : wMen;
    const preyMp = whiteWinning ? evBMp : evWMp;
    const preyKn = whiteWinning ? bK : wK;
    const preyKp = whiteWinning ? evBKp : evWKp;
    let hunt = 0;
    for (let i = 0; i < huntKn; i++) {
      const hr = huntKp[i] >> 3, hc = huntKp[i] & 7;
      let minD = 14;
      for (let j = 0; j < preyMn; j++) {
        const d = chebDist(hr, hc, preyMp[j] >> 3, preyMp[j] & 7);
        if (d < minD) minD = d;
      }
      for (let j = 0; j < preyKn; j++) {
        const d = chebDist(hr, hc, preyKp[j] >> 3, preyKp[j] & 7);
        if (d < minD) minD = d;
      }
      hunt += (10 - minD) * 6;   // close the distance
    }
    // push prey to the edge/corner (kings included)
    for (let j = 0; j < preyMn; j++) {
      const r = preyMp[j] >> 3, c = preyMp[j] & 7;
      hunt += chebFromCenter(r, c) * 5;
    }
    for (let j = 0; j < preyKn; j++) {
      const r = preyKp[j] >> 3, c = preyKp[j] & 7;
      hunt += chebFromCenter(r, c) * 5;
    }
    score += whiteWinning ? hunt : -hunt;
  }
  return score;
}

function chebDist(r1: number, c1: number, r2: number, c2: number): number {
  const dr = r1 > r2 ? r1 - r2 : r2 - r1;
  const dc = c1 > c2 ? c1 - c2 : c2 - c1;
  return dr > dc ? dr : dc;
}
function chebFromCenter(r: number, c: number): number {
  const dr = Math.abs(2 * r - 7), dc = Math.abs(2 * c - 7);
  return ((dr > dc ? dr : dc) - 1) >> 1;   // 0 center .. 3 corner
}

function kingSlideScore(board: BoardType, pos: number): number {
  const r = pos >> 3, c = pos & 7;
  let cnt = 0;
  // NW
  for (let rr = r - 1, cc = c - 1; rr >= 0 && cc >= 0 && board[rr * 8 + cc] === null; rr--, cc--) { if (++cnt >= 8) break; }
  // NE
  if (cnt < 8) for (let rr = r - 1, cc = c + 1; rr >= 0 && cc <= 7 && board[rr * 8 + cc] === null; rr--, cc++) { if (++cnt >= 8) break; }
  // SW
  if (cnt < 8) for (let rr = r + 1, cc = c - 1; rr <= 7 && cc >= 0 && board[rr * 8 + cc] === null; rr++, cc--) { if (++cnt >= 8) break; }
  // SE
  if (cnt < 8) for (let rr = r + 1, cc = c + 1; rr <= 7 && cc <= 7 && board[rr * 8 + cc] === null; rr++, cc++) { if (++cnt >= 8) break; }
  if (cnt === 0) return -45;               // trapped king
  return cnt * 3;
}

function evalSide(board: BoardType, whiteToMove: boolean): number {
  const s = evalWhitePOV(board);
  return (whiteToMove ? s : -s) + 8;       // tempo for the side to move
}

// ---------- Lightweight existence scanners (avoid full move generation) ----------
function sideHasCapture(board: BoardType, whiteToMove: boolean): boolean {
  for (let pos = 0; pos < 64; pos++) {
    const p = board[pos];
    if (!p || !isPlayerPiece(p, whiteToMove)) continue;
    const r = pos >> 3, c = pos & 7;
    if (isKing(p)) {
      // flying king: first piece on each diagonal; enemy + empty square beyond = capture
      for (let d = 0; d < 4; d++) {
        const dr = d < 2 ? -1 : 1, dc = (d & 1) === 0 ? -1 : 1;
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr <= 7 && cc >= 0 && cc <= 7 && board[rr * 8 + cc] === null) { rr += dr; cc += dc; }
        if (rr >= 0 && rr <= 7 && cc >= 0 && cc <= 7) {
          const q = board[rr * 8 + cc];
          if (q && isOpponentPiece(q, whiteToMove)) {
            const lr = rr + dr, lc = cc + dc;
            if (lr >= 0 && lr <= 7 && lc >= 0 && lc <= 7 && board[lr * 8 + lc] === null) return true;
          }
        }
      }
    } else {
      // man: forward captures only (Spanish rules)
      const dr = whiteToMove ? -1 : 1;
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        const mr = r + dr, mc = c + s2, lr = r + 2 * dr, lc = c + 2 * s2;
        if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
        const mid = board[mr * 8 + mc];
        if (mid && isOpponentPiece(mid, whiteToMove) && board[lr * 8 + lc] === null) return true;
      }
    }
  }
  return false;
}

function sideHasQuiet(board: BoardType, whiteToMove: boolean): boolean {
  for (let pos = 0; pos < 64; pos++) {
    const p = board[pos];
    if (!p || !isPlayerPiece(p, whiteToMove)) continue;
    const r = pos >> 3, c = pos & 7;
    if (isKing(p)) {
      if (r > 0 && c > 0 && board[pos - 9] === null) return true;
      if (r > 0 && c < 7 && board[pos - 7] === null) return true;
      if (r < 7 && c > 0 && board[pos + 7] === null) return true;
      if (r < 7 && c < 7 && board[pos + 9] === null) return true;
    } else {
      const dr = whiteToMove ? -1 : 1;
      const nr = r + dr;
      if (nr >= 0 && nr <= 7) {
        if (c > 0 && board[nr * 8 + c - 1] === null) return true;
        if (c < 7 && board[nr * 8 + c + 1] === null) return true;
      }
    }
  }
  return false;
}

// ---------- Quiescence: resolve full forced-capture chains ----------
function qsearch(board: BoardType, alpha: number, beta: number, whiteToMove: boolean, ply: number): number {
  aiNodes++;
  if (aiTimeUp()) return 0;
  if (!sideHasCapture(board, whiteToMove)) {
    if (!sideHasQuiet(board, whiteToMove)) return -(AI_WIN - ply);   // no moves at all — loss
    return evalSide(board, whiteToMove);   // quiet position — stand on evaluation
  }
  if (ply >= AI_MAX_PLY - 1) return evalSide(board, whiteToMove);
  const moves = getAllValidMoves(board, whiteToMove);
  if (moves.length === 0) return -(AI_WIN - ply);
  // Captures are mandatory: no stand-pat, search every forced line
  if (moves.length > 1) {
    moves.sort((a, b) => (b.captures.length * 100 + (b.isKingPromotion ? 50 : 0))
                        - (a.captures.length * 100 + (a.isKingPromotion ? 50 : 0)));
  }
  let best = -AI_INF;
  for (let i = 0; i < moves.length; i++) {
    const child = executeMove(board, moves[i], whiteToMove);
    const sc = -qsearch(child, -beta, -alpha, !whiteToMove, ply + 1);
    if (aiAborted) return 0;
    if (sc > best) best = sc;
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  return best;
}

// ---------- Main search: Negamax + PVS + TT ----------
const ordScores = new Float64Array(128);

function orderMoves(moves: Move[], ttMoveCode: number, ply: number): void {
  const n = moves.length;
  for (let i = 0; i < n; i++) {
    const m = moves[i];
    const code = m.from * 64 + m.to;
    let s: number;
    if (code === ttMoveCode) s = 10000000;
    else if (m.captures.length > 0) {
      s = 5000000 + m.captures.length * 2000 + (m.isKingPromotion ? 900 : 0) + histTable[code];
    } else {
      if (code === killer1[ply]) s = 900000;
      else if (code === killer2[ply]) s = 800000;
      else s = histTable[code];
      if (m.isKingPromotion) s += 700000;
    }
    ordScores[i] = s;
  }
  // insertion sort (move lists are short)
  for (let i = 1; i < n; i++) {
    const mv = moves[i]; const sc = ordScores[i];
    let j = i - 1;
    while (j >= 0 && ordScores[j] < sc) { moves[j + 1] = moves[j]; ordScores[j + 1] = ordScores[j]; j--; }
    moves[j + 1] = mv; ordScores[j + 1] = sc;
  }
}

function aiSearch(board: BoardType, depth: number, alpha: number, beta: number, whiteToMove: boolean, ply: number): number {
  aiNodes++;
  if (aiTimeUp()) return 0;

  computeHash(board, whiteToMove);
  const hLo = gHashLo, hHi = gHashHi;
  const idx = ((hLo ^ hHi) >>> 0) & TT_MASK;
  let ttMoveCode = -1;
  if (ttFlagA[idx] !== 0 && ttKeyLo[idx] === hLo && ttKeyHi[idx] === hHi) {
    ttMoveCode = ttMoveA[idx];
    if (ttDepth[idx] >= depth) {
      let sc = ttScoreA[idx];
      if (sc > AI_MATE_BOUND) sc -= ply; else if (sc < -AI_MATE_BOUND) sc += ply;
      const f = ttFlagA[idx];
      if (f === 1) return sc;
      if (f === 2) { if (sc > alpha) alpha = sc; }
      else if (f === 3) { if (sc < beta) beta = sc; }
      if (alpha >= beta) return sc;
    }
  }

  if (depth <= 0 || ply >= AI_MAX_PLY - 2) {
    return qsearch(board, alpha, beta, whiteToMove, ply);   // qsearch handles mate/quiet itself
  }

  const moves = getAllValidMoves(board, whiteToMove);
  if (moves.length === 0) return -(AI_WIN - ply);

  let d = depth;
  if (moves.length === 1 && ply < AI_MAX_PLY - 8) d += 1;   // forced-move extension (free ply)

  orderMoves(moves, ttMoveCode, ply);

  const alphaOrig = alpha;
  let best = -AI_INF;
  let bestCode = -1;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const child = executeMove(board, m, whiteToMove);
    let sc: number;
    if (i === 0) {
      sc = -aiSearch(child, d - 1, -beta, -alpha, !whiteToMove, ply + 1);
    } else {
      // Late Move Reductions: search late quiet moves shallower first
      let red = 0;
      if (d >= 3 && i >= 3 && m.captures.length === 0 && !m.isKingPromotion) {
        red = (d >= 5 && i >= 6) ? 2 : 1;
      }
      sc = -aiSearch(child, d - 1 - red, -alpha - 1, -alpha, !whiteToMove, ply + 1);   // null window
      if (red > 0 && sc > alpha && !aiAborted) {
        sc = -aiSearch(child, d - 1, -alpha - 1, -alpha, !whiteToMove, ply + 1);       // verify at full depth
      }
      if (sc > alpha && sc < beta && !aiAborted) {
        sc = -aiSearch(child, d - 1, -beta, -alpha, !whiteToMove, ply + 1);            // full re-search
      }
    }
    if (aiAborted) return 0;
    if (sc > best) { best = sc; bestCode = m.from * 64 + m.to; }
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) {
      if (m.captures.length === 0) {
        const code = m.from * 64 + m.to;
        if (killer1[ply] !== code) { killer2[ply] = killer1[ply]; killer1[ply] = code; }
        histTable[code] += d * d;
        if (histTable[code] > 400000) { for (let h = 0; h < histTable.length; h++) histTable[h] >>= 1; }
      }
      break;
    }
  }

  if (!aiAborted) {
    const flag = best <= alphaOrig ? 3 : (best >= beta ? 2 : 1);
    ttStore(hLo, hHi, d, best, flag, bestCode, ply);
  }
  return best;
}

// ---------- Game-level repetition memory (anti-shuffle) ----------
let memLo: number[] = [];
let memHi: number[] = [];
let memPieceCount = -1;

function aiResetGameMemory(): void {
  memLo = []; memHi = []; memPieceCount = -1;
}

function aiRemember(board: BoardType, whiteToMove: boolean): void {
  computeHash(board, whiteToMove);
  memLo.push(gHashLo); memHi.push(gHashHi);
  if (memLo.length > 200) { memLo.shift(); memHi.shift(); }
}

function aiTimesSeen(board: BoardType, whiteToMove: boolean): number {
  computeHash(board, whiteToMove);
  const lo = gHashLo, hi = gHashHi;
  let n = 0;
  for (let i = 0; i < memLo.length; i++) if (memLo[i] === lo && memHi[i] === hi) n++;
  return n;
}

// ---------- Level configuration ----------
// time = thinking budget (ms), maxDepth = iterative-deepening cap,
// blunder = probability of a deliberate 2nd-best move (human-like, low levels only),
// jitter = randomness window among near-equal best moves (variety; 0 = fully deterministic)
const AI_LEVELS = [
  { time: 0,    maxDepth: 0,  blunder: 0,    jitter: 0 },   // unused (index 0)
  { time: 60,   maxDepth: 2,  blunder: 0.32, jitter: 60 },  // 1
  { time: 90,   maxDepth: 3,  blunder: 0.20, jitter: 45 },  // 2
  { time: 140,  maxDepth: 4,  blunder: 0.12, jitter: 30 },  // 3
  { time: 220,  maxDepth: 6,  blunder: 0.06, jitter: 22 },  // 4
  { time: 340,  maxDepth: 8,  blunder: 0.03, jitter: 16 },  // 5
  { time: 480,  maxDepth: 12, blunder: 0,    jitter: 12 },  // 6
  { time: 650,  maxDepth: 14, blunder: 0,    jitter: 10 },  // 7
  { time: 880,  maxDepth: 17, blunder: 0,    jitter: 8 },   // 8
  { time: 1150, maxDepth: 20, blunder: 0,    jitter: 6 },   // 9
  { time: 1450, maxDepth: 24, blunder: 0,    jitter: 3 },   // 10
  { time: 1850, maxDepth: 30, blunder: 0,    jitter: 0 },   // 11 — full strength
];

function countPieces(board: BoardType): number {
  let n = 0;
  for (let i = 0; i < 64; i++) if (board[i] !== null) n++;
  return n;
}

// ---------- Root: iterative deepening + aspiration + repetition control ----------
function getBestMove(board: BoardType, isWhiteTurn: boolean, level: number): Move | null {
  const moves = getAllValidMoves(board, isWhiteTurn);
  if (moves.length === 0) return null;

  // Auto-detect a new game (piece count can never increase within one game)
  const pc = countPieces(board);
  if (memPieceCount >= 0 && pc > memPieceCount) aiResetGameMemory();
  memPieceCount = pc;
  aiRemember(board, isWhiteTurn);

  const noteChosen = (m: Move): Move => {
    const after = executeMove(board, m, isWhiteTurn);
    aiRemember(after, !isWhiteTurn);
    memPieceCount = countPieces(after);
    return m;
  };

  if (moves.length === 1) return noteChosen(moves[0]);   // forced — play instantly

  const lv = level < 1 ? 1 : (level > 11 ? 11 : Math.round(level));
  const cfg = AI_LEVELS[lv];

  aiNodes = 0;
  aiAborted = false;
  aiReachedDepth = 0;
  aiStopTime = aiNow() + cfg.time;
  killer1.fill(-1); killer2.fill(-1);
  for (let h = 0; h < histTable.length; h++) histTable[h] >>= 1;   // soft decay between moves

  // Root move list + running scores.
  // Repetition control is applied INSIDE the loop so it participates in
  // alpha/PVS consistently: winning/equal → penalize repeating a position
  // we've already seen this game; clearly losing → mildly reward it
  // (legitimate draw-seeking). This is what stops king-shuffling.
  orderMoves(moves, -1, 0);
  const n = moves.length;
  const scores = new Float64Array(n).fill(-AI_INF);
  const repAdj = new Float64Array(n);
  const exact = new Uint8Array(n);            // 1 = full-window exact score (PVS gives bounds otherwise)
  for (let i = 0; i < n; i++) {
    const after = executeMove(board, moves[i], isWhiteTurn);
    const seen = aiTimesSeen(after, !isWhiteTurn);
    repAdj[i] = seen;                          // stored as count; sign decided per-iteration
  }
  let bestIdx = 0;
  let bestScore = -AI_INF;
  let lastFullScore = -AI_INF;

  for (let depth = 1; depth <= cfg.maxDepth && !aiAborted; depth++) {
    let alpha0 = -AI_INF, beta0 = AI_INF;
    if (depth >= 4 && lastFullScore > -AI_INF) { alpha0 = lastFullScore - 70; beta0 = lastFullScore + 70; }
    const repSign = (lastFullScore > -AI_INF && lastFullScore < -140) ? 25 : -60;

    let done = false;
    while (!done && !aiAborted) {
      let iterBest = -AI_INF, iterBestIdx = -1;
      let alpha = alpha0;
      let firstDone = false;
      for (let i = 0; i < n; i++) {
        const rep = repAdj[i] * repSign;
        const child = executeMove(board, moves[i], isWhiteTurn);
        let sc: number;
        let isExact = 0;
        if (i === 0) {
          sc = -aiSearch(child, depth - 1, -(beta0 - rep), -(alpha - rep), !isWhiteTurn, 1) + rep;
          isExact = 1;
        } else {
          sc = -aiSearch(child, depth - 1, -(alpha - rep) - 1, -(alpha - rep), !isWhiteTurn, 1) + rep;
          if (sc > alpha && sc < beta0 && !aiAborted) {
            sc = -aiSearch(child, depth - 1, -(beta0 - rep), -(alpha - rep), !isWhiteTurn, 1) + rep;
            isExact = 1;
          }
        }
        if (aiAborted) break;
        scores[i] = sc; exact[i] = isExact;
        if (i === 0) firstDone = true;
        if (sc > iterBest) { iterBest = sc; iterBestIdx = i; }
        if (sc > alpha) alpha = sc;
      }
      if (aiAborted) {
        // Partial iteration: adopt only if the previous best was re-searched first
        // and a later move already proved strictly better at this deeper depth.
        if (firstDone && iterBestIdx > 0 && iterBest > scores[0]) {
          bestIdx = iterBestIdx; bestScore = iterBest;
        }
        break;
      }
      if (iterBest <= alpha0 && alpha0 > -AI_INF) { alpha0 = -AI_INF; continue; }   // fail low → widen
      if (iterBest >= beta0 && beta0 < AI_INF)   { beta0 = AI_INF;  continue; }     // fail high → widen
      done = true;
      aiReachedDepth = depth;
      bestIdx = iterBestIdx; bestScore = iterBest; lastFullScore = iterBest;
      // Re-sort root moves by this iteration's scores (best first for the next depth)
      const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => scores[b] - scores[a]);
      const mCopy = order.map(k => moves[k]);
      const sCopy = order.map(k => scores[k]);
      const rCopy = order.map(k => repAdj[k]);
      const eCopy = order.map(k => exact[k]);
      for (let k = 0; k < n; k++) { moves[k] = mCopy[k]; scores[k] = sCopy[k]; repAdj[k] = rCopy[k]; exact[k] = eCopy[k]; }
      bestIdx = 0;
    }
    if (bestScore > AI_WIN - 200) break;   // forced win found — no need to think longer
  }

  // ----- Human-like inaccuracy for low levels -----
  // (upper-bound scores are fine here — imperfection is the point)
  if (cfg.blunder > 0 && Math.random() < cfg.blunder) {
    let secondIdx = -1, secondSc = -AI_INF;
    for (let i = 0; i < n; i++) {
      if (i === bestIdx) continue;
      if (scores[i] > secondSc) { secondSc = scores[i]; secondIdx = i; }
    }
    if (secondIdx >= 0 && secondSc > bestScore - 320) return noteChosen(moves[secondIdx]);
  }

  // ----- Variety among near-equal best moves (EXACT scores only) -----
  // PVS null-window results are upper bounds, not true values; only moves that
  // were re-searched with a full window may enter the random pool.
  if (cfg.jitter > 0) {
    const pool: number[] = [];
    for (let i = 0; i < n; i++) if (exact[i] === 1 && scores[i] >= bestScore - cfg.jitter) pool.push(i);
    if (pool.length > 1) return noteChosen(moves[pool[Math.floor(Math.random() * pool.length)]]);
  }

  return noteChosen(moves[bestIdx]);
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

  // ==================== OPPONENT (AI) PLAY ====================
  useEffect(() => {
    if (screen !== 'game' || gameOver || gameMode === 'watch') return;
    if (isWhiteTurn) return; // Player is white
    if (isRealMatch) return; // Real opponent plays via network, not AI

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
      const move = getBestMove(board, false, level);
      if (move) {
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
      }
    }, delay);

    return () => { if (generalTimerRef.current) clearTimeout(generalTimerRef.current); };
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

    let _watchTurn = watchTurn; // local mutable copy — safe inside closure
    const interval = setInterval(() => {
      setWatchBoard(prev => {
        const turn = _watchTurn;
        const moves = getAllValidMoves(prev, turn);
        
        if (moves.length === 0) {
          setWatchWinner(turn ? 'black' : 'white');
          setWatchGameOver(true);
          return prev;
        }

        const move = getBestMove(prev, turn, 11);
        if (!move) {
          setWatchWinner(turn ? 'black' : 'white');
          setWatchGameOver(true);
          return prev;
        }

        const newBoard = executeMove(prev, move, turn);
        const nextMoves = getAllValidMoves(newBoard, !turn);
        
        if (nextMoves.length === 0) {
          setWatchWinner(turn ? 'white' : 'black');
          setWatchGameOver(true);
        }

        _watchTurn = !turn;
        setWatchTurn(!turn);
        setLastMove({ from: move.from, to: move.to });
        return newBoard;
      });
    }, 1500 + Math.random() * 2500);

    return () => clearInterval(interval);
  }, [screen, gameMode, watchMatch, watchGameOver]); // watchTurn read inside setter — no dep needed

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
    aiResetGameMemory();   // fresh repetition memory for the new game
    setIsWhiteTurn(true);
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
    const color = isWhite(piece)
      ? 'bg-gradient-to-br from-yellow-200 to-yellow-400 text-yellow-800 border-yellow-500'
      : 'bg-gradient-to-br from-gray-700 to-gray-900 text-gray-200 border-gray-500';

    return (
      <div className={`rounded-full ${size === 'text-3xl' ? 'w-9 h-9' : 'w-6 h-6'} flex items-center justify-center border-2 ${color} shadow-lg ${isK ? 'ring-2 ring-yellow-400' : ''}`}>
        <span className={size === 'text-3xl' ? 'text-lg' : 'text-xs'}>
          {isK ? '👑' : (isWhite(piece) ? '⚪' : '⚫')}
        </span>
      </div>
    );
  };

  const currentBoard = gameMode === 'watch' ? watchBoard : board;
  const whiteCount = currentBoard.filter(p => isWhite(p)).length;
  const blackCount = currentBoard.filter(p => isBlack(p)).length;

  // ==================== SCREENS ====================

  // ---- HOME SCREEN ----
  const renderHome = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
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
          <div className="bg-yellow-600/30 px-3 py-1 rounded-full flex items-center gap-1">
            <span className="text-yellow-400 font-bold">{fmtNum(Math.max(0, coins))}</span>
            <span>💰</span>
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
          <div className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl p-3 text-center active:scale-95 transition-transform shadow-lg shadow-orange-500/20"
            onClick={() => showNotif(t('المتجر سيكون متاحاً قريباً! 🛒'))}>
            <div className="text-2xl mb-1">🛒</div>
            <div className="text-white font-bold text-xs">{t('المتجر')}</div>
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
            className="aspect-square w-full max-w-[380px] grid grid-cols-8 gap-0 rounded-lg overflow-hidden shadow-2xl border-2 border-yellow-900/50"
          >
            {displayBoard.map((piece, i) => {
              const row = getRow(i);
              const col = getCol(i);
              const isDark = (row + col) % 2 === 1;
              const isSelected = selectedPiece === i;
              const isValidMove = validMoves.includes(i);
              const isLastMoveSquare = lastMove && (lastMove.from === i || lastMove.to === i);
              const hasCapture = selectedMoves.some(m => m.to === i && m.captures.length > 0);

              return (
                  <div key={i}
                  role={isDark && !isWatch ? 'button' : undefined}
                  aria-label={isDark && piece ? tf('قطعة {0} في صف {1} عمود {2}', (piece.includes('white') ? t('بيضاء') : t('سوداء')) + (piece.includes('King') ? t(' ملك') : ''), Math.floor(i/8)+1, i%8+1) : (isDark && isValidMove ? tf('حرك هنا: صف {0} عمود {1}', Math.floor(i/8)+1, i%8+1) : undefined)}
                  onClick={() => !isWatch && handleCellClick(i)}
                  className={`aspect-square flex items-center justify-center relative transition-all
                    ${isDark
                      ? isSelected ? 'bg-green-600' :
                        isLastMoveSquare ? 'bg-amber-800' :
                        isValidMove ? (hasCapture ? 'bg-red-700/70' : 'bg-green-800/70') :
                        'bg-amber-900'
                      : 'bg-amber-100'}
                    ${isValidMove && !isWatch ? 'cursor-pointer' : ''}
                    ${isDark && piece && !isWatch && isPlayerPiece(piece, true) ? 'cursor-pointer' : ''}
                  `}>
                  {piece && renderPiece(piece)}
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
                  <span>⚙️</span> إعدادات خصوصية الإعلانات
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

  // ==================== MAIN RENDER ====================
  if (!isLoggedIn) return renderLogin();

  return (
    <div
      className="h-screen w-screen max-w-md mx-auto flex flex-col bg-gray-900 text-white overflow-hidden relative"
      dir={dir}
      // مساحة محجوزة للبانر: تدفع شريط التنقّل والأزرار للأعلى بدل أن يغطّيها
      style={bannerH > 0 ? { paddingBottom: `${bannerH}px` } : undefined}
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
              <span className="text-green-400 font-bold">{incomingInvite.from.displayName}</span> يدعوك للعب!
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
