import React from "react";
import { Link } from "react-router-dom";
import RatingStars from "@/components/common/RatingStars";
import UserAvatar from "@/components/common/UserAvatar";
import { MapPin, Calendar, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

export default function EventCard({ event, photo, eventType, author }) {
  const photoUrl = photo?.photo_url || null;
  const created = event?.created_at || event?.created_date || null;

  return (
    <Link to={`/eventdetail?id=${event.id}`}>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
        {/* Media */}
        <div className="relative aspect-[4/3] bg-slate-200 overflow-hidden">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={event.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <div className="w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center shadow-sm">
                <ImageIcon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">No photo yet</p>
            </div>
          )}

          {/* Type badge */}
          {eventType && (
            <div className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-slate-700">
              {eventType.name}
            </div>
          )}

          {/* Rating */}
          <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full">
            <RatingStars rating={event.rating} size="xs" />
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-2 line-clamp-1">
            {event.title}
          </h3>

          {event.comment && (
            <p className="text-sm text-slate-600 mb-3 line-clamp-2">
              {event.comment}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <UserAvatar user={author} size="xs" />
              <span className="font-medium">
                {author?.username || author?.full_name || "Anonymous"}
              </span>
            </div>
            {created && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(created), "MMM d")}</span>
              </div>
            )}
          </div>

          {event.location_name && (
            <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
              <MapPin className="w-3 h-3" />
              <span className="line-clamp-1">{event.location_name}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
