"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { Buyer, Gig } from "../types";
import styles from "./DashboardClient.module.css";

type Filter = "all" | "todo" | "done";

const LINKEDIN_GEO_URNS: Record<string, string> = {
  australia: "101452733",
  belgium: "100565514",
  brazil: "106057199",
  canada: "101174742",
  cyprus: "106774002",
  denmark: "104514075",
  egypt: "106155005",
  france: "105015875",
  germany: "101282230",
  india: "102713980",
  ireland: "104738515",
  italy: "103350119",
  netherlands: "102890719",
  pakistan: "101022442",
  qatar: "104170880",
  "saudi arabia": "100459316",
  spain: "105646813",
  switzerland: "106693272",
  "united arab emirates": "104305776",
  "united kingdom": "101165590",
  "united states": "103644278"
};

function getTitle(gig: Gig) {
  if (gig.title) return gig.title;

  try {
    const slug = new URL(gig.gig_url).pathname.split("/").filter(Boolean).at(-1) || gig.gig_key;
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return gig.gig_key;
  }
}

function getInitials(value: string | null | undefined) {
  const text = (value || "?").trim();
  const words = text.split(/\s+/);
  return words.length > 1 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : text.slice(0, 2).toUpperCase();
}

function googleUrl(username: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${username}"`)}`;
}

function lensUrl(imageUrl: string) {
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
}

function linkedinUrl(username: string) {
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(username)}&origin=GLOBAL_SEARCH_HEADER`;
}

function linkedinLocationUrl(username: string, country: string | null) {
  const geoUrn = country ? LINKEDIN_GEO_URNS[country.toLowerCase()] : null;
  if (!geoUrn) return null;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(username)}&origin=FACETED_SEARCH&geoUrn=${encodeURIComponent(JSON.stringify([geoUrn]))}`;
}

function parseReviewDetails(buyer: Buyer) {
  const original = buyer.review || "";
  const usernamePrefix = new RegExp(`^${buyer.username[0] || ""}${buyer.username}`, "i");
  const country = buyer.country || "";
  const ageMatch = original.match(/(\d+\s+(?:day|days|week|weeks|month|months|year|years)\s+ago)/i);
  const priceMatch = original.match(/((?:Up to\s+)?\$\d[\d,]*(?:\s*-\s*\$\d[\d,]*)?(?:\s+and above)?)(?=Price)/i);
  const durationMatch = original.match(/Price\s*([^$]*?)(?=Duration|$)/i);
  const repeatClient = /Repeat Client/i.test(original);

  let reviewText = original
    .replace(usernamePrefix, "")
    .replace(new RegExp(buyer.username, "ig"), "")
    .replace(/Repeat Client/ig, "")
    .replace(country, "")
    .replace(ageMatch?.[0] || "", "")
    .replace(priceMatch?.[0] || "", "")
    .replace(/Price/ig, "")
    .replace(durationMatch?.[1] || "", "")
    .replace(/Duration/ig, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!reviewText) reviewText = original || "No review text captured.";

  return {
    reviewText,
    age: ageMatch?.[1] || null,
    price: priceMatch?.[1] || null,
    duration: durationMatch?.[1]?.trim() || null,
    repeatClient
  };
}

