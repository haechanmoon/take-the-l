import GameEntry from "./GameEntry";

export default function HomePage() {
  return (
    <main>
      <GameEntry />
      <section className="info-section" aria-label="게임 소개">
        <div className="info-inner">
          <p className="eyebrow">THIS IS THE WHOLE POINT</p>
          <h2>그냥 들어와서 춤춰.</h2>
          <p>
            <strong>L을 가져가</strong>, 또는 <strong>엘을 가져가</strong>. Take the L은
            닉네임만 쓰고 바로 들어가는 웹 놀이터야. 공개방에서 다른 사람들과 걷고,
            다섯 가지 춤을 추고, 정해진 말풍선으로 인사해.
          </p>
          <div className="how-grid">
            <div><span>01</span><h3>입장</h3><p>로그인 없이 닉네임만 쓰면 돼.</p></div>
            <div><span>02</span><h3>움직이기</h3><p>PC는 방향키, 휴대폰은 왼쪽 조이스틱.</p></div>
            <div><span>03</span><h3>춤추기</h3><p>Q W E R T 또는 화면의 춤 버튼을 눌러.</p></div>
          </div>
          <p className="independent-note">팬이 만든 비공식 놀이터야. 캐릭터와 화면은 자체 제작했어.</p>
        </div>
      </section>
    </main>
  );
}
