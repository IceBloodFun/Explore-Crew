import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Link } from "react-router-dom";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, AlertCircle, MapPin, Plus } from "lucide-react";

export default function Wishlist(){
  const [wishes,setWishes]=useState([]);
  const [types,setTypes]=useState([]);
  const [loading,setLoading]=useState(true);

  const [q,setQ]=useState("");
  const [ftype,setFtype]=useState("all");
  const [fprio,setFprio]=useState("all");

  useEffect(()=>{(async()=>{
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user || null;

    const [{ data: t }, wsResp] = await Promise.all([
      supabase.from("event_types").select("*").order("name"),
      user
        ? supabase
            .from("wishes")
            .select("*")
            .eq("created_by", user.id)
            .eq("completed", false)
            .order("created_at",{ascending:false})
        : Promise.resolve({ data: [] })
    ]);

    setTypes(t||[]);
    setWishes(wsResp?.data || []);
    setLoading(false);
  })()},[]);

  const filtered = useMemo(()=>{
    const S = q.trim().toLowerCase();
    return wishes.filter(w=>{
      const okQ = !S || w.name.toLowerCase().includes(S) || (w.comment||"").toLowerCase().includes(S);
      const okT = ftype==="all" || w.type_id===ftype;
      const okP = fprio==="all" || w.priority===parseInt(fprio,10);
      return okQ && okT && okP;
    });
  },[wishes,q,ftype,fprio]);

  const prLabel = {1:"Low",2:"Medium",3:"High"};
  const prClass = {1:"bg-blue-100 text-blue-700",2:"bg-amber-100 text-amber-700",3:"bg-red-100 text-red-700"};

  if(loading){
    return <div className="max-w-5xl mx-auto px-4 py-6"><div className="h-64 rounded-2xl bg-slate-100 animate-pulse" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">My Wishlist</h1>
          <p className="text-slate-600">Places and experiences you want to explore</p>
        </div>
        <Link to="/wishlist/add">
          <Button className="bg-gradient-to-r from-pink-500 to-rose-500">
            <Plus className="w-4 h-4 mr-2" />
            Add Wish
          </Button>
        </Link>
      </div>

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search wishes..."
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            className="pl-10 h-12 bg-white"
          />
        </div>

        <div className="flex gap-2">
          <select value={ftype} onChange={(e)=>setFtype(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm">
            <option value="all">All Types</option>
            {types.map(t=>(<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
          <select value={fprio} onChange={(e)=>setFprio(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm">
            <option value="all">All Priority</option>
            <option value="3">High</option>
            <option value="2">Medium</option>
            <option value="1">Low</option>
          </select>
        </div>
      </div>

      {filtered.length===0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-pink-100 flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-pink-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No wishes yet</h3>
          <p className="text-slate-500 mb-4">Start adding places you want to visit!</p>
          <Link to="/wishlist/add"><Button>Add Your First Wish</Button></Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(w=>{
            const wt = types.find(t=>t.id===w.type_id);
            const cls = prClass[w.priority] || prClass[2];
            return (
              <Link key={w.id} to={`/wishlist/detail?id=${w.id}`}>
                <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-slate-800">{w.name}</h3>
                    <span className={`px-2 py-1 rounded ${cls} text-xs font-medium`}>
                      {prLabel[w.priority] || "Medium"} Priority
                    </span>
                  </div>
                  {w.comment && <p className="text-sm text-slate-600 mb-3 line-clamp-2">{w.comment}</p>}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {wt && <span className="px-2 py-1 bg-slate-100 rounded">{wt.name}</span>}
                    {w.location_name && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{w.location_name}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
