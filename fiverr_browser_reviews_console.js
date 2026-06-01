/**
 * Paste this whole file into Chrome DevTools Console while you are on a Fiverr gig page.
 *
 * Flow:
 * 1. Read the current gig metadata from the page.
 * 2. Click "Show More Reviews" up to MAX_CLICKS times.
 * 3. Extract visible buyer reviews with buyer profile images only.
 * 4. Download JSON and POST it to your dashboard.
 *
 * It does not solve CAPTCHA or bypass blocks. If Fiverr shows a block/challenge,
 * stop and do not keep retrying.
 */

(async () => {
  const MAX_CLICKS = 30;
  const DELAY_MS = 1000;
  const REQUIRE_BUYER_PROFILE_IMAGE = true;
  const DASHBOARD_POST_URL = "https://fiverr-scrap.vercel.app/api/reviews";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();

  function normalizeFiverrImageUrl(url) {
    if (!url) return null;

    return url
      .replace("/f_auto,q_auto,t_profile_small/", "/")
      .replace("/f_auto,q_auto,t_profile_original/", "/")
      .replace("/f_auto,q_auto/", "/")
      .replace(/\/{2,}/g, (match, offset, full) => {
        return full.slice(Math.max(0, offset - 6), offset) === "https:" ? "//" : "/";
      });
  }

  function normalizePageUrl(url) {
    const parsed = new URL(url, location.href);
    parsed.hash = "";
    return `${parsed.origin}${parsed.pathname}`;
  }

  function getUrlParts() {
    const [sellerFromUrl = "unknown-seller", slug = "unknown-gig"] = location.pathname
      .split("/")
      .filter(Boolean);

    return { sellerFromUrl, slug };
  }

  function getGigKeyFromUrl() {
    const { sellerFromUrl, slug } = getUrlParts();
    return `${sellerFromUrl}-${slug}`.toLowerCase();
  }

  function getMetaContent(selector) {
    return clean(document.querySelector(selector)?.getAttribute("content"));
  }

  function getInitialProps() {
    const script = document.querySelector("script#perseus-initial-props");
    if (!script?.textContent) return null;

    try {
      return JSON.parse(script.textContent);
    } catch {
      return null;
    }
  }

  function walk(value, visitor, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);

    const result = visitor(value);
    if (result) return result;

    for (const child of Object.values(value)) {
      const childResult = walk(child, visitor, seen);
      if (childResult) return childResult;
    }

    return null;
  }

  function findGigData(props) {
    const slug = location.pathname.split("/").filter(Boolean).at(-1);
    if (!props) return null;

    return walk(props, (item) => {
      const hasRealGigId = item.gig_id || item.gigId;
      const itemSlug = item.cached_slug || item.slug;
      const itemUrl = item.gig_url || item.url;
      const looksLikeCurrentGig =
        itemSlug === slug ||
        (typeof itemUrl === "string" && itemUrl.endsWith(`/${slug}`));

      return hasRealGigId && looksLikeCurrentGig ? item : null;
    });
  }

  function findFirstStringByKey(value, keyNames) {
    return walk(value, (item) => {
      for (const keyName of keyNames) {
        const found = item[keyName];
        if (typeof found === "string" && clean(found)) return found;
      }
      return null;
    });
  }

  function findGigImageFromData(gigData) {
    const image = findFirstStringByKey(gigData, [
      "gig_image_url",
      "gigImageUrl",
      "thumbnail_url",
      "thumbnailUrl",
      "image_url",
      "imageUrl",
      "src"
    ]);
    return normalizeFiverrImageUrl(image);
  }

  function findSellerImageFromData(gigData) {
    const image = findFirstStringByKey(gigData, [
      "seller_profile_image_url",
      "sellerProfileImageUrl",
      "profile_image_url",
      "profileImageUrl",
      "avatar_url",
      "avatarUrl"
    ]);
    return normalizeFiverrImageUrl(image);
  }

  function findHeroImageFromDom() {
    const ogImage = getMetaContent("meta[property='og:image']");
    if (ogImage) return normalizeFiverrImageUrl(ogImage);

    const images = [...document.querySelectorAll("img")]
      .map((image) => image.currentSrc || image.src || "")
      .filter((src) => {
        if (!src) return false;
        if (/flags|profile|avatar|user/i.test(src)) return false;
        return /fiverr-res\.cloudinary\.com|cloudinary/i.test(src);
      });

    return normalizeFiverrImageUrl(images[0] || null);
  }

  function findSellerImageFromDom() {
    const images = [...document.querySelectorAll("img")]
      .map((image) => image.currentSrc || image.src || "")
      .filter((src) => /profile|attachments\/profile|profile\/photos/i.test(src));

    return normalizeFiverrImageUrl(images[0] || null);
  }

  function getTextNearHeading(labels) {
    const headings = [...document.querySelectorAll("h1, h2, h3, h4, strong, b, span")];
    const heading = headings.find((node) => {
      const text = clean(node.innerText).toLowerCase();
      return labels.some((label) => text === label || text.includes(label));
    });

    if (!heading) return null;

    const section = heading.closest("section, article, div");
    const candidates = [
      section,
      heading.parentElement,
      heading.parentElement?.nextElementSibling,
      heading.nextElementSibling,
    ].filter(Boolean);

    const text = candidates
      .map((node) => clean(node.innerText).replace(clean(heading.innerText), "").trim())
      .filter((value) => value.length > 40)
      .sort((a, b) => b.length - a.length)[0];

    return text || null;
  }

  function getGigTitle(gigData) {
    const h1 = clean(document.querySelector("h1")?.innerText);
    const ogTitle = getMetaContent("meta[property='og:title']");
    const pageTitle = clean(document.title);

    return (
      h1 ||
      ogTitle.replace(/^.*?:\s*I will\s*/i, "I will ").replace(/\s+on fiverr\.com$/i, "") ||
      pageTitle.replace(/\s+by\s+.*?\s+\|\s+Fiverr$/i, "") ||
      clean(gigData?.title)
    );
  }

  function getAboutThisGig(gigData) {
    return (
      getTextNearHeading(["about this gig", "about the gig", "description"]) ||
      clean(gigData?.description) ||
      getMetaContent("meta[property='og:description']") ||
      getMetaContent("meta[name='description']")
    );
  }

  function extractGig() {
    const props = getInitialProps();
    const gigData = findGigData(props);
    const { sellerFromUrl, slug } = getUrlParts();
    const gigUrl = normalizePageUrl(location.href);
    const gigKey = getGigKeyFromUrl();
    const aboutThisGig = getAboutThisGig(gigData);

    return {
      gigKey,
      gigUrl,
      title: getGigTitle(gigData) || slug,
      sellerUsername:
        clean(gigData?.seller?.username) ||
        clean(gigData?.seller_username) ||
        clean(gigData?.sellerUsername) ||
        sellerFromUrl,
      sellerProfileImageUrl: findSellerImageFromData(gigData) || findSellerImageFromDom(),
      gigImageUrl: findGigImageFromData(gigData) || findHeroImageFromDom(),
      description: aboutThisGig,
      aboutThisGig,
      raw: {
        urlGigKey: gigKey,
        embeddedGigId: gigData?.gig_id || gigData?.gigId || null,
        embeddedGigData: gigData || null,
      },
    };
  }

  function isBlocked() {
    const text = document.body.innerText.toLowerCase();
    return (
      text.includes("captcha") ||
      text.includes("verify you are human") ||
      text.includes("access denied") ||
      text.includes("perimeterx")
    );
  }

  function findShowMoreButton() {
    const buttons = [...document.querySelectorAll('button, [role="button"]')];
    return buttons.find((button) => {
      const text = clean(button.innerText).toLowerCase();
      const disabled =
        button.disabled ||
        button.getAttribute("aria-disabled") === "true" ||
        button.closest("[aria-disabled='true']");

      return !disabled && /^(show more reviews|show more|load more reviews|load more)$/i.test(text);
    });
  }

  async function clickShowMoreReviews() {
    for (let i = 1; i <= MAX_CLICKS; i++) {
      if (isBlocked()) {
        console.warn("Stopped: Fiverr appears to be showing a CAPTCHA/block page.");
        break;
      }

      const button = findShowMoreButton();
      if (!button) {
        console.log(`Stopped after ${i - 1} clicks: no Show More Reviews button found.`);
        break;
      }

      button.scrollIntoView({ behavior: "smooth", block: "center" });
      await sleep(600);
      button.click();
      console.log(`Clicked Show More Reviews: ${i}/${MAX_CLICKS}`);
      await sleep(DELAY_MS);
    }
  }

  function removeSellerResponseFromClone(reviewEl) {
    const clone = reviewEl.cloneNode(true);
    [...clone.querySelectorAll("*")].forEach((node) => {
      if (/seller'?s response/i.test(clean(node.innerText))) {
        const removable = node.closest("div, section, article, li") || node;
        removable.remove();
      }
    });
    return clone;
  }

  function isBuyerProfileImage(src) {
    if (!src) return false;
    if (/general_assets\/flags|\/flags\//i.test(src)) return false;
    if (/t_clients_thumb|\/gigs\/|company\/logo|portfolio|video|t_main/i.test(src)) return false;
    return /attachments\/profile\/photo|profile\/photos|\/profile\//i.test(src);
  }

  function getImageScore(image, reviewEl, username, sellerResponseTop) {
    const src = image.currentSrc || image.src || "";
    if (!isBuyerProfileImage(src)) return -9999;

    const reviewRect = reviewEl.getBoundingClientRect();
    const rect = image.getBoundingClientRect();
    const distanceFromReviewTop = rect.top - reviewRect.top;
    if (distanceFromReviewTop < -10 || rect.top >= sellerResponseTop) return -9999;

    let score = 0;
    const figure = image.closest("figure");
    const titledParent = image.closest("[title]");
    const title = clean(figure?.getAttribute("title") || titledParent?.getAttribute("title"));
    const alt = clean(image.alt);
    const aria = clean(image.getAttribute("aria-label"));
    const nearbyText = clean((image.closest("figure, a, div, header") || image).innerText);

    if (username && title.toLowerCase() === username.toLowerCase()) score += 120;
    if (username && alt.toLowerCase() === username.toLowerCase()) score += 90;
    if (username && aria.toLowerCase().includes(username.toLowerCase())) score += 60;
    if (username && nearbyText.toLowerCase().includes(username.toLowerCase())) score += 45;
    if (figure) score += 25;
    if (/attachments\/profile\/photo/i.test(src)) score += 20;
    if (distanceFromReviewTop <= 120) score += 35;
    if (rect.width >= 24 && rect.height >= 24) score += 10;
    if (rect.width > 140 || rect.height > 140) score -= 25;
    score -= Math.max(0, distanceFromReviewTop) / 12;

    return score;
  }

  function getBuyerProfileImageUrl(reviewEl, username) {
    const reviewRect = reviewEl.getBoundingClientRect();
    const sellerResponseNode = [...reviewEl.querySelectorAll("*")].find((node) =>
      /seller'?s response/i.test(clean(node.innerText))
    );
    const sellerResponseTop = sellerResponseNode?.getBoundingClientRect().top ?? Infinity;

    const usernameFigure = username
      ? reviewEl.querySelector(`figure[title="${CSS.escape(username)}"]`)
      : null;
    const usernameFigureImage = usernameFigure?.querySelector("img");
    const usernameFigureSrc = usernameFigureImage?.currentSrc || usernameFigureImage?.src || "";
    if (isBuyerProfileImage(usernameFigureSrc)) {
      return normalizeFiverrImageUrl(usernameFigureSrc);
    }

    const scoredImages = [...reviewEl.querySelectorAll("img")]
      .map((image) => ({
        image,
        score: getImageScore(image, reviewEl, username || "", sellerResponseTop),
      }))
      .filter((item) => item.score > -9999)
      .sort((a, b) => b.score - a.score);

    const best = scoredImages[0]?.image;
    const bestSrc = best?.currentSrc || best?.src || null;

    if (!bestSrc) {
      console.warn("No buyer avatar found for review", {
        username,
        reviewTop: reviewRect.top,
        imageCount: reviewEl.querySelectorAll("img").length,
      });
    }

    return normalizeFiverrImageUrl(bestSrc);
  }

  function getUsername(reviewEl) {
    const titleFigure = reviewEl.querySelector("figure[title]");
    if (titleFigure?.getAttribute("title")) return clean(titleFigure.getAttribute("title"));

    const heading = reviewEl.querySelector("h6, h5, h4, [data-testid*='username']");
    if (heading) return clean(heading.innerText);

    const firstStrongText = [...reviewEl.querySelectorAll("b, strong")]
      .map((node) => clean(node.innerText))
      .find(Boolean);

    return firstStrongText || null;
  }

  function getCountry(reviewEl) {
    const countryFlag = reviewEl.querySelector("img.country-flag");
    const countryText = countryFlag?.closest(".country")?.innerText;
    return clean(countryText) || countryFlag?.alt || null;
  }

  function getRating(reviewEl) {
    const ratingText =
      reviewEl.querySelector("[aria-label*='Rating'], [aria-label*='rating']")?.getAttribute("aria-label") ||
      reviewEl.querySelector(".orca-rating")?.innerText;

    const match = clean(ratingText).match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  function getReviewText(reviewEl) {
    const clone = removeSellerResponseFromClone(reviewEl);
    const textBlocks = [...clone.querySelectorAll("p, span, div")]
      .map((node) => clean(node.innerText))
      .filter((text) => {
        if (text.length < 25) return false;
        if (/^(helpful|yes|no|seller's response|show more|show less)$/i.test(text)) return false;
        if (/^\d+(\.\d+)?$/.test(text)) return false;
        return true;
      });

    const unique = [...new Set(textBlocks)];
    return unique.sort((a, b) => b.length - a.length)[0] || null;
  }

  function extractReviews(gigUrl) {
    const reviewNodes = [
      ...document.querySelectorAll("ul.review-list li.review-item-component"),
    ];

    const seen = new Set();

    return reviewNodes
      .map((reviewEl, index) => {
        const username = getUsername(reviewEl);
        const review = getReviewText(reviewEl);
        const profileImageUrl = getBuyerProfileImageUrl(reviewEl, username);
        const country = getCountry(reviewEl);
        const rating = getRating(reviewEl);

        if (REQUIRE_BUYER_PROFILE_IMAGE && !profileImageUrl) return null;

        const key = `${username || ""}|${review || ""}`;
        if (seen.has(key)) return null;
        seen.add(key);

        return {
          index: index + 1,
          username,
          profileImageUrl,
          country,
          rating,
          review,
          gigUrl,
        };
      })
      .filter(Boolean);
  }

  function downloadJson(filename, json) {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const gig = extractGig();
  console.log("Gig detected:", gig);

  await clickShowMoreReviews();

  const result = {
    url: gig.gigUrl,
    extractedAt: new Date().toISOString(),
    gig,
    count: 0,
    reviews: extractReviews(gig.gigUrl),
  };

  result.reviews = [
    ...new Map(
      result.reviews.map((review) => [String(review.username || "").toLowerCase(), review])
    ).values(),
  ];
  result.count = result.reviews.length;

  const json = JSON.stringify(result, null, 2);
  console.log(json);
  downloadJson(`fiverr-gig-${gig.gigKey}-buyer-reviews-${Date.now()}.json`, json);
  console.log(`Downloaded ${result.count} buyer reviews with profile images as JSON.`);

  try {
    const response = await fetch(DASHBOARD_POST_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: json,
    });
    const body = await response.json().catch(() => ({}));
    console.log("Dashboard save response:", response.status, body);
  } catch (error) {
    console.warn("Could not POST to dashboard. Is the Next app running?", error);
  }

  try {
    await navigator.clipboard.writeText(json);
    console.log(`Copied ${result.count} reviews as JSON to clipboard.`);
  } catch {
    console.log("Could not copy automatically. Copy the JSON from the console output.");
  }
})();
