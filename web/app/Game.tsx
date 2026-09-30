"use client";

import { Client, type Room } from "@colyseus/sdk";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group, Mesh, Sprite, Texture } from "three";
import { CanvasTexture, LinearFilter, Vector3 } from "three";

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
type AudioLevels = { music: number; voice: number };
const DEFAULT_AUDIO_LEVELS: AudioLevels = { music: 0.7, voice: 0.4 };

const GAME_SERVER = process.env.NEXT_PUBLIC_GAME_SERVER;
function gameServerUrl() {
  return GAME_SERVER || `http://${window.location.hostname}:2567`;
}
const DANCES: { id: DanceId; key: string; title: string; audio: string }[] = [
  { id: "take-l", key: "Q", title: "L을 가져가", audio: "/audio/take-l.m4a" },
  { id: "honey", key: "W", title: "크림치즈허니", audio: "/audio/honey.m4a" },
  { id: "vegetable", key: "E", title: "야채", audio: "/audio/vegetable.m4a" },
  { id: "selfie", key: "R", title: "셀카", audio: "/audio/selfie.m4a" },
  { id: "criss-cross", key: "T", title: "크리스크로스", audio: "/audio/criss-cross.m4a" },
];
const BUBBLES = ["L을 가져가!", "같이 춤춰!", "ㅋㅋㅋ", "안녕!", "한 번 더!"];
function randomNickname() {
  const adjectives = ["춤추는", "신나는", "말랑한", "통통한", "엉뚱한", "반짝이는"];
  const friends = ["감자", "치즈", "오리", "당근", "만두", "두부"];
  const pick = (items: string[]) => items[Math.floor(Math.random() * items.length)];
  return `${pick(adjectives)}${pick(friends)}${Math.floor(Math.random() * 900) + 100}`;
}
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
      <sprite position={[0, 3.22, 0]} scale={[1.8, 0.45, 1]}>
        <spriteMaterial map={nameTexture} transparent depthTest={false} />
      </sprite>
      {bubbleTexture && <sprite position={[0, 3.8, 0]} scale={[2.1, 0.52, 1]}>
        <spriteMaterial map={bubbleTexture} transparent depthTest={false} />
      </sprite>}
    </>
  );
}

type Point = [number, number, number];
type Pose = {
  hop: number;
  lean: number;
  turn: number;
  headTilt: number;
  bodySway: number;
  bodyPitch: number;
  headPitch: number;
  leftKnee: number;
  rightKnee: number;
  leftFoot: number;
  rightFoot: number;
  leftElbow: Point;
  leftHand: Point;
  rightElbow: Point;
  rightHand: Point;
  leftLegLift: number;
  rightLegLift: number;
  leftLegSwing: number;
  rightLegSwing: number;
  leftLegSpread: number;
  rightLegSpread: number;
};

const DANCE_SECONDS: Record<DanceId, number> = {
  "take-l": 3.24,
  honey: 2.32,
  vegetable: 2.17,
  selfie: 1.68,
  "criss-cross": 1.98,
};

function createPose(): Pose {
  return {
    hop: 0,
    lean: 0,
    turn: 0,
    headTilt: 0,
    bodySway: 0, bodyPitch: 0, headPitch: 0,
    leftKnee: 0, rightKnee: 0, leftFoot: 0, rightFoot: 0,
    leftElbow: [-1.05, -0.05, 0], leftHand: [-1.02, -0.57, 0.03],
    rightElbow: [1.05, -0.05, 0], rightHand: [1.02, -0.57, 0.03],
    leftLegLift: 0, rightLegLift: 0,
    leftLegSwing: 0, rightLegSwing: 0,
    leftLegSpread: 0, rightLegSpread: 0,
  };
}

function setPoint(point: Point, x: number, y: number, z: number) {
  point[0] = x;
  point[1] = y;
  point[2] = z;
}

const poseNumbers = ["hop", "lean", "turn", "headTilt", "bodySway", "bodyPitch", "headPitch", "leftKnee", "rightKnee", "leftFoot", "rightFoot", "leftLegLift", "rightLegLift", "leftLegSwing", "rightLegSwing", "leftLegSpread", "rightLegSpread"] as const;
const posePoints = ["leftElbow", "leftHand", "rightElbow", "rightHand"] as const;

