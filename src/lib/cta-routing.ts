export function getPrimaryCtaUrl(): string {
  const live = (process.env.NEXT_PUBLIC_PAYMENTS_LIVE ?? "")
    .trim()
    .toLowerCase();

  if (live === "true" || live === "1" || live === "yes") {
    // TODO (BIZ-01): Wire this to the real Paddle Checkout URL.
    return "https://checkout.paddle.com/";
  }

  return "/signup";
}

