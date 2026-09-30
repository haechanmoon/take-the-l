"use client";

import { Client, type Room } from "@colyseus/sdk";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group, Mesh, Sprite, Texture } from "three";
import { CanvasTexture, LinearFilter } from "three";

type DanceId = "take-l" | "honey" | "vegetable" | "selfie" | "criss-cross";
type Player = {
  id: string;
  name: string;
  x: number;
  z: number;
  color: string;
  dance: DanceId | null;
  facing: number;
};
type RoomInfo = { number: number; id: string; count: number; capacity: number };
type Snapshot = { id: string; number: number; players: Player[] };

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER || "http://localhost:2567";
const DANCES: { id: DanceId; key: string; title: string; audio: string }[] = [
  { id: "take-l", key: "Q", title: "L을 가져가", audio: "/audio/take-l.m4a" },
  { id: "honey", key: "W", title: "크림치즈허니", audio: "/audio/honey.m4a" },
  { id: "vegetable", key: "E", title: "야채", audio: "/audio/vegetable.m4a" },
  { id: "selfie", key: "R", title: "셀카", audio: "/audio/selfie.m4a" },
  { id: "criss-cross", key: "T", title: "크리스크로스", audio: "/audio/criss-cross.m4a" },
];
const BUBBLES = ["L을 가져가!", "같이 춤춰!", "ㅋㅋㅋ", "안녕!", "한 번 더!"];
const DEMO_PLAYERS: Player[] = [
  { id: "demo-1", name: "춤추는 감자", x: -3.6, z: 0.4, color: "#ff7867", dance: "take-l", facing: 0.3 },
  { id: "demo-2", name: "치즈", x: 1.1, z: -1.5, color: "#f8c14b", dance: "honey", facing: -0.2 },
  { id: "demo-3", name: "야채", x: 5, z: 1.5, color: "#68d9a5", dance: "vegetable", facing: 0.1 },
];

function labelTexture(text: string, background = "#201a2e"): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = background;
  context.beginPath();
  context.roundRect(4, 8, 504, 112, 40);
  context.fill();
  context.fillStyle = "#fff9e7";
  context.font = "bold 49px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 256, 64, 460);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  return texture;
}

function NameTag({ name, bubble }: { name: string; bubble?: string }) {
  const nameTexture = useMemo(() => labelTexture(name), [name]);
  const bubbleTexture = useMemo(() => bubble ? labelTexture(bubble, "#ef5b52") : null, [bubble]);
  useEffect(() => () => { nameTexture.dispose(); bubbleTexture?.dispose(); }, [nameTexture, bubbleTexture]);
  return (
    <>
      <sprite position={[0, 3.25, 0]} scale={[2.6, 0.65, 1]}>
        <spriteMaterial map={nameTexture} transparent depthTest={false} />
      </sprite>
      {bubbleTexture && <sprite position={[0, 4.05, 0]} scale={[2.8, 0.7, 1]}>
        <spriteMaterial map={bubbleTexture} transparent depthTest={false} />
      </sprite>}
    </>
  );
}

