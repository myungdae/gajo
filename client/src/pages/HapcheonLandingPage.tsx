import { Link } from 'react-router-dom';

export default function HapcheonLandingPage(){
  return <main className="hapcheon-landing">
    <section className="hapcheon-landing-card" aria-labelledby="hapcheon-landing-title">
      <h1 id="hapcheon-landing-title" className="sr-only">합천 AI 여행도우미</h1>
      <img
        className="hapcheon-landing-hero"
        src="/branding/hapcheon-ai-autumn-social-1200x630-v2.png"
        width="1200"
        height="630"
        alt="해인사와 가야산의 화려한 가을 풍경, 해인사·영상테마파크·황매산을 소개하는 합천 AI 여행도우미 관광 일러스트"
      />
      <div className="hapcheon-landing-action">
        <Link className="hapcheon-landing-cta" to="/hapcheon?start=ai">합천 여행 시작하기</Link>
        <p>회원가입 없이 바로 이용할 수 있어요.</p>
      </div>
    </section>
  </main>
}
