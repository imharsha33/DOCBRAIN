import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ArrowRight,
  FileText,
  MessageSquare,
  Layers,
  Search,
  Zap,
  Shield,
  BookOpen,
  Quote,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DocBrain AI — Understand Every Document. Instantly." },
      {
        name: "description",
        content:
          "Upload PDFs, Word files, and notes. Chat with your documents and get accurate answers with source citations.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <HowItWorks />
      <Features />
      <Testimonials />
      <Faq />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-xl bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
            <img src="/logo.jpg" alt="DocBrain Logo" className="h-full w-full object-cover" />
          </div>
          <span className="text-base font-semibold tracking-tight">DocBrain AI</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link to="/dashboard">Get started <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 hero-grid opacity-30" />
      <div className="relative mx-auto max-w-4xl px-6 py-28 text-center md:py-36">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-brand" /> AI-Powered Document Intelligence
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
          <span className="text-gradient">Understand Every Document.</span>
          <br />
          <span className="font-display italic">Instantly.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          Upload PDFs, notes, and research. Ask questions naturally and receive accurate, cited answers powered by AI.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/dashboard">
              Start free <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#how">See how it works</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: FileText, title: "Upload", body: "Drop PDFs, Markdown, TXT, or CSV files. Your data stays private to your workspace." },
    { icon: Zap, title: "Index", body: "We split, embed, and store your content for fast semantic search." },
    { icon: MessageSquare, title: "Ask", body: "Chat naturally. Every answer is grounded in your documents with clickable citations." },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeader eyebrow="How it works" title="From upload to insight in seconds." />
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="text-xs text-muted-foreground">Step {i + 1}</div>
            <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const feats = [
    { icon: Search, title: "Semantic Search", body: "Find concepts, not just keywords, across every file you upload." },
    { icon: Layers, title: "Collections", body: "Organize documents by project, class, or client and chat with any combination." },
    { icon: BookOpen, title: "Grounded Citations", body: "Every answer cites the exact document and page. No hallucinations." },
    { icon: Shield, title: "Private by Design", body: "Your files are only visible to you. Data stays secure in your workspace." },
    { icon: MessageSquare, title: "Multi-doc Chat", body: "Select many documents and get synthesized answers across all of them." },
    { icon: Zap, title: "Blazing Fast Retrieval", body: "Indexed vector search returns relevant passages in milliseconds." },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeader eyebrow="Features" title="Everything you need for document intelligence." />
      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {feats.map((f) => (
          <div key={f.title} className="group rounded-2xl border border-border/60 bg-card/40 p-6 transition hover:border-brand/40">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    { name: "Amelia Chen", role: "PhD Researcher", body: "DocBrain replaced five hours of lit review with fifteen minutes of chat. Citations are always spot-on." },
    { name: "Marcus Reyes", role: "Legal Ops", body: "We drop entire contract sets in and ask specific clause questions. The page-level citations are a game changer." },
    { name: "Priya Nair", role: "Product Manager", body: "Our team's Notion + PDFs finally feel searchable. It's the interface I always wanted for our own docs." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeader eyebrow="Loved by teams" title="What people are saying." />
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {items.map((t) => (
          <div key={t.name} className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <Quote className="h-6 w-6 text-brand" />
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">{t.body}</p>
            <div className="mt-6">
              <div className="text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.role}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    { q: "What file types do you support?", a: "PDF, DOCX, TXT, Markdown, and CSV. More formats coming soon." },
    { q: "Are my documents private?", a: "Yes. Your files are securely stored in your personal workspace. No one else can read your files." },
    { q: "Which AI models do you use?", a: "DocBrain uses best-in-class AI models for generation and embeddings. Providers are abstracted so you can swap them later." },
    { q: "Can I use it for free?", a: "Yes — during the beta, all features are free to explore." },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <SectionHeader eyebrow="FAQ" title="Frequently asked questions." />
      <div className="mt-10 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40">
        {faqs.map((f) => (
          <details key={f.q} className="group p-6">
            <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
              {f.q}
              <span className="text-muted-foreground group-open:rotate-45 transition">+</span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" /> DocBrain AI © {new Date().getFullYear()}
        </div>
        <div className="text-xs text-muted-foreground">Understand Every Document. Instantly.</div>
      </div>
    </footer>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-xs uppercase tracking-widest text-brand">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
    </div>
  );
}
