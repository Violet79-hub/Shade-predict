"use client";

import { useEffect, useRef, useState } from 'react';
import type { Map as GLMap, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Polygon } from 'geojson';
import { LocateFixed, Maximize2, RotateCw, Trees } from 'lucide-react';
import { planningGridByArea } from '../planner-model';
import { contains, bounds, treeGeometry, type Boundary } from './map-geometry';

type Props = { area: string; count: number; year: number; speciesName: string; onAreaChange: (name: string) => void; selectionMode: string; streetId: string };
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

export function GeographicMap(props: Props) {
  const host = useRef<HTMLDivElement>(null), map = useRef<GLMap | null>(null);
  const data = useRef<Boundary[]>([]), propsRef = useRef(props);
  const anchor = useRef<[number, number] | null>(null), placement = useRef(false);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [is3d, set3d] = useState(false), [placing, setPlacing] = useState(false);
  const [layer, setLayer] = useState(true), [zoom, setZoom] = useState(12.4);
  const [notice, setNotice] = useState('');
  useEffect(() => { propsRef.current = props; }, [props]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    async function init() {
      try {
        const [gl, response] = await Promise.all([import('maplibre-gl'), fetch('/map/suburbs.geojson')]);
        if (!response.ok) throw Error('Official boundaries could not be loaded.');
        const collection = await response.json();
        if (disposed || !host.current) return;
        data.current = collection.features;
        const m = new gl.Map({ container: host.current, center: [144.953, -37.807], zoom: 12.4, maxZoom: 20,
          attributionControl: { compact: true },
          style: { version: 8, sources: { basemap: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors © CARTO' } }, layers: [{ id: 'base', type: 'raster', source: 'basemap' }] }
        });
        map.current = m;
        m.addControl(new gl.NavigationControl({ visualizePitch: true }), 'top-right');
        m.addControl(new gl.ScaleControl(), 'bottom-left');
        m.on('load', () => {
          if (disposed) return;
          m.addSource('boundaries', { type: 'geojson', data: collection });
          m.addLayer({ id: 'canopy', type: 'fill', source: 'boundaries', paint: { 'fill-color': ['step', ['get', 'canopy'], '#edf3ee', 5, '#d2e3d6', 10, '#aacbb6', 15, '#76a88a', 20, '#437954'], 'fill-opacity': .62 } });
          m.addLayer({ id: 'borders', type: 'line', source: 'boundaries', paint: { 'line-color': '#fff', 'line-width': 1.5 } });
          m.addLayer({ id: 'selected', type: 'line', source: 'boundaries', filter: ['==', 'name', propsRef.current.area], paint: { 'line-color': '#12573e', 'line-width': 3 } });
          m.addSource('trees', { type: 'geojson', data: empty });
          m.addLayer({ id: 'tree-models', type: 'fill-extrusion', source: 'trees', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } });
          m.addSource('candidates', { type: 'geojson', data: empty });
          m.addLayer({ id: 'candidate-points', type: 'circle', source: 'candidates', paint: { 'circle-radius': 5, 'circle-color': '#da8e20', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
          m.on('click', 'candidate-points', event => {
            if (placement.current) return;
            const f = event.features?.[0];
            if (!f || f.geometry.type !== 'Point') return;
            const info = document.createElement('div');
            info.textContent = `${f.properties?.streetName || 'Planting candidate'} · Priority ${f.properties?.priorityScore}. Requires site verification.`;
            new gl.Popup().setLngLat(f.geometry.coordinates as [number, number]).setDOMContent(info).addTo(m);
          });
          m.on('click', 'canopy', event => {
            if (placement.current) {
              const f = data.current.find(x => x.properties.name === propsRef.current.area);
              if (!f || !contains([event.lngLat.lng, event.lngLat.lat], f)) { setNotice('Choose a point inside the selected green outline.'); return; }
              anchor.current = [event.lngLat.lng, event.lngLat.lat];
              (m.getSource('trees') as GeoJSONSource).setData(treeGeometry(f, propsRef.current.count, propsRef.current.year, anchor.current));
              m.easeTo({ center: anchor.current, zoom: 18, pitch: 58, duration: 800 });
              set3d(true); placement.current = false; setPlacing(false); setNotice('');
              return;
            }
            const name = event.features?.[0]?.properties?.name;
            if (name) propsRef.current.onAreaChange(name);
          });
          m.on('mouseenter', 'canopy', () => { m.getCanvas().style.cursor = placement.current ? 'crosshair' : 'pointer'; });
          m.on('mouseleave', 'canopy', () => { m.getCanvas().style.cursor = ''; });
          setReady(true);
        });
        m.on('zoomend', () => setZoom(m.getZoom()));
        m.on('pitchend', () => set3d(m.getPitch() > 10));
        m.on('error', e => { if ('sourceId' in e && e.sourceId === 'basemap') setNotice('Some street tiles could not load. Check your connection; area selection is still available.'); });
        observer = new ResizeObserver(() => m.resize());
        observer.observe(host.current);
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : 'Map could not start. Please enable WebGL.'); }
    }
    void init();
    return () => { disposed = true; observer?.disconnect(); map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    anchor.current = null;
    const f = data.current.find(x => x.properties.name === props.area);
    m.setFilter('selected', ['==', 'name', props.area]);
    if (f) m.fitBounds(bounds(f), { padding: 65, maxZoom: 15, duration: 650 });
  }, [props.area, ready]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const f = data.current.find(x => x.properties.name === props.area);
    if (f) (m.getSource('trees') as GeoJSONSource).setData(treeGeometry(f, props.count, props.year, anchor.current));
    const cells = planningGridByArea[props.area] ?? [];
    (m.getSource('candidates') as GeoJSONSource).setData({ type: 'FeatureCollection', features: cells.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { streetName: c.streetName, priorityScore: c.priorityScore } })) });
  }, [props.count, props.year, props.area, ready]);
  function focusTrees() {
    const m = map.current, f = data.current.find(x => x.properties.name === props.area);
    if (!m || !f) return;
    const first = treeGeometry(f, props.count, props.year, anchor.current).features[0]?.geometry as Polygon | undefined;
    const center = anchor.current ?? first?.coordinates[0][0] as [number, number] | undefined;
    if (center) { m.easeTo({ center, zoom: 18.5, pitch: 58, bearing: -18, duration: 900 }); set3d(true); }
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await host.current?.parentElement?.requestFullscreen(); }
    catch { setNotice('Fullscreen is not available in this browser.'); }
  }
  return <section className="geo-workspace" aria-label="Melbourne geographic map">
    <div className="geo-map" ref={host} />
    {!ready && !error && <div className="geo-status">Loading Melbourne map…</div>}
    {error && <div className="geo-status" role="alert">{error}<button onClick={() => window.location.reload()}>Retry</button></div>}
    <div className="geo-toolbar">
      <button disabled={!ready} aria-pressed={!is3d} onClick={() => { map.current?.easeTo({ pitch: 0, bearing: 0 }); set3d(false); }}>2D map</button>
      <button disabled={!ready || props.count < 1} aria-pressed={is3d} onClick={focusTrees}><Trees size={16} />3D trees</button>
      <button disabled={!ready} onClick={() => map.current?.easeTo({ bearing: (map.current.getBearing() + 45) % 360 })} aria-label="Rotate map"><RotateCw size={16} /></button>
      <button disabled={!ready} onClick={() => map.current?.fitBounds([[144.89, -37.86], [145.01, -37.76]], { padding: 25, pitch: 0, bearing: 0 })} aria-label="Show all Melbourne areas"><LocateFixed size={16} /></button>
      <button onClick={fullscreen} aria-label="Fullscreen map"><Maximize2 size={16} /></button>
    </div>
    <div className="geo-plant-action"><button disabled={!ready || props.count < 1} aria-pressed={placing} onClick={() => { placement.current = !placement.current; setPlacing(placement.current); }}>{placing ? 'Click inside the selected area · Cancel' : 'Place a planting preview'}</button></div>
    {notice && <div className="geo-notice" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
    <div className="geo-legend"><strong>{layer ? 'Tree canopy · observed 2018' : 'Street basemap'}</strong><div className="geo-ramp" /><div className="geo-ticks"><span>0%</span><span>5</span><span>10</span><span>15</span><span>20+</span></div><button disabled={!ready} onClick={() => { setLayer(!layer); map.current?.setPaintProperty('canopy', 'fill-opacity', layer ? 0 : .62); }}>{layer ? 'Hide canopy colours' : 'Show canopy colours'}</button></div>
    <div className="geo-readout"><strong>{props.area}</strong><span>{props.count} {props.speciesName} · {props.year} preview</span><small>Orange dots: ranked planting candidates. Zoom {zoom.toFixed(1)}. Tree positions and sizes are illustrative, not surveyed sites.{props.selectionMode !== 'suburb' ? ' Map shows suburb boundaries; street/CLUE controls are scenario assumptions.' : ''}</small></div>
  </section>;
}
