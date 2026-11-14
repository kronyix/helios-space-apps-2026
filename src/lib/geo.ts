import { Vector3 } from 'three';

/**
 * Converts planetocentric latitude / east longitude to a point on a sphere
 * whose equirectangular texture has 0° longitude at the image center
 * (three.js SphereGeometry default UV mapping).
 */
export function latLngToVector3(lat: number, lngEast: number, radius: number, out = new Vector3()) {
  const lng = ((lngEast + 180) % 360) - 180; // normalize to [-180, 180)
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  out.set(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
  return out;
}

/** Y rotation that brings a given east longitude to face the +Z camera. */
export function yawToFace(lngEast: number) {
  const lng = ((lngEast + 180) % 360) - 180;
  return -((lng + 90) * Math.PI) / 180;
}
