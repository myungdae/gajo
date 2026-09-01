import { Link } from 'react-router-dom';

export default function HapcheonLandingPage(){
  return <main className="hapcheon-landing">
    <section className="hapcheon-landing-visual" aria-labelledby="hapcheon-landing-title">
      <h1 id="hapcheon-landing-title" className="sr-only">합천 AI 여행도우미</h1>
      <img
        className="hapcheon-landing-hero"
        src="/branding/hapcheon-ai-autumn-mobile-780x1688-v1.png"
        width="780"
        height="1688"
        alt="해인사와 가야산의 화려한 가을 풍경, 해인사·영상테마파크·황매산을 소개하는 합천 AI 여행도우미 관광 일러스트"
      />
      <Link className="hapcheon-landing-cta" to="/hapcheon?start=ai"><span className="sr-only">합천 여행 시작하기</span></Link>
    </section>
  </main>
}