function Avatar({ player, bubble }: { player: Player; bubble?: string }) {
  const root = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const face = useRef<Mesh>(null);
  const variant = useMemo(() => player.id.charCodeAt(0) % 3, [player.id]);

  useFrame(({ clock }, delta) => {
    if (!root.current || !torso.current || !leftArm.current || !rightArm.current || !leftLeg.current || !rightLeg.current) return;
    const t = clock.elapsedTime;
    const rate = player.dance ? 8 : 2;
    const beat = Math.sin(t * rate);
    const sway = Math.cos(t * rate);
    root.current.position.x += (player.x - root.current.position.x) * Math.min(1, delta * 12);
    root.current.position.z += (player.z - root.current.position.z) * Math.min(1, delta * 12);
    root.current.rotation.y += (player.facing - root.current.rotation.y) * Math.min(1, delta * 12);
    root.current.position.y = player.dance ? Math.max(0, beat) * 0.18 : 0;
    torso.current.rotation.z = player.dance ? beat * 0.11 : 0;
    leftArm.current.rotation.z = player.dance ? -0.6 - beat * 0.8 : -0.08;
    rightArm.current.rotation.z = player.dance ? 0.6 + sway * 0.8 : 0.08;
    leftArm.current.rotation.x = player.dance === "selfie" ? -1.4 : 0;
    rightArm.current.rotation.x = player.dance === "take-l" ? -0.8 : 0;
    leftLeg.current.rotation.x = player.dance ? beat * 0.4 : 0;
    rightLeg.current.rotation.x = player.dance ? -beat * 0.4 : 0;
    if (player.dance === "criss-cross") {
      leftLeg.current.rotation.z = beat * 0.35;
      rightLeg.current.rotation.z = -beat * 0.35;
    } else {
      leftLeg.current.rotation.z = 0;
      rightLeg.current.rotation.z = 0;
    }
    if (player.dance === "vegetable") torso.current.rotation.y = beat * 0.28;
    else torso.current.rotation.y = 0;
    if (player.dance === "honey") root.current.rotation.y += sway * 0.04;
    if (face.current) face.current.rotation.z = player.dance ? beat * 0.06 : 0;
  });

  return <group ref={root} position={[player.x, 0, player.z]}>
    <group ref={torso} position={[0, 1.45, 0]}>
      <mesh castShadow position={[0, 0, 0]}><boxGeometry args={[1.34, 1.18, 0.78]} /><meshStandardMaterial color={player.color} roughness={0.7} /></mesh>
      <mesh ref={face} castShadow position={[0, 0.98, 0]}><boxGeometry args={[0.95, 0.83, 0.77]} /><meshStandardMaterial color="#ffdfae" roughness={0.8} /></mesh>
      <mesh position={[-0.2, 1.07, 0.39]}><boxGeometry args={[0.085, 0.09, 0.025]} /><meshBasicMaterial color="#262031" /></mesh>
      <mesh position={[0.2, 1.07, 0.39]}><boxGeometry args={[0.085, 0.09, 0.025]} /><meshBasicMaterial color="#262031" /></mesh>
      <mesh position={[0, 0.79, 0.39]}><boxGeometry args={[0.25, 0.05, 0.025]} /><meshBasicMaterial color="#ab655a" /></mesh>
      {variant === 0 && <mesh position={[0, 1.44, 0]}><boxGeometry args={[1.02, 0.2, 0.87]} /><meshStandardMaterial color="#2d2435" /></mesh>}
      {variant === 1 && <mesh position={[0, 1.41, -0.08]}><coneGeometry args={[0.32, 0.5, 5]} /><meshStandardMaterial color="#2d2435" /></mesh>}
      <group ref={leftArm} position={[-0.9, 0.45, 0]}><mesh castShadow position={[0, -0.4, 0]}><boxGeometry args={[0.43, 0.88, 0.5]} /><meshStandardMaterial color={player.color} /></mesh></group>
      <group ref={rightArm} position={[0.9, 0.45, 0]}><mesh castShadow position={[0, -0.4, 0]}><boxGeometry args={[0.43, 0.88, 0.5]} /><meshStandardMaterial color={player.color} /></mesh></group>
    </group>
    <group ref={leftLeg} position={[-0.31, 0.9, 0]}><mesh castShadow position={[0, -0.42, 0]}><boxGeometry args={[0.51, 0.86, 0.55]} /><meshStandardMaterial color="#39435c" /></mesh><mesh castShadow position={[0, -0.77, 0.17]}><boxGeometry args={[0.56, 0.22, 0.74]} /><meshStandardMaterial color="#252839" /></mesh></group>
    <group ref={rightLeg} position={[0.31, 0.9, 0]}><mesh castShadow position={[0, -0.42, 0]}><boxGeometry args={[0.51, 0.86, 0.55]} /><meshStandardMaterial color="#39435c" /></mesh><mesh castShadow position={[0, -0.77, 0.17]}><boxGeometry args={[0.56, 0.22, 0.74]} /><meshStandardMaterial color="#252839" /></mesh></group>
    <NameTag name={player.name} bubble={bubble} />
  </group>;
}

function CameraAim() {
  const { camera } = useThree();
  useEffect(() => { camera.lookAt(0, 0, 0); }, [camera]);
  return null;
}

