import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "@/components/ui/button";
import { ArrowLeft, Trash2, CheckCircle, MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function WishDetail(){
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get("id");

  const [me,setMe]=useState(null);
  const [wish,setWish]=useState(null);
  const [type,setType]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{ if(!id) return; (async()=>{
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user||null; setMe(user);

    const { data: w } = await supabase.from("wishes").select("*").eq("id", id).single();
    setWish(w||null);

    if(w?.type_id){
      const { data: t } = await supabase.from("event_types").select("*").eq("id", w.type_id).single();
      setType(t||null);
    }
    setLoading(false);
  })() },[id]);

  const isOwner = me && wish && me.id===wish.created_by;

  async function markDone(){
    if(!isOwner) return;
    const { error } = await supabase.from("wishes").update({ completed:true }).eq("id", id);
    if(error){ console.error(error); alert("Failed to update wish."); return; }
    navigate("/wishlist");
  }

  async function removeWish(){
    if(!isOwner) return;
    const ok = window.confirm("Delete this wish?");
    if(!ok) return;
    const { error } = await supabase.from("wishes").delete().eq("id", id);
    if(error){ console.error(error); alert("Failed to delete wish."); return; }
    navigate("/wishlist");
  }

  if(loading){
    return <div className="max-w-4xl mx-auto px-4 py-6"><div className="h-64 rounded-2xl bg-slate-100 animate-pulse" /></div>;
  }
  if(!wish){
    return <div className="max-w-4xl mx-auto px-4 py-6">
      <p className="text-slate-600">Wish not found.</p>
      <Button className="mt-4" onClick={()=>navigate("/wishlist")}>Back</Button>
    </div>;
  }

  const prLabel = {1:"Low",2:"Medium",3:"High"};
  const prClass = {1:"bg-blue-100 text-blue-700",2:"bg-amber-100 text-amber-700",3:"bg-red-100 text-red-700"};

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="icon" onClick={()=>navigate("/wishlist")}><ArrowLeft className="w-4 h-4" /></Button>
        {isOwner && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-green-600 hover:text-green-700" onClick={markDone}>
              <CheckCircle className="w-4 h-4 mr-2" /> Mark as Done
            </Button>
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={removeWish}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{wish.name}</h1>
            <div className="flex items-center gap-2">
              {type && <span className="inline-block px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium">{type.name}</span>}
              <span className={`px-2 py-1 rounded ${prClass[wish.priority]||prClass[2]} text-xs font-medium`}>
                {prLabel[wish.priority]||"Medium"} Priority
              </span>
            </div>
          </div>
        </div>

        {wish.comment && <p className="text-slate-700 text-lg leading-relaxed">{wish.comment}</p>}

        {wish.location_name && (
          <div className="flex items-center gap-2 pt-4 border-t border-slate-200 text-slate-600">
            <MapPin className="w-4 h-4" />
            <span>{wish.location_name}</span>
          </div>
        )}
      </div>

      {wish.latitude && wish.longitude && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Location</h3>
          <div className="h-[300px] rounded-lg overflow-hidden">
            <MapContainer center={[wish.latitude, wish.longitude]} zoom={15} style={{height:"100%", width:"100%"}}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
              <Marker position={[wish.latitude, wish.longitude]}>
                <Popup>{wish.name}</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}
