import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import UserAvatar from "@/components/common/UserAvatar";
import Button from "@/components/ui/button";
import { UserPlus, UserCheck, UserX } from "lucide-react";

export default function Friends() {
  const [me, setMe] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [requests, setRequests] = useState([]);   // friend_requests liés à moi
  const [friends, setFriends] = useState([]);     // friendships (mes amis)
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      setMe(user || null);

      // tous les profils (on filtrera client-side)
      const [{ data: profs }, { data: reqs }, { data: frs }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase
          .from("friend_requests")
          .select("*")
          .or(`from_user_id.eq.${user?.id},to_user_id.eq.${user?.id}`),
        supabase.from("friendships").select("*"),
      ]);

      setProfiles((profs || []).filter((p) => p.id !== user?.id));
      setRequests(reqs || []);
      setFriends(frs || []);
      setLoading(false);
    })();
  }, []);

  const friendIds = useMemo(
    () => new Set(friends.map((f) => (f.user_id === me?.id ? f.friend_id : f.user_id))),
    [friends, me?.id]
  );

  // status pour un utilisateur donné
  function getStatus(otherId) {
    if (friendIds.has(otherId)) return "friend";

    const r = requests.find(
      (r) =>
        (r.from_user_id === me?.id && r.to_user_id === otherId) ||
        (r.to_user_id === me?.id && r.from_user_id === otherId)
    );
    if (!r) return "none";
    if (r.status === "accepted") return "friend";
    if (r.status === "rejected") return "none";
    if (r.from_user_id === me?.id) return "outgoing"; // j'ai envoyé
    return "incoming"; // j'ai reçu
  }

  async function sendRequest(otherId) {
    await supabase.from("friend_requests").insert({
      from_user_id: me.id,
      to_user_id: otherId,
      status: "pending",
    });
    // refresh léger
    const { data } = await supabase
      .from("friend_requests")
      .select("*")
      .or(`from_user_id.eq.${me.id},to_user_id.eq.${me.id}`);
    setRequests(data || []);
  }

  async function acceptRequest(otherId) {
    // retrouve la requête
    const req = requests.find(
      (r) => r.from_user_id === otherId && r.to_user_id === me.id && r.status === "pending"
    );
    if (!req) return;
    // 1) update -> accepted
    await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", req.id);
    // 2) crée la relation dans friendships (bidirectionnelle si tu as un trigger, sinon insère 2 lignes)
    await supabase.from("friendships").insert({ user_id: me.id, friend_id: otherId });
    await supabase.from("friendships").insert({ user_id: otherId, friend_id: me.id });

    // refresh
    const [{ data: reqs }, { data: frs }] = await Promise.all([
      supabase
        .from("friend_requests")
        .select("*")
        .or(`from_user_id.eq.${me.id},to_user_id.eq.${me.id}`),
      supabase.from("friendships").select("*"),
    ]);
    setRequests(reqs || []);
    setFriends(frs || []);
  }

  async function declineRequest(otherId) {
    const req = requests.find(
      (r) => r.from_user_id === otherId && r.to_user_id === me.id && r.status === "pending"
    );
    if (!req) return;
    await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", req.id);
    const { data } = await supabase
      .from("friend_requests")
      .select("*")
      .or(`from_user_id.eq.${me.id},to_user_id.eq.${me.id}`);
    setRequests(data || []);
  }

  async function removeFriend(otherId) {
    await supabase.from("friendships").delete().or(
      `and(user_id.eq.${me.id},friend_id.eq.${otherId}),and(user_id.eq.${otherId},friend_id.eq.${me.id})`
    );
    const { data } = await supabase.from("friendships").select("*");
    setFriends(data || []);
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return profiles;
    return profiles.filter(
      (p) =>
        (p.username || "").toLowerCase().includes(needle) ||
        (p.full_name || "").toLowerCase().includes(needle) ||
        (p.email || "").toLowerCase().includes(needle)
    );
  }, [profiles, q]);

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Friends</h1>
        <p className="text-slate-600">Manage your crew</p>
      </div>

      <div className="mb-6">
        <input
          className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
          placeholder="Search friends…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-slate-500">No users.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((u) => {
            const st = getStatus(u.id);
            return (
              <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                <UserAvatar user={u} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">
                    {u.username || u.full_name || "User"}
                  </div>
                  <div className="text-sm text-slate-500 truncate">{u.email}</div>
                </div>

                {/* Actions selon statut */}
                {st === "friend" && (
                  <Button variant="outline" onClick={() => removeFriend(u.id)} className="flex items-center gap-2">
                    <UserX className="w-4 h-4" />
                    Remove
                  </Button>
                )}
                {st === "none" && (
                  <Button onClick={() => sendRequest(u.id)} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white">
                    <UserPlus className="w-4 h-4" />
                    Add
                  </Button>
                )}
                {st === "outgoing" && (
                  <span className="text-sm text-slate-500">Request sent…</span>
                )}
                {st === "incoming" && (
                  <div className="flex gap-2">
                    <Button onClick={() => acceptRequest(u.id)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <UserCheck className="w-4 h-4" />
                      Accept
                    </Button>
                    <Button variant="outline" onClick={() => declineRequest(u.id)}>
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