function blendPose(current: Pose, target: Pose, amount: number) {
  for (const key of poseNumbers) current[key] += (target[key] - current[key]) * amount;
  for (const key of posePoints) {
    for (let axis = 0; axis < 3; axis++) current[key][axis] += (target[key][axis] - current[key][axis]) * amount;
  }
}

function smoothBeat(value: number) {
  const blend = Math.max(0, Math.min(1, 0.5 + value / 0.9));
  return blend * blend * (3 - 2 * blend);
}

// Reuse the same pose and points instead of creating arrays for every rendered frame.
function dancePose(dance: DanceId | null, seconds: number, pose: Pose) {
  for (const key of poseNumbers) pose[key] = 0;
  pose.hop = Math.sin(seconds * 2) * 0.025;
  setPoint(pose.leftElbow, -1.05, -0.05, 0);
  setPoint(pose.leftHand, -1.02, -0.57, 0.03);
  setPoint(pose.rightElbow, 1.05, -0.05, 0);
  setPoint(pose.rightHand, 1.02, -0.57, 0.03);
  if (!dance) return;

  const cycle = seconds / DANCE_SECONDS[dance] * Math.PI * 2;
  if (dance === "take-l") {
    const kick = Math.sin(cycle * 2);
    const left = Math.max(0, kick);
    const right = Math.max(0, -kick);
    const recoil = 0.5 + 0.5 * Math.cos(cycle * 4);
    pose.hop = 0.02 + recoil * 0.18;
    pose.bodySway = -kick * 0.14;
    pose.bodyPitch = -0.06 + recoil * 0.07;
    pose.lean = kick * 0.15;
    pose.turn = kick * 0.1;
    pose.headTilt = -0.1;
    pose.headPitch = recoil * 0.04;
    pose.leftLegSwing = -left * 1.05 - recoil * 0.12;
    pose.rightLegSwing = -right * 1.05 - recoil * 0.12;
    pose.leftKnee = 0.15 + recoil * 0.65 * (1 - left);
    pose.rightKnee = 0.15 + recoil * 0.65 * (1 - right);
    pose.leftFoot = -left * 0.22;
    pose.rightFoot = -right * 0.22;
    pose.leftLegSpread = -0.08 - left * 0.32;
    pose.rightLegSpread = 0.08 + right * 0.32;
    setPoint(pose.leftElbow, -0.87, -0.18, 0.18);
    setPoint(pose.leftHand, -0.2, -0.56, 0.45);
    setPoint(pose.rightElbow, 1.26, 0.68, 0.04);
    setPoint(pose.rightHand, 0.25, 1.33, 0.55);
    return;
  }
  if (dance === "honey") {
    const pump = Math.sin(cycle * 3);
    const sway = Math.sin(cycle);
    const crouch = 0.5 - pump * 0.5;
    pose.hop = -crouch * 0.13 + Math.max(0, pump) * 0.11;
    pose.bodySway = sway * 0.22;
    pose.bodyPitch = crouch * 0.12;
    pose.headPitch = -crouch * 0.08;
    pose.lean = -sway * 0.12;
    pose.turn = sway * 0.15;
    pose.leftLegSwing = -0.12 - crouch * 0.38;
    pose.rightLegSwing = -0.12 - crouch * 0.38;
    pose.leftKnee = 0.24 + crouch * 0.76;
    pose.rightKnee = 0.24 + crouch * 0.76;
    pose.leftLegLift = Math.max(0, sway) * 0.08;
    pose.rightLegLift = Math.max(0, -sway) * 0.08;
    pose.leftFoot = -pose.leftLegSwing - pose.leftKnee;
    pose.rightFoot = -pose.rightLegSwing - pose.rightKnee;
    pose.leftLegSpread = -0.15 - Math.max(0, sway) * 0.15;
    pose.rightLegSpread = 0.15 + Math.max(0, -sway) * 0.15;
    setPoint(pose.leftElbow, -1.38, 0.54, 0.05);
    setPoint(pose.leftHand, -1.16, 1.12 + pump * 0.2, 0.18);
    setPoint(pose.rightElbow, 1.38, 0.54, 0.05);
    setPoint(pose.rightHand, 1.16, 1.12 + pump * 0.2, 0.18);
    return;
  }
  if (dance === "criss-cross") {
    const cross = smoothBeat(Math.sin(cycle * 2));
    const bounce = 0.5 + 0.5 * Math.cos(cycle * 4);
    const lead = Math.sin(cycle);
    pose.hop = 0.02 + bounce * 0.2;
    pose.bodySway = lead * 0.1;
    pose.bodyPitch = bounce * 0.1;
    pose.headPitch = -bounce * 0.07;
    pose.lean = lead * 0.1;
    pose.turn = Math.sin(cycle * 2) * 0.12;
    pose.leftLegSpread = -0.4 + cross * 0.95;
    pose.rightLegSpread = 0.4 - cross * 0.95;
    pose.leftLegSwing = -0.22 - lead * cross * 0.35;
    pose.rightLegSwing = -0.22 + lead * cross * 0.35;
    pose.leftKnee = 0.2 + bounce * 0.48;
    pose.rightKnee = 0.2 + bounce * 0.48;
    pose.leftFoot = -0.12 - lead * 0.18;
    pose.rightFoot = -0.12 + lead * 0.18;
    setPoint(pose.leftElbow, -1.3 + cross * 0.9, 0.04 + cross * 0.09, 0.1 + cross * 0.25);
    setPoint(pose.leftHand, -1.72 + cross * 2.2, -0.25 + cross * 0.37, 0.15 + cross * 0.4);
    setPoint(pose.rightElbow, 1.3 - cross * 0.9, 0.04 + cross * 0.09, 0.1 + cross * 0.35);
    setPoint(pose.rightHand, 1.72 - cross * 2.2, -0.25 + cross * 0.37, 0.15 + cross * 0.5);
    return;
  }
  if (dance === "vegetable") {
    const step = Math.sin(cycle * 2);
    const leftStep = smoothBeat(step);
    const leftLift = Math.max(0, step);
    const rightLift = Math.max(0, -step);
    pose.hop = 0.02 + (0.5 + 0.5 * Math.cos(cycle * 4)) * 0.13;
    pose.bodySway = -step * 0.13;
    pose.bodyPitch = Math.abs(step) * 0.1;
    pose.headPitch = -Math.abs(step) * 0.06;
    pose.lean = -0.12 + leftStep * 0.24;
    pose.turn = -0.1 + leftStep * 0.2;
    pose.leftLegSwing = -1.2 * leftLift;
    pose.rightLegSwing = -1.2 * rightLift;
    pose.leftKnee = 0.15 + leftLift * 1.15;
    pose.rightKnee = 0.15 + rightLift * 1.15;
    pose.leftFoot = -leftLift * 0.22;
    pose.rightFoot = -rightLift * 0.22;
    pose.leftLegSpread = -leftLift * 0.12;
    pose.rightLegSpread = rightLift * 0.12;
    setPoint(pose.leftElbow, -1.1 - leftStep * 0.22, -0.16 + leftStep * 0.64, leftStep * 0.1);
    setPoint(pose.leftHand, -1.02 - leftStep * 0.12, -0.57 + leftStep * 1.59, 0.02 + leftStep * 0.23);
    setPoint(pose.rightElbow, 1.32 - leftStep * 0.22, 0.48 - leftStep * 0.64, 0.1 - leftStep * 0.1);
    setPoint(pose.rightHand, 1.14 - leftStep * 0.12, 1.02 - leftStep * 1.59, 0.25 - leftStep * 0.23);
    return;
  }

  const sway = Math.sin(cycle * 2);
  const tap = 0.5 + 0.5 * Math.cos(cycle * 4);
  pose.hop = 0.01 + tap * 0.06;
  pose.bodySway = sway * 0.22;
  pose.bodyPitch = tap * 0.04;
  pose.headPitch = -tap * 0.04;
  pose.lean = -0.12 + sway * 0.07;
  pose.turn = -0.16 + sway * 0.08;
  pose.headTilt = 0.11 + sway * 0.06;
  pose.leftLegSwing = -0.1 - Math.max(0, sway) * 0.28;
  pose.rightLegSwing = -0.1 - Math.max(0, -sway) * 0.28;
  pose.leftKnee = 0.15 + Math.max(0, sway) * 0.4;
  pose.rightKnee = 0.15 + Math.max(0, -sway) * 0.4;
  pose.leftLegSpread = -0.06 - Math.max(0, sway) * 0.22;
  pose.rightLegSpread = 0.06 + Math.max(0, -sway) * 0.22;
  pose.leftFoot = -pose.leftLegSwing - pose.leftKnee + tap * 0.08;
  pose.rightFoot = -pose.rightLegSwing - pose.rightKnee + tap * 0.08;
  setPoint(pose.leftElbow, -0.87, -0.08, 0.1);
  setPoint(pose.leftHand, -0.72, -0.49, 0.38);
  setPoint(pose.rightElbow, 1.42, 0.68, 0.43);
  setPoint(pose.rightHand, 2.08, 1.25, 1.1);
}

