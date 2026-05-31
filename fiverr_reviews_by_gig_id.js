/**
 * Fiverr latest reviews by gig ID.
 *
 * Edit only these two constants:
 *   GIG_ID
 *   REVIEW_LIMIT
 *
 * Run:
 *   node fiverr_reviews_by_gig_id.js
 */

const GIG_ID = "440776575";
const REVIEW_LIMIT = 10;

const HEADERS = {
  "accept": "application/json,text/plain,*/*",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
};

function simplifyReview(review) {
  return {
    id: review.id,
    created_at: review.created_at,
    rating: review.value,
    username: review.username,
    reviewer_country: review.reviewer_country,
    reviewer_country_code: review.reviewer_country_code,
    comment: review.comment,
    seller_response: review.seller_response?.comment || null,
    order_duration: review.order_duration,
    order_price_range: review.order_price_range,
    order_price_range_usd: review.order_price_range_usd,
    repeat_buyer: review.repeat_buyer,
    is_business: review.is_business,
    work_sample: review.work_sample || null,
    gig_id: review.gig_id,
    gig_slug: review.gig_slug,
  };
}

async function fetchReviews(gigId, limit) {
  const url = new URL(`https://www.fiverr.com/gig_page/api/fetch_reviews/${gigId}`);
  url.searchParams.set("gig_id", String(gigId));
  url.searchParams.set("sort_by", "recent");
  url.searchParams.set("page_size", String(limit));

  const response = await fetch(url, { headers: HEADERS });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed: ${response.status} ${response.statusText}\n${body.slice(0, 500)}`);
  }

  return response.json();
}

async function main() {
  const data = await fetchReviews(GIG_ID, REVIEW_LIMIT);
  const reviews = (data.reviews || []).slice(0, REVIEW_LIMIT).map(simplifyReview);

  console.log(
    JSON.stringify(
      {
        gig_id: GIG_ID,
        sort_by: "recent",
        requested: REVIEW_LIMIT,
        returned: reviews.length,
        has_next: Boolean(data.has_next),
        total_count: data.total_count,
        reviews,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
