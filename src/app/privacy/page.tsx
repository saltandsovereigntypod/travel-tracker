import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="November 17, 2026">
      <p>
        Driftbook is a trip-planning app run by Salt &amp; Sovereignty. This page explains what we collect, why,
        and what control you have. The short version: we only keep what you put in to plan your trips, we never sell it,
        and only the people you invite to a trip can see that trip.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address, display name and, if you sign in with Google, your Google profile name and photo. We never see your Google password.</li>
        <li><strong>Trip content you add:</strong> trips, ideas, itinerary plans, flights, stays, expenses, packing lists, notes, journal entries, comments, votes and photos.</li>
        <li><strong>Your personal design:</strong> the theme, layout, stickers and images you use to decorate your own view.</li>
        <li><strong>Basic technical data:</strong> standard server logs (such as IP address and browser type) kept by our hosting providers for security and troubleshooting.</li>
      </ul>

      <h2>Who can see what</h2>
      <ul>
        <li>Shared trip information is visible only to people who are members of that trip.</li>
        <li>Private notes, your personal packing list and your personal design are visible only to you.</li>
        <li>If a trip owner turns on a read-only share link, anyone with that link can see the trip name, dates, itinerary, stay names and flight times. It never includes confirmation codes, costs, notes, ideas or photos. The owner can turn the link off at any time.</li>
      </ul>

      <h2>How we use it</h2>
      <p>Only to run Driftbook: signing you in, saving and syncing your trips, and showing them to the people you share them with. We don&apos;t sell your data, show ads, or use your content to train AI models.</p>

      <h2>Services we rely on</h2>
      <ul>
        <li><strong>Supabase</strong> stores accounts, trip data and photos.</li>
        <li><strong>Cloudflare</strong> hosts the website.</li>
        <li><strong>Google</strong>, only if you choose &quot;Continue with Google&quot;.</li>
        <li><strong>OpenStreetMap services</strong> (Photon search and OpenFreeMap tiles) receive the place names you search for and the map areas you view.</li>
        <li><strong>Frankfurter</strong> receives currency codes when converting an expense.</li>
        <li><strong>Google Fonts</strong> delivers the fonts used in themes.</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>You can edit or delete anything you&apos;ve added, leave a trip, or (as an owner) delete a trip and everything in it.</li>
        <li>You can download a copy of a trip from Trip settings.</li>
        <li>To delete your account entirely, email us and we&apos;ll remove it and your personal content.</li>
      </ul>

      <h2>Contact</h2>
      <p>Questions or requests: <a href="mailto:saltandsovereignty@gmail.com">saltandsovereignty@gmail.com</a></p>
    </LegalPage>
  );
}
