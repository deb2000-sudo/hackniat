import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import DropNav from '../components/drop/DropNav'
import HackathonBoard from '../components/drop/HackathonBoard'
import CountUpStat from '../components/drop/CountUpStat'
import { IconMissing, IconPassed, IconWarn } from '../components/drop/icons'
import { HOUR, formatRemaining, useCountdown } from '../components/drop/useCountdown'
import { useDropSurface } from '../components/drop/useDropSurface'
import { BTN, BTN_GHOST, BTN_VOLT, EYEBROW, MONO, PANEL, PILL_VOLT, WRAP } from '../components/drop/theme'

const PITCH =
  "Most hackathons take your submission and hand back a number. Drop tells you what's wrong before the deadline, and tells you why afterwards."

/** The draft a builder is part-way through — deliberately vague where it counts. */
const DRAFT = [
  { heading: true, text: '# Problem' },
  { text: '' },
  { text: 'Hackathon teams waste a lot of time on' },
  { text: "things that aren't building. It's a big" },
  { text: 'problem and it affects everyone.' },
  { text: '' },
  { heading: true, text: '# Solution' },
  { text: '' },
  { text: 'One dashboard that pulls your repo,' },
  { text: 'deploys and issue tracker into a single' },
  { text: 'view, so you can see project health' },
  { text: 'without switching tabs.' },
]

const CHECKS = [
  { state: 'missing', Icon: IconMissing, tone: 'text-missing', text: 'Demo video missing' },
  {
    state: 'warn',
    Icon: IconWarn,
    tone: 'text-warn',
    text: "Your problem statement doesn't say who has this problem",
  },
  {
    state: 'warn',
    Icon: IconWarn,
    tone: 'text-warn',
    text: "MVP link isn't public — we couldn't open it",
  },
  {
    state: 'passed',
    Icon: IconPassed,
    tone: 'text-passed',
    text: 'Solution description looks solid',
  },
]

/** Derived from CHECKS so the tally can never drift from the list below it. */
const tally = (checks) => {
  const count = (state) => checks.filter((c) => c.state === state).length
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
  return [
    count('missing') && plural(count('missing'), 'blocker'),
    count('warn') && plural(count('warn'), 'warning'),
    count('passed') && `${count('passed')} passed`,
  ].filter(Boolean)
}

const STEPS = [
  {
    num: '01',
    title: 'Find it',
    body: "Browse live hackathons. Filter by team size, prize, or how long you've got.",
  },
  {
    num: '02',
    title: 'Check it',
    body: 'Run the readiness check as many times as you want before you submit. It tells you exactly what’s missing.',
  },
  {
    num: '03',
    title: 'Learn from it',
    body: 'Score, rubric breakdown, and written feedback on every submission. No exceptions.',
  },
]

const FOOTER_LINKS = ['Hackathons', 'Guidelines', 'Support', 'Contact', 'Privacy']

/** The reviewer's own deadline, ticking alongside the checks. */
const CHECK_DEADLINE = Date.now() + 624 * 60 * 1000 // 10h 24m

/** The clock is live, so the reassurance has to earn itself as time runs out. */
const reassurance = (ms) => {
  if (ms <= 0) return 'Deadline passed.'
  if (ms > 6 * HOUR) return 'Plenty of time.'
  if (ms > HOUR) return 'Still fixable.'
  return 'Cutting it close.'
}

/**
 * Owns the ticking clock so the 1Hz update stays a leaf. Hoisting useCountdown
 * into the page component re-rendered the entire landing tree every second.
 */
function ReadinessClock() {
  const remaining = useCountdown(CHECK_DEADLINE)

  return (
    <p className="font-mono text-[15px] text-volt-ink tabular-nums">
      {formatRemaining(remaining)} left. {reassurance(remaining)}
    </p>
  )
}

