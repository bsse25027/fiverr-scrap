/**
 * Paste this whole file into Chrome DevTools Console while you are on a Fiverr gig page.
 *
 * It clicks "Show More Reviews" up to MAX_CLICKS times, then extracts visible buyer
 * reviews from ul.review-list > li.review-item-component and downloads JSON.
 *
 * Important: this version only keeps reviews where the BUYER has a real profile image.
 * It ignores seller-response avatars/images.
 *
 * It does not solve CAPTCHA or bypass blocks. If Fiverr shows a block/challenge,
 * stop and do not keep retrying.
 */

(async () => {
  const MAX_CLICKS = 20;
  const DELAY_MS = 2500;
  const REQUIRE_BUYER_PROFILE_IMAGE = true;
  const DASHBOARD_POST_URL = "http://localhost:3000/api/reviews";

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();

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

  function getBuyerProfileImageUrl(reviewEl) {
    const reviewRect = reviewEl.getBoundingClientRect();
    const sellerResponseNode = [...reviewEl.querySelectorAll("*")].find((node) =>
      /seller'?s response/i.test(clean(node.innerText))
    );
    const sellerResponseTop = sellerResponseNode?.getBoundingClientRect().top ?? Infinity;

    const buyerImages = [...reviewEl.querySelectorAll("img")]
      .filter((image) => {
        const src = image.currentSrc || image.src || "";
        if (!src) return false;
        if (image.classList.contains("country-flag")) return false;
        if (/general_assets\/flags/i.test(src)) return false;
        if (!/profile|attachments\/profile|profile\/photos/i.test(src)) return false;

        const rect = image.getBoundingClientRect();
        const distanceFromReviewTop = rect.top - reviewRect.top;

        // Buyer avatar is in the review header. Seller avatar is lower, inside
        // the "Seller's Response" block, so keep only images before that area.
        return distanceFromReviewTop >= -5 && distanceFromReviewTop <= 130 && rect.top < sellerResponseTop;
      })
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    return normalizeFiverrImageUrl(buyerImages[0]?.currentSrc || buyerImages[0]?.src || null);
  }

  function normalizeFiverrImageUrl(url) {
    if (!url) return null;

    return url
      .replace("/f_auto,q_auto,t_profile_small/", "/")
      .replace("/f_auto,q_auto,t_profile_original/", "/")
      .replace("/f_auto,q_auto/", "/")
      .replace(/\/{2,}/g, (match, offset, full) => {
        // Keep the protocol slash in https://.
        return full.slice(Math.max(0, offset - 6), offset) === "https:" ? "//" : "/";
      });
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

  function extractReviews() {
    const reviewNodes = [
      ...document.querySelectorAll("ul.review-list li.review-item-component"),
    ];

    const seen = new Set();

    return reviewNodes
      .map((reviewEl, index) => {
        const username = getUsername(reviewEl);
        const review = getReviewText(reviewEl);
        const profileImageUrl = getBuyerProfileImageUrl(reviewEl);
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

  await clickShowMoreReviews();

  const result = {
    url: location.href,
    extractedAt: new Date().toISOString(),
    count: 0,
    reviews: extractReviews(),
  };

  result.count = result.reviews.length;

  const json = JSON.stringify(result, null, 2);
  console.log(json);
  downloadJson(`fiverr-buyer-reviews-${Date.now()}.json`, json);
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
