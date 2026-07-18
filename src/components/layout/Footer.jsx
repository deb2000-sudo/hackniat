export default function Footer() {
  return (
    <footer className="footer">
      <div className="container row-between wrap">
        <span>© {new Date().getFullYear()} HackNIAT — AI Hackathon Evaluator</span>
        <span className="text-subtle">Evaluating innovation, powered by AI.</span>
      </div>
    </footer>
  )
}