function Scene({ players, bubbles }: { players: Player[]; bubbles: Record<string, string> }) {
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 19, 22], fov: 44, near: 0.1, far: 100 }}>
    <CameraAim />
    <color attach="background" args={["#90cbe5"]} />
    <ambientLight intensity={1.35} />
    <directionalLight position={[8, 18, 6]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[30, 22]} /><meshStandardMaterial color="#91da9c" />
    </mesh>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
      <planeGeometry args={[17, 10]} /><meshStandardMaterial color="#f8dca6" />
    </mesh>
    {[-1, 1].map((side) => <group key={side} position={[side * 10.5, 0, -4]}>
      <mesh castShadow position={[0, 0.7, 0]}><cylinderGeometry args={[0.18, 0.22, 1.4]} /><meshStandardMaterial color="#9f695a" /></mesh>
      <mesh castShadow position={[0, 2.05, 0]}><dodecahedronGeometry args={[1.18, 0]} /><meshStandardMaterial color={side === 1 ? "#78bf82" : "#79c69f"} /></mesh>
    </group>)}
    <mesh position={[-8.5, 0.4, 5.5]} castShadow><boxGeometry args={[2.2, 0.8, 1]} /><meshStandardMaterial color="#f47571" /></mesh>
    <mesh position={[8.5, 0.4, 5.5]} castShadow><boxGeometry args={[2.2, 0.8, 1]} /><meshStandardMaterial color="#73a9ee" /></mesh>
    {players.map((player) => <Avatar key={player.id} player={player} bubble={bubbles[player.id]} />)}
  </Canvas>;
}

