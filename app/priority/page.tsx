import Link from "next/link";
import { ArrowRight, Info, Leaf, ThermometerSun, Users } from "lucide-react";
import { SiteHeader } from "../components/site-header";
import { priorityAreas } from "../data";

export default function PriorityAreasPage() {
  return (
    <main className="app-shell priority-page">
      <SiteHeader active="priority"/>
      <section className="priority-hero">
        <div><span className="section-eyebrow">MELBOURNE PLANNING INDEX</span><h1>Priority areas</h1><p>Find where planting could deliver the greatest public benefit, based on current heat severity, canopy deficit and community vulnerability.</p></div>
        <div className="method-note"><Info size={18}/><div><strong>How the score works</strong><p>40% heat severity · 35% canopy deficit · 25% vulnerability</p></div></div>
      </section>
      <section className="priority-content">
        <div className="priority-summary"><strong>13 supported areas</strong><span>Current measured conditions · Demo index</span></div>
        <div className="priority-table-wrap">
          <table className="priority-table">
            <thead><tr><th>Rank</th><th>Planning area</th><th>Priority score</th><th>Heat severity</th><th>Canopy deficit</th><th>Vulnerability</th><th>Current condition</th><th></th></tr></thead>
            <tbody>{priorityAreas.map((area)=><tr key={area.name}><td><span className={`table-rank ${area.rank<=3?"top":""}`}>{area.rank}</span></td><td><strong>{area.name}</strong><small>{area.population} residents</small></td><td><div className="score-cell"><strong>{area.score}</strong><i><b style={{width:`${area.score}%`}}/></i></div></td><td>{area.heatSeverity}<small><ThermometerSun size={12}/>{area.heat}°C</small></td><td>{area.canopyDeficit}<small><Leaf size={12}/>{area.current}% cover</small></td><td>{area.vulnerability}<small><Users size={12}/>index</small></td><td><span className={area.score>=80?"priority-badge urgent":area.score>=70?"priority-badge high":"priority-badge moderate"}>{area.score>=80?"Very high":area.score>=70?"High":"Moderate"}</span></td><td><Link href="/scenario" aria-label={`Plan a scenario for ${area.name}`}>Plan <ArrowRight size={14}/></Link></td></tr>)}</tbody>
          </table>
        </div>
        <div className="coverage-note"><Info size={16}/><p><strong>Coverage note:</strong> Scenario analysis is currently available for these 13 validated demo areas. Areas outside this list should be labelled unsupported until their canopy, heat and vulnerability inputs are validated.</p></div>
      </section>
      <footer><span><Leaf size={15}/>Shade 2050</span><p>Decision support for a cooler, greener Melbourne.</p><span>Portfolio prototype · 2026</span></footer>
    </main>
  );
}
