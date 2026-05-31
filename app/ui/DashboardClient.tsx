"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Buyer } from "../page";
import styles from "./DashboardClient.module.css";

type Filter = "all" | "todo" | "done";

export default function DashboardClient({ initialBuyers }: { initialBuyers: Buyer[] }) {
  const [buyers, setBuyers] = useState(initialBuyers);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return buyers.filter((buyer) => {
      if (filter === "done" && !buyer.done) return false;
      if (filter === "todo" && buyer.done) return false;
      if (!q) return true;

      return [
        buyer.username,
        buyer.country || "",
        buyer.review || "",
        buyer.gig_url || ""
      ].join(" ").toLowerCase().includes(q);
    });
  }, [buyers, filter, query]);

  const doneCount = buyers.filter((buyer) => buyer.done).length;

  useEffect(() => {
    let cancelled = false;

    async function refreshBuyers() {
      const response = await fetch("/api/reviews", { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as { buyers?: Buyer[] };
      if (!cancelled && Array.isArray(data.buyers)) {
        setBuyers(data.buyers);
      }
    }

    refreshBuyers();

    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Fiverr Review Buyers</h1>
          <p>Saved buyer profiles received from your browser extractor.</p>
        </div>
        <div className={styles.badge}>{isPending ? "Saving..." : "Live"}</div>
      </header>

      <section className={styles.stats}>
        <div>
          <span>Total</span>
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
        <div>
          <span>Visible</span>
          <strong>{filtered.length}</strong>
        </div>
      </section>

      <section className={styles.toolbar}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search username, country, review, or gig URL"
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
      </section>

      <section className={styles.grid}>
        {filtered.map((buyer) => (
          <article key={buyer.username} className={`${styles.card} ${buyer.done ? styles.done : ""}`}>
            <div className={styles.person}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={buyer.profile_image_url} alt={buyer.username} />
              <div>
                <h2>{buyer.username}</h2>
                <p>{[buyer.country, buyer.rating ? `${buyer.rating} stars` : ""].filter(Boolean).join(" | ")}</p>
              </div>
              <button
                className={buyer.done ? styles.doneButton : ""}
                onClick={() => toggleDone(buyer.username, !buyer.done)}
              >
                {buyer.done ? "Done" : "Mark Done"}
              </button>
            </div>
            <p className={styles.review}>{buyer.review}</p>
            <div className={styles.meta}>
              <span>Last seen {new Date(buyer.last_seen_at).toLocaleString()}</span>
              {buyer.gig_url ? <a href={buyer.gig_url} target="_blank">Open gig</a> : null}
            </div>
          </article>
        ))}
      </section>

      {!filtered.length ? <div className={styles.empty}>No saved buyers match this view.</div> : null}
    </main>
  );
}
