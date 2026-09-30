import { defineRoom, defineServer, matchMaker, Room, type Client } from "colyseus";
import type { NextFunction, Request, Response } from "express";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CAPACITY = 20;
const DANCES = ["take-l", "honey", "vegetable", "selfie", "criss-cross"] as const;
const BUBBLES = ["L을 가져가!", "같이 춤춰!", "ㅋㅋㅋ", "안녕!", "한 번 더!"] as const;
const COLORS = ["#ff7867", "#f8c14b", "#68d9a5", "#70a8ff", "#b594f6", "#ff91c3"];
const BLOCKED_NAME_PARTS = ["시발", "씨발", "병신", "개새끼", "좆", "ㅅㅂ"];

type Dance = (typeof DANCES)[number];
type Player = {
  id: string;
  name: string;
  x: number;
  z: number;
  color: string;
  dance: Dance | null;
  facing: number;
  lastMove: number;
  lastBubble: number;
  lastShare: number;
  dancedOnce: boolean;
};

type RoomSummary = { number: number; id: string; count: number; capacity: number };
const rooms: RoomSummary[] = [];
const statsFile = fileURLToPath(new URL("../data/stats.json", import.meta.url));
const freshStats = {
  startedAt: new Date().toISOString(),
  entrySessions: 0,
  currentPlayers: 0,
  peakPlayers: 0,
  firstDances: 0,
  dances: Object.fromEntries(DANCES.map((dance) => [dance, 0])) as Record<Dance, number>,
  shares: 0,
  launchStartedAt: null as string | null,
  launchHourEntries: 0,
};
const savedStats = existsSync(statsFile) ? JSON.parse(readFileSync(statsFile, "utf8")) as Partial<typeof freshStats> : {};
const stats = { ...freshStats, ...savedStats, currentPlayers: 0, dances: { ...freshStats.dances, ...savedStats.dances } };

function persistStats() {
  mkdirSync(dirname(statsFile), { recursive: true });
  writeFileSync(`${statsFile}.tmp`, JSON.stringify(stats));
  renameSync(`${statsFile}.tmp`, statsFile);
}

function updateCount(number: number, count: number) {
  const room = rooms.find((item) => item.number === number);
  if (room) room.count = count;
  stats.currentPlayers = rooms.reduce((total, item) => total + item.count, 0);
  stats.peakPlayers = Math.max(stats.peakPlayers, stats.currentPlayers);
  persistStats();
}

function cleanNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name.length < 2 || name.length > 12) return null;
  if (!/^[\p{L}\p{N}_ ]+$/u.test(name)) return null;
  if (BLOCKED_NAME_PARTS.some((part) => name.replaceAll(" ", "").includes(part))) return null;
  return name;
}

class PlaygroundRoom extends Room {
  maxClients = CAPACITY;
  maxMessagesPerSecond = 20;
  autoDispose = false;
  private roomNumber = 1;
  private players = new Map<string, Player>();

