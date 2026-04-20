import Link from 'next/link'
import Nav from '@/components/Nav'

export default function Home() {
  return (
    <div className="min-h-screen bg-navy text-cream font-body">

      <Nav />

      {/* HERO */}
      <section
        className="relative overflow-hidden text-center px-6 py-16 md:py-24"
        style={{background:'linear-gradient(160deg, #0d1f3c 0%, #1a3a0a 60%, #2d5a1b 100%)'}}
      >
        <div className="relative z-10 max-w-2xl mx-auto">
          <p className="font-condensed tracking-widest uppercase text-sm mb-4 text-dirt">
            ⚾ Find Your People
          </p>
          <h1
            className="font-display leading-none mb-6 text-cream"
            style={{fontSize:'clamp(3rem, 10vw, 6rem)'}}
          >
            Lace Up.<br />
            <span className="text-dirt">Show Up.</span><br />
            Play Ball.
          </h1>
          <p className="text-base md:text-lg mb-8 mx-auto max-w-md leading-relaxed" style={{color:'rgba(245,237,214,0.75)'}}>
            Connect with baseball players near you — play catch, find pickup games, take lessons, or test gear with the community.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth"
              className="font-condensed font-bold tracking-widest uppercase px-8 py-4 rounded bg-dirt text-navy hover:bg-dirt-dark transition-all"
            >
              Get Started
            </Link>
            <Link
              href="/players"
              className="font-condensed font-semibold tracking-widest uppercase px-8 py-4 rounded text-cream border-2 transition-all"
              style={{borderColor:'rgba(245,237,214,0.3)'}}
            >
              Browse Players
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-4xl mx-auto px-6 py-16 md:py-20">
        <h2 className="font-display text-4xl md:text-5xl tracking-wide text-center text-cream mb-10">
          How It <span className="text-dirt">Works</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {icon:'👤', title:'Create Your Profile',  desc:"List your position, experience level, and a short bio. Tell the community who you are and what you're looking for."},
            {icon:'🔍', title:'Find Players Nearby',  desc:"Browse players in your area filtered by level and position. See who's verified by the community."},
            {icon:'⚾', title:'Get Out & Play',       desc:'Send a catch request, join a pickup game, book a lesson, or show up to a gear meetup. Go play ball.'},
          ].map(step => (
            <div
              key={step.title}
              className="text-center p-6 rounded-xl border"
              style={{background:'rgba(255,255,255,0.03)', borderColor:'rgba(196,130,42,0.2)'}}
            >
              <div className="text-4xl mb-4">{step.icon}</div>
              <h3 className="font-condensed font-bold tracking-wide text-lg text-cream mb-3">{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{color:'rgba(245,237,214,0.55)'}}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center px-6 py-16 md:py-24">
        <h2 className="font-display text-4xl md:text-5xl tracking-wide text-cream mb-4">
          Ready to <span className="text-dirt">Get Back Out There?</span>
        </h2>
        <p className="text-lg mb-8" style={{color:'rgba(245,237,214,0.6)'}}>
          Join thousands of players already finding their crew.
        </p>
        <Link
          href="/auth"
          className="font-condensed font-bold tracking-widest uppercase px-10 py-4 rounded bg-dirt text-navy hover:bg-dirt-dark transition-all inline-block"
        >
          Join CatchUp Free
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="border-t px-6 py-8 text-center" style={{borderColor:'rgba(196,130,42,0.2)'}}>
        <div className="font-display text-2xl text-cream mb-2">
          Catch<span className="text-dirt">Up</span>
        </div>
        <p className="font-condensed text-sm tracking-wide" style={{color:'rgba(245,237,214,0.3)'}}>
          © 2026 CatchUp. Built for players, by players.
        </p>
      </footer>

    </div>
  )
}