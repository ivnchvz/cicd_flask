"use client";

import React, { useEffect, useState } from "react";
import { Globe } from "@/components/ui/globe";
import io from "socket.io-client";

const socket = io("http://127.0.0.1:5000"); // Replace with your Flask backend URL

export default function Home() {
  const [issPosition, setIssPosition] = useState<{ latitude: number; longitude: number }>({
    latitude: 0,
    longitude: 0,
  });

  useEffect(() => {
    socket.on("iss_update", (data: any) => {
      if (data && !data.error) {
        setIssPosition({ latitude: data.latitude, longitude: data.longitude });
      }
    });

    return () => {
      socket.off("iss_update");
    };
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen"
      style={{ backgroundColor: "#D3D3D3" }} // Set the background color
    >
      <h1 className="text-3xl space-mono-bold mb-4 text-black">Real-Time ISS Tracker</h1>
      <div className="w-[600px] h-[600px]">
        <Globe
          issLatitude={issPosition.latitude}
          issLongitude={issPosition.longitude}
          globeConfig={{ autoRotate: true, autoRotateSpeed: 1 }}
        />
      </div>
      {/* Display the coordinates */}
      <div className="mt-4 text-center">
        <h2 className="text-xl space-mono-bold text-black">Current ISS Coordinates</h2>
        <p className="text-lg space-mono-regular">
          Latitude: <span className="space-mono-regular">{issPosition.latitude.toFixed(6)}</span>
        </p>
        <p className="text-lg space-mono-regular">
          Longitude: <span className="space-mono-regular">{issPosition.longitude.toFixed(6)}</span>
        </p>
      </div>
    </div>
  );
}
