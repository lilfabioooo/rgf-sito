"""Renderizza alcune viste del camion. Uso:
   blender -b rgf-truck.blend --python render_truck.py -- <cartella_out>
"""
import bpy
import sys
import math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = argv[0] if argv else "//render"

scene = bpy.context.scene
cam = scene.camera

if hasattr(scene, "eevee"):
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
scene.render.image_settings.file_format = 'PNG'


def aim(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


# il mezzo occupa X -5.8..5.05 (10.85 m): con lente 50 su sensore 36 mm
# servono circa 20 m di distanza perche' ci stia tutto in larghezza
VISTE = [
    ("01-tre-quarti", (16.0, 15.0, 7.0), (-0.4, 0, 1.90), 50, 1500, 850),
    ("02-frontale",   (14.0, 6.5, 3.6),  (3.2, 0, 2.00),  55, 1300, 900),
    ("03-coda",       (-14.0, 9.0, 5.0), (-4.3, 0, 1.80), 55, 1300, 850),
    ("04-fianco",     (-0.4, 26.0, 2.4), (-0.4, 0, 2.00), 50, 1600, 600),
]

for nome, pos, target, lens, rx, ry in VISTE:
    cam.location = pos
    cam.data.lens = lens
    aim(cam, target)
    scene.render.resolution_x = rx
    scene.render.resolution_y = ry
    scene.render.filepath = f"{out}/{nome}.png"
    bpy.ops.render.render(write_still=True)
    print(f"SCRITTO {scene.render.filepath}")
