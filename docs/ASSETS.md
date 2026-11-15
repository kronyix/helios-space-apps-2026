# 3D & Media Assets Log

## 1. Mars Exploration Rover (`public/models/opportunity.glb`)

- **Subject**: Mars Exploration Rover (MER-A *Spirit* / MER-B *Opportunity*)
- **Source**: NASA 3D Resources (`https://nasa3d.arc.nasa.gov/detail/mer-opportunity` and `https://nasa3d.arc.nasa.gov/detail/spirit`)
- **Credit**: Courtesy NASA/JPL-Caltech
- **Date Verified**: 2026-11-15
- **License**: NASA Media Usage Guidelines (public domain government work; NASA insignia/logotype is not used as application branding).
- **Technical Summary**:
  - **File size**: 36,668 bytes (`35.8 KB`, Draco-compressed `.glb`)
  - **Geometry**: 1 merged mesh node (`Mesh` / `polySurface17`), 9 material primitives, `3,845` triangles (`<= 3 MB` budget)
  - **Materials**: 9 untextured PBR materials (`SolarArrays`, `Gold`, `Gold2`, `Copper`, `White`, `LightGrayMetal`, `Gray`, `lambert1`, `Black`), upgraded at runtime in `RoverDriveScene.tsx` with `RoomEnvironment` PMREM reflections and dynamic Martian dust accumulation (`game.rover.dust`).
  - **Embedded Textures**: `0` (no NASA logo/insignia textures present).
  - **Rigging / Node Structure Note**: Wheels, rocker-bogie suspension, and Pancam mast are merged into the single `polySurface17` mesh in the source lower-poly NASA model; chassis pitch/roll/height and bob are driven from `contactPoints` + `heightAt` samples, and wheel tracks/dust puffs are rendered beneath the wheel contact points.
