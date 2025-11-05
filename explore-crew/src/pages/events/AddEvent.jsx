import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RatingStars from "@/components/common/RatingStars";
import UserAvatar from "@/components/common/UserAvatar";
import { MapPin, Upload, X, Loader2, Users, ImagePlus } from "lucide-react";

// Mini Textarea & Checkbox si tu ne les as pas encore dans /ui
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

export default function AddEvent() {
  const navigate = useNavigate();

  // Form
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);

  // Data
  const [currentUser, setCurrentUser] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedParticipants, setSelectedParticipants] = useState([]);

  // Photos
  const [files, setFiles] = useState([]); // [{file, preview}]
  const [submitting, setSubmitting] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: userData }, { data: types }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("event_types").select("*").order("name"),
      ]);
      const user = userData?.user || null;
      setCurrentUser(user);
      setEventTypes(types || []);

      // Récupère les amis (table friendships avec unicité symétrique)
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
      }
    })();
  }, []);

  const toggleParticipant = (id) => {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const canSubmit = title.trim() && typeId && files.length > 0 && !submitting;

  // Geoloc
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

  // File selection
  const onSelectFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const remaining = Math.max(0, 4 - files.length);
    const take = picked.slice(0, remaining);
    const withPreview = take.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...prev, ...withPreview]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => {
      const next = [...prev];
      const f = next[idx];
      if (f?.preview) URL.revokeObjectURL(f.preview);
      next.splice(idx, 1);
      return next;
    });
  };

  // Upload helper: upload vers bucket privé + insert event_photos
  async function uploadEventPhotos(filesToUpload, eventId, userId) {
    const inserted = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const f = filesToUpload[i].file;
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${eventId}/${Date.now()}-${i}.${ext}`;

      // Upload privé
      const { error: upErr } = await supabase
        .storage
        .from("event-photos")
        .upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type,
        });
      if (upErr) throw upErr;

      // IMPORTANT :
      // - bucket privé => on NE stocke PAS d'URL publique
      // - on stocke file_path (et aussi photo_url=path pour satisfaire le NOT NULL)
      const { error: dbErr } = await supabase
        .from("event_photos")
        .insert({
          event_id: eventId,
          file_path: path,
          photo_url: path, // placeholder : pas une URL. L'affichage utilisera des signed URLs.
          sort_order: i,
        });

      if (dbErr) throw dbErr;
      inserted.push(path);
    }
    return inserted;
  }

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      // 1) user
      let userId = currentUser?.id;
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        userId = user.id;
      }

      // 2) event
      const { data: ev, error: e1 } = await supabase
        .from("events")
        .insert({
          title: title.trim(),
          type_id: typeId,
          rating,
          comment: comment.trim() || null,
          location_name: locationName.trim() || null,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          created_by: userId,
        })
        .select()
        .single();
      if (e1) throw e1;

      // 3) photos -> storage privé + event_photos(file_path + photo_url=path)
      await uploadEventPhotos(files, ev.id, userId);

      // 4) participants
      if (selectedParticipants.length) {
        const rows = selectedParticipants.map((uid) => ({
          event_id: ev.id,
          user_id: uid,
        }));
        const { error: e3 } = await supabase.from("event_participants").insert(rows);
        if (e3) throw e3;
      }

      // 5) redirect
      navigate("/feed");
    } catch (err) {
      console.error(err);
      alert("Error while publishing the event.");
    } finally {
      setSubmitting(false);
    }
  };

  const friendCount = friends.length;
  const selectedCount = selectedParticipants.length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Add Event</h1>
        <p className="text-slate-600">Share your experience with the crew</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photos */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Photos *</h2>
            <span className="text-sm text-slate-500">{files.length}/4 selected</span>
          </div>

          {files.length === 0 ? (
            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 hover:border-cyan-500 transition-colors h-40 cursor-pointer">
              <ImagePlus className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-sm text-slate-600">Upload up to 4 photos</span>
              <input type="file" accept="image/*" multiple onChange={onSelectFiles} className="hidden" />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {files.map((f, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                  <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
                    title="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {files.length < 4 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-cyan-500 flex flex-col items-center justify-center cursor-pointer transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-600">Add more</span>
                  <input type="file" accept="image/*" multiple onChange={onSelectFiles} className="hidden" />
                </label>
              )}
            </div>
          )}
        </section>

        {/* Details */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <Input placeholder="e.g., Amazing pizza at Luigi's" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-300 bg-white w-full text-sm"
              >
                <option value="">Select type</option>
                {eventTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Rating *</label>
              <RatingStars rating={rating} size="md" interactive onChange={setRating} />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Location name</label>
              <Input placeholder="Enter location name" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Comment</label>
            <Textarea rows={4} placeholder="Share your thoughts..." value={comment} onChange={(e) => setComment(e.target.value)} />
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
              <label className="block text-xs text-slate-600 mb-1">Latitude</label>
              <Input
                type="number"
                step="any"
                value={latitude ?? ""}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Longitude</label>
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

        {/* Participants (friends) */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4" /> Participants
            </h2>
            <span className="text-sm text-slate-500">
              {selectedCount}/{friendCount} selected
            </span>
          </div>

          {friends.length === 0 ? (
            <p className="text-sm text-slate-500">No friends yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {friends.map((u) => {
                const checked = selectedParticipants.includes(u.id);
                return (
                  <label key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <Checkbox
                      id={`user-${u.id}`}
                      checked={checked}
                      onChange={() => toggleParticipant(u.id)}
                    />
                    <UserAvatar user={u} size="sm" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">
                        {u.username || u.full_name || "User"}
                      </div>
                      {u.bio && <div className="text-xs text-slate-500 line-clamp-1">{u.bio}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {/* Submit */}
        <div className="sticky bottom-4">
          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-cyan-500 to-teal-600 text-white hover:shadow-lg"
            disabled={!canSubmit}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </span>
            ) : (
              "Publish Event"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
