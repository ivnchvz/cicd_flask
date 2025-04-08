"use client";

import dynamic from "next/dynamic";
import { io } from "socket.io-client";
import { useEffect, useState } from "react";

interface GlobeProps {
  issLatitude: number;
  issLongitude: number;
  globeConfig?: {
    autoRotate?: boolean;
    autoRotateSpeed?: number;
    globeColor?: string;
    emissive?: string;
    emissiveIntensity?: number;
    shininess?: number;
  };
}

const Globe = dynamic<GlobeProps>(
  () => import("../components/ui/globe").then((mod) => mod.Globe),
  { ssr: false }
);

// Dynamically determine the backend URL based on the current host
const backendUrl = `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:5000`;
const socket = io(backendUrl, {
  transports: ["websocket", "polling"],
  path: "/socket.io",
});

interface IssUpdateData {
  latitude: number;
  longitude: number;
  country_code?: string;
  error?: string;
}

export default function Home() {
  const [issPosition, setIssPosition] = useState<{
    latitude: number;
    longitude: number;
    countryCode?: string;
  }>({
    latitude: 0,
    longitude: 0,
    countryCode: "N/A",
  });

  useEffect(() => {
    socket.on("connect", () => {
      console.log(`Connected to backend at ${backendUrl}`);
    });

    socket.on("iss_update", (data: IssUpdateData) => {
      console.log("Received ISS update:", data);
      if (data && !data.error) {
        setIssPosition({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          countryCode: data.country_code || "N/A",
        });
      } else if (data.error) {
        console.error("Backend error:", data.error);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("Connection error:", err.message);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from backend");
    });

    return () => {
      socket.off("connect");
      socket.off("iss_update");
      socket.off("connect_error");
      socket.off("disconnect");
    };
  }, []);

  const globeConfig = {
    autoRotate: true,
    autoRotateSpeed: 1,
    globeColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0.1,
    shininess: 0.9,
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen"
      style={{ backgroundColor: "#D3D3D3" }}
    >
      <h1 className="text-3xl space-mono-bold mb-4 text-black">Real-Time ISS Tracker</h1>
      <div className="w-[600px] h-[600px]">
        <Globe
          issLatitude={issPosition.latitude}
          issLongitude={issPosition.longitude}
          globeConfig={globeConfig}
        />
      </div>
      <div className="mt-4 text-center">
        <h2 className="text-xl space-mono-bold text-black">Current ISS Coordinates</h2>
        <p className="text-lg space-mono-regular">
          Latitude: <span className="space-mono-regular">{issPosition.latitude.toFixed(6)}</span>
        </p>
        <p className="text-lg space-mono-regular">
          Longitude: <span className="space-mono-regular">{issPosition.longitude.toFixed(6)}</span>
        </p>
        <p className="text-lg space-mono-regular">
          Country Code: <span className="space-mono-regular">{issPosition.countryCode}</span>
        </p>
      </div>
    </div>
  );
}