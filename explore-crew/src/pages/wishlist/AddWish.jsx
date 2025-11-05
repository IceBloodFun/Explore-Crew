import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, ArrowLeft } from "lucide-react";

const Textarea = (props)=>(<textarea className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500" {...props} />);

export default function AddWish(){
  const navigate = useNavigate();
  const [types,setTypes]=useState([]);
  const [name,setName]=useState("");
  const [typeId,setTypeId]=useState("");
  const [priority,setPriority]=useState(2);
  const [comment,setComment]=useState("");
  const [locationName,setLocationName]=useState("");
  const [latitude,setLatitude]=useState(null);
  const [longitude,setLongitude]=useState(null);
  const [geoLoading,setGeoLoading]=useState(false);
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{(async()=>{
    const { data } = await supabase.from("event_types").select("*").order("name");
    setTypes(data||[]);
  })()},[]);

  const canSubmit = name.trim() && typeId && !submitting;

  const getCurrentLocation=()=>{
    setGeoLoading(true);
    if(!navigator.geolocation){ setGeoLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos)=>{ setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); if(!locationName) setLocationName("Current Location"); setGeoLoading(false); },
      ()=>setGeoLoading(false),
      { enableHighAccuracy:true }
    );
  };

  const onSubmit=async(e)=>{
    e.preventDefault(); if(!canSubmit) return;
    setSubmitting(true);
    try{
      const { data: { user } } = await supabase.auth.getUser();
      if(!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("wishes").insert({
        name: name.trim(),
        type_id: typeId,
        priority,
        comment: comment.trim() || null,
        location_name: locationName.trim() || null,
        latitude: latitude ? Number(latitude): null,
        longitude: longitude ? Number(longitude): null,
        created_by: user.id,
        completed: false,
      });
      if(error) throw error;
      navigate("/wishlist");
    }catch(err){
      console.error(err);
      alert("Failed to save wish.");
    }finally{
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={()=>navigate("/wishlist")}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Add Wish</h1>
          <p className="text-slate-600 text-sm">Add a place you want to visit</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Wish Name *</label>
            <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g., Try the famous ramen place" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
              <select value={typeId} onChange={(e)=>setTypeId(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 bg-white w-full text-sm">
                <option value="">Select type</option>
                {types.map(t=>(<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority *</label>
              <select value={priority} onChange={(e)=>setPriority(parseInt(e.target.value,10))} className="h-10 px-3 rounded-lg border border-slate-300 bg-white w-full text-sm">
                <option value={3}>High</option>
                <option value={2}>Medium</option>
                <option value={1}>Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Comment</label>
            <Textarea rows={4} value={comment} onChange={(e)=>setComment(e.target.value)} placeholder="Why do you want to visit this place?" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Location</h2>
            <Button type="button" variant="outline" size="sm" onClick={getCurrentLocation} disabled={geoLoading} className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {geoLoading ? "Getting..." : "Use Current"}
            </Button>
          </div>
          <Input value={locationName} onChange={(e)=>setLocationName(e.target.value)} placeholder="Enter location name" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Latitude</label>
              <Input type="number" step="any" value={latitude ?? ""} onChange={(e)=>setLatitude(e.target.value)} placeholder="0.0" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Longitude</label>
              <Input type="number" step="any" value={longitude ?? ""} onChange={(e)=>setLongitude(e.target.value)} placeholder="0.0" />
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full h-12 bg-gradient-to-r from-pink-500 to-rose-500 hover:shadow-lg" disabled={!canSubmit}>
          {submitting ? (<span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>) : "Save Wish"}
        </Button>
      </form>
    </div>
  );
}
