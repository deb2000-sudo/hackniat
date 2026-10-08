/**
 * The Challazo mark and the hero illustration. Pure SVG — every colour is a
 * token from challazo-home.css, so both follow the light/dark switch.
 */

/** Outline-only mark used as a watermark on generated card banners. */
export function GhostMark() {
  return (
    <svg className="hz-lm hz-ghostmark hz-ghost" width="150" height="150" viewBox="0 0 40 40" aria-hidden="true">
      <rect className="hz-tile" width="40" height="40" rx="12" />
      <circle className="hz-ring" cx="20" cy="20" r="13" fill="none" strokeWidth="1.4" style={{ opacity: 0.5 }} />
      <g className="hz-arw" fill="none" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12.5 V25" />
        <path d="M14.6 19.8 L20 25.4 L25.4 19.8" />
      </g>
    </svg>
  )
}

const CONFETTI = [
  { delay: '0s', shape: <rect x="246" y="14" width="9" height="9" rx="2" fill="var(--lime)" /> },
  { delay: '1.2s', shape: <circle cx="352" cy="16" r="4.5" fill="var(--il-slate)" /> },
  { delay: '2.4s', shape: <rect x="534" y="20" width="9" height="9" rx="2" fill="var(--lime)" /> },
  { delay: '3.3s', shape: <circle cx="196" cy="18" r="4" fill="var(--lime)" /> },
  { delay: '4.4s', shape: <rect x="438" y="12" width="7" height="7" rx="2" fill="var(--il-slate)" /> },
  { delay: '5.2s', shape: <circle cx="300" cy="20" r="4" fill="var(--lime)" /> },
]

