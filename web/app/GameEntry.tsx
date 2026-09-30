"use client";

import dynamic from "next/dynamic";

const Game = dynamic(() => import("./Game"), {
  ssr: false,
  loading: () => <div className="game-loading">놀이터를 준비하는 중...</div>,
});

export default function GameEntry() {
  return <Game />;
}
