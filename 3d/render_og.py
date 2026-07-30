"""Renderizza il mezzo su fondo trasparente per l'immagine social (og.jpg).

Il testo non si compone qui: la lastra esce con canale alfa e viene montata
nel browser su canvas, dove ci sono i font veri del sito (Sora, Inter).

Illuminazione presa da assets/env-dusk.jpg, la stessa mappa che usa la scena
Three.js: cosi' l'immagine condivisa e l'hero del sito sono coerenti.

   blender -b rgf-truck.blend --python render_og.py -- <out.png>
"""
import bpy
import sys
import math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = argv[0]

scene = bpy.context.scene

# --- mondo: la mappa d'ambiente cotta, non piu' il cielo procedurale ---
mondo = bpy.data.worlds.new("OG")
scene.world = mondo
mondo.use_nodes = True
nodi = mondo.node_tree
bg = nodi.nodes["Background"]
env = nodi.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(r"C:/Users/fabio/sito-rgf/assets/env-dusk.jpg")
mapping = nodi.nodes.new("ShaderNodeMapping")
coord = nodi.nodes.new("ShaderNodeTexCoord")
nodi.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
nodi.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
nodi.links.new(env.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.95

# --- il piazzale diventa cattura-ombre: sotto il mezzo resta solo l'ombra ---
for nome in ("Piazzale",):
    ob = bpy.data.objects.get(nome)
    if ob:
        ob.is_shadow_catcher = True

# le luci di studio restano: danno il modellato che il solo ambiente non da'
for nome in ("Cielo",):
    ob = bpy.data.objects.get(nome)
    if ob:
        ob.data.energy *= 0.7


def aim(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


cam = scene.camera
cam.data.lens = 70
# 30 m di distanza: a 13 m il mezzo usciva dall'inquadratura su tre lati
cam.location = (20.5, 19.5, 6.6)
aim(cam, (-0.5, 0, 1.95))
# il mezzo va spinto nella meta' destra: a sinistra ci va il testo
cam.data.shift_x = -0.17

scene.render.engine = 'CYCLES'
scene.cycles.samples = 200
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 840
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = -0.55
scene.render.filepath = out

bpy.ops.render.render(write_still=True)
print(f"LASTRA OG SCRITTA {scene.render.filepath}")