/** Three students at a hackathon desk, with a countdown board behind them. */
export function HeroScene() {
  return (
    <div className="hz-heroart">
      <div className="hz-scenecard">
        <svg
          className="hz-scene"
          viewBox="0 0 600 340"
          fill="none"
          role="img"
          aria-label="Three students building at a hackathon desk, with a countdown board on the wall behind them"
        >
          <circle cx="486" cy="36" r="116" fill="var(--lime)" opacity=".13" />
          <circle cx="78" cy="306" r="86" fill="var(--lime)" opacity=".07" />

          {/* countdown board */}
          <g className="hz-floatA">
            <rect x="366" y="26" width="198" height="98" rx="15" fill="var(--il-card)" stroke="var(--il-line)" strokeWidth="2" />
            <circle cx="406" cy="75" r="21" stroke="var(--il-line)" strokeWidth="6" />
            <circle className="hz-boardring" cx="406" cy="75" r="21" stroke="var(--lime)" strokeWidth="6" strokeLinecap="round" />
            <rect x="444" y="54" width="92" height="9" rx="4.5" fill="var(--il-line)" />
            <rect x="444" y="71" width="64" height="9" rx="4.5" fill="var(--lime)" />
            <rect x="444" y="88" width="78" height="9" rx="4.5" fill="var(--il-line)" />
          </g>

          {/* pinned notes */}
          <g transform="rotate(-8 80 68)">
            <g className="hz-floatB">
              <rect x="52" y="40" width="56" height="56" rx="10" fill="var(--lime)" />
              <rect x="64" y="57" width="32" height="5" rx="2.5" fill="var(--on-lime)" opacity=".38" />
              <rect x="64" y="69" width="22" height="5" rx="2.5" fill="var(--on-lime)" opacity=".38" />
            </g>
          </g>
          <g transform="rotate(7 157 52)">
            <g className="hz-floatC">
              <rect x="132" y="27" width="50" height="50" rx="10" fill="var(--il-card)" stroke="var(--il-line)" strokeWidth="2" />
              <rect x="144" y="43" width="28" height="5" rx="2.5" fill="var(--il-line)" />
              <rect x="144" y="55" width="18" height="5" rx="2.5" fill="var(--il-line)" />
            </g>
          </g>
          <g className="hz-floatB">
            <rect x="212" y="50" width="106" height="34" rx="17" fill="var(--il-card)" stroke="var(--il-line)" strokeWidth="2" />
            <circle cx="233" cy="67" r="7" fill="var(--lime)" />
            <rect x="248" y="63" width="54" height="8" rx="4" fill="var(--il-line)" />
          </g>

          {/* confetti */}
          {CONFETTI.map((piece) => (
            <g key={piece.delay} className="hz-cf" style={{ animationDelay: piece.delay }}>
              {piece.shape}
            </g>
          ))}

          {/* left student */}
          <g className="hz-bob">
            <path d="M120 244 Q106 268 112 286" stroke="var(--lime)" strokeWidth="16" strokeLinecap="round" />
            <path d="M180 244 Q194 268 188 286" stroke="var(--lime)" strokeWidth="16" strokeLinecap="round" />
            <circle cx="112" cy="288" r="8.5" fill="var(--il-skin1)" />
            <circle cx="188" cy="288" r="8.5" fill="var(--il-skin1)" />
            <rect x="108" y="220" width="84" height="76" rx="30" fill="var(--lime)" />
            <ellipse cx="150" cy="226" rx="26" ry="9" fill="#000" opacity=".07" />
            <rect x="142" y="202" width="16" height="22" rx="8" fill="var(--il-skin1)" />
            <circle cx="150" cy="178" r="29" fill="var(--il-skin1)" />
            <path d="M121 180c0-18 13-32 29-32s29 14 29 32c0-7-9-13-29-13s-29 6-29 13z" fill="var(--il-hair1)" />
            <circle cx="131" cy="188" r="4.5" fill="#E2735A" opacity=".22" />
            <circle cx="169" cy="188" r="4.5" fill="#E2735A" opacity=".22" />
            <circle cx="138" cy="182" r="2.8" fill="var(--il-hair2)" />
            <circle cx="162" cy="182" r="2.8" fill="var(--il-hair2)" />
            <path d="M144 192q6 5 12 0" stroke="var(--il-hair2)" strokeWidth="2.4" strokeLinecap="round" />
          </g>

          {/* centre student, arm up */}
          <g className="hz-bob2">
            <path d="M270 198 Q248 172 254 140" stroke="var(--il-slate)" strokeWidth="15" strokeLinecap="round" />
            <circle cx="254" cy="136" r="8.5" fill="var(--il-skin2)" />
            <path d="M330 198 Q344 228 332 250" stroke="var(--il-slate)" strokeWidth="15" strokeLinecap="round" />
            <rect x="264" y="180" width="72" height="116" rx="28" fill="var(--il-slate)" />
            <ellipse cx="300" cy="186" rx="23" ry="8" fill="#000" opacity=".07" />
            <rect x="292" y="162" width="16" height="20" rx="8" fill="var(--il-skin2)" />
            <circle cx="300" cy="140" r="27" fill="var(--il-skin2)" />
            <path d="M273 142c0-15 12-27 27-27s27 12 27 27c0-6-8-11-27-11s-27 5-27 11z" fill="var(--il-hair2)" />
            <circle cx="300" cy="110" r="10.5" fill="var(--il-hair2)" />
            <circle cx="282" cy="149" r="4.5" fill="#E2735A" opacity=".22" />
            <circle cx="318" cy="149" r="4.5" fill="#E2735A" opacity=".22" />
            <circle cx="289" cy="144" r="2.8" fill="var(--il-hair1)" />
            <circle cx="311" cy="144" r="2.8" fill="var(--il-hair1)" />
            <path d="M294 154q6 5 12 0" stroke="var(--il-hair1)" strokeWidth="2.4" strokeLinecap="round" />
            <rect x="322" y="232" width="18" height="30" rx="5" fill="var(--il-lid)" />
            <rect x="326" y="238" width="10" height="4" rx="2" fill="var(--lime)" />
            <circle cx="332" cy="252" r="8" fill="var(--il-skin2)" />
          </g>

          {/* right student, cap */}
          <g className="hz-bob3">
            <path d="M420 246 Q406 270 412 288" stroke="var(--il-tee)" strokeWidth="16" strokeLinecap="round" />
            <path d="M480 246 Q494 270 488 288" stroke="var(--il-tee)" strokeWidth="16" strokeLinecap="round" />
            <circle cx="412" cy="290" r="8.5" fill="var(--il-skin3)" />
            <circle cx="488" cy="290" r="8.5" fill="var(--il-skin3)" />
            <rect x="408" y="222" width="84" height="74" rx="30" fill="var(--il-tee)" stroke="var(--il-teeline)" strokeWidth="1.5" />
            <ellipse cx="450" cy="228" rx="26" ry="9" fill="#000" opacity=".06" />
            <rect x="442" y="204" width="16" height="22" rx="8" fill="var(--il-skin3)" />
            <circle cx="450" cy="180" r="29" fill="var(--il-skin3)" />
            <circle cx="431" cy="188" r="4.5" fill="#C2543A" opacity=".25" />
            <circle cx="469" cy="188" r="4.5" fill="#C2543A" opacity=".25" />
            <circle cx="438" cy="186" r="2.8" fill="var(--il-hair3)" />
            <circle cx="462" cy="186" r="2.8" fill="var(--il-hair3)" />
            <path d="M444 196q6 5 12 0" stroke="var(--il-hair3)" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M422 170c0-16 13-28 28-28s28 12 28 28z" fill="var(--lime)" />
            <rect x="418" y="165" width="64" height="10" rx="5" fill="var(--lime)" />
            <rect x="476" y="166" width="28" height="8" rx="4" fill="var(--lime)" />
          </g>

          {/* desk */}
          <rect x="16" y="288" width="568" height="14" rx="7" fill="var(--il-desk)" />
          <rect x="40" y="300" width="520" height="16" rx="4" fill="var(--il-desk2)" />
          <rect x="74" y="314" width="13" height="26" rx="3" fill="var(--il-desk2)" />
          <rect x="513" y="314" width="13" height="26" rx="3" fill="var(--il-desk2)" />

          {/* laptops */}
          <path d="M124 246 L176 246 L182 288 L118 288 Z" fill="var(--il-lid)" />
          <rect x="112" y="285" width="76" height="7" rx="3.5" fill="var(--il-desk2)" />
          <rect x="138" y="256" width="24" height="24" rx="7" stroke="var(--lime)" strokeWidth="2" />
          <g className="hz-liddrop">
            <path d="M150 261 v11" stroke="var(--lime)" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M145.6 267.5 L150 272.4 L154.4 267.5" stroke="var(--lime)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          <path d="M424 248 L476 248 L482 288 L418 288 Z" fill="var(--il-lid)" />
          <rect x="412" y="285" width="76" height="7" rx="3.5" fill="var(--il-desk2)" />
          <rect x="438" y="258" width="24" height="24" rx="7" stroke="var(--lime)" strokeWidth="2" />
          <g className="hz-liddrop2">
            <path d="M450 263 v11" stroke="var(--lime)" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M445.6 269.5 L450 274.4 L454.4 269.5" stroke="var(--lime)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* mug */}
          <path className="hz-steam" d="M230 258 q6 -8 0 -16" stroke="var(--il-slate)" strokeWidth="3" strokeLinecap="round" />
          <path className="hz-steam2" d="M241 258 q6 -8 0 -16" stroke="var(--il-slate)" strokeWidth="3" strokeLinecap="round" />
          <rect x="222" y="264" width="26" height="24" rx="6" fill="var(--lime)" />
          <path d="M249 270 q9 6 0 12" stroke="var(--lime)" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
