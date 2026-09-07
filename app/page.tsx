import Link from "next/link";
import { ArrowRight, BarChart3, BrainCircuit, Leaf, Map, ShieldCheck, Sparkles, ThermometerSun, TreePine, Trees } from "lucide-react";
import { SiteHeader } from "./components/site-header";
import { priorityAreas } from "./data";

export default function HomePage() {
  const featured = priorityAreas.slice(0, 4);
  return (
    <main className="app-shell landing-page">
      <SiteHeader active="home"/>
      <section className="home-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={15}/> AI-powered urban canopy planning</div>
          <h1>Plan the trees.<br/><em>See the cooler future.</em></h1>
          <p>Shade 2050 turns Melbourne’s tree and heat data into practical planting scenarios—so planners can compare what happens if we do nothing with what becomes possible when we plant.</p>
          <div className="hero-actions">
            <Link className="primary-cta" href="/scenario">Plan a scenario <ArrowRight size={17}/></Link>
            <Link className="secondary-cta" href="#explore">Explore current conditions</Link>
          </div>
          <div className="trust-row"><span><ShieldCheck size={15}/> Clear assumptions</span><span><BrainCircuit size={15}/> Tree-level forecasting</span><span><Map size={15}/> 13 supported areas</span></div>
        </div>
        <div className="hero-visual">
          <div className="hero-image" role="img" aria-label="Carlton streetscape becoming greener over time"/>
          <div className="hero-image-label"><span>CARLTON · 2050 SCENARIO</span><strong>From exposed streets to continuous shade</strong></div>
          <div className="floating-impact"><Trees size={20}/><div><strong>+11.8%</strong><small>canopy cover</small></div></div>
          <div className="floating-heat"><ThermometerSun size={18}/><div><strong>−4.1°C</strong><small>surface temperature</small></div></div>
        </div>
      </section>

      <section className="home-stat-strip" aria-label="Platform summary">
        <div><strong>13</strong><span>supported planning areas</span></div>
        <div><strong>18</strong><span>tree species profiles</span></div>
        <div><strong>2035 · 2050</strong><span>forecast horizons</span></div>
        <div><strong>Model B</strong><span>recursive crown growth</span></div>
      </section>

      <section className="explore-section" id="explore">
        <div className="explore-heading"><div><span className="section-eyebrow">CURRENT CONDITIONS</span><h2>Where does Melbourne need shade most?</h2><p>Priority combines urban heat, canopy deficit and community vulnerability. These are measured and derived indicators—not future predictions.</p></div><Link href="/priority">View all priority areas <ArrowRight size={16}/></Link></div>
        <div className="area-preview-grid">
          {featured.map((area) => <article className="area-preview-card" key={area.name}><div className="area-card-top"><span className="rank-number">#{area.rank}</span><span className={area.score >= 80 ? "risk high" : "risk medium"}>{area.score >= 80 ? "Very high priority" : "High priority"}</span></div><h3>{area.name}</h3><div className="area-score-row"><div><small>Priority score</small><strong>{area.score}<span>/100</span></strong></div><div className="score-ring" style={{"--score": `${area.score * 3.6}deg`} as React.CSSProperties}><span>{area.score}</span></div></div><div className="area-factors"><span><ThermometerSun size={14}/>{area.heat}°C heat</span><span><Leaf size={14}/>{area.current}% canopy</span></div><Link href="/scenario">Test a planting plan <ArrowRight size={14}/></Link></article>)}
        </div>
      </section>

      <section className="how-section">
        <div className="how-intro"><span className="section-eyebrow">FROM DATA TO DECISION</span><h2>One clear planning workflow</h2><p>Explore current conditions, test an intervention, then compare outcomes and prioritise investment.</p></div>
        <div className="how-steps">
          <article><span>01</span><div className="how-icon"><Map/></div><h3>Choose an area</h3><p>Select one of 13 supported Melbourne areas and review its current canopy and heat profile.</p></article>
          <article><span>02</span><div className="how-icon"><TreePine/></div><h3>Build a scenario</h3><p>Choose a species, planting volume and 2035 or 2050 horizon.</p></article>
          <article><span>03</span><div className="how-icon"><BarChart3/></div><h3>Compare the future</h3><p>See baseline versus intervention canopy, heat impact and Model B growth evidence.</p></article>
        </div>
      </section>

      <section className="home-cta"><div><span><BrainCircuit size={22}/> MODEL B</span><h2>Turn tree growth into a decision you can see.</h2><p>Run the Carlton demo or choose another supported planning area.</p></div><Link className="light-cta" href="/scenario">Open scenario planner <ArrowRight size={17}/></Link></section>
      <footer><span><Leaf size={15}/>Shade 2050</span><p>Decision support for a cooler, greener Melbourne.</p><span>Portfolio prototype · 2026</span></footer>
    </main>
  );
}
