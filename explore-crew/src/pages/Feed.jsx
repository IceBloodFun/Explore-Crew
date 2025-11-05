import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import Button from "@/components/ui/button"; // export default Button
import EventCard from "@/components/events/EventCard";
import { Plus, Search, Filter as FilterIcon } from "lucide-react";

// Helpers pour signer les chemins du bucket privé
function isHttpUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

async function signPaths(paths) {
  const toSign = Array.from(new Set(paths.filter((p) => !!p && !isHttpUrl(p))));
  if (toSign.length === 0) return {};
  const { data, error } = await supabase
    .storage
    .from("event-photos")
    .createSignedUrls(toSign, 60 * 60); // 1h
  if (error) {
    console.error(error);
    return {};
  }
  const map = {};
  data.forEach((row, i) => {
    map[toSign[i]] = row.signedUrl || null;
  });
  return map;
}

export default function Feed() {
  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [photos, setPhotos] = useState([]); // signed photo objects
  const [users, setUsers] = useState([]); // profiles (auteurs)
  const [loading, setLoading] = useState(true);

  // états UI
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRating, setFilterRating] = useState("all");
  const [filterAuthor, setFilterAuthor] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1) events (RLS => moi + amis)
      const { data: evts, error: e1 } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      if (e1) console.error(e1);

      // 2) types
      const { data: types, error: e2 } = await supabase
        .from("event_types")
        .select("*");
      if (e2) console.error(e2);

      // 3) auteurs (profiles)
      const authorIds = [...new Set((evts || []).map((e) => e.created_by))];
      let profs = [];
      if (authorIds.length) {
        const { data: p, error: e4 } = await supabase
          .from("profiles")
          .select("*")
          .in("id", authorIds);
        if (e4) console.error(e4);
        profs = p || [];
      }

      // 4) photos (uniquement celles des events chargés)
      let phs = [];
      const eventIds = (evts || []).map((e) => e.id);
      if (eventIds.length) {
        const { data: ph, error: e3 } = await supabase
          .from("event_photos")
          .select("id,event_id,file_path,photo_url,sort_order")
          .in("event_id", eventIds);
        if (e3) console.error(e3);
        phs = ph || [];
      }

      // 5) signer les chemins privés
      const rawPaths = phs.map((p) => p.file_path || p.photo_url).filter(Boolean);
      const signedMap = await signPaths(rawPaths);
      const signedPhotos = phs.map((p) => {
        const path = p.file_path || p.photo_url;
        let url = path;
        if (!isHttpUrl(path)) {
          url = signedMap[path] || null;
        }
        return { ...p, photo_url: url };
      });

      setEvents(evts || []);
      setEventTypes(types || []);
      setPhotos(signedPhotos);
      setUsers(profs || []);
      setLoading(false);
    })();
  }, []);

  // auteurs uniques pour le filtre
  const uniqueAuthors = useMemo(() => {
    const ids = [...new Set(events.map((e) => e.created_by))];
    return users.filter((u) => ids.includes(u.id));
  }, [events, users]);

  // filtrage
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (events || []).filter((event) => {
      const matchesSearch =
        !q ||
        event.title.toLowerCase().includes(q) ||
        (event.comment || "").toLowerCase().includes(q);

      const matchesType = filterType === "all" || event.type_id === filterType;

      const matchesRating =
        filterRating === "all" ||
        (typeof event.rating === "number" && event.rating >= parseInt(filterRating, 10));

      const matchesAuthor =
        filterAuthor === "all" || event.created_by === filterAuthor;

      return matchesSearch && matchesType && matchesRating && matchesAuthor;
    });
  }, [events, searchQuery, filterType, filterRating, filterAuthor]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="h-8 w-32 bg-slate-200 rounded mb-6 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden">
              <div className="aspect-[4/3] bg-slate-200 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-6 w-3/4 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1">Explore Feed</h1>
          <p className="text-slate-600">Discover what your crew has been up to</p>
        </div>
        {/* Add Event (desktop) */}
        <Link to="/addevent" className="hidden md:block">
          <Button className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white">
            <Plus className="w-4 h-4" />
            Add Event
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 bg-white border-slate-200"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <FilterIcon className="w-5 h-5 text-slate-500" />
        {/* Type */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
        >
          <option value="all">All Types</option>
          {eventTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {/* Rating */}
        <select
          value={filterRating}
          onChange={(e) => setFilterRating(e.target.value)}
          className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
        >
          <option value="all">All Ratings</option>
          <option value="4">4+ Stars</option>
          <option value="3">3+ Stars</option>
        </select>
        {/* Author */}
        <select
          value={filterAuthor}
          onChange={(e) => setFilterAuthor(e.target.value)}
          className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
        >
          <option value="all">All Authors</option>
          {uniqueAuthors.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username || u.full_name || "User"}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <Search className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No events found</h3>
          <p className="text-slate-500">Try adjusting filters or search query</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            // première photo (si dispo)
            const firstPhoto = photos
              .filter((p) => p.event_id === event.id)
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];

            const eventType = eventTypes.find((t) => t.id === event.type_id);
            const author = users.find((u) => u.id === event.created_by);
            return (
              <EventCard
                key={event.id}
                event={event}
                photo={firstPhoto}
                eventType={eventType}
                author={author}
              />
            );
          })}
        </div>
      )}

      {/* Floating Add Button - Mobile */}
      <Link to="/addevent" className="md:hidden">
        <button className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
          <Plus className="w-6 h-6" />
        </button>
      </Link>
    </div>
  );
}
