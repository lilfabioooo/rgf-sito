"""Esporta il solo mezzo (senza set, luci e camera) in glTF binario.

Prima di esportare congela i modificatori e unisce le mesh per materiale.
Con 230 oggetti separati il GLB pesava 1,9 MB, in buona parte intestazioni e
accessor ripetuti, e in three.js sarebbero diventate altrettante draw call;
unendo per materiale ne restano una manciata.

   blender -b rgf-truck.blend --python export_glb.py -- <file.glb>
"""
import bpy
import sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = argv[0]

COLLEZIONI = ("Motrice", "Semirimorchio", "Ruote")

# 1. raccogli gli oggetti del mezzo e congela i modificatori.
#    Vanno applicati prima della fusione: join() tiene solo i modificatori
#    dell'oggetto attivo e scarterebbe Bevel, Mirror e Solidify di tutti
#    gli altri.
mezzo = []
for nome in COLLEZIONI:
    mezzo.extend(o for o in bpy.data.collections[nome].objects if o.type == 'MESH')

bpy.ops.object.select_all(action='DESELECT')
for ob in mezzo:
    if ob.modifiers:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.convert(target='MESH')
        ob.select_set(False)

# 2. unisci per materiale
per_materiale = {}
for ob in mezzo:
    chiave = ob.data.materials[0].name if ob.data.materials else "_nessuno"
    per_materiale.setdefault(chiave, []).append(ob)

uniti = []
for chiave, gruppo in per_materiale.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in gruppo:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = gruppo[0]
    if len(gruppo) > 1:
        bpy.ops.object.join()
    unito = bpy.context.view_layer.objects.active
    unito.name = "RGF_" + chiave.replace(" ", "_")
    uniti.append(unito)

bpy.ops.object.select_all(action='DESELECT')
for ob in uniti:
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,            # Z-up di Blender -> Y-up di glTF/three.js
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False,
    export_normals=True,
    export_tangents=False,
    export_animations=False,
    export_extras=False,
)
facce = sum(len(o.data.polygons) for o in uniti)
print(f"ESPORTATE {len(uniti)} mesh ({facce} facce) da {len(mezzo)} oggetti in {out}")
