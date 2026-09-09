import Link from "next/link";
import { ArrowRight, BarChart3, BrainCircuit, Leaf, Map, ShieldCheck, Sparkles, ThermometerSun, TreePine, Trees } from "lucide-react";
import { SiteHeader } from "./components/site-header";
import { priorityAreas } from "./official-data-model";

export default function HomePage() {
  const featured = priorityAreas.slice(0, 4);
  return (
    <main className="app-shell landing-page">
      <SiteHeader active="home"/>
      <section className="home-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={15}/> Data-driven urban canopy planning</div>
          <h1>Plan the trees.<br/><em>See the cooler future.</em></h1>
          <p>Shade 2050 combines official Melbourne tree, canopy, building and urban-heat datasets with empirical models to compare no-intervention and planting scenarios.</p>
          <div className="hero-actions">
            <Link className="primary-cta" href="/scenario">Plan a scenario <ArrowRight size={17}/></Link>
            <Link className="secondary-cta" href="#explore">Explore observed conditions</Link>
          </div>
          <div className="trust-row"><span><ShieldCheck size={15}/> Official source data</span><span><BrainCircuit size={15}/> Empirical tree & UHI models</span><span><Map size={15}/> Verified areas only</span></div>
        </div>
        <div className="hero-visual">
          <div className="hero-image" role="img" aria-label="Carlton streetscape scenario visualisation"/>
          <div className="hero-image-label"><span>CARLTON · 2050 SCENARIO</span><strong>Illustrative streetscape · model results shown in planner</strong></div>
          <div className="floating-impact"><Trees size={20}/><div><strong>Empirical</strong><small>canopy projection</small></div></div>
          <div className="floating-heat"><ThermometerSun size={18}/><div><strong>OLS</strong><small>UHI model</small></div></div>
        </div>
      </section>

      <section className="home-stat-strip" aria-label="Platform summary">
        <div><strong>{priorityAreas.length}</strong><span>verified planning areas</span></div>
        <div><strong>2011–2025</strong><span>official observed inputs</span></div>
        <div><strong>2035 · 2050</strong><span>forecast horizons</span></div>
        <div><strong>Model B</strong><span>empirical crown-age fit</span></div>
      </section>

      <section className="explore-section" id="explore">
        <div className="explore-heading"><div><span className="section-eyebrow">OBSERVED CONDITIONS</span><h2>Where does Melbourne need shade most?</h2><p>Priority uses official 2018 UHI, official 2018 tree cover and official 2018 Heat Vulnerability Index. The score is a derived equal-percentile index, not an observed variable.</p></div><Link href="/priority">View all priority areas <ArrowRight size={16}/></Link></div>
        <div className="area-preview-grid">
          {featured.map((area) => <article className="area-preview-card" key={area.name}><div className="area-card-top"><span className="rank-number">#{area.rank}</span><span className={area.score >= 80 ? "risk high" : "risk medium"}>{area.score >= 80 ? "Very high priority" : area.score >= 65 ? "High priority" : "Moderate priority"}</span></div><h3>{area.name}</h3><div className="area-score-row"><div><small>Derived priority score</small><strong>{area.score}<span>/100</span></strong></div><div className="score-ring" style={{"--score": `${area.score * 3.6}deg`} as React.CSSProperties}><span>{area.score}</span></div></div><div className="area-factors"><span><ThermometerSun size={14}/>{area.heat}°C UHI</span><span><Leaf size={14}/>{area.current}% tree cover</span></div><Link href="/scenario">Test a planting plan <ArrowRight size={14}/></Link></article>)}
        </div>
      </section>

      <section className="how-section">
        <div className="how-intro"><span className="section-eyebrow">FROM DATA TO DECISION</span><h2>One clear planning workflow</h2><p>Start with observed official conditions, run an empirical intervention scenario, then compare the no-intervention and planting projections.</p></div>
        <div className="how-steps">
          <article><span>01</span><div className="how-icon"><Map/></div><h3>Choose a verified area</h3><p>Review official canopy, UHI, tree inventory and building-form inputs.</p></article>
          <article><span>02</span><div className="how-icon"><TreePine/></div><h3>Build a scenario</h3><p>Choose a tree species, planting volume and 2035 or 2050 horizon.</p></article>
          <article><span>03</span><div className="how-icon"><BarChart3/></div><h3>Compare projections</h3><p>See observed baseline, empirical no-intervention trajectory and planting outcome.</p></article>
        </div>
      </section>

      <section className="home-cta"><div><span><BrainCircuit size={22}/> MODEL B</span><h2>Turn observed urban data into a testable planting scenario.</h2><p>Forecasts are model outputs; source years and fit information are shown in the planner.</p></div><Link className="light-cta" href="/scenario">Open scenario planner <ArrowRight size={17}/></Link></section>
      <footer><span><Leaf size={15}/>Shade 2050</span><p>Decision support for a cooler, greener Melbourne.</p><span>Empirical prototype · 2026</span></footer>
    </main>
  );
}
