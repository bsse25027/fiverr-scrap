"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Buyer, Gig } from "../types";
import styles from "./DashboardClient.module.css";

function getTitle(gig: Gig) {
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
  const text = (value || "?").trim();
  const words = text.split(/\s+/);
  return words.length > 1 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : text.slice(0, 2).toUpperCase();
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

  useEffect(() => {
    let cancelled = false;

    async function refreshData() {
      const response = await fetch("/api/reviews", { cache: "no-store" });
      if (!response.ok || cancelled) return;

      const data = (await response.json()) as { gigs?: Gig[]; buyers?: Buyer[] };
      if (Array.isArray(data.gigs)) setGigs(data.gigs);
      if (Array.isArray(data.buyers)) setBuyers(data.buyers);
    }

    refreshData();

    return () => {
      cancelled = true;
    };
  }, []);

  const statsByGig = useMemo(() => {
    return new Map(gigs.map((gig) => {
      const gigReviews = buyers.filter((buyer) => buyer.gig_key === gig.gig_key);
      const done = gigReviews.filter((buyer) => buyer.done).length;
      const countries = new Set(gigReviews.map((buyer) => buyer.country).filter(Boolean));
      const avgRating = gigReviews.length
        ? gigReviews.reduce((sum, buyer) => sum + Number(buyer.rating || 0), 0) / gigReviews.length
        : 0;

      return [gig.gig_key, {
        total: gigReviews.length,
        done,
        pending: gigReviews.length - done,
        countries: countries.size,
        avgRating
      }];
    }));
  }, [buyers, gigs]);

  const filteredGigs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gigs;

    return gigs.filter((gig) => [
      getTitle(gig),
      gig.seller_username || "",
      gig.description || "",
      gig.gig_url
    ].join(" ").toLowerCase().includes(q));
  }, [gigs, query]);

  const totalDone = buyers.filter((buyer) => buyer.done).length;
  const totalPending = buyers.length - totalDone;

  return (
    <main className={styles.pageShell}>
      <header className={styles.appHeader}>
        <div>
          <p className={styles.eyebrow}>Dashboard</p>
          <h1>Fiverr gigs</h1>
          <p className={styles.headerText}>Review every saved gig separately, then open a gig to inspect its details and buyers.</p>
        </div>
      </header>

      <section className={styles.metricStrip}>
        <div className={styles.metric}>
          <span>Gigs</span>
          <strong>{gigs.length}</strong>
        </div>
        <div className={styles.metric}>
          <span>Reviews</span>
          <strong>{buyers.length}</strong>
        </div>
        <div className={styles.metric}>
          <span>Done</span>
          <strong>{totalDone}</strong>
        </div>
        <div className={styles.metric}>
          <span>Pending</span>
          <strong>{totalPending}</strong>
        </div>
      </section>

      <section className={styles.toolbar}>
        <div>
          <h2>Saved gigs</h2>
          <p>{filteredGigs.length} visible from {gigs.length} total</p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title, seller, description, URL"
        />
      </section>

      {!filteredGigs.length ? (
        <section className={styles.emptyState}>
          <strong>No gigs found</strong>
          <span>Run the console script on a Fiverr gig page, or clear your search.</span>
        </section>
      ) : (
        <section className={styles.gigGrid}>
          {filteredGigs.map((gig) => {
            const stats = statsByGig.get(gig.gig_key) || { total: 0, done: 0, pending: 0, countries: 0, avgRating: 0 };
            const donePercent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

            return (
              <Link key={gig.gig_key} className={styles.gigCard} href={`/gigs/${encodeURIComponent(gig.gig_key)}`}>
                <div className={styles.gigImage}>
                  {gig.gig_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gig.gig_image_url} alt={getTitle(gig)} />
                  ) : (
                    <span>{getInitials(gig.title || gig.seller_username)}</span>
                  )}
                </div>

                <div className={styles.gigContent}>
                  <div className={styles.gigTopline}>
                    <span>{stats.total} reviews</span>
                    <span>{stats.avgRating ? `${stats.avgRating.toFixed(1)} rating` : "No rating"}</span>
                  </div>

                  <h3>{getTitle(gig)}</h3>
                  <p className={styles.description}>{gig.description || "No gig description saved yet."}</p>

                  <div className={styles.sellerRow}>
                    <div className={styles.avatar}>
                      {gig.seller_profile_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={gig.seller_profile_image_url} alt={gig.seller_username || "Seller"} />
                      ) : (
                        getInitials(gig.seller_username)
                      )}
                    </div>
                    <div>
                      <strong>{gig.seller_username || "Unknown seller"}</strong>
                      <span>{stats.countries} buyer countries</span>
                    </div>
                  </div>

                  <div className={styles.progressBlock}>
                    <div className={styles.progressLine}>
                      <span style={{ width: `${donePercent}%` }} />
                    </div>
                    <p>{stats.done} done, {stats.pending} pending</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
