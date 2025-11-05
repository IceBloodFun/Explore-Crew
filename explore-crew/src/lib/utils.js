import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/lib/utils.js
export function createPageUrl(nameOrPath) {
  // si on te passe déjà un path '/...' on le garde
  if (typeof nameOrPath === "string" && nameOrPath.startsWith("/")) {
    return nameOrPath;
  }

  const map = {
    Feed: "/feed",
    MapView: "/mapview",
    Wishlist: "/wishlist",
    Friends: "/friends",
    Profile: "/profile",
    Settings: "/settings",
    AddEvent: "/addevent",
    EventDetail: "/eventdetail",
    AddWish: "/wishlist/add",
    WishDetail: "/wishlist/detail",
    Login: "/login",
  };

  // fallback: '/nom' en kebab/lowcase
  if (!map[nameOrPath]) {
    return `/${String(nameOrPath).trim().toLowerCase()}`;
  }
  return map[nameOrPath];
}

// petit helper utile si besoin
export function withQuery(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  return url.pathname + (url.search ? url.search : "");
}
