import React from "react";
import { Star } from "lucide-react";

export default function RatingStars({ rating = 0, size = "sm", interactive = false, onChange }) {
  const sizes = {
    xs: "w-3 h-3",
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={interactive ? "button" : "button"}
          onClick={interactive ? () => onChange?.(star) : undefined}
          disabled={!interactive}
          className={interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}
          aria-label={interactive ? `Set rating to ${star}` : undefined}
        >
          <Star
            className={`${sizes[size]} ${
              star <= (Number(rating) || 0) ? "fill-amber-400 text-amber-400" : "text-slate-300"
            } ${interactive ? "transition-colors" : ""}`}
          />
        </button>
      ))}
    </div>
  );
}
