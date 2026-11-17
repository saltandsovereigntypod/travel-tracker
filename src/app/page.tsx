"use client";

import Link from "next/link";
import { Lightbulb, CalendarDays, Plane, BedDouble, Wallet, Palette, Map, Users, Luggage, BookHeart, WifiOff, Share2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const FEATURES = [
  { icon: Lightbulb, title: "Ideas board", text: "Everyone drops in things they want to do. Vote, comment, then move the winners onto the plan." },
  { icon: CalendarDays, title: "Day-by-day itinerary", text: "Drag plans between days. Flights and check-ins show up on the right day automatically." },
  { icon: Plane, title: "Flights", text: "Boarding-pass cards with times, confirmation codes and who's on which flight." },
  { icon: BedDouble, title: "Stays", text: "Hotels, hostels and rentals with nights, addresses and check-in times." },
  { icon: Wallet, title: "Budget & splitting", text: "Log costs in any currency. Driftbook works out who owes whom." },
  { icon: Luggage, title: "Packing", text: "A shared list for the group, plus a private list for each person." },
  { icon: Map, title: "Map", text: "Every idea, plan and stay pinned, with each day's route." },
  { icon: Palette, title: "Your own design", text: "Pages or a free-form board. Themes, fonts, colors, stickers. Nobody else's view changes." },
  { icon: Users, title: "Live together", text: "See changes the moment someone makes them, and who's looking at what." },
  { icon: BookHeart, title: "Journal & scrapbook", text: "Afterwards, your plans, journal and photos become a keepsake." },
  { icon: WifiOff, title: "Works offline", text: "Install it on your phone. Your last-synced plans open with no signal." },
  { icon: Share2, title: "Share a read-only link", text: "Send the itinerary to family without making them sign up." },
];

export default function Landing() {
  const { user, ready } = useAuth();
  const signedIn = ready && !!user;
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="brand-mark" />
          Driftbook
        </Link>
        <div className="row">
          {signedIn ? (
            <Link href="/trips" className="btn btn-primary">Open Driftbook</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">Sign in</Link>
              <Link href="/login?mode=signup" className="btn btn-primary">Start planning</Link>
            </>
          )}
        </div>
      </nav>

      <section className="hero-grid">
        <div>
          <p className="chip">Plan together · design your own way</p>
          <h1 style={{ marginTop: "1rem" }}>
            One plan.<br />
            <em>Everyone&apos;s</em> own scrapbook.
          </h1>
          <p className="hero-lead">
            Trips, weddings, podcast seasons, your household: Driftbook drifts with your needs. Everyone shares the same
            plans, money and calendar, everything feeds everything else, and each of you arranges and decorates it your own way.
          </p>
          <div className="row wrap">
            <Link href={signedIn ? "/trips" : "/login?mode=signup"} className="btn btn-primary btn-lg">
              {signedIn ? "Open Driftbook" : "Start planning"}
            </Link>
            <a href="#features" className="btn btn-lg">See what&apos;s inside</a>
          </div>
        </div>
        <div className="collage" aria-hidden>
          <div className="card" style={{ left: "4%", top: "6%", width: "62%", transform: "rotate(-3deg)", padding: 0, overflow: "hidden" }}>
            <div style={{ height: 150, background: "linear-gradient(135deg,#3D5A80,#E07A5F)" }} />
            <div style={{ padding: "1rem" }}>
              <div className="day-num">Day 3 · Sat Oct 30</div>
              <h3 style={{ marginTop: 4 }}>Haunted walking tour</h3>
              <p className="muted small">8:00 PM · Essex St</p>
            </div>
          </div>
          <div className="card" style={{ right: "2%", top: "0%", width: "44%", transform: "rotate(4deg)", background: "#1B1420", color: "#F4E9DC", borderColor: "#3E2E47" }}>
            <p style={{ fontFamily: "Caveat, cursive", fontSize: "1.5rem", color: "#F28C28" }}>Daniel&apos;s view 🦇</p>
            <p className="small" style={{ opacity: 0.8 }}>Same plans, spooky theme.</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stickers/passport-stamp.svg" alt="" style={{ right: "10%", bottom: "8%", width: 150, transform: "rotate(-12deg)" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stickers/pumpkin.svg" alt="" style={{ left: "6%", bottom: "6%", width: 90, transform: "rotate(8deg)" }} />
          <div className="card" style={{ left: "30%", bottom: "4%", width: "40%", transform: "rotate(-1deg)" }}>
            <div className="row-between">
              <strong>Witch Museum</strong>
              <span className="vote-btn on">▲ 3</span>
            </div>
            <p className="muted small">Idea from Lizza</p>
          </div>
        </div>
      </section>

      <section id="features" style={{ paddingTop: "2rem" }}>
        <h2 style={{ fontSize: "2rem", marginBottom: "1.2rem" }}>Everything a group plan needs</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="empty-icon" style={{ margin: 0, width: 44, height: 44, borderRadius: 14 }}>
                <f.icon size={22} />
              </div>
              <h3>{f.title}</h3>
              <p className="muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="tiny muted" style={{ textAlign: "center", marginTop: "3rem" }}>
        Driftbook by Salt &amp; Sovereignty · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
      </footer>
    </div>
  );
}
