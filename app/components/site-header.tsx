"use client";

import Link from "next/link";
import { ChevronDown, Leaf, MapPin } from "lucide-react";

type ActivePage = "home" | "explore" | "scenario" | "priority";

export function SiteHeader({ active }: { active: ActivePage }) {
  return (
    <header className="topbar">
      <Link className="brand-lockup" href="/" aria-label="Shade 2050 home">
        <div className="logo-mark"><Leaf size={22} strokeWidth={2.4}/></div>
        <div><div className="brand-name">Shade 2050</div><div className="brand-tag">Greener Melbourne. Cooler Futures.</div></div>
      </Link>
      <nav aria-label="Primary navigation">
        <Link className={active === "home" ? "active" : ""} href="/">Home</Link>
        <Link className={active === "explore" ? "active" : ""} href="/#explore">Explore</Link>
        <Link className={active === "scenario" ? "active" : ""} href="/scenario">Plan a scenario</Link>
        <Link className={active === "priority" ? "active" : ""} href="/priority">Priority areas</Link>
      </nav>
      <div className="header-actions">
        <button className="location-button" aria-label="Selected city: Melbourne"><MapPin size={16}/>Melbourne<ChevronDown size={14}/></button>
        <div className="slogan">More trees.<br/><span>Brighter tomorrows.</span></div>
      </div>
    </header>
  );
}
