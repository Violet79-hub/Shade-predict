import Link from "next/link";
import { ArrowRight, Info, Leaf, ThermometerSun, Users } from "lucide-react";
import { SiteHeader } from "../components/site-header";
import { priorityAreas } from "../official-data-model";

export default function PriorityAreasPage() {
  return (
    <main className="app-shell priority-page">
      <SiteHeader active="priority"/>
      <section className="priority-hero">
        <div><span className="section-eyebrow">OFFICIAL-DATA PLANNING INDEX</span><h1>Priority areas</h1><p>Compare verified areas using official 2018 urban heat-island intensity, tree cover and Heat Vulnerability Index.</p></div>
        <div className="method-note"><Info size={18}/><div><strong>How the score works</strong><p>Equal percentile rank of UHI severity, low tree cover and HVI. The score is a transparent derived index, not an observed measurement.</p></div></div>
      </section>
      <section className="priority-content">
        <div className="priority-summary"><strong>{priorityAreas.length} verified areas</strong><span>Official observations · derived ranking</span></div>
        <div className="priority-table-wrap">
          <table className="priority-table">
            <thead><tr><th>Rank</th><th>Planning area</th><th>Priority score</th><th>UHI percentile</th><th>Low-cover percentile</th><th>HVI percentile</th><th>Observed condition</th><th></th></tr></thead>
            <tbody>{priorityAreas.map((area)=><tr key={area.name}><td><span className={`table-rank ${area.rank<=3?"top":""}`}>{area.rank}</span></td><td><strong>{area.name}</strong><small>{area.population === "—" ? "Population forecast unavailable" : `${area.population} forecast residents (2026)`}</small></td><td><div className="score-cell"><strong>{area.score}</strong><i><b style={{width:`${area.score}%`}}/></i></div></td><td>{area.heatSeverity}<small><ThermometerSun size={12}/>{area.heat}°C UHI (2018)</small></td><td>{area.canopyDeficit}<small><Leaf size={12}/>{area.current}% tree cover (2018)</small></td><td>{area.vulnerability}<small><Users size={12}/>HVI {area.hvi} (2018)</small></td><td><span className={area.score>=80?"priority-badge urgent":area.score>=65?"priority-badge high":"priority-badge moderate"}>{area.score>=80?"Very high":area.score>=65?"High":"Moderate"}</span></td><td><Link href="/scenario" aria-label={`Plan a scenario for ${area.name}`}>Plan <ArrowRight size={14}/></Link></td></tr>)}</tbody>
          </table>
        </div>
        <div className="coverage-note"><Info size={16}/><p><strong>Coverage note:</strong> Only areas with complete official tree-inventory, 2018 and 2023 building-footprint, tree-cover and UHI inputs are included. Areas without complete source coverage are excluded rather than filled with synthetic values.</p></div>
      </section>
      <footer><span><Leaf size={15}/>Shade 2050</span><p>Decision support for a cooler, greener Melbourne.</p><span>Empirical prototype · 2026</span></footer>
    </main>
  );
}