export default function GigDetailClient({ gig, initialBuyers }: { gig: Gig; initialBuyers: Buyer[] }) {
  const [buyers, setBuyers] = useState(initialBuyers);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [isPending, startTransition] = useTransition();

  const filteredBuyers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return buyers.filter((buyer) => {
      if (buyer.archived) return false;
      if (filter === "done" && !buyer.done) return false;
      if (filter === "todo" && buyer.done) return false;
      if (!q) return true;

      return [
        buyer.username,
        buyer.country || "",
        buyer.review || ""
      ].join(" ").toLowerCase().includes(q);
    });
  }, [buyers, filter, query]);

  const activeBuyers = buyers.filter((buyer) => !buyer.archived);
  const doneCount = activeBuyers.filter((buyer) => buyer.done).length;
  const pendingCount = activeBuyers.length - doneCount;
  const avgRating = activeBuyers.length
    ? activeBuyers.reduce((sum, buyer) => sum + Number(buyer.rating || 0), 0) / activeBuyers.length
    : 0;
  const countries = new Set(activeBuyers.map((buyer) => buyer.country).filter(Boolean)).size;
  const archivedCount = buyers.length - activeBuyers.length;

  function toggleDone(id: number, done: boolean) {
    setBuyers((current) => current.map((buyer) => buyer.id === id ? { ...buyer, done } : buyer));

    startTransition(async () => {
      const response = await fetch(`/api/reviews/item/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ done })
      });

      if (!response.ok) {
        setBuyers((current) => current.map((buyer) => buyer.id === id ? { ...buyer, done: !done } : buyer));
      }
    });
  }

  function deleteReview(id: number) {
    const previous = buyers;
    setBuyers((current) => current.filter((buyer) => buyer.id !== id));

    startTransition(async () => {
      const response = await fetch(`/api/reviews/item/${id}`, { method: "DELETE" });
      if (!response.ok) setBuyers(previous);
    });
  }

  function archiveReview(id: number) {
    const note = window.prompt("Optional archive note for this review:", "")?.trim() || "";
    setBuyers((current) =>
      current.map((buyer) =>
        buyer.id === id
          ? {
              ...buyer,
              archived: true,
              archive_note: note || null,
              archived_at: new Date().toISOString()
            }
          : buyer
      )
    );

    startTransition(async () => {
      const response = await fetch(`/api/reviews/item/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archived: true, archiveNote: note })
      });

      if (!response.ok) {
        setBuyers((current) =>
          current.map((buyer) =>
            buyer.id === id
              ? { ...buyer, archived: false, archive_note: null, archived_at: null }
              : buyer
          )
        );
      }
    });
  }

  return (
    <main className={styles.pageShell}>
      <header className={styles.detailTopbar}>
        <div>
          <Link className={styles.backLink} href="/">Back to gigs</Link>
          <h1>{getTitle(gig)}</h1>
          <p>{gig.seller_username || "Unknown seller"} - {activeBuyers.length} active reviews, {archivedCount} archived</p>
        </div>
        <div className={styles.detailTopActions}>
          <span className={isPending ? styles.savingBadge : styles.liveBadge}>{isPending ? "Saving" : "Live"}</span>
        </div>
      </header>

      <section className={styles.gigDetailHero}>
        <div className={styles.heroMedia}>
          {gig.gig_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gig.gig_image_url} alt={getTitle(gig)} />
          ) : (
            <span>{getInitials(gig.title || gig.seller_username)}</span>
          )}
        </div>

        <div className={styles.heroBody}>
          <div className={styles.sellerRowLarge}>
            <div className={styles.avatarLarge}>
              {gig.seller_profile_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={gig.seller_profile_image_url} alt={gig.seller_username || "Seller"} />
              ) : (
                getInitials(gig.seller_username)
              )}
            </div>
            <div>
              <strong>{gig.seller_username || "Unknown seller"}</strong>
              <span>Seller profile</span>
            </div>
          </div>

          <div className={styles.heroMetrics}>
            <div>
              <span>Reviews</span>
              <strong>{activeBuyers.length}</strong>
            </div>
            <div>
              <span>Done</span>
              <strong>{doneCount}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </div>
            <div>
              <span>Archived</span>
              <strong>{archivedCount}</strong>
            </div>
            <div>
              <span>Countries</span>
              <strong>{countries}</strong>
            </div>
            <div>
              <span>Avg Rating</span>
              <strong>{avgRating ? avgRating.toFixed(1) : "-"}</strong>
            </div>
          </div>

          {gig.gig_url !== "unknown" ? (
            <a className={styles.openGigButton} href={gig.gig_url} target="_blank" rel="noopener noreferrer">
              Open original gig
            </a>
          ) : null}
        </div>
      </section>

      <section className={styles.aboutPanel}>
        <h2>About this gig</h2>
        <p>{gig.description || "No about section has been saved for this gig yet. Re-run the updated console script on this gig page to capture it."}</p>
      </section>

      <section className={styles.reviewsSection}>
        <div className={styles.toolbar}>
          <div>
            <h2>Reviews for this gig</h2>
            <p>{filteredBuyers.length} visible from {activeBuyers.length} active. Archived reviews live in the archive folder.</p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search username, country, review"
          />
          <div className={styles.filterGroup}>
            {(["all", "todo", "done"] as Filter[]).map((item) => (
              <button
                key={item}
                className={filter === item ? styles.filterActive : ""}
                onClick={() => setFilter(item)}
              >
                {item === "todo" ? "Pending" : item === "done" ? "Done" : "All"}
              </button>
            ))}
          </div>
        </div>

        {!filteredBuyers.length ? (
          <div className={styles.emptyState}>
            <strong>No reviews found</strong>
            <span>Try another filter or scrape more reviews for this gig.</span>
          </div>
        ) : (
          <div className={styles.reviewGrid}>
            {filteredBuyers.map((buyer) => {
              const locationUrl = linkedinLocationUrl(buyer.username, buyer.country);
              const details = parseReviewDetails(buyer);

              return (
                <article key={buyer.id} className={buyer.done ? styles.reviewCardDone : styles.reviewCard}>
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
                      <p>{buyer.country || "Unknown country"}</p>
                    </div>
                    <button className={buyer.done ? styles.doneButton : styles.markButton} onClick={() => toggleDone(buyer.id, !buyer.done)}>
                      {buyer.done ? "Done" : "Mark done"}
                    </button>
                  </div>

                  <div className={styles.reviewMetaGrid}>
                    <div className={styles.reviewMetaItem}>
                      <span>Rating</span>
                      <strong>{buyer.rating ? `${buyer.rating}/5` : "-"}</strong>
                    </div>
                    <div className={styles.reviewMetaItem}>
                      <span>Price</span>
                      <strong>{details.price || "-"}</strong>
                    </div>
                    <div className={styles.reviewMetaItem}>
                      <span>Duration</span>
                      <strong>{details.duration || "-"}</strong>
                    </div>
                    <div className={styles.reviewMetaItem}>
                      <span>When</span>
                      <strong>{details.age || "-"}</strong>
                    </div>
                  </div>

                  <div className={styles.reviewFlags}>
                    {details.repeatClient ? <span>Repeat client</span> : null}
                    {buyer.done ? <span>Marked done</span> : <span>Needs review</span>}
                    {buyer.country ? <span>{buyer.country}</span> : null}
                  </div>

                  <div className={styles.reviewQuote}>
                    <span className={styles.quoteMark}>"</span>
                    <p>{details.reviewText}</p>
                  </div>

                  <div className={styles.actionGrid}>
                    <a href={lensUrl(buyer.profile_image_url)} target="_blank" rel="noopener noreferrer">Google Lens</a>
                    <a href={googleUrl(buyer.username)} target="_blank" rel="noopener noreferrer">Google Name</a>
                    <a href={linkedinUrl(buyer.username)} target="_blank" rel="noopener noreferrer">LinkedIn</a>
                    {locationUrl ? (
                      <a href={locationUrl} target="_blank" rel="noopener noreferrer">LinkedIn Location</a>
                    ) : (
                      <span>No Location Match</span>
                    )}
                  </div>

                  <div className={styles.reviewFooter}>
                    <span>{new Date(buyer.last_seen_at).toLocaleString()}</span>
                    <div className={styles.footerActions}>
                      <button onClick={() => archiveReview(buyer.id)}>Archive</button>
                      <button onClick={() => deleteReview(buyer.id)}>Delete review</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