const shoulderLeft = new Vector3(-0.9, 0.46, 0);
const shoulderRight = new Vector3(0.9, 0.46, 0);
const down = new Vector3(0, -1, 0);
const segmentStart = new Vector3();
const segmentEnd = new Vector3();

function pointToSegment(mesh: Mesh | null, start: Vector3 | Point, end: Point) {
  if (!mesh) return;
  if (start instanceof Vector3) segmentStart.copy(start);
  else segmentStart.set(...start);
  segmentEnd.set(...end);
  mesh.position.copy(segmentStart).add(segmentEnd).multiplyScalar(0.5);
  segmentEnd.sub(segmentStart);
  const length = segmentEnd.length();
  mesh.quaternion.setFromUnitVectors(down, segmentEnd.divideScalar(length));
  mesh.scale.y = length;
}

// Lowest corner of the shoe after hip, knee and ankle rotation, in avatar space.
function shoeBottom(swing: number, spread: number, knee: number, ankle: number, lift: number) {
  const hipY = Math.cos(swing) * Math.cos(spread);
  const hipZ = Math.sin(swing);
  const footAngle = knee + ankle;
  const footY = hipY * Math.cos(footAngle) - hipZ * Math.sin(footAngle);
  const footZ = -hipY * Math.sin(footAngle) - hipZ * Math.cos(footAngle);
  return 0.9 + lift - 0.43 * hipY
    - 0.34 * (hipY * Math.cos(knee) - hipZ * Math.sin(knee)) + 0.17 * footZ
    - 0.28 * Math.abs(Math.cos(swing) * Math.sin(spread))
    - 0.11 * Math.abs(footY) - 0.37 * Math.abs(footZ);
}

