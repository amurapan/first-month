import LegalLayout from "@/components/legal-layout";
export default function Privacy() {
  return (
    <LegalLayout title="Your numbers. Your choices.">
      <p>
        First Month is a shared planning tool for adults. This page explains
        what this version stores, when your partner can see it, and how to
        remove it. Questions or privacy requests:{" "}
        <a href="mailto:kudomiya@proton.me">kudomiya@proton.me</a>.
      </p>
      <h2>What you enter</h2>
      <p>
        We store the information you save: names, income, optional personal
        costs and preferences, shared expenses, decision answers and proposals,
        weekly check-ins, confirmations, plan history, and monthly records of
        shared costs, refunds, and reported transfers. We do not connect to bank
        accounts, collect bank credentials, move money, or take payment in this
        release.
      </p>
      <h2>What your partner sees</h2>
      <p>
        Your financial profile appears to your partner after both people choose
        to share. Preliminary partner-income estimates are private to their
        author. Personal answers to a decision or weekly check-in have a
        separate sharing choice and appear together after both people share.
        Titles, proposed costs, shared action items, and agreements belong to
        your shared space. Monthly records are shared records and are available
        while both financial profiles are shared; there is no private expense
        mode in the monthly ledger. Anyone with a personal link can access and
        act as that role.
      </p>
      <h2>Invitations and product feedback</h2>
      <p>
        An unused invitation shows the inviting partner’s name and whether a
        starting comparison has been saved. It does not reveal incomes, costs,
        answers or estimates. Opening the invitation does not join the space;
        that requires a separate action.
      </p>
      <p>
        Product feedback is visible to its author and the First Month team,
        never to the other partner. We store your note, category, screen name,
        household reference, role, sample-household flag and submission time.
        Financial values and access links are not attached automatically.
        Feedback is not sent to the conversation provider. You can view or
        delete your notes in the feedback form; they are included in your own
        data export and removed when the space is deleted. Unfinished feedback
        may be saved in your browser. The form does not collect an email address
        or send notifications.
      </p>
      <h2>Generated conversation support</h2>
      <p>
        When you request a conversation guide or recap, the service sends
        mutually shared names, priorities, notes, relevant decision or check-in
        text, category names and calculated indicators (such as which categories
        exceeded the plan or whether a transfer awaits confirmation) to Groq, or
        a configured OpenAI alternative. Structured income, expense amounts,
        balances, and numeric comfort limits are excluded. Anything you type
        into a note is sent as written, so avoid information you do not want
        processed by the provider. We request that generated responses are not
        stored as response objects; the provider’s own processing policies still
        apply. Generating a recap is optional.
      </p>
      <h2>Storage and hosting</h2>
      <p>
        The service uses Cloudflare-backed storage through Sites. Vercel may
        serve the public address and forward requests to the same service. These
        infrastructure providers process requests to operate the service and may
        retain operational logs under their own policies. Personal access tokens
        are stored as hashes in the database. Links keep tokens after the #
        fragment; authenticated API calls send tokens in authorization headers.
      </p>
      <p>
        Your browser stores unfinished forms, your recent personal link, and
        navigation preferences. These can contain financial amounts. Use a
        private browser profile on shared devices. Clearing browser data removes
        local copies, not the saved household. We do not include advertising
        pixels or third-party behavioral analytics in the app.
      </p>
      <h2>Export, retention, and deletion</h2>
      <p>
        Saved household records remain until the space is deleted. Open{" "}
        <strong>Settings & access → Export my data</strong> to download your own
        and mutually shared records; your partner’s private answers are
        excluded. Either person with a valid personal link can explicitly delete
        the shared space, which removes active records and disables both links.
        Copies previously exported or downloaded by either person are not
        remotely deleted. Infrastructure backups and operational logs may remain
        according to the hosting providers’ retention processes.
      </p>
      <p>
        You can replace your personal access link from Settings & access. Its
        previous version will stop working. Without a valid link or a backup, we
        cannot reliably verify ownership or recover a role.
      </p>
      <h2>Contact</h2>
      <p>
        For questions about your information, write to{" "}
        <a href="mailto:kudomiya@proton.me">kudomiya@proton.me</a>. Do not
        include your personal access token or sensitive financial details in an
        initial email.
      </p>
    </LegalLayout>
  );
}
