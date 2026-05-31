"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Buyer, Gig } from "../page";
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

function fallbackTitle(gig: Gig) {
  if (gig.title) return gig.title;
  if (gig.gig_url === "unknown") return "Unknown gig";

  try {
    const slug = new URL(gig.gig_url).pathname.split("/").filter(Boolean).at(-1) || gig.gig_key;
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return gig.gig_key;
  }
}

function getInitials(value: string | null | undefined) {
  const text = value || "?";
  return text.slice(0, 2).toUpperCase();
}

function getGoogleUsernameUrl(username: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${username}"`)}`;
}

function getLensUrl(imageUrl: string) {
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
}

function getLinkedInNameUrl(username: string) {
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(username)}&origin=GLOBAL_SEARCH_HEADER`;
}

function getLinkedInLocationUrl(username: string, country: string | null) {
  const geoUrn = country ? LINKEDIN_GEO_URNS[country.toLowerCase()] : null;
  if (!geoUrn) return null;

  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(username)}&origin=FACETED_SEARCH&geoUrn=${encodeURIComponent(JSON.stringify([geoUrn]))}`;
}

export default function DashboardClient({
  initialGigs,
  initialBuyers
}: {
  initialGigs: Gig[];
  initialBuyers: Buyer[];
}) {
  const [gigs, setGigs] = useState(initialGigs);
  const [buyers, setBuyers] = useState(initialBuyers);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedGigKey, setSelectedGigKey] = useState<string | null>(initialGigs[0]?.gig_key || null);
  const [loadMedia, setLoadMedia] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedGig = useMemo(() => {
    return gigs.find((gig) => gig.gig_key === selectedGigKey) || gigs[0] || null;
  }, [gigs, selectedGigKey]);

  const selectedReviews = useMemo(() => {
    if (!selectedGig) return [];
    const q = query.trim().toLowerCase();

    return buyers
      .filter((buyer) => buyer.gig_key === selectedGig.gig_key)
      .filter((buyer) => {
        if (filter === "done" && !buyer.done) return false;
        if (filter === "todo" && buyer.done) return false;
        if (!q) return true;

        return [
          buyer.username,
          buyer.country || "",
          buyer.review || "",
          selectedGig.title || "",
          selectedGig.seller_username || ""
        ].join(" ").toLowerCase().includes(q);
      });
  }, [buyers, filter, query, selectedGig]);

  const gigStats = useMemo(() => {
    return new Map(gigs.map((gig) => {
      const gigBuyers = buyers.filter((buyer) => buyer.gig_key === gig.gig_key);
      const doneCount = gigBuyers.filter((buyer) => buyer.done).length;
      return [gig.gig_key, { total: gigBuyers.length, done: doneCount, todo: gigBuyers.length - doneCount }];
    }));
  }, [buyers, gigs]);

  const doneCount = buyers.filter((buyer) => buyer.done).length;

  useEffect(() => {
    let cancelled = false;

    async function refreshData() {
      const response = await fetch("/api/reviews", { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as { gigs?: Gig[]; buyers?: Buyer[] };
      if (!cancelled) {
        if (Array.isArray(data.gigs)) setGigs(data.gigs);
        if (Array.isArray(data.buyers)) setBuyers(data.buyers);
      }
    }

    refreshData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedGigKey && gigs[0]) {
      setSelectedGigKey(gigs[0].gig_key);
    }
  }, [gigs, selectedGigKey]);

  function toggleDone(username: string, done: boolean) {
    setBuyers((current) =>
      current.map((buyer) => buyer.username === username ? { ...buyer, done } : buyer)
    );

    startTransition(async () => {
      const response = await fetch(`/api/reviews/${encodeURIComponent(username)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ done })
      });

      if (!response.ok) {
        setBuyers((current) =>
          current.map((buyer) => buyer.username === username ? { ...buyer, done: !done } : buyer)
        );
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

  function deleteGig(gigKey: string) {
    const gig = gigs.find((item) => item.gig_key === gigKey);
    if (!gig || !window.confirm(`Delete "${fallbackTitle(gig)}" and all attached reviews?`)) return;

    const previousGigs = gigs;
    const previousBuyers = buyers;
    const nextGigs = gigs.filter((item) => item.gig_key !== gigKey);

    setGigs(nextGigs);
    setBuyers((current) => current.filter((buyer) => buyer.gig_key !== gigKey));
    setSelectedGigKey(nextGigs[0]?.gig_key || null);

    startTransition(async () => {
      const response = await fetch(`/api/gigs/${encodeURIComponent(gigKey)}`, { method: "DELETE" });
      if (!response.ok) {
        setGigs(previousGigs);
        setBuyers(previousBuyers);
        setSelectedGigKey(gigKey);
      }
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Fiverr Review Buyers</h1>
          <p>Gigs first, then the buyer reviews attached to the selected gig.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={loadMedia ? styles.mediaOn : ""} onClick={() => setLoadMedia((value) => !value)}>
            {loadMedia ? "Media Loaded" : "Load Media"}
          </button>
          <div className={styles.badge}>{isPending ? "Saving..." : "Live"}</div>
        </div>
      </header>

      <section className={styles.stats}>
        <div>
          <span>Gigs</span>
          <strong>{gigs.length}</strong>
        </div>
        <div>
          <span>Total Buyers</span>
          <strong>{buyers.length}</strong>
        </div>
        <div>
          <span>Done</span>
          <strong>{doneCount}</strong>
        </div>
        <div>
          <span>Undone</span>
          <strong>{buyers.length - doneCount}</strong>
        </div>
      </section>

      <section className={styles.layout}>
        <aside className={styles.gigsPanel}>
          <div className={styles.sectionTitle}>
            <span>Gigs</span>
            <strong>{gigs.length}</strong>
          </div>

          <div className={styles.gigList}>
            {gigs.map((gig) => {
              const stats = gigStats.get(gig.gig_key) || { total: 0, done: 0, todo: 0 };

              return (
                <article
                  key={gig.gig_key}
                  className={`${styles.gigCard} ${selectedGig?.gig_key === gig.gig_key ? styles.selectedGig : ""}`}
                >
                  <button className={styles.gigSelect} onClick={() => setSelectedGigKey(gig.gig_key)}>
                    <div className={styles.gigMedia}>
                      {loadMedia && gig.gig_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={gig.gig_image_url} alt={fallbackTitle(gig)} />
                      ) : (
                        <span>{getInitials(gig.title || gig.seller_username)}</span>
                      )}
                    </div>
                    <div className={styles.gigBody}>
                      <h2>{fallbackTitle(gig)}</h2>
                      <p>{gig.description || "No description captured yet."}</p>
                      <div className={styles.sellerLine}>
                        <span className={styles.sellerAvatar}>
                          {loadMedia && gig.seller_profile_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={gig.seller_profile_image_url} alt={gig.seller_username || "Seller"} />
                          ) : (
                            getInitials(gig.seller_username)
                          )}
                        </span>
                        <span>{gig.seller_username || "Unknown seller"}</span>
                      </div>
                      <span className={styles.gigMeta}>
                        {stats.total} reviews · {stats.done} done · {stats.todo} undone
                      </span>
                    </div>
                  </button>
                  <div className={styles.gigCardActions}>
                    {gig.gig_url !== "unknown" ? (
                      <a href={gig.gig_url} target="_blank" rel="noopener noreferrer">Open</a>
                    ) : null}
                    <button onClick={() => deleteGig(gig.gig_key)}>Delete</button>
                  </div>
                </article>
              );
            })}
          </div>
        </aside>

        <section className={styles.reviewsPanel}>
          {selectedGig ? (
            <>
              <div className={styles.gigHeader}>
                <div>
                  <span className={styles.kicker}>Selected gig</span>
                  <h2>{fallbackTitle(selectedGig)}</h2>
                  <p>{selectedGig.seller_username || "Unknown seller"} · {selectedReviews.length} visible reviews</p>
                </div>
                {selectedGig.gig_url !== "unknown" ? (
                  <a className={styles.openGig} href={selectedGig.gig_url} target="_blank" rel="noopener noreferrer">
                    Open gig
                  </a>
                ) : null}
              </div>

              <div className={styles.toolbar}>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search selected gig by username, country, review, seller"
                />
                <div className={styles.filters}>
                  {(["all", "todo", "done"] as Filter[]).map((item) => (
                    <button
                      key={item}
                      className={filter === item ? styles.active : ""}
                      onClick={() => setFilter(item)}
                    >
                      {item === "todo" ? "Undone" : item[0].toUpperCase() + item.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.grid}>
                {selectedReviews.map((buyer) => {
                  const linkedinLocationUrl = getLinkedInLocationUrl(buyer.username, buyer.country);

                  return (
                    <article key={buyer.id} className={`${styles.card} ${buyer.done ? styles.done : ""}`}>
                      <div className={styles.person}>
                        <div className={styles.buyerAvatar}>
                          {loadMedia ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={buyer.profile_image_url} alt={buyer.username} />
                          ) : (
                            getInitials(buyer.username)
                          )}
                        </div>
                        <div>
                          <h3>{buyer.username}</h3>
                          <p>{[buyer.country, buyer.rating ? `${buyer.rating} stars` : ""].filter(Boolean).join(" | ")}</p>
                        </div>
                        <button
                          className={buyer.done ? styles.doneButton : ""}
                          onClick={() => toggleDone(buyer.username, !buyer.done)}
                        >
                          {buyer.done ? "Done" : "Mark Done"}
                        </button>
                      </div>

                      <div className={styles.actions}>
                        <a href={getLensUrl(buyer.profile_image_url)} target="_blank" rel="noopener noreferrer">
                          Google Lens
                        </a>
                        <a href={getGoogleUsernameUrl(buyer.username)} target="_blank" rel="noopener noreferrer">
                          Google Name
                        </a>
                        <a href={getLinkedInNameUrl(buyer.username)} target="_blank" rel="noopener noreferrer">
                          LinkedIn Name
                        </a>
                        {linkedinLocationUrl ? (
                          <a href={linkedinLocationUrl} target="_blank" rel="noopener noreferrer">
                            LinkedIn Location
                          </a>
                        ) : (
                          <span className={styles.disabledAction}>No Location Match</span>
                        )}
                      </div>

                      <p className={styles.review}>{buyer.review}</p>
                      <div className={styles.meta}>
                        <span>Last seen {new Date(buyer.last_seen_at).toLocaleString()}</span>
                        <button onClick={() => deleteReview(buyer.id)}>Delete review</button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {!selectedReviews.length ? <div className={styles.empty}>No buyers match this selected gig view.</div> : null}
            </>
          ) : (
            <div className={styles.empty}>No gigs saved yet.</div>
          )}
        </section>
      </section>
    </main>
  );
}