const Avatar = memo(function Avatar({ player, bubble }: { player: Player; bubble?: string }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const leftUpperArm = useRef<Mesh>(null);
  const leftForearm = useRef<Mesh>(null);
  const rightUpperArm = useRef<Mesh>(null);
  const rightForearm = useRef<Mesh>(null);
  const leftHand = useRef<Group>(null);
  const rightHand = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftKnee = useRef<Group>(null);
  const rightKnee = useRef<Group>(null);
  const leftFoot = useRef<Group>(null);
  const rightFoot = useRef<Group>(null);
  const previousDance = useRef<DanceId | null>(player.dance);
  const danceStartedAt = useRef(0);
  const currentPose = useMemo(createPose, []);
  const targetPose = useMemo(createPose, []);
  const variant = useMemo(() => player.id.charCodeAt(0) % 3, [player.id]);

  useFrame(({ clock }, delta) => {
    if (!root.current || !torso.current || !head.current || !leftLeg.current || !rightLeg.current) return;
    const t = clock.elapsedTime;
    if (previousDance.current !== player.dance) {
      previousDance.current = player.dance;
      danceStartedAt.current = t;
    }
    dancePose(player.dance, t - danceStartedAt.current, targetPose);
    blendPose(currentPose, targetPose, 1 - Math.exp(-22 * delta));
    const pose = currentPose;
    const movementBlend = 1 - Math.exp(-12 * delta);
    root.current.position.x += (player.x - root.current.position.x) * movementBlend;
    root.current.position.z += (player.z - root.current.position.z) * movementBlend;
    const facingDelta = player.facing - root.current.rotation.y;
    root.current.rotation.y += Math.atan2(Math.sin(facingDelta), Math.cos(facingDelta)) * movementBlend;
    const floor = Math.min(
      shoeBottom(pose.leftLegSwing, pose.leftLegSpread, pose.leftKnee, pose.leftFoot, pose.leftLegLift),
      shoeBottom(pose.rightLegSwing, pose.rightLegSpread, pose.rightKnee, pose.rightFoot, pose.rightLegLift),
    );
    root.current.position.y = Math.max(pose.hop, 0.02 - floor);
    if (body.current) body.current.position.x = pose.bodySway;
    torso.current.rotation.z = pose.lean;
    torso.current.rotation.y = pose.turn;
    torso.current.rotation.x = pose.bodyPitch;
    head.current.rotation.z = pose.headTilt;
    head.current.rotation.x = pose.headPitch;
    pointToSegment(leftUpperArm.current, shoulderLeft, pose.leftElbow);
    pointToSegment(leftForearm.current, pose.leftElbow, pose.leftHand);
    pointToSegment(rightUpperArm.current, shoulderRight, pose.rightElbow);
    pointToSegment(rightForearm.current, pose.rightElbow, pose.rightHand);
    leftHand.current?.position.set(...pose.leftHand);
    rightHand.current?.position.set(...pose.rightHand);
    leftLeg.current.position.y = 0.9 + pose.leftLegLift;
    rightLeg.current.position.y = 0.9 + pose.rightLegLift;
    leftLeg.current.rotation.x = pose.leftLegSwing;
    rightLeg.current.rotation.x = pose.rightLegSwing;
    leftLeg.current.rotation.z = pose.leftLegSpread;
    rightLeg.current.rotation.z = pose.rightLegSpread;
    if (leftKnee.current) leftKnee.current.rotation.x = pose.leftKnee;
    if (rightKnee.current) rightKnee.current.rotation.x = pose.rightKnee;
    if (leftFoot.current) leftFoot.current.rotation.x = pose.leftFoot;
    if (rightFoot.current) rightFoot.current.rotation.x = pose.rightFoot;
  });

  return <group ref={root} position={[player.x, 0, player.z]}>
    <group ref={body}>
    <group ref={torso} position={[0, 1.45, 0]}>
      <mesh castShadow position={[0, 0, 0]}><boxGeometry args={[1.34, 1.18, 0.78]} /><meshStandardMaterial color={player.color} roughness={0.7} /></mesh>
      <group ref={head} position={[0, 0.98, 0]}>
        <mesh castShadow><boxGeometry args={[0.95, 0.83, 0.77]} /><meshStandardMaterial color="#ffdfae" roughness={0.8} /></mesh>
        <mesh position={[-0.2, 0.09, 0.39]}><boxGeometry args={[0.085, 0.09, 0.025]} /><meshBasicMaterial color="#262031" /></mesh>
        <mesh position={[0.2, 0.09, 0.39]}><boxGeometry args={[0.085, 0.09, 0.025]} /><meshBasicMaterial color="#262031" /></mesh>
        <mesh position={[0, -0.19, 0.39]}><boxGeometry args={[0.25, player.dance ? 0.13 : 0.05, 0.025]} /><meshBasicMaterial color="#ab655a" /></mesh>
        {variant === 0 && <mesh position={[0, 0.46, 0]}><boxGeometry args={[1.02, 0.2, 0.87]} /><meshStandardMaterial color="#2d2435" /></mesh>}
        {variant === 1 && <mesh position={[0, 0.43, -0.08]}><coneGeometry args={[0.32, 0.5, 5]} /><meshStandardMaterial color="#2d2435" /></mesh>}
      </group>
      <mesh ref={leftUpperArm} castShadow><boxGeometry args={[0.46, 1, 0.52]} /><meshStandardMaterial color={player.color} /></mesh>
      <mesh ref={leftForearm} castShadow><boxGeometry args={[0.4, 1, 0.48]} /><meshStandardMaterial color={player.color} /></mesh>
      <mesh ref={rightUpperArm} castShadow><boxGeometry args={[0.46, 1, 0.52]} /><meshStandardMaterial color={player.color} /></mesh>
      <mesh ref={rightForearm} castShadow><boxGeometry args={[0.4, 1, 0.48]} /><meshStandardMaterial color={player.color} /></mesh>
      <group ref={leftHand}><mesh castShadow><boxGeometry args={[0.4, 0.22, 0.48]} /><meshStandardMaterial color="#ffdfae" /></mesh></group>
      <group ref={rightHand}>
        {player.dance === "take-l" ? <group scale={[-1, 1, 1]}>
          <mesh castShadow><boxGeometry args={[0.35, 0.3, 0.48]} /><meshStandardMaterial color="#ffdfae" /></mesh>
          <mesh castShadow position={[-0.09, 0.25, 0]}><boxGeometry args={[0.14, 0.37, 0.28]} /><meshStandardMaterial color="#ffdfae" /></mesh>
          <mesh castShadow position={[0.21, 0.08, 0]}><boxGeometry args={[0.35, 0.14, 0.28]} /><meshStandardMaterial color="#ffdfae" /></mesh>
        </group> : <mesh castShadow><boxGeometry args={[0.4, 0.22, 0.48]} /><meshStandardMaterial color="#ffdfae" /></mesh>}
        {player.dance === "selfie" && <mesh position={[0.06, 0.18, 0.08]} rotation={[0, 0, 0.25]}><boxGeometry args={[0.28, 0.46, 0.07]} /><meshStandardMaterial color="#272237" /></mesh>}
      </group>
    </group>
    <group ref={leftLeg} position={[-0.31, 0.9, 0]}>
      <mesh castShadow position={[0, -0.215, 0]}><boxGeometry args={[0.51, 0.43, 0.55]} /><meshStandardMaterial color="#39435c" /></mesh>
      <group ref={leftKnee} position={[0, -0.43, 0]}>
        <mesh castShadow position={[0, -0.215, 0]}><boxGeometry args={[0.5, 0.43, 0.54]} /><meshStandardMaterial color="#39435c" /></mesh>
        <group ref={leftFoot} position={[0, -0.34, 0]}><mesh castShadow position={[0, 0, 0.17]}><boxGeometry args={[0.56, 0.22, 0.74]} /><meshStandardMaterial color="#252839" /></mesh></group>
      </group>
    </group>
    <group ref={rightLeg} position={[0.31, 0.9, 0]}>
      <mesh castShadow position={[0, -0.215, 0]}><boxGeometry args={[0.51, 0.43, 0.55]} /><meshStandardMaterial color="#39435c" /></mesh>
      <group ref={rightKnee} position={[0, -0.43, 0]}>
        <mesh castShadow position={[0, -0.215, 0]}><boxGeometry args={[0.5, 0.43, 0.54]} /><meshStandardMaterial color="#39435c" /></mesh>
        <group ref={rightFoot} position={[0, -0.34, 0]}><mesh castShadow position={[0, 0, 0.17]}><boxGeometry args={[0.56, 0.22, 0.74]} /><meshStandardMaterial color="#252839" /></mesh></group>
      </group>
    </group>
    </group>
    <NameTag name={player.name} bubble={bubble} />
  </group>;
});

