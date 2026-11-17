import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="November 17, 2026">
      <p>Driftbook is a shared planning app run by Salt &amp; Sovereignty. By using it, you agree to these terms.</p>

      <h2>Your account</h2>
      <p>Keep your sign-in details safe. You&apos;re responsible for what happens under your account. You must be old enough to agree to these terms where you live.</p>

      <h2>Your content</h2>
      <p>What you add stays yours. You give us permission to store it and show it to the people you share your plans with, only so Driftbook can work. Don&apos;t upload anything you don&apos;t have the right to share, or anything illegal, hateful or harassing.</p>

      <h2>Sharing</h2>
      <p>Anyone you invite to a space as an editor can change its shared information. Only invite people you trust, and use &quot;view only&quot; invites when someone just needs to see the plan.</p>

      <h2>Bookings and money</h2>
      <p>Driftbook helps you organize plans. It doesn&apos;t book anything or move money. Always double-check flight times, reservations and confirmation details with the airline, hotel or provider. Currency conversions are estimates.</p>

      <h2>Availability</h2>
      <p>We work to keep Driftbook running and your data safe, but it&apos;s provided as is, without guarantees. Keep copies of anything critical, like tickets and confirmations. We may change or discontinue features, and we&apos;ll update these terms when that happens.</p>

      <h2>Contact</h2>
      <p><a href="mailto:saltandsovereignty@gmail.com">saltandsovereignty@gmail.com</a></p>
    </LegalPage>
  );
}
