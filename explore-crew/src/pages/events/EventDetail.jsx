import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RatingStars from "@/components/common/RatingStars";
import UserAvatar from "@/components/common/UserAvatar";
import {
  Calendar,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Edit,
  Upload,
  X,
  Loader2,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default marker icon (CDN)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// --- small local UI helpers ---
const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={[
      "block w-full rounded-lg border border-slate-300 bg-white",
      "px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm",
      "focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent",
      className,
    ].join(" ")}
    {...props}
  />
);
const Checkbox = ({ checked, onChange, id }) => (
  <input
    id={id}
    type="checkbox"
    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
    checked={checked}
    onChange={(e) => onChange?.(e.target.checked)}
  />
);

// --- helpers for private bucket signing ---
function isHttpUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

async function signPaths(paths) {
  const toSign = Array.from(new Set(paths.filter((p) => !!p && !isHttpUrl(p))));
  if (!toSign.length) return {};
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

export default function EventDetail() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const eventId = params.get("id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // view data
  const [event, setEvent] = useState(null);
  const [photoUrls, setPhotoUrls] = useState([]); // signed URLs for carousel
  const [eventType, setEventType] = useState(null);
  const [author, setAuthor] = useState(null);
  const [participants] = useState([]);
  const [me, setMe] = useState(null);
  const [idx, setIdx] = useState(0);

  // edit mode
  const [editMode, setEditMode] = useState(false);
  const [eventTypes, setEventTypes] = useState([]);
  const [friends, setFriends] = useState([]);

  // editable form states
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);

  // photos edit
  const [existingPhotos, setExistingPhotos] = useState([]); // rows: {id, file_path, photo_url, sort_order}
  const [toDelete, setToDelete] = useState([]); // existing rows to delete (keep full row for id+file_path)
  const [newFiles, setNewFiles] = useState([]); // [{file, preview}]
  const MAX_PHOTOS = 4;

  // participants edit
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [initialParticipantIds, setInitialParticipantIds] = useState([]);

  const [geoLoading, setGeoLoading] = useState(false);

  const isOwner = me && event && me.id === event.created_by;

  // ----------------- LOAD -----------------
  async function loadAll() {
    setLoading(true);

    // me
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user || null;
    setMe(user);

    // event
    const { data: ev, error: e1 } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (e1) {
      console.error(e1);
      setLoading(false);
      return;
    }
    setEvent(ev);

    // photos (with ids)
    const { data: phs, error: e2 } = await supabase
      .from("event_photos")
      .select("id, file_path, photo_url, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });
    if (e2) console.error(e2);
    setExistingPhotos(phs || []);

    // sign for carousel
    const paths = (phs || [])
      .map((p) => p.file_path || p.photo_url)
      .filter(Boolean);
    const signed = await signPaths(paths);
    const urls = paths
      .map((p) => (isHttpUrl(p) ? p : signed[p] || null))
      .filter(Boolean);
    setPhotoUrls(urls);

    // event type (single) for badge
    if (ev?.type_id) {
      const { data: t } = await supabase
        .from("event_types")
        .select("*")
        .eq("id", ev.type_id)
        .single();
      setEventType(t || null);
    } else {
      setEventType(null);
    }

    // all types for editing
    const { data: types } = await supabase.from("event_types").select("*").order("name");
    setEventTypes(types || []);

    // author
    if (ev?.created_by) {
      const { data: a } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", ev.created_by)
        .single();
      setAuthor(a || null);
    } else {
      setAuthor(null);
    }

    // participants
    const { data: ep } = await supabase
      .from("event_participants")
      .select("user_id")
      .eq("event_id", eventId);
    const ids = (ep || []).map((r) => r.user_id);
    setInitialParticipantIds(ids);
    setSelectedParticipants(ids);

    // friends list (for picking participants)
    if (user) {
      const { data: fs } = await supabase
        .from("friendships")
        .select("user_id, friend_id");
      const myId = user.id;
      const friendIds = (fs || []).map((row) =>
        row.user_id === myId ? row.friend_id : row.user_id
      );
      if (friendIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("*")
          .in("id", friendIds);
        setFriends(profs || []);
      } else {
        setFriends([]);
      }
    } else {
      setFriends([]);
    }

    // seed editable form fields
    setTitle(ev.title || "");
    setTypeId(ev.type_id || "");
    setRating(ev.rating || 5);
    setComment(ev.comment || "");
    setLocationName(ev.location_name || "");
    setLatitude(ev.latitude ?? null);
    setLongitude(ev.longitude ?? null);

    // reset edit helpers
    setToDelete([]);
    setNewFiles([]);
    setIdx(0);

    setLoading(false);
  }

  useEffect(() => {
    if (eventId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // ----------------- EDIT HANDLERS -----------------
  const toggleParticipant = (id) => {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const getCurrentLocation = () => {
    setGeoLoading(true);
    if (!navigator.geolocation) {
      setGeoLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        if (!locationName) setLocationName("Current Location");
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true }
    );
  };

  const onSelectFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const currentCount = (existingPhotos?.length || 0) + (newFiles?.length || 0);
    const remaining = Math.max(0, MAX_PHOTOS - currentCount);
    const take = picked.slice(0, remaining);
    const withPreview = take.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setNewFiles((prev) => [...prev, ...withPreview]);
  };

  const removeNewFile = (idx) => {
    setNewFiles((prev) => {
      const next = [...prev];
      const f = next[idx];
      if (f?.preview) URL.revokeObjectURL(f.preview);
      next.splice(idx, 1);
      return next;
    });
  };

  const removeExistingPhoto = (photoRow) => {
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photoRow.id));
    setToDelete((prev) => [...prev, photoRow]); // keep for deletion (id + file_path)
  };

  async function uploadEventPhotos(filesToUpload, eventId, userId, startOrder = 0) {
    const inserted = [];
    for (let i = 0; i < filesToUpload.length; i++) {
      const f = filesToUpload[i].file;
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${eventId}/${Date.now()}-${i}.${ext}`;

      const { error: upErr } = await supabase
        .storage
        .from("event-photos")
        .upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type,
        });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("event_photos")
        .insert({
          event_id: eventId,
          file_path: path,
          photo_url: path, // placeholder (private bucket)
          sort_order: startOrder + i,
        });
      if (dbErr) throw dbErr;

      inserted.push(path);
    }
    return inserted;
  }

  async function saveEdits() {
    if (!isOwner || !event) return;
    setSaving(true);
    try {
      // 1) update event fields
      const { error: eUpdate } = await supabase
        .from("events")
        .update({
          title: title.trim(),
          type_id: typeId || null,
          rating,
          comment: comment.trim() || null,
          location_name: locationName.trim() || null,
          latitude: latitude !== "" ? Number(latitude) : null,
          longitude: longitude !== "" ? Number(longitude) : null,
        })
        .eq("id", event.id);
      if (eUpdate) throw eUpdate;

      // get user id
      const ownerId = event.created_by;

      // 2) delete removed existing photos (storage + rows)
      if (toDelete.length) {
        const paths = toDelete
          .map((p) => p.file_path || p.photo_url)
          .filter((p) => p && !isHttpUrl(p));
        if (paths.length) {
          // bulk remove on storage
          const { error: remErr } = await supabase
            .storage
            .from("event-photos")
            .remove(paths);
          if (remErr) console.warn(remErr);
        }
        // delete rows
        const ids = toDelete.map((p) => p.id);
        await supabase.from("event_photos").delete().in("id", ids);
      }

      // 3) upload new photos (append at the end)
      if (newFiles.length) {
        const nextOrder = existingPhotos.length; // remaining ones after deletions already reflected in state
        await uploadEventPhotos(newFiles, event.id, ownerId, nextOrder);
      }

      // 4) sync participants
      const init = new Set(initialParticipantIds);
      const nowSet = new Set(selectedParticipants);

      const toAdd = [...nowSet].filter((id) => !init.has(id));
      const toRemove = [...init].filter((id) => !nowSet.has(id));

      if (toAdd.length) {
        const rows = toAdd.map((uid) => ({ event_id: event.id, user_id: uid }));
        const { error: eIns } = await supabase.from("event_participants").insert(rows);
        if (eIns) throw eIns;
      }
      if (toRemove.length) {
        const { error: eDel } = await supabase
          .from("event_participants")
          .delete()
          .eq("event_id", event.id)
          .in("user_id", toRemove);
        if (eDel) throw eDel;
      }

      // 5) reload fresh data and exit edit mode
      await loadAll();
      setEditMode(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdits() {
    // simple reset by reloading
    loadAll();
    setEditMode(false);
  }

  // ----------------- VIEW ACTIONS -----------------
  const next = () =>
    setIdx((p) => (photoUrls.length ? (p + 1) % photoUrls.length : 0));
  const prev = () =>
    setIdx((p) =>
      photoUrls.length ? (p - 1 + photoUrls.length) % photoUrls.length : 0
    );

  async function handleDelete() {
    if (!isOwner) return;
    const ok = window.confirm(
      "Delete this event? This action cannot be undone."
    );
    if (!ok) return;
    try {
      // Remove files from storage (folder = {ownerId}/{eventId})
      const ownerId = event.created_by;
      const folder = `${ownerId}/${eventId}`;
      const { data: objs, error: listErr } = await supabase.storage
        .from("event-photos")
        .list(folder, { limit: 1000 });
      if (listErr) console.warn(listErr);

      if (objs && objs.length) {
        const paths = objs.map((o) => `${folder}/${o.name}`);
        const { error: remErr } = await supabase.storage
          .from("event-photos")
          .remove(paths);
        if (remErr) console.warn(remErr);
      }

      // Delete children rows first
      await supabase.from("event_photos").delete().eq("event_id", eventId);
      await supabase.from("event_participants").delete().eq("event_id", eventId);

      // Then the event
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;

      navigate("/feed");
    } catch (err) {
      console.error(err);
      alert("Failed to delete the event.");
    }
  }

  // ----------------- RENDER -----------------
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="h-10 w-32 bg-slate-200 rounded mb-4 animate-pulse" />
        <div className="aspect-[16/9] bg-slate-200 rounded-2xl mb-6 animate-pulse" />
        <div className="h-8 w-1/2 bg-slate-200 rounded mb-3 animate-pulse" />
        <div className="h-24 w-full bg-slate-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-slate-600">Event not found.</p>
        <Button className="mt-4" onClick={() => navigate("/feed")}>
          Back to feed
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {isOwner && !editMode && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        )}

        {isOwner && editMode && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEdits}
              disabled={saving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-cyan-500 to-teal-600 text-white"
              onClick={saveEdits}
              disabled={saving}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* VIEW MODE */}
      {!editMode && (
        <>
          {/* Carousel */}
          {photoUrls.length > 0 && (
            <div className="mb-6 rounded-2xl overflow-hidden bg-slate-900 relative">
              <div className="aspect-[16/9]">
                <img
                  src={photoUrls[idx]}
                  alt={event.title}
                  className="w-full h-full object-contain bg-slate-900"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
              {photoUrls.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {photoUrls.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setIdx(i)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i === idx ? "bg-white w-6" : "bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Card: details */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  {event.title}
                </h1>
                {eventType && (
                  <span className="inline-block px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium">
                    {eventType.name}
                  </span>
                )}
              </div>
              <RatingStars rating={event.rating} size="lg" />
            </div>

            {event.comment && (
              <p className="text-slate-700 text-lg leading-relaxed mt-4">
                {event.comment}
              </p>
            )}

            <div className="flex items-center gap-4 pt-4 mt-4 border-t border-slate-200 text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {event.created_at
                    ? format(new Date(event.created_at), "MMMM d, yyyy")
                    : ""}
                </span>
              </div>
              {event.location_name && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* People */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
            <h3 className="font-semibold text-slate-900 mb-4">People</h3>
            <div className="space-y-3">
              {/* author */}
              <div className="flex items-center gap-3">
                <UserAvatar user={author} size="md" />
                <div>
                  <p className="font-medium text-slate-900">
                    {author?.username || author?.full_name || "User"}
                  </p>
                  <p className="text-sm text-slate-500">Event creator</p>
                </div>
              </div>

              {/* participants */}
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <UserAvatar user={p} size="md" />
                  <div>
                    <p className="font-medium text-slate-900">
                      {p.username || p.full_name}
                    </p>
                    <p className="text-sm text-slate-500">Participant</p>
                  </div>
                </div>
              ))}

              {!author && participants.length === 0 && (
                <p className="text-sm text-slate-500">No participants listed.</p>
              )}
            </div>
          </div>

          {/* Map */}
          {event.latitude && event.longitude && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Location</h3>
              <div className="h-[300px] rounded-lg overflow-hidden">
                <MapContainer
                  center={[event.latitude, event.longitude]}
                  zoom={15}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <Marker position={[event.latitude, event.longitude]}>
                    <Popup>{event.title}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* EDIT MODE */}
      {editMode && (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            saveEdits();
          }}
        >
          {/* Photos */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                Photos
              </h2>
              <span className="text-sm text-slate-500">
                {(existingPhotos.length + newFiles.length)}/{MAX_PHOTOS}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* existing */}
              {existingPhotos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                  {/* signed URL for display */}
                  <img
                    src={
                      photoUrls.find((u) =>
                        (p.file_path || p.photo_url)
                          ? u.includes(encodeURIComponent((p.file_path || p.photo_url).split("/").pop()))
                          : false
                      ) || photoUrls[0] || ""
                    }
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingPhoto(p)}
                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* new */}
              {newFiles.map((f, i) => (
                <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                  <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeNewFile(i)}
                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {existingPhotos.length + newFiles.length < MAX_PHOTOS && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-cyan-500 flex flex-col items-center justify-center cursor-pointer transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-600">Add photos</span>
                  <input type="file" accept="image/*" multiple onChange={onSelectFiles} className="hidden" />
                </label>
              )}
            </div>
          </section>

          {/* Details */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Title *
              </label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type *
                </label>
                <select
                  value={typeId || ""}
                  onChange={(e) => setTypeId(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-slate-300 bg-white w-full text-sm"
                >
                  <option value="">Select type</option>
                  {eventTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rating *
                </label>
                <RatingStars rating={rating} size="md" interactive onChange={setRating} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location name
                </label>
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Comment
              </label>
              <Textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </section>

          {/* Location */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Location</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={getCurrentLocation}
                className="flex items-center gap-2"
                disabled={geoLoading}
              >
                <MapPin className="w-4 h-4" />
                {geoLoading ? "Getting..." : "Use Current"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Latitude
                </label>
                <Input
                  type="number"
                  step="any"
                  value={latitude ?? ""}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Longitude
                </label>
                <Input
                  type="number"
                  step="any"
                  value={longitude ?? ""}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="0.0"
                />
              </div>
            </div>
          </section>

          {/* Participants */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4" /> Participants
              </h2>
              <span className="text-sm text-slate-500">
                {selectedParticipants.length}/{friends.length} selected
              </span>
            </div>
            {friends.length === 0 ? (
              <p className="text-sm text-slate-500">No friends yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {friends.map((u) => {
                  const checked = selectedParticipants.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <Checkbox
                        id={`u-${u.id}`}
                        checked={checked}
                        onChange={() => toggleParticipant(u.id)}
                      />
                      <UserAvatar user={u} size="sm" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-800">
                          {u.username || u.full_name || "User"}
                        </div>
                        {u.bio && (
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {u.bio}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {/* Save buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelEdits} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-cyan-500 to-teal-600 text-white"
              onClick={saveEdits}
              disabled={saving}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