function CameraAim({ focus }: { focus?: Player }) {
  const { camera, size } = useThree();
  const target = useRef(new Vector3());
  const lookTarget = useRef(new Vector3());
  const desiredLookTarget = useRef(new Vector3());
  useFrame((_, delta) => {
    const x = focus?.x ?? 0;
    const z = focus?.z ?? 0;
    const portrait = size.height > size.width;
    target.current.set(x, focus ? (portrait ? 11 : 9) : 19, z + (focus ? (portrait ? 14 : 11) : 22));
    const blend = 1 - Math.exp(-4 * delta);
    camera.position.lerp(target.current, blend);
    desiredLookTarget.current.set(x, 0, z);
    lookTarget.current.lerp(desiredLookTarget.current, blend);
    camera.lookAt(lookTarget.current);
  });
  return null;
}

function Scene({ players, bubbles, focus }: { players: Player[]; bubbles: Record<string, string>; focus?: Player }) {
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 19, 22], fov: 44, near: 0.1, far: 100 }}>
    <CameraAim focus={focus} />
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
  const [name, setName] = useState(randomNickname);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [ownId, setOwnId] = useState<string | null>(null);
  const [roomNumber, setRoomNumber] = useState<number | null>(null);
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const [muted, setMuted] = useState(false);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>(DEFAULT_AUDIO_LEVELS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [joystick, setJoystick] = useState({ x: 0, z: 0 });
  const roomRef = useRef<Room | null>(null);
  const playersRef = useRef<Record<string, Player>>({});
  const ownIdRef = useRef<string | null>(null);
  const mutedRef = useRef(false);
  const audioLevelsRef = useRef<AudioLevels>(DEFAULT_AUDIO_LEVELS);
  const activeAudio = useRef(0);
  const music = useRef<HTMLAudioElement | null>(null);
  const voices = useRef(new Map<HTMLAudioElement, number>());
  const keys = useRef(new Set<string>());
  const joystickRef = useRef({ x: 0, z: 0 });
  const bubbleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { ownIdRef.current = ownId; }, [ownId]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const applyMusicVolume = useCallback(() => {
    if (music.current) music.current.volume = audioLevelsRef.current.music * (activeAudio.current ? 0.85 : 1);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("take-the-l-audio") || "null") as AudioLevels | null;
      if (saved && Number.isFinite(saved.music) && Number.isFinite(saved.voice)) {
        const next = { music: Math.max(0, Math.min(1, saved.music)), voice: Math.max(0, Math.min(1, saved.voice)) };
        audioLevelsRef.current = next;
        setAudioLevels(next);
        applyMusicVolume();
      }
    } catch { /* Sound controls still work when browser storage is unavailable. */ }
  }, [applyMusicVolume]);

  const changeAudioLevel = (key: keyof AudioLevels, value: number) => {
    const next = { ...audioLevelsRef.current, [key]: value };
    audioLevelsRef.current = next;
    setAudioLevels(next);
    applyMusicVolume();
    for (const [audio, gain] of voices.current) audio.volume = next.voice * gain;
    try { localStorage.setItem("take-the-l-audio", JSON.stringify(next)); } catch { /* Optional preference. */ }
  };

  const startMusic = useCallback(() => {
    if (mutedRef.current || document.hidden || !music.current) return;
    applyMusicVolume();
    void music.current.play().catch(() => {});
  }, [applyMusicVolume]);

  const stopVoices = useCallback(() => {
    for (const audio of voices.current.keys()) audio.pause();
    voices.current.clear();
    activeAudio.current = 0;
    applyMusicVolume();
  }, [applyMusicVolume]);

  useEffect(() => {
    if (!roomNumber) return;
    startMusic();
    const onVisibility = () => {
      if (document.hidden) {
        music.current?.pause();
        stopVoices();
      } else startMusic();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      music.current?.pause();
      stopVoices();
    };
  }, [roomNumber, startMusic, stopVoices]);

  useEffect(() => {
    const audio = music.current;
    return () => {
      audio?.pause();
      stopVoices();
    };
  }, [stopVoices]);

  const toggleSound = () => {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      music.current?.pause();
      stopVoices();
    } else startMusic();
  };

  const refreshRooms = useCallback(async () => {
    try {
      const response = await fetch(`${gameServerUrl()}/rooms`, { cache: "no-store" });
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
    if (mutedRef.current || document.hidden || activeAudio.current >= 3) return;
    const dancer = playersRef.current[dancerId];
    const self = playersRef.current[ownIdRef.current || ""];
    if (dancerId !== ownIdRef.current && (!dancer || !self || Math.hypot(dancer.x - self.x, dancer.z - self.z) > 7)) return;
    const dance = DANCES.find((item) => item.id === id);
    if (!dance) return;
    const audio = new Audio(dance.audio);
    const gain = dancerId === ownIdRef.current ? 1 : 0.45;
    audio.volume = audioLevelsRef.current.voice * gain;
    voices.current.set(audio, gain);
    activeAudio.current += 1;
    applyMusicVolume();
    let released = false;
    const finished = () => {
      if (released) return;
      released = true;
      voices.current.delete(audio);
      activeAudio.current = voices.current.size;
      applyMusicVolume();
    };
    audio.addEventListener("ended", finished, { once: true });
    audio.addEventListener("error", finished, { once: true });
    void audio.play().catch(finished);
  }, [applyMusicVolume]);

  const join = useCallback(async (requestedRoom?: number) => {
    const nickname = name.trim();
    if (nickname.length < 2 || nickname.length > 12 || !/^[\p{L}\p{N}_ ]+$/u.test(nickname)) {
      setError("닉네임은 한글·영문·숫자로 2~12자만 써 줘.");
      return;
    }
    // Start inside the entry gesture so phone browsers can play audio.
    startMusic();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${gameServerUrl()}/rooms`, { cache: "no-store" });
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
      const client = new Client(gameServerUrl());
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
      if (!roomRef.current) music.current?.pause();
      setError(reason instanceof Error ? reason.message : "입장하지 못했어. 다시 시도해 줘.");
    } finally {
      setBusy(false);
    }
  }, [name, playDance, startMusic]);

  useEffect(() => {
    if (!roomNumber) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        keys.current.add(event.key);
      }
      if (event.repeat) return;
      const dance = DANCES.find((item) => item.key.toLowerCase() === event.key.toLowerCase());
      if (dance) {
        startMusic();
        roomRef.current?.send("dance", dance.id);
      }
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
  }, [roomNumber, startMusic]);

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
    <audio ref={music} src="/audio/gajyeoga.wav" loop preload="none" />
    <div className="game-shell">
      <section className="stage-panel" aria-label="춤추는 놀이터">
        <div className="stage-canvas"><Scene players={roomNumber ? playerList : DEMO_PLAYERS} bubbles={bubbles} focus={ownId ? players[ownId] : undefined} /></div>
        <div className="brand-badge"><span className="brand-icon">L</span><span>L을 가져가</span></div>
        {!roomNumber ? <form className="join-panel" onSubmit={(event) => { event.preventDefault(); void join(selectedRoom ?? undefined); }}>
          <h1>L을 가져가!</h1>
          <label htmlFor="nickname">닉네임 변경 가능</label>
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
          <button className="sound-toggle" onClick={toggleSound} aria-label={muted ? "소리 켜기" : "소리 끄기"}
            aria-pressed={muted} title={muted ? "소리 켜기" : "소리 끄기"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5Z" />
              {muted ? <path d="m3 3 18 18" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
            </svg>
          </button>
          <details className="playing-menu">
            <summary aria-label="게임 메뉴">☰</summary>
            <div className="menu-body">
              <div className="playing-actions">
                <button onClick={() => void copyLink()}>{copied ? "복사했어!" : "이 방 링크 복사"}</button>
                <button onClick={() => void leave()}>나가기</button>
              </div>
              <div className="audio-settings">
                <label htmlFor="music-volume">브금 <output>{Math.round(audioLevels.music * 100)}%</output></label>
                <input id="music-volume" type="range" min="0" max="100" step="5" value={Math.round(audioLevels.music * 100)}
                  onChange={(event) => changeAudioLevel("music", Number(event.target.value) / 100)} />
                <label htmlFor="voice-volume">목소리 <output>{Math.round(audioLevels.voice * 100)}%</output></label>
                <input id="voice-volume" type="range" min="0" max="100" step="5" value={Math.round(audioLevels.voice * 100)}
                  onChange={(event) => changeAudioLevel("voice", Number(event.target.value) / 100)} />
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
            onClick={() => { startMusic(); roomRef.current?.send("dance", dance.id); }}>
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
  </>;
}