export default function DropLandingPage() {
  useDropSurface({ title: 'Drop — Build. Ship. Drop.', description: PITCH })

  return (
    <div className="drop">
      <a
        href="#top"
        className="absolute top-3 left-5 z-60 -translate-y-[200%] rounded-drop bg-volt px-4 py-2.5 text-sm font-semibold text-on-volt focus-visible:translate-y-0"
      >
        Skip to content
      </a>

      <DropNav />

      <main id="top">
        {/* ------------------------------ Hero ------------------------------ */}
        <section className={`${WRAP} pt-6 pb-10 md:pt-22 md:pb-24`} aria-labelledby="drop-hero-title">
          <p className={PILL_VOLT}>
            <span className="size-1.5 shrink-0 rounded-full bg-volt" aria-hidden="true" />
            <span>
              <span className={MONO}>14</span> hackathons live right now
            </span>
          </p>

          <h1
            id="drop-hero-title"
            className="mt-5 text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-ink md:mt-7 md:max-w-[14ch] md:text-[56px] md:leading-[1.02] xl:text-[72px]"
          >
            Build. Ship. Drop.
          </h1>

          <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-muted md:mt-6 md:text-[18px]">
            Find a hackathon, submit your build, and find out what&rsquo;s wrong with it before the
            deadline — not after.
          </p>

          <div className="mt-6 flex flex-col gap-2.5 md:mt-9 md:flex-row md:flex-wrap md:gap-3">
            <a className={BTN_VOLT} href="#hackathons">
              Browse hackathons
            </a>
            <a className={BTN_GHOST} href="#how-it-works">
              How it works
            </a>
          </div>
        </section>

        {/* -------------------------- Hackathon board ------------------------ */}
        <HackathonBoard />

        {/* ------------------------------ Hook ------------------------------ */}
        <section className={`${WRAP} py-18 text-center md:py-28`} aria-labelledby="drop-hook-title">
          <h2
            id="drop-hook-title"
            className="mx-auto max-w-[18ch] text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] text-ink xl:text-[52px]"
          >
            Ever lost and never found out why?
          </h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-base text-muted md:text-[17px]">
            Form in. Score out. Silence. That&rsquo;s how most hackathons end.
          </p>
        </section>

        {/* ------------------------- Readiness check ------------------------- */}
        <section className="border-y border-hairline py-16 md:py-26" aria-labelledby="drop-check-title">
          <div className={WRAP}>
            <div className="mb-7 max-w-[660px] md:mb-12">
              <span className={`${EYEBROW} mb-3.5`}>Readiness check</span>
              <h2
                id="drop-check-title"
                className="text-[30px] leading-[1.08] font-semibold tracking-[-0.03em] text-ink md:text-4xl xl:text-[44px]"
              >
                Find out before the deadline, not after.
              </h2>
              <p className="mt-4 text-base text-muted md:text-[17px]">
                Run it any time before you submit. It reads your entry the way an evaluator will,
                and tells you what&rsquo;s weak while you can still do something about it.
              </p>
            </div>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              {/* Left — the draft */}
              <div className={`${PANEL} overflow-hidden`}>
                <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
                  <span className="font-mono text-[12.5px] text-muted">submission.md</span>
                  <span className="rounded-md border border-hairline bg-raised px-[9px] py-1 font-mono text-[11px] tracking-[0.04em] text-muted uppercase">
                    Draft
                  </span>
                </div>

                <div className="overflow-x-auto px-4 py-[18px]">
                  {DRAFT.map((line, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[28px_minmax(0,1fr)] gap-4 font-mono text-[13px] leading-[1.85] whitespace-pre-wrap"
                    >
                      {/* Decorative gutter, kept above 3:1 all the same. */}
                      <span className="text-right text-muted/80 select-none" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className={line.heading ? 'font-semibold text-ink' : 'text-ink/75'}>
                        {line.text}
                      </span>
                    </div>
                  ))}
                </div>

                <dl className="border-t border-hairline">
                  <div className="flex items-center justify-between gap-4 px-4 py-[13px] text-[13.5px]">
                    <dt className="text-muted">MVP link</dt>
                    <dd className="overflow-hidden font-mono text-[12.5px] text-ellipsis whitespace-nowrap text-ink/75">
                      drop-mvp-a91.vercel.app
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-hairline px-4 py-[13px] text-[13.5px]">
                    <dt className="text-muted">Demo video</dt>
                    {/* Dimmer than a filled value, but it's real content — keeps AA. */}
                    <dd className="font-mono text-[12.5px] text-muted">not added</dd>
                  </div>
                </dl>
              </div>

              {/* Right — the result */}
              <div className={`${PANEL} p-[22px]`}>
                <ReadinessClock />

                <p className="mt-3.5 mb-5 flex flex-wrap items-center gap-2.5 border-b border-hairline pb-5 font-mono text-[12.5px] text-muted">
                  {tally(CHECKS).map((part, index) => (
                    <Fragment key={part}>
                      {index > 0 && <span aria-hidden="true">·</span>}
                      <span>{part}</span>
                    </Fragment>
                  ))}
                </p>

                <ul className="flex flex-col gap-2.5">
                  {CHECKS.map(({ Icon, tone, text }) => (
                    <li
                      key={text}
                      className={`flex items-start gap-3 rounded-drop border border-hairline bg-raised px-4 py-[15px] text-[14.5px] leading-normal ${tone}`}
                    >
                      <Icon width={18} height={18} className="mt-px shrink-0" />
                      <span className="font-normal">{text}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-5 border-t border-hairline pt-[18px] text-[13.5px] text-muted">
                  Fix something, run it again. There&rsquo;s no limit before the deadline.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------- How it works -------------------------- */}
        <section className="py-11 md:py-18" id="how-it-works" aria-labelledby="drop-how-title">
          <div className={WRAP}>
            <h2
              id="drop-how-title"
              className="mb-9 text-[26px] font-semibold tracking-[-0.025em] text-ink md:text-[32px]"
            >
              How it works
            </h2>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-5">
              {STEPS.map((step) => (
                <div key={step.num} className="border-t border-hairline pt-[22px]">
                  <span className="font-mono text-[13px] tracking-[0.04em] text-muted tabular-nums">
                    {step.num}
                  </span>
                  <h3 className="mt-3.5 text-xl font-semibold tracking-[-0.015em] text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 max-w-[34ch] text-[15px] text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------ Numbers ----------------------------- */}
        <section className="border-y border-hairline py-12 md:py-18" aria-label="Drop in numbers">
          <div className={WRAP}>
            <div className="grid grid-cols-1 md:grid-cols-3">
              <CountUpStat value={14} label="live hackathons" />
              <CountUpStat value={8400} label="builders" />
              <CountUpStat value={100} suffix="%" label="get feedback" emphasis />
            </div>
          </div>
        </section>

        {/* ---------------------------- For organisers ------------------------ */}
        <section className="border-b border-hairline bg-surface" aria-labelledby="drop-org-title">
          <div
            className={`${WRAP} flex flex-col items-start justify-between gap-7 py-12 lg:flex-row lg:items-center lg:gap-10 lg:py-18`}
          >
            <div>
              <h2
                id="drop-org-title"
                className="text-[28px] font-semibold tracking-[-0.02em] text-ink"
              >
                Running a hackathon?
              </h2>
              <p className="mt-3 max-w-[56ch] text-[15.5px] text-muted">
                List it on Drop. Set your rubric, assign evaluators, and let the platform handle
                submissions, scoring, and feedback delivery.
              </p>
            </div>
            <Link to="/register" className={`${BTN_GHOST} w-full shrink-0 md:w-auto`}>
              List a hackathon
            </Link>
          </div>
        </section>

        {/* ----------------------------- Final CTA ---------------------------- */}
        <section className="bg-volt py-16 text-center md:py-24" aria-labelledby="drop-cta-title">
          <div className={WRAP}>
            <h2
              id="drop-cta-title"
              className="text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] text-on-volt xl:text-[52px]"
            >
              Something&rsquo;s always closing soon.
            </h2>
            <p className="mt-8">
              <Link
                to="/register"
                className={`${BTN} w-full border-transparent bg-canvas font-semibold text-ink hover:bg-raised focus-visible:outline-on-volt md:w-auto`}
              >
                Create your account
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* ------------------------------- Footer ------------------------------- */}
      <footer className="py-12">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-6`}>
          <span className="text-[15px] font-semibold tracking-[-0.03em] text-muted">Drop</span>
          <nav className="flex flex-wrap gap-x-6 gap-y-4 md:gap-7" aria-label="Footer">
            {FOOTER_LINKS.map((label) => (
              <a
                key={label}
                href="#top"
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