export default function Game() {
  const [name, setName] = useState("");
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [ownId, setOwnId] = useState<string | null>(null);
  const [roomNumber, setRoomNumber] = useState<number | null>(null);
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [joystick, setJoystick] = useState({ x: 0, z: 0 });
  const roomRef = useRef<Room | null>(null);
  const playersRef = useRef<Record<string, Player>>({});
  const ownIdRef = useRef<string | null>(null);
  const mutedRef = useRef(false);
  const activeAudio = useRef(0);
  const keys = useRef(new Set<string>());
  const joystickRef = useRef({ x: 0, z: 0 });
  const bubbleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { ownIdRef.current = ownId; }, [ownId]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const refreshRooms = useCallback(async () => {
    try {
      const response = await fetch(`${GAME_SERVER}/rooms`, { cache: "no-store" });
      if (!response.ok) throw new Error("room list unavailable");
      const data = await response.json() as { rooms: RoomInfo[] };
      setRooms(data.rooms);
      setError("");
    } catch {
      if (!roomRef.current) setError("놀이터 서버에 연결할 수 없어. 잠시 후 다시 시도해 줘.");
    }
  }, []);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const requested = Number(parameters.get("room"));
    if (requested >= 1 && requested <= 5) setSelectedRoom(requested);
    void refreshRooms();
    const timer = setInterval(() => void refreshRooms(), 5000);
    return () => clearInterval(timer);
  }, [refreshRooms]);

  const playDance = useCallback((id: DanceId, dancerId: string) => {
    if (mutedRef.current || activeAudio.current >= 3) return;
    const dancer = playersRef.current[dancerId];
    const self = playersRef.current[ownIdRef.current || ""];
    if (dancerId !== ownIdRef.current && (!dancer || !self || Math.hypot(dancer.x - self.x, dancer.z - self.z) > 7)) return;
    const dance = DANCES.find((item) => item.id === id);
    if (!dance) return;
    const audio = new Audio(dance.audio);
    audio.volume = dancerId === ownIdRef.current ? 0.8 : 0.35;
    activeAudio.current += 1;
    const finished = () => { activeAudio.current = Math.max(0, activeAudio.current - 1); };
    audio.addEventListener("ended", finished, { once: true });
    audio.addEventListener("error", finished, { once: true });
    void audio.play().catch(finished);
  }, []);

  const join = useCallback(async (requestedRoom?: number) => {
    const nickname = name.trim();
    if (nickname.length < 2 || nickname.length > 12 || !/^[\p{L}\p{N}_ ]+$/u.test(nickname)) {
      setError("닉네임은 한글·영문·숫자로 2~12자만 써 줘.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${GAME_SERVER}/rooms`, { cache: "no-store" });
      if (!response.ok) throw new Error("서버에 연결할 수 없어.");
      const available = (await response.json() as { rooms: RoomInfo[] }).rooms;
      setRooms(available);
      const chosen = requestedRoom
        ? available.find((item) => item.number === requestedRoom)
        : [...available].filter((item) => item.count < item.capacity)
            .sort((left, right) => right.count - left.count || left.number - right.number)[0];
      if (!chosen || chosen.count >= chosen.capacity) throw new Error("방이 가득 찼어. 다른 방을 골라 줘.");
      const previous = roomRef.current;
      roomRef.current = null;
      if (previous) await previous.leave();
      setRoomNumber(null);
      setOwnId(null);
      setPlayers({});
      const client = new Client(GAME_SERVER);
      const source = new URLSearchParams(window.location.search).get("src");
      const room = await client.joinById(chosen.id, { name: nickname, source: source === "openchat" ? source : undefined });
      roomRef.current = room;
      room.onMessage("player-joined", (player: Player) => {
        setPlayers((current) => ({ ...current, [player.id]: player }));
      });
      room.onMessage("player-left", ({ id }: { id: string }) => {
        setPlayers((current) => { const next = { ...current }; delete next[id]; return next; });
      });
      room.onMessage("player-moved", (update: Pick<Player, "id" | "x" | "z" | "facing" | "dance">) => {
        setPlayers((current) => current[update.id]
          ? { ...current, [update.id]: { ...current[update.id], ...update } }
          : current);
      });
      room.onMessage("player-danced", ({ id, dance }: { id: string; dance: DanceId | null }) => {
        setPlayers((current) => current[id]
          ? { ...current, [id]: { ...current[id], dance } }
          : current);
        if (dance) playDance(dance, id);
      });
      room.onMessage("bubble", ({ id, text }: { id: string; text: string }) => {
        setBubbles((current) => ({ ...current, [id]: text }));
        if (bubbleTimers.current[id]) clearTimeout(bubbleTimers.current[id]);
        bubbleTimers.current[id] = setTimeout(() => {
          setBubbles((current) => { const next = { ...current }; delete next[id]; return next; });
        }, 2600);
      });
      room.onLeave(() => {
        if (roomRef.current !== room) return;
        roomRef.current = null;
        setRoomNumber(null);
        setOwnId(null);
        setPlayers({});
        setError("연결이 끊겼어. 다시 들어가 줘.");
      });
      room.onDrop(() => setError("연결을 다시 시도하는 중..."));
      room.onReconnect(() => setError(""));
      const snapshot = await room.request("snapshot") as Snapshot;
      setPlayers(Object.fromEntries(snapshot.players.map((player) => [player.id, player])));
      setOwnId(snapshot.id);
      setRoomNumber(snapshot.number);
      window.history.replaceState(null, "", `/?room=${snapshot.number}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "입장하지 못했어. 다시 시도해 줘.");
    } finally {
      setBusy(false);
    }
  }, [name, playDance]);

  useEffect(() => {
    if (!roomNumber) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        keys.current.add(event.key);
      }
      if (event.repeat || event.target instanceof HTMLInputElement) return;
      const dance = DANCES.find((item) => item.key.toLowerCase() === event.key.toLowerCase());
      if (dance) roomRef.current?.send("dance", dance.id);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.key);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const timer = setInterval(() => {
      let x = joystickRef.current.x;
      let z = joystickRef.current.z;
      if (keys.current.has("ArrowLeft")) x -= 1;
      if (keys.current.has("ArrowRight")) x += 1;
      if (keys.current.has("ArrowUp")) z -= 1;
      if (keys.current.has("ArrowDown")) z += 1;
      if (Math.hypot(x, z) > 0.08) roomRef.current?.send("move", { x, z });
    }, 100);
    return () => {
      clearInterval(timer);
      keys.current.clear();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [roomNumber]);

  const leave = async () => {
    const room = roomRef.current;
    roomRef.current = null;
    setRoomNumber(null);
    setOwnId(null);
    setPlayers({});
    window.history.replaceState(null, "", "/");
    if (room) await room.leave();
  };

  const copyLink = async () => {
    if (!roomNumber) return;
    await navigator.clipboard.writeText(`${window.location.origin}/?room=${roomNumber}`);
    roomRef.current?.send("share");
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const moveJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rectangle = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rectangle.left - rectangle.width / 2) / (rectangle.width / 2);
    const z = (event.clientY - rectangle.top - rectangle.height / 2) / (rectangle.height / 2);
    const length = Math.max(1, Math.hypot(x, z));
    const next = { x: x / length, z: z / length };
    joystickRef.current = next;
    setJoystick(next);
  };
  const releaseJoystick = () => {
    joystickRef.current = { x: 0, z: 0 };
    setJoystick({ x: 0, z: 0 });
  };

  const playerList = Object.values(players);
  const currentDance = ownId ? players[ownId]?.dance : null;

  return <>
    <div className="game-shell">
      <section className="stage-panel" aria-label="춤추는 놀이터">
        <div className="stage-canvas"><Scene players={roomNumber ? playerList : DEMO_PLAYERS} bubbles={bubbles} /></div>
        <div className="brand-badge"><span className="brand-icon">L</span><span>TAKE THE L</span></div>
        {!roomNumber ? <form className="join-panel" onSubmit={(event) => { event.preventDefault(); void join(selectedRoom ?? undefined); }}>
          <h1>L을 가져가!</h1>
          <label htmlFor="nickname">닉네임</label>
          <input id="nickname" autoComplete="off" maxLength={12} value={name}
            onChange={(event) => setName(event.target.value)} placeholder="닉네임을 써 줘" />
          <div className="room-grid" aria-label="공개방 선택">
            {Array.from({ length: 5 }, (_, index) => {
              const info = rooms.find((item) => item.number === index + 1);
              const full = info ? info.count >= info.capacity : false;
              return <button key={index} type="button" disabled={full}
                aria-pressed={selectedRoom === index + 1}
                className={`room-pill ${selectedRoom === index + 1 ? "selected" : ""}`}
                onClick={() => setSelectedRoom(selectedRoom === index + 1 ? null : index + 1)}>
                <strong>{index + 1}</strong><small>{info ? info.count : "—"}/20</small>
              </button>;
            })}
          </div>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "입장 중..." : "들어가기 ↗"}</button>
          {error && <p role="alert" className="error-text">{error} <button type="button" onClick={() => void refreshRooms()}>다시 연결</button></p>}
        </form> : <div className="game-hud">
          <div className="room-badge"><span className="live-dot" /> {roomNumber}번방 <small>{playerList.length}/20</small></div>
          <details className="playing-menu">
            <summary aria-label="게임 메뉴">☰</summary>
            <div className="menu-body">
              <div className="playing-actions">
                <button onClick={() => void copyLink()}>{copied ? "복사했어!" : "링크 복사"}</button>
                <button onClick={() => setMuted(!muted)}>{muted ? "소리 켜기" : "소리 끄기"}</button>
                <button onClick={() => void leave()}>나가기</button>
              </div>
              <div className="bubble-panel"><span>말풍선</span><div>{BUBBLES.map((text) => <button key={text} onClick={() => roomRef.current?.send("bubble", text)}>{text}</button>)}</div></div>
              <div className="room-switch"><span>방 바꾸기</span><div>{rooms.map((info) => <button key={info.number} disabled={busy || info.count >= info.capacity || info.number === roomNumber}
                onClick={() => void join(info.number)}>{info.number}</button>)}</div></div>
              {error && <p role="alert" className="error-text">{error}</p>}
            </div>
          </details>
        </div>}
        {roomNumber && <>
          <div className="dance-tray">{DANCES.map((dance) => <button key={dance.id}
            className={currentDance === dance.id ? "active" : ""}
            onClick={() => roomRef.current?.send("dance", dance.id)}>
            <kbd>{dance.key}</kbd><span>{dance.title}</span>
          </button>)}</div>
          <div className="joystick" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); moveJoystick(event); }}
            onPointerMove={(event) => { if (event.buttons) moveJoystick(event); }}
            onPointerUp={releaseJoystick} onPointerCancel={releaseJoystick}>
            <div className="joystick-knob" style={{ transform: `translate(${joystick.x * 31}px, ${joystick.z * 31}px)` }} />
          </div>
        </>}
      </section>
    </div>
    <div className="rotate-overlay"><div className="rotate-icon">↻</div><h2>휴대폰을 가로로 돌려 줘!</h2></div>
  </>;
}
