import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { getBounds } from '@gltf-transform/core';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const b = getBounds(scene);
  let tris = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const idx = p.getIndices(); tris += (idx ? idx.getCount() : p.getAttribute('POSITION')!.getCount()) / 3; }
  console.log(`\n== ${f}\n bounds min ${b.min.map(v=>v.toFixed(3))} max ${b.max.map(v=>v.toFixed(3))}\n meshes ${root.listMeshes().length} tris ${tris} materials ${root.listMaterials().length} textures ${root.listTextures().length}`);
  console.log(' textures:', root.listTextures().map(t=>`${t.getName()||t.getURI()} ${t.getMimeType()} ${t.getSize()?.join('x')}`).join(' | '));
  console.log(' materials:', root.listMaterials().map(m=>m.getName()).join(', '));
  const walk = (n: any, d: number) => { if (d < 4) console.log(' '.repeat(d*2+1) + n.getName() + (n.getMesh() ? ' [mesh]' : '') + ' t=' + n.getTranslation().map((v:number)=>v.toFixed(2))); n.listChildren().forEach((c: any) => walk(c, d+1)); };
  scene.listChildren().forEach(n => walk(n, 0));
}
