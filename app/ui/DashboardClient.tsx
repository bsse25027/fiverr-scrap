"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Buyer, Gig } from "../page";
import styles from "./DashboardClient.module.css";

type View = "gigs" | "detail" | "reviews";
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
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  } catch {
    return gig.gig_key;
  }
}

function getInitials(value: string | null | undefined) {
  const text = (value || "?").trim();
  const words = text.split(/\s+/);
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : text.slice(0, 2).toUpperCase();
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className={styles.stars} aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) return <span key={i} className={styles.starFull}>★</span>;
        if (i === full && half) return <span key={i} className={styles.starHalf}>★</span>;
        return <span key={i} className={styles.starEmpty}>☆</span>;
      })}
      <span className={styles.ratingNum}>{rating.toFixed(1)}</span>
    </span>
  );
}

function getGoogleUsernameUrl(u: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`"${u}"`)}`;
}
function getLensUrl(url: string) {
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`;
}
function getLinkedInNameUrl(u: string) {
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(u)}&origin=GLOBAL_SEARCH_HEADER`;
}
function getLinkedInLocationUrl(u: string, country: string | null) {
  const geoUrn = country ? LINKEDIN_GEO_URNS[country.toLowerCase()] : null;
  if (!geoUrn) return null;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(u)}&origin=FACETED_SEARCH&geoUrn=${encodeURIComponent(JSON.stringify([geoUrn]))}`;
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
  const [view, setView] = useState<View>("gigs");
  const [selectedGigKey, setSelectedGigKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const res = await fetch("/api/reviews", { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const data = await res.json() as { gigs?: Gig[]; buyers?: Buyer[] };
      if (Array.isArray(data.gigs)) setGigs(data.gigs);
      if (Array.isArray(data.buyers)) setBuyers(data.buyers);
    }
    refresh();
    return () => { cancelled = true; };
  }, []);

  const selectedGig = useMemo(
    () => gigs.find((g) => g.gig_key === selectedGigKey) ?? null,
    [gigs, selectedGigKey]
  );

  const gigBuyers = useMemo(
    () => buyers.filter((b) => b.gig_key === selectedGigKey),
    [buyers, selectedGigKey]
  );

  const filteredBuyers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gigBuyers.filter((b) => {
      if (filter === "done" && !b.done) return false;
      if (filter === "todo" && b.done) return false;
      if (!q) return true;
      return [b.username, b.country ?? "", b.review ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [gigBuyers, filter, query]);

  const gigStats = useMemo(() => {
    return new Map(gigs.map((g) => {
      const gb = buyers.filter((b) => b.gig_key === g.gig_key);
      const done = gb.filter((b) => b.done).length;
      return [g.gig_key, { total: gb.length, done, todo: gb.length - done }];
    }));
  }, [buyers, gigs]);

  const totalDone = buyers.filter((b) => b.done).length;

  function openGig(gigKey: string) {
    setSelectedGigKey(gigKey);
    setView("detail");
    setFilter("all");
    setQuery("");
  }

  function openReviews() {
    setView("reviews");
  }

  function goBack() {
    if (view === "reviews") { setView("detail"); return; }
    setView("gigs");
    setSelectedGigKey(null);
  }

  function toggleDone(id: number, done: boolean) {
    setBuyers((cur) => cur.map((b) => b.id === id ? { ...b, done } : b));
    startTransition(async () => {
      const res = await fetch(`/api/reviews/item/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ done })
      });
      if (!res.ok) setBuyers((cur) => cur.map((b) => b.id === id ? { ...b, done: !done } : b));
    });
  }

  function deleteReview(id: number) {
    const prev = buyers;
    setBuyers((cur) => cur.filter((b) => b.id !== id));
    startTransition(async () => {
      const res = await fetch(`/api/reviews/item/${id}`, { method: "DELETE" });
      if (!res.ok) setBuyers(prev);
    });
  }

  function deleteGig(gigKey: string) {
    const gig = gigs.find((g) => g.gig_key === gigKey);
    if (!gig || !window.confirm(`Delete "${fallbackTitle(gig)}" and all its reviews?`)) return;
    const prevGigs = gigs, prevBuyers = buyers;
    const nextGigs = gigs.filter((g) => g.gig_key !== gigKey);
    setGigs(nextGigs);
    setBuyers((cur) => cur.filter((b) => b.gig_key !== gigKey));
    setView("gigs");
    setSelectedGigKey(null);
    startTransition(async () => {
      const res = await fetch(`/api/gigs/${encodeURIComponent(gigKey)}`, { method: "DELETE" });
      if (!res.ok) { setGigs(prevGigs); setBuyers(prevBuyers); }
    });
  }

  return (
    <div className={styles.root}>
      {/* ── TOP BAR ── */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          {view !== "gigs" && (
            <button className={styles.backBtn} onClick={goBack}>
              ← Back
            </button>
          )}
          <div className={styles.brand}>
            <span className={styles.brandIcon}>🔍</span>
            <span className={styles.brandName}>Fiverr Review Intel</span>
          </div>
          {view !== "gigs" && selectedGig && (
            <div className={styles.breadcrumb}>
              <span className={styles.breadSep}>/</span>
              <button className={styles.breadLink} onClick={() => { setSelectedGigKey(selectedGig.gig_key); setView("detail"); }}>
                {fallbackTitle(selectedGig).slice(0, 40)}{fallbackTitle(selectedGig).length > 40 ? "…" : ""}
              </button>
              {view === "reviews" && (
                <>
                  <span className={styles.breadSep}>/</span>
                  <span className={styles.breadCurrent}>Reviews</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.liveChip} data-pending={isPending}>
            <span className={styles.liveDot} />
            {isPending ? "Saving…" : "Live"}
          </div>
        </div>
      </header>

      {/* ── STATS BAR ── */}
      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <span className={styles.statNum}>{gigs.length}</span>
          <span className={styles.statLabel}>Gigs</span>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={styles.statNum}>{buyers.length}</span>
          <span className={styles.statLabel}>Total Buyers</span>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={styles.statNum} style={{ color: "var(--green)" }}>{totalDone}</span>
          <span className={styles.statLabel}>Verified</span>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={styles.statNum} style={{ color: "#f59e0b" }}>{buyers.length - totalDone}</span>
          <span className={styles.statLabel}>Pending</span>
        </div>
      </div>

      {/* ══════════════ VIEW: GIGS ══════════════ */}
      {view === "gigs" && (
        <div className={styles.viewGigs}>
          <div className={styles.viewHeading}>
            <h1 className={styles.viewTitle}>Scraped Gigs</h1>
            <p className={styles.viewSub}>Click a gig to inspect its details and buyer reviews.</p>
          </div>

          {gigs.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📭</span>
              <p>No gigs scraped yet. Run the console script on a Fiverr gig page.</p>
            </div>
          )}

          <div className={styles.gigsGrid}>
            {gigs.map((gig) => {
              const stats = gigStats.get(gig.gig_key) ?? { total: 0, done: 0, todo: 0 };
              const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
              return (
                <div
                  key={gig.gig_key}
                  className={styles.gigCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => openGig(gig.gig_key)}
                  onKeyDown={(e) => e.key === "Enter" && openGig(gig.gig_key)}
                >
                  <div className={styles.gigThumb}>
                    {gig.gig_image_url
                      ? <img src={gig.gig_image_url} alt={fallbackTitle(gig)} />
                      : <span className={styles.gigThumbFallback}>{getInitials(gig.title || gig.seller_username)}</span>
                    }
                    <div className={styles.gigThumbOverlay}>
                      <span className={styles.gigBadge}>{stats.total} reviews</span>
                    </div>
                  </div>
                  <div className={styles.gigCardBody}>
                    <h2 className={styles.gigCardTitle}>{fallbackTitle(gig)}</h2>
                    <div className={styles.gigCardSeller}>
                      <div className={styles.sellerAvatar}>
                        {gig.seller_profile_image_url
                          ? <img src={gig.seller_profile_image_url} alt={gig.seller_username ?? ""} />
                          : <span>{getInitials(gig.seller_username)}</span>
                        }
                      </div>
                      <span className={styles.sellerName}>{gig.seller_username ?? "Unknown seller"}</span>
                    </div>
                    <p className={styles.gigCardDesc}>{gig.description ?? "No description captured."}</p>
                    <div className={styles.progressWrap}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.progressLabel}>{stats.done}/{stats.total} verified</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════ VIEW: GIG DETAIL ══════════════ */}
      {view === "detail" && selectedGig && (() => {
        const stats = gigStats.get(selectedGig.gig_key) ?? { total: 0, done: 0, todo: 0 };
        const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
        return (
          <div className={styles.viewDetail}>
            <div className={styles.detailHero}>
              <div className={styles.detailHeroImg}>
                {selectedGig.gig_image_url
                  ? <img src={selectedGig.gig_image_url} alt={fallbackTitle(selectedGig)} />
                  : <span className={styles.detailHeroFallback}>{getInitials(selectedGig.title)}</span>
                }
              </div>
              <div className={styles.detailHeroInfo}>
                <p className={styles.kicker}>Gig Details</p>
                <h2 className={styles.detailTitle}>{fallbackTitle(selectedGig)}</h2>
                <div className={styles.detailSeller}>
                  <div className={styles.detailSellerAvatar}>
                    {selectedGig.seller_profile_image_url
                      ? <img src={selectedGig.seller_profile_image_url} alt={selectedGig.seller_username ?? ""} />
                      : <span>{getInitials(selectedGig.seller_username)}</span>
                    }
                  </div>
                  <div>
                    <span className={styles.detailSellerName}>{selectedGig.seller_username ?? "Unknown seller"}</span>
                    <span className={styles.detailSellerLabel}>Seller</span>
                  </div>
                </div>

                <div className={styles.detailStats}>
                  <div className={styles.detailStatBox}>
                    <span className={styles.detailStatNum}>{stats.total}</span>
                    <span className={styles.detailStatLabel}>Total Reviews</span>
                  </div>
                  <div className={styles.detailStatBox}>
                    <span className={styles.detailStatNum} style={{ color: "var(--green)" }}>{stats.done}</span>
                    <span className={styles.detailStatLabel}>Verified</span>
                  </div>
                  <div className={styles.detailStatBox}>
                    <span className={styles.detailStatNum} style={{ color: "#f59e0b" }}>{stats.todo}</span>
                    <span className={styles.detailStatLabel}>Pending</span>
                  </div>
                </div>

                <div className={styles.detailProgress}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.progressLabel}>{pct}% verified</span>
                </div>

                <div className={styles.detailActions}>
                  <button className={styles.primaryBtn} onClick={openReviews}>
                    View {stats.total} Buyer Reviews →
                  </button>
                  {selectedGig.gig_url !== "unknown" && (
                    <a className={styles.outlineBtn} href={selectedGig.gig_url} target="_blank" rel="noopener noreferrer">
                      Open on Fiverr ↗
                    </a>
                  )}
                  <button className={styles.dangerBtn} onClick={() => deleteGig(selectedGig.gig_key)}>
                    Delete Gig
                  </button>
                </div>
              </div>
            </div>

            {selectedGig.description && (
              <div className={styles.detailDesc}>
                <h3 className={styles.detailDescTitle}>About this Gig</h3>
                <p>{selectedGig.description}</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* ══════════════ VIEW: REVIEWS ══════════════ */}
      {view === "reviews" && selectedGig && (
        <div className={styles.viewReviews}>
          <div className={styles.reviewsToolbar}>
            <div className={styles.reviewsToolbarLeft}>
              <h2 className={styles.reviewsTitle}>
                Buyer Reviews
                <span className={styles.reviewsCount}>{filteredBuyers.length}</span>
              </h2>
            </div>
            <div className={styles.reviewsToolbarRight}>
              <input
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search username, country, review…"
              />
              <div className={styles.filterBtns}>
                {(["all", "todo", "done"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ""}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === "todo" ? "Pending" : f === "done" ? "Verified" : "All"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredBuyers.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>🔎</span>
              <p>No reviews match your filters.</p>
            </div>
          )}

          <div className={styles.reviewsGrid}>
            {filteredBuyers.map((buyer) => {
              const linkedinLocUrl = getLinkedInLocationUrl(buyer.username, buyer.country);
              return (
                <article key={buyer.id} className={`${styles.reviewCard} ${buyer.done ? styles.reviewDone : ""}`}>
                  {/* ── Card header ── */}
                  <div className={styles.reviewCardHead}>
                    <div className={styles.buyerAvatar}>
                      {buyer.profile_image_url
                        ? <img src={buyer.profile_image_url} alt={buyer.username} />
                        : <span>{getInitials(buyer.username)}</span>
                      }
                      {buyer.done && <span className={styles.doneCheck}>✓</span>}
                    </div>
                    <div className={styles.buyerInfo}>
                      <span className={styles.buyerName}>{buyer.username}</span>
                      {buyer.country && <span className={styles.buyerCountry}>📍 {buyer.country}</span>}
                      <Stars rating={buyer.rating} />
                    </div>
                    <button
                      className={buyer.done ? styles.verifiedBtn : styles.verifyBtn}
                      onClick={() => toggleDone(buyer.id, !buyer.done)}
                    >
                      {buyer.done ? "✓ Verified" : "Mark Done"}
                    </button>
                  </div>

                  {/* ── Review text ── */}
                  {buyer.review && (
                    <div className={styles.reviewTextWrap}>
                      <span className={styles.quoteIcon}>"</span>
                      <p className={styles.reviewText}>{buyer.review}</p>
                    </div>
                  )}

                  {/* ── Verify links ── */}
                  <div className={styles.verifyLinks}>
                    <a href={getLensUrl(buyer.profile_image_url)} target="_blank" rel="noopener noreferrer" className={styles.verifyLink}>
                      <span>🔍</span> Lens
                    </a>
                    <a href={getGoogleUsernameUrl(buyer.username)} target="_blank" rel="noopener noreferrer" className={styles.verifyLink}>
                      <span>🌐</span> Google
                    </a>
                    <a href={getLinkedInNameUrl(buyer.username)} target="_blank" rel="noopener noreferrer" className={styles.verifyLink}>
                      <span>💼</span> LinkedIn
                    </a>
                    {linkedinLocUrl
                      ? <a href={linkedinLocUrl} target="_blank" rel="noopener noreferrer" className={styles.verifyLink}>
                          <span>📍</span> LI + Loc
                        </a>
                      : <span className={styles.verifyLinkDis}><span>📍</span> No Match</span>
                    }
                  </div>

                  {/* ── Footer ── */}
                  <div className={styles.reviewCardFoot}>
                    <span className={styles.reviewDate}>
                      {new Date(buyer.last_seen_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                    <button className={styles.deleteBtn} onClick={() => deleteReview(buyer.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
