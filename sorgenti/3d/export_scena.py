"""Asset per il sito Next.js dalla scena completa.

   blender -b rgf-truck-scena.blend --python export_scena.py -- <dir_out>

Camion e strada escono in due GLB separati: nel sito il mezzo esce di scena
allo scroll mentre la strada resta ferma, quindi non possono stare nello
stesso gruppo.
"""

import bpy
import sys
from mathutils import Vector

out_dir = sys.argv[sys.argv.index("--") + 1:][0]


def esporta(collezioni, filepath):
    bpy.ops.object.select_all(action='DESELECT')
    n = 0
    for nome in collezioni:
        c = bpy.data.collections.get(nome)
        if not c:
            continue
        for ob in c.objects:
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            n += 1
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=12,
        export_draco_normal_quantization=9,
    )
    print(f"GLB {filepath} ({n} oggetti)")


esporta(("Motrice", "Semirimorchio", "Ruote", "Marchio"), f"{out_dir}/camion.glb")
esporta(("Strada",), f"{out_dir}/strada.glb")


# ---- poster per il ripiego mobile: mezzo sulla strada, fondo trasparente ----
scene = bpy.context.scene
cam = scene.camera
cam.data.lens = 50
cam.location = (16.0, 15.0, 7.0)
d = Vector((-0.4, 0, 1.9)) - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

for ob in bpy.data.collections["Set"].objects:
    if ob.type == 'MESH':
        ob.hide_render = True   # il piazzale coprirebbe la strada

scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.film_transparent = True
scene.render.filepath = f"{out_dir}/camion-poster"
try:
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 88
except TypeError:
    scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
bpy.ops.render.render(write_still=True)
print(f"POSTER {scene.render.filepath}")
