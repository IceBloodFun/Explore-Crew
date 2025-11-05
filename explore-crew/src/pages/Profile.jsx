import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserAvatar from "@/components/common/UserAvatar";
import { Loader2, Upload } from "lucide-react";

// mini textarea local
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

export default function Profile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  // form state
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user || null);
      if (!user) {
        setLoading(false);
        return;
      }

      // 🔹 Assure-toi qu'une ligne existe (sinon update ne fait rien)
      await supabase
        .from("profiles")
        .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });

      // fetch profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUsername(prof?.username || "");
      setFullName(prof?.full_name || "");
      setBio(prof?.bio || "");
      setAvatarUrl(prof?.avatar_url || "");
      setLoading(false);
    })();
  }, []);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file || !me) return;

    setUploadingAvatar(true);
    try {
      // bucket public "avatars" (on a déjà créé les policies précédemment)
      const base = file.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_");
      const path = `${me.id}/${Date.now()}-${base}`;

      const { error: upErr } = await supabase
        .storage
        .from("avatars")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(pub?.publicUrl || "");
    } catch (err) {
      console.error(err);
      alert("Avatar upload failed (bucket 'avatars').");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!me) return;
    setSaving(true);
    try {
      // 🔹 UP SERT (crée si ça n'existe pas, sinon met à jour)
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: me.id,
            username: username || null,
            full_name: fullName || null,
            bio: bio || null,
            avatar_url: avatarUrl || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select()
        .single();

      if (error) throw error;

      // Optionnel : recharger depuis la DB pour être sûr
      const { data: fresh } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", me.id)
        .single();

      setUsername(fresh?.username || "");
      setFullName(fresh?.full_name || "");
      setBio(fresh?.bio || "");
      setAvatarUrl(fresh?.avatar_url || "");
      alert("Profile saved!");
    } catch (err) {
      console.error(err);
      alert("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="h-8 w-40 bg-slate-200 rounded mb-6 animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!me) return <div className="p-6">Not logged in.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-6">My Profile</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          {/* avatar + uploader */}
          <div className="flex items-center gap-4">
            <UserAvatar user={{ avatar_url: avatarUrl, username, full_name: fullName, email: me.email }} size="xl" />
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                disabled={uploadingAvatar}
              />
              <div className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">
                {uploadingAvatar ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Change Avatar
                  </span>
                )}
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <Input value={me.email} disabled className="bg-slate-100" />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <Input
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
            <Input
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
            <Textarea
              rows={4}
              placeholder="Tell us about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-12 bg-gradient-to-r from-cyan-500 to-teal-600 text-white"
          disabled={saving}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          ) : (
            "Save Changes"
          )}
        </Button>
      </form>
    </div>
  );
}
