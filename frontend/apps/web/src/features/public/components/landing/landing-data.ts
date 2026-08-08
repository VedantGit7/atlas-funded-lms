export const FAQ_DATA = [
  {
    q: "Do I need trading experience to get started?",
    a: "Not at all. The free diagnostic assesses where you currently stand, whether you're a complete beginner or an experienced trader. It tells you exactly what to work on first, with no prior knowledge assumed.",
  },
  {
    q: "What's included in the free diagnostic?",
    a: "A 20-question assessment covering risk management, trading psychology, technical analysis, and prop firm rule awareness. You get an instant score breakdown by category with specific, actionable recommendations.",
  },
  {
    q: "What's the difference between the free tools and paid courses?",
    a: "The free tools (trade journal, risk calculator, habit tracker) build consistent daily habits. The paid courses provide structured video lessons, strategy frameworks, and the deeper knowledge that turns good habits into a real, testable edge.",
  },
  {
    q: "Will FundedBeyond guarantee I pass a funded evaluation?",
    a: "No academy can guarantee your results. Challenges depend on your live execution and discipline. What we guarantee is that you'll understand the rules, have built the right habits, and have a tested strategy before you attempt one.",
  },
  {
    q: "Which prop firms does the curriculum cover?",
    a: "The curriculum is firm-agnostic, covering universal skills and rules that apply across all major evaluation-based prop firms. You'll be prepared regardless of which firm you choose.",
  },
  {
    q: "How long does it take to complete the courses?",
    a: "Foundation courses take 2-3 weeks at a comfortable pace. Pro adds another 4-6 weeks of deeper content. Most students feel evaluation-ready within a month of starting.",
  },
] as const;

export const STATS = [
  { value: "4,200+", label: "Students Enrolled" },
  { value: "73%", label: "Evaluation Pass Rate", accent: true },
  { value: "12", label: "Structured Courses" },
  { value: "Free", label: "To Start, Always", gold: true },
] as const;

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Take the Free Diagnostic",
    body: "A 20-question readiness assessment across risk management, psychology, technical knowledge, and prop firm rules. Free, instant, no signup required.",
    link: { href: "#diagnostic", label: "Free forever →" },
  },
  {
    step: "02",
    title: "Build Daily Habits",
    body: "Use the free practice tools: trade journal, risk calculator, and habit tracker to build the consistency and discipline that prop firm evaluations are specifically designed to test.",
    link: { href: "#tools", label: "Free tools →" },
  },
  {
    step: "03",
    title: "Master Your Edge",
    body: "Enroll in structured courses built by funded traders covering risk strategy, evaluation psychology, and firm-specific playbooks, then attempt your challenge with genuine confidence.",
    link: { href: "#courses", label: "See courses →" },
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "After 3 failed evaluations I finally understood what I was doing wrong. The diagnostic pinpointed my risk management issues immediately. It saved me another $400 in challenge fees.",
    name: "Jordan M.",
    detail: "Now funded at $25K",
    badge: "Foundation",
  },
  {
    quote:
      "The daily habit tools changed my consistency completely. I went from overtrading every session to hitting my targets calmly. Passed my first evaluation on the very next attempt.",
    name: "Sarah K.",
    detail: "Passed her first evaluation",
    badge: "Free Tools",
  },
  {
    quote:
      "The structured courses gave me a framework I could actually stick to. Real, applicable content, not generic theory. Cleared a $100K challenge within 6 weeks of completing the Pro course.",
    name: "Michael T.",
    detail: "Cleared $100K challenge",
    badge: "Pro",
  },
] as const;

export const WHO_ITS_FOR = [
  {
    step: "01",
    title: "Complete Beginners",
    body: "You've heard about prop firm funding but haven't traded professionally yet. The diagnostic tells you exactly what to learn first. No wasted time, no guesswork about where to start.",
  },
  {
    step: "02",
    title: "Failed Challengers",
    body: "You've attempted evaluations before and failed. The diagnostic pinpoints exactly why, and the courses give you a concrete path to fixing it before you spend another challenge fee.",
  },
  {
    step: "03",
    title: "Consistent Traders",
    body: "You already trade profitably but haven't attempted a funded challenge yet. The courses help you adapt your existing strategy to evaluation constraints without breaking what already works.",
  },
] as const;
