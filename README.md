# Take the L

닉네임만 쓰고 입장하는 공개 춤 놀이터. 1~5번방은 고정이며 각 방은 20명까지 들어간다. 사용자 녹음 다섯 개가 춤 버튼에 연결된다.

공개 주소: https://take-the-l.vercel.app

오픈채팅에 처음 공유할 때는 `https://take-the-l.vercel.app/?src=openchat`을 사용한다. 이 링크로 처음 입장한 시점부터 출시 1시간 집계를 시작한다.

## 로컬 실행

Node.js 22 이상에서 저장소 루트에서 실행한다.

```bash
npm ci
npm run dev:server
```

다른 터미널에서:

```bash
npm run dev:web
```

웹은 `http://localhost:3000`, 서버는 `http://localhost:2567`이다. 웹의 서버 주소는 `web/.env.local`의 `NEXT_PUBLIC_GAME_SERVER`로 바꿀 수 있다.

같은 와이파이의 휴대폰에서는 컴퓨터의 로컬 IP에 포트 3000으로 접속한다. 예: `http://192.168.0.84:3000`. 서버 주소를 따로 설정하지 않으면 웹에 접속한 컴퓨터 주소의 2567 포트를 사용한다. 개발 환경에서만 로컬 네트워크의 웹 주소를 허용한다.

브금은 `web/public/audio/`의 반복 WAV 파일이다. 입장할 때 재생을 시작하고, 목소리가 겹치면 브금을 조금 낮춘다. 게임 메뉴에서 브금과 목소리 볼륨을 각각 조절할 수 있다.

## 출시 설정

- Vercel 프로젝트 루트: `web`
- Vercel 환경 변수: `NEXT_PUBLIC_SITE_URL=https://실제-웹-주소`, `NEXT_PUBLIC_GAME_SERVER=https://실제-게임-서버-주소`
- AWS 게임 서버 환경 변수: `WEB_ORIGIN=https://실제-웹-주소`, `PUBLIC_ADDRESS=실제-게임-서버-호스트`, `PORT=2567`
- 서버 빌드: 저장소 루트에서 `npm ci && npm run build -w server`
- 서버 실행: `npm run start -w server`
- 게임 서버는 HTTPS/WSS 역방향 프록시 뒤에 둔다. 브라우저가 HTTPS 웹에서 HTTP 게임 서버에 접속할 수 없기 때문이다.
- `server/data/stats.json`은 집계 파일이다. Git에 올리지 않고 서버의 지속 저장 공간에 보관한다.

처음 오픈채팅방에 공유할 때 `https://실제-웹-주소/?src=openchat&room=1` 링크를 사용한다. 이 링크로 첫 입장이 발생한 순간부터 1시간 동안 들어온 모든 방 입장 세션을 센다. 운영 지표는 게임 서버의 `/stats`에서 볼 수 있다. 재접속도 새 입장 세션으로 집계될 수 있으므로 사람 수와 동일하지 않다.

## 공개 전 확인

1. AWS 계정의 무료 혜택 잔여분과 월 3만 원 예산 알림을 확인한다.
2. PC 두 창과 실제 휴대폰에서 같은 방에 입장해 이동, 춤, 음성, 말풍선, 방 이동을 확인한다.
3. Vercel 공개 주소와 게임 서버의 `/health`를 확인한다.
4. Google Search Console에서 웹 주소를 등록하고 `sitemap.xml`을 제출한다. 색인과 검색 순위는 보장되지 않는다.

자세한 범위는 [요구사항](docs/requirements.md)을 본다. 캐릭터와 무대는 자체 제작했고, 공개 음성은 프로젝트 제공자가 직접 녹음한 파일이다.

작게 시작하는 첫 배포 구성과 비용·종료 방법은 [배포 계획](docs/deployment.md)에 정리했다.
