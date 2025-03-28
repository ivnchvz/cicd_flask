"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ThreeGlobe from "three-globe";
import * as THREE from "three";
import { FeatureCollection } from "geojson";

export interface GlobeProps {
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

// Define the custom type for globeRef
interface CustomGlobe extends THREE.Object3D {
  getGlobeRadius: () => number;
  issMarker?: THREE.Mesh;
}

const GlobeScene: React.FC<GlobeProps> = ({ issLatitude, issLongitude, globeConfig }) => {
  const globeRef = useRef<CustomGlobe>(null); // Use the custom type for the globe reference
  const groupRef = useRef<THREE.Group | null>(null); // Ref for the group
  const [countries, setCountries] = useState<FeatureCollection | null>(null); // Use FeatureCollection for GeoJSON data

  // Fine-tuning offsets for ISS marker
  const latitudeOffset = 0.1; // Adjust this value as needed
  const longitudeOffset = -90; // Adjusted to -90 as requested

  // Fetch the countries data dynamically
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch("/data/globe.json");
        if (!response.ok) {
          throw new Error(`Failed to fetch globe.json: ${response.statusText}`);
        }
        const data: FeatureCollection = await response.json();
        setCountries(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchCountries();
  }, []);

  // Initialize the globe once
  useEffect(() => {
    if (typeof window === "undefined") return; // Ensure this runs only on the client

    if (groupRef.current && !globeRef.current && countries) {
      const globe = new ThreeGlobe()
        .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-dark.jpg")
        .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
        .hexPolygonsData(countries.features)
        .hexPolygonResolution(3)
        .hexPolygonMargin(0.7);

      globeRef.current = globe as CustomGlobe; // Assign the globe instance to the ref

      // Add the globe to the group only if groupRef.current is not null
      if (groupRef.current) {
        groupRef.current.add(globe);
      }

      // Set the globe material properties
      const globeMaterial = globe.globeMaterial() as unknown as {
        color: THREE.Color;
        emissive: THREE.Color;
        emissiveIntensity: number;
        shininess: number;
      };

      if (globeConfig) {
        if (globeConfig.globeColor) globeMaterial.color = new THREE.Color(globeConfig.globeColor);
        if (globeConfig.emissive) globeMaterial.emissive = new THREE.Color(globeConfig.emissive);
        if (globeConfig.emissiveIntensity !== undefined)
          globeMaterial.emissiveIntensity = globeConfig.emissiveIntensity;
        if (globeConfig.shininess !== undefined) globeMaterial.shininess = globeConfig.shininess;
      }
    }
  }, [countries, globeConfig]);

  // Update the ISS marker when the coordinates change
  useEffect(() => {
    if (typeof window === "undefined") return; // Ensure this runs only on the client
    if (!globeRef.current || !groupRef.current) return;

    const radius = globeRef.current.getGlobeRadius() || 100;

    // Apply fine-tuning offsets
    const adjustedLatitude = issLatitude + latitudeOffset;
    const adjustedLongitude = issLongitude + longitudeOffset;

    // Convert adjusted latitude and longitude to 3D coordinates
    const phi = (90 - adjustedLatitude) * (Math.PI / 180); // Latitude to polar angle
    const theta = (adjustedLongitude + 180) * (Math.PI / 180); // Longitude to azimuthal angle

    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    // Create or update marker
    if (!globeRef.current.issMarker) {
      const markerGeometry = new THREE.SphereGeometry(2, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      globeRef.current.issMarker = new THREE.Mesh(markerGeometry, markerMaterial);

      // Add the marker to the group only if groupRef.current is not null
      if (groupRef.current) {
        groupRef.current.add(globeRef.current.issMarker);
      }
    }
    globeRef.current.issMarker.position.set(x, y, z);

    // Debugging logs for fine-tuning
    console.log("Adjusted Coordinates:", { adjustedLatitude, adjustedLongitude });
    console.log("3D Coordinates:", { x, y, z });
  }, [issLatitude, issLongitude, latitudeOffset, longitudeOffset]); // Added latitudeOffset and longitudeOffset

  // Example of using countries
  useEffect(() => {
    if (countries) {
      console.log("Countries FeatureCollection:", countries);
      // Use countries.features here if needed
    }
  }, [countries]);

  return <group ref={groupRef} />;
};

export const Globe: React.FC<GlobeProps> = ({ issLatitude, issLongitude, globeConfig }) => {
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true only after mounting on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh" }}>
      {isClient && (
        <Canvas camera={{ position: [0, 0, 600], fov: 50 }}>
          <ambientLight color={"#D3D3D3"} intensity={0.8} />
          <directionalLight color={"#D3D3D3"} position={[-400, 100, 400]} intensity={3.0} />
          <OrbitControls
            enableZoom={true}
            minDistance={500}
            maxDistance={800}
            autoRotate={globeConfig?.autoRotate ?? true}
            autoRotateSpeed={globeConfig?.autoRotateSpeed ?? 1}
          />
          <GlobeScene issLatitude={issLatitude} issLongitude={issLongitude} globeConfig={globeConfig} />
        </Canvas>
      )}
    </div>
  );
};