  onCreate(options: { number: number }) {
    this.roomNumber = options.number;
    this.onMessage("snapshot", (client) => ({
      id: client.sessionId,
      number: this.roomNumber,
      players: [...this.players.values()].map(({ lastMove, lastBubble, lastShare, dancedOnce, ...visible }) => visible),
    }));
    this.onMessage("move", (client, value: unknown) => {
      const player = this.players.get(client.sessionId);
      if (!player || !value || typeof value !== "object") return;
      const input = value as { x?: unknown; z?: unknown };
      if (typeof input.x !== "number" || typeof input.z !== "number") return;
      if (!Number.isFinite(input.x) || !Number.isFinite(input.z)) return;
      const now = Date.now();
      if (now - player.lastMove < 50) return;
      const length = Math.hypot(input.x, input.z);
      if (length < 0.08) return;
      const delta = Math.min((now - player.lastMove) / 1000, 0.15);
      const step = Math.max(delta, 0.05) * 4;
      const dx = (input.x / Math.max(length, 1)) * step;
      const dz = (input.z / Math.max(length, 1)) * step;
      player.x = Math.max(-13, Math.min(13, player.x + dx));
      player.z = Math.max(-9, Math.min(9, player.z + dz));
      player.facing = Math.atan2(dx, dz);
      player.lastMove = now;
      if (player.dance) player.dance = null;
      this.broadcast("player-moved", {
        id: player.id, x: player.x, z: player.z, facing: player.facing, dance: player.dance,
      });
    });

    this.onMessage("dance", (client, value: unknown) => {
      const player = this.players.get(client.sessionId);
      if (!player || typeof value !== "string" || !DANCES.includes(value as Dance)) return;
      const next = player.dance === value ? null : (value as Dance);
      player.dance = next;
      if (next) {
        stats.dances[next] += 1;
        if (!player.dancedOnce) {
          player.dancedOnce = true;
          stats.firstDances += 1;
        }
        persistStats();
      }
      this.broadcast("player-danced", { id: player.id, dance: next });
    });

    this.onMessage("bubble", (client, value: unknown) => {
      const player = this.players.get(client.sessionId);
      if (!player || typeof value !== "string" || !BUBBLES.includes(value as typeof BUBBLES[number])) return;
      const now = Date.now();
      if (now - player.lastBubble < 1800) return;
      player.lastBubble = now;
      this.broadcast("bubble", { id: player.id, text: value });
    });

    this.onMessage("share", (client) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;
      const now = Date.now();
      if (now - player.lastShare < 5000) return;
      player.lastShare = now;
      stats.shares += 1;
      persistStats();
    });
  }

  onAuth(_client: Client, options: { name?: unknown }) {
    return cleanNickname(options?.name) !== null;
  }

  onJoin(client: Client, options: { name?: unknown; source?: unknown }) {
    const name = cleanNickname(options?.name);
    if (!name) return;
    const player: Player = {
      id: client.sessionId,
      name,
      x: Math.random() * 10 - 5,
      z: Math.random() * 6 - 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      dance: null,
      facing: 0,
      lastMove: Date.now() - 100,
      lastBubble: 0,
      lastShare: 0,
      dancedOnce: false,
    };
    this.players.set(client.sessionId, player);
    this.broadcast("player-joined", {
      id: player.id, name: player.name, x: player.x, z: player.z,
      color: player.color, dance: player.dance, facing: player.facing,
    });
    stats.entrySessions += 1;
    const now = Date.now();
    if (!stats.launchStartedAt && options.source === "openchat") {
      stats.launchStartedAt = new Date(now).toISOString();
    }
    if (stats.launchStartedAt && now - Date.parse(stats.launchStartedAt) < 3_600_000) {
      stats.launchHourEntries += 1;
    }
    updateCount(this.roomNumber, this.players.size);
  }

  onLeave(client: Client) {
    if (!this.players.delete(client.sessionId)) return;
    this.broadcast("player-left", { id: client.sessionId });
    updateCount(this.roomNumber, this.players.size);
  }

  async onDrop(client: Client) {
    await this.allowReconnection(client, 10);
  }
}

const origin = process.env.WEB_ORIGIN || "http://localhost:3000";
const server = defineServer({
  publicAddress: process.env.PUBLIC_ADDRESS,
  rooms: Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [
      `space_${index + 1}`,
      defineRoom(PlaygroundRoom, { number: index + 1 }),
    ]),
  ),
  express: (app) => {
    app.use((request: Request, response: Response, next: NextFunction) => {
      if (request.headers.origin === origin) {
        response.header("Access-Control-Allow-Origin", origin);
        response.header("Vary", "Origin");
        response.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        response.header("Access-Control-Allow-Headers", "Content-Type");
      }
      if (request.method === "OPTIONS") {
        response.sendStatus(204);
        return;
      }
      next();
    });
    app.get("/health", (_request: Request, response: Response) => response.json({ ok: true }));
    app.get("/rooms", (_request: Request, response: Response) => response.json({ rooms }));
    app.get("/stats", (_request: Request, response: Response) => {
      response.header("Cache-Control", "no-store");
      return response.json({ ...stats, launchGoalReached: stats.launchHourEntries >= 100, rooms });
    });
  },
});

const port = Number(process.env.PORT || 2567);
await server.listen(port);
for (let number = 1; number <= 5; number += 1) {
  const room = await matchMaker.createRoom(`space_${number}`, {});
  rooms.push({ number, id: room.roomId, count: 0, capacity: CAPACITY });
}
console.log(`Take the L game server listening on ${port}`);
