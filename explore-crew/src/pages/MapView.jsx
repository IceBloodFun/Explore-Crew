import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import Button from "@/components/ui/button";
import RatingStars from "@/components/common/RatingStars";
import { ExternalLink } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function isHttpUrl(v){ return typeof v==="string" && /^https?:\/\//i.test(v); }

async function signPaths(paths){
  const toSign = Array.from(new Set(paths.filter((p)=>!!p && !isHttpUrl(p))));
  if(!toSign.length) return {};
  const { data, error } = await supabase.storage.from("event-photos").createSignedUrls(toSign, 3600);
  if(error){ console.error(error); return {}; }
  const map = {}; data.forEach((row, i)=>{ map[toSign[i]] = row.signedUrl || null; });
  return map;
}

export default function MapView(){
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [types, setTypes] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [center, setCenter] = useState([50.846741, 4.35249]); // Bruxelles par défaut
  const [zoom, setZoom] = useState(12);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{(async()=>{
    setLoading(true);
    const { data: evts } = await supabase
      .from("events")
      .select("*")
      .not("latitude","is",null)
      .not("longitude","is",null)
      .order("created_at",{ascending:false});

    const { data: t } = await supabase.from("event_types").select("*");

    let ph = [];
    const ids = (evts||[]).map(e=>e.id);
    if(ids.length){
      const { data } = await supabase
        .from("event_photos")
        .select("event_id,file_path,photo_url,sort_order")
        .in("event_id", ids);
      ph = data || [];
    }

    const rawPaths = ph.map(p=>p.file_path || p.photo_url).filter(Boolean);
    const signed = await signPaths(rawPaths);
    const signedPhotos = ph.map(p=>{
      const path = p.file_path || p.photo_url;
      const url = isHttpUrl(path) ? path : (signed[path] || null);
      return { ...p, photo_url: url };
    });

    setEvents(evts||[]);
    setTypes(t||[]);
    setPhotos(signedPhotos);

    const withLoc = (evts||[]);
    if(withLoc.length){
      const avgLat = withLoc.reduce((s,e)=>s+e.latitude,0)/withLoc.length;
      const avgLng = withLoc.reduce((s,e)=>s+e.longitude,0)/withLoc.length;
      setCenter([avgLat, avgLng]);
    }else if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setZoom(12);
      });
    }
    setLoading(false);
  })()},[]);

  const eventsWithLoc = useMemo(()=>events.filter(e=>e.latitude && e.longitude),[events]);

  if(loading){
    return <div className="h-[calc(100vh-4rem)] bg-slate-100 animate-pulse" />;
  }

  return (
    <div className="h-[calc(100vh-4rem)] relative">
      <MapContainer center={center} zoom={zoom} style={{height:"100%", width:"100%"}} className="z-0">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        />
        {eventsWithLoc.map(event=>{
          const first = photos
            .filter(p=>p.event_id===event.id)
            .sort((a,b)=>(a.sort_order??0)-(b.sort_order??0))[0];
          const type = types.find(t=>t.id === event.type_id);
          return (
            <Marker key={event.id} position={[event.latitude, event.longitude]}>
              <Popup>
                <div className="w-48">
                  {first?.photo_url && (
                    <img src={first.photo_url} alt={event.title} className="w-full h-32 object-cover rounded-lg mb-2" />
                  )}
                  <h3 className="font-semibold text-sm mb-1">{event.title}</h3>
                  {type && <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs mb-2">{type.name}</span>}
                  <div className="mb-2">
                    <RatingStars rating={event.rating} size="xs" />
                  </div>
                  <Button size="sm" className="w-full" onClick={()=>navigate(`/eventdetail?id=${event.id}`)}>
                    <ExternalLink className="w-3 h-3 mr-2" />
                    View Details
                  </Button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4">
        <h3 className="font-semibold text-sm mb-1">Events on Map</h3>
        <p className="text-xs text-slate-600">{eventsWithLoc.length} locations</p>
      </div>
    </div>
  );
}
