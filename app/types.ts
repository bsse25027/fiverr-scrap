export type Buyer = {
  id: number;
  gig_key: string;
  username: string;
  profile_image_url: string;
  country: string | null;
  rating: number | null;
  review: string | null;
  gig_url: string | null;
  source_url: string | null;
  done: boolean;
  first_seen_at: string;
  last_seen_at: string;
};

export type Gig = {
  gig_key: string;
  gig_url: string;
  title: string | null;
  seller_username: string | null;
  seller_profile_image_url: string | null;
  gig_image_url: string | null;
  description: string | null;
  first_seen_at: string;
  last_seen_at: string;
};
