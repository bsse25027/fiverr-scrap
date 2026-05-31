/**
 * Fiverr latest reviews fetcher.
 *
 * Edit only GIG_URL below, then run:
 *   node fiverr_last_reviews.js
 */

const GIG_URL = "https://www.fiverr.com/ai_nest/build-vapi-ai-voice-agents-and-chatbots-for-ai-mobile-apps-and-website";
const REVIEW_LIMIT = 10;

const BROWSER_HEADERS = {
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
};

function extractJsonScript(html, id) {
  const pattern = new RegExp(
    `<script[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    "i"
  );
  const match = html.match(pattern);

  if (!match) {
    throw new Error(`Could not find script#${id} in the Fiverr page HTML.`);
  }

  return JSON.parse(match[1].trim());
}

function getSlugFromGigUrl(gigUrl) {
  const pathname = new URL(gigUrl).pathname;
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length < 2) {
    throw new Error("The URL does not look like a Fiverr gig URL.");
  }

  return parts[parts.length - 1];
}

function pickGig(props, slug) {
  const gigs = props.gigsData || props.seller?.gigs?.nodes || [];
  const gig = gigs.find((item) => item.cached_slug === slug || item.gig_url?.endsWith(`/${slug}`)) || gigs[0];

  if (!gig?.gig_id) {
    throw new Error("Could not find gig_id in Fiverr embedded page data.");
  }

  return gig;
}

function simplifyReview(review) {
  return {
    id: review.id,
    created_at: review.created_at,
    rating: review.value,
    username: review.username,
    reviewer_country: review.reviewer_country,
    comment: review.comment,
    seller_response: review.seller_response?.comment || null,
    order_duration: review.order_duration,
    order_price_range_usd: review.order_price_range_usd,
    gig_id: review.gig_id,
    gig_slug: review.gig_slug,
  };
}

async function fetchJson(url, referer) {
  const response = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      accept: "application/json,text/plain,*/*",
      referer,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Fiverr API failed: ${response.status} ${response.statusText}\n${body.slice(0, 500)}`);
  }

  return response.json();
}

async function main() {
  const pageResponse = await fetch(GIG_URL, { headers: BROWSER_HEADERS });

  if (!pageResponse.ok) {
    throw new Error(`Fiverr page failed: ${pageResponse.status} ${pageResponse.statusText}`);
  }

  const html = await pageResponse.text();
  const props = extractJsonScript(html, "perseus-initial-props");
  const slug = getSlugFromGigUrl(GIG_URL);
  const gig = pickGig(props, slug);

  const apiUrl = new URL(`https://www.fiverr.com/gig_page/api/fetch_reviews/${gig.gig_id}`);
  apiUrl.searchParams.set("gig_id", String(gig.gig_id));
  apiUrl.searchParams.set("sort_by", "recent");
  apiUrl.searchParams.set("page_size", String(REVIEW_LIMIT));

  const data = await fetchJson(apiUrl.toString(), GIG_URL);
  const reviews = (data.reviews || []).slice(0, REVIEW_LIMIT).map(simplifyReview);

  console.log(
    JSON.stringify(
      {
        gig: {
          id: gig.gig_id,
          title: gig.title,
          slug: gig.cached_slug,
          url: `https://www.fiverr.com${gig.gig_url || new URL(GIG_URL).pathname}`,
        },
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
