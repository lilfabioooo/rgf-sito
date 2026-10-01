"""Tre inquadrature dello spot RGF dal modello procedurale del mezzo.
   blender -b rgf-truck.blend --python spot.py -- <cartella_out> <env.jpg>"""
import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
out, envpath = argv[0], argv[1]
sc = bpy.context.scene
for ob in []:
    print("OB", ob.name, ob.type, tuple(round(v, 2) for v in ob.dimensions), tuple(round(v, 2) for v in ob.location))
# cielo del tramonto
w = bpy.data.worlds.new("Spot"); sc.world = w; w.use_nodes = True
n = w.node_tree; bg = n.nodes["Background"]
env = n.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(envpath)
n.links.new(env.outputs["Color"], bg.inputs["Color"]); bg.inputs["Strength"].default_value = 1.0
# strada
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
strada = bpy.context.object; strada.scale = (400, 14, 1)
m = bpy.data.materials.new("Asfalto"); m.use_nodes = True
p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = (0.05, 0.05, 0.055, 1); p.inputs["Roughness"].default_value = 0.55
strada.data.materials.append(m)
for y in (-3.6, 3.6):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, y, 0.01)); l = bpy.context.object; l.scale = (400, 0.15, 1)
    ml = bpy.data.materials.new("Linea"); ml.use_nodes = True; ml.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.8, 0.8, 0.75, 1); l.data.materials.append(ml)
# campagna ai lati
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -0.02)); c = bpy.context.object; c.scale = (800, 800, 1)
mc = bpy.data.materials.new("Campo"); mc.use_nodes = True; mc.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.06, 0.07, 0.04, 1); c.data.materials.append(mc)
# sole basso
bpy.ops.object.light_add(type='SUN', location=(0, 0, 10)); sole = bpy.context.object
sole.data.energy = 3.0; sole.data.color = (1.0, 0.62, 0.35); sole.rotation_euler = (math.radians(82), 0, math.radians(-120))
sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
try: sc.eevee.taa_render_samples = 64
except Exception: pass
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.render.image_settings.file_format = 'JPEG'
sc.view_settings.view_transform = 'AgX'
cam = sc.camera
def aim(o, t): o.rotation_euler = (Vector(t) - o.location).to_track_quat('-Z', 'Y').to_euler()
INQ = {
  "A-basso": ((11.5, -5.5, 0.7), (1.0, 0, 2.1), 24),
  "B-fianco": ((0, -16, 2.2), (0, 0, 1.8), 40),
  "C-via": ((-22, 7, 3.0), (-2, 0, 1.6), 45),
}
for nome, (loc, tgt, lens) in [(k,v) for k,v in INQ.items() if k.startswith("A")]:
    cam.location = loc; aim(cam, tgt); cam.data.lens = lens
    sc.render.filepath = f"{out}/{nome}.jpg"
    bpy.ops.render.render(write_still=True)
    print("SCRITTA", nome)
