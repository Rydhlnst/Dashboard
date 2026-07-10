"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ProjectRecord } from "@/types/project";
import { Badge } from "@/components/ui/badge";

// Fix default marker icon issue in Leaflet
const DefaultIcon = L.icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons based on status
const greenIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const yellowIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapComponentProps {
  projects: ProjectRecord[];
}

// Helper component to center and fit bounds dynamically
function ChangeMapView({ projects }: { projects: ProjectRecord[] }) {
  const map = useMap();

  useEffect(() => {
    if (!projects || projects.length === 0) return;

    const coordinates = projects
      .filter((p) => p.lat !== null && p.lng !== null)
      .map((p) => [p.lat as number, p.lng as number] as L.LatLngTuple);

    if (coordinates.length === 0) return;

    if (coordinates.length === 1) {
      map.setView(coordinates[0], 12);
    } else {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [projects, map]);

  return null;
}

export default function MapComponent({ projects }: MapComponentProps) {
  const validSites = projects.filter((p) => p.lat !== null && p.lng !== null);

  const getMarkerIcon = (status: string | null, blocking: boolean) => {
    if (blocking) return redIcon;
    if (!status) return DefaultIcon;
    const s = status.toLowerCase();
    if (s.includes("complet") || s.includes("done") || s.includes("selesai")) {
      return greenIcon;
    }
    if (s.includes("progress") || s.includes("jalan")) {
      return yellowIcon;
    }
    return DefaultIcon;
  };

  // Center in Indonesia by default
  const defaultCenter: L.LatLngTuple = [-2.548926, 118.0148634];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {validSites.map((site) => {
        const markerIcon = getMarkerIcon(site.status_project, site.blocking);
        return (
          <Marker
            key={site.id}
            position={[site.lat as number, site.lng as number]}
            icon={markerIcon}
          >
            <Popup>
              <div className="space-y-2 p-1 text-xs">
                <div className="border-b pb-1">
                  <h4 className="font-bold text-sm text-primary">{site.site_name}</h4>
                  <p className="text-[10px] text-muted-foreground font-mono">{site.pdid} | {site.caid}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Provinsi</span>
                    <span className="font-medium">{site.province || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Kota/Kab</span>
                    <span className="font-medium">{site.city || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Mitra</span>
                    <span className="font-medium">{site.mitra_impl || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Status Project</span>
                    <div className="mt-0.5">
                      {site.status_project ? (
                        <Badge className="text-[9px] py-0 px-1" variant={site.status_project.toLowerCase().includes("complet") ? "success" : site.blocking ? "destructive" : "secondary"}>
                          {site.status_project}
                        </Badge>
                      ) : "-"}
                    </div>
                  </div>
                </div>
                {site.blocking ? (
                  <div className="border border-red-100 bg-red-50/20 p-1.5 rounded mt-1 text-red-600">
                    <p className="font-bold text-[9px] uppercase tracking-wide">Kendala Aktif:</p>
                    <p className="text-[10px]">{site.issue_category}: {site.support_needed || "Butuh eskalasi"}</p>
                  </div>
                ) : null}
              </div>
            </Popup>
          </Marker>
        );
      })}
      <ChangeMapView projects={validSites} />
    </MapContainer>
  );
}
