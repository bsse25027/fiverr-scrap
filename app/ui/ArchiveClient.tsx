"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { Buyer, Gig } from "../types";
import styles from "./DashboardClient.module.css";

function getInitials(value: string | null | undefined) {
  const text = (value || "?").trim();
  const words = text.split(/\s+/);
  return words.length > 1 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : text.slice(0, 2).toUpperCase();
}

function getGigTitle(gig: Gig | undefined) {
  if (!gig) return "Unknown gig";
  if (gig.title) return gig.title;
  try {
    const slug = new URL(gig.gig_url).pathname.split("/").filter(Boolean).at(-1) || gig.gig_key;
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return gig.gig_key;
  }
}

export default function ArchiveClient({ initialBuyers, gigs }: { initialBuyers: Buyer[]; gigs: Gig[] }) {
  const [buyers, setBuyers] = useState(initialBuyers);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const gigsByKey = useMemo(() => new Map(gigs.map((gig) => [gig.gig_key, gig])), [gigs]);
  const filteredBuyers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buyers;

    return buyers.filter((buyer) => {
      const gig = gigsByKey.get(buyer.gig_key);
      return [
        buyer.username,
        buyer.country || "",
        buyer.review || "",
        buyer.archive_note || "",
        getGigTitle(gig)
      ].join(" ").toLowerCase().includes(q);
    });
  }, [buyers, gigsByKey, query]);

  function unarchiveReview(id: number) {
    const previous = buyers;
    setBuyers((current) => current.filter((buyer) => buyer.id !== id));

    startTransition(async () => {
      const response = await fetch(`/api/reviews/item/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: false })
      });

      if (!response.ok) setBuyers(previous);
    });
  }

  return (
    <main className={styles.pageShell}>
      <header className={styles.detailTopbar}>
        <div>
          <Link className={styles.backLink} href="/">Back to gigs</Link>
          <h1>Archived reviews</h1>
          <p>Reviews hidden from normal gig pages until you unarchive them.</p>
        </div>
        <span className={isPending ? styles.savingBadge : styles.liveBadge}>{isPending ? "Saving" : "Archive"}</span>
      </header>

      <section className={styles.toolbar}>
        <div>
          <h2>Archive folder</h2>
          <p>{filteredBuyers.length} visible from {buyers.length} archived</p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search archived username, note, gig, country"
        />
      </section>

      {!filteredBuyers.length ? (
        <div className={styles.emptyState}>
          <strong>No archived reviews</strong>
          <span>Archived reviews will appear here with their notes.</span>
        </div>
      ) : (
        <section className={styles.reviewGrid}>
          {filteredBuyers.map((buyer) => {
            const gig = gigsByKey.get(buyer.gig_key);

            return (
              <article key={buyer.id} className={styles.archiveCard}>
                <div className={styles.reviewHead}>
                  <div className={styles.buyerAvatar}>
                    {buyer.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={buyer.profile_image_url} alt={buyer.username} />
                    ) : (
                      getInitials(buyer.username)
                    )}
                  </div>
                  <div className={styles.reviewIdentity}>
                    <h3>{buyer.username}</h3>
                    <p>{[buyer.country, getGigTitle(gig)].filter(Boolean).join(" - ")}</p>
                  </div>
                  <button className={styles.markButton} onClick={() => unarchiveReview(buyer.id)}>
                    Unarchive
                  </button>
                </div>

                {buyer.archive_note ? (
                  <div className={styles.archiveNote}>
                    <span>Your note</span>
                    <p>{buyer.archive_note}</p>
                  </div>
                ) : null}

                <div className={styles.reviewQuote}>
                  <span className={styles.quoteMark}>"</span>
                  <p>{buyer.review || "No review text captured."}</p>
                </div>

                <div className={styles.reviewFooter}>
                  <span>Archived {buyer.archived_at ? new Date(buyer.archived_at).toLocaleString() : "recently"}</span>
                  {gig ? <Link href={`/gigs/${encodeURIComponent(gig.gig_key)}`}>Open gig</Link> : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
