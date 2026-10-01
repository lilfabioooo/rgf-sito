"""
Cuoce una mappa d'ambiente equirettangolare del piazzale RGF al crepuscolo.

Serve a dare al cromo della cisterna qualcosa di vero da riflettere: un
gradiente disegnato su canvas non ha ne' orizzonte strutturato ne' sorgenti
puntiformi, ed e' il motivo per cui il metallo legge come plastica. Qui ci
sono capannoni all'orizzonte e lampioni al sodio, che sono esattamente i
riflessi che l'occhio si aspetta su una cisterna inox.

   blender -b --factory-startup --python bake_env.py -- <out.jpg>
"""

import bpy
import math
import sys
import random

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = argv[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
random.seed(7)


def mat(nome, base, rough=0.8, metallic=0.0, emit=None, emit_str=0.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    if emit is not None:
        for k in ("Emission Color", "Emission"):
            if k in b.inputs:
                b.inputs[k].default_value = (*emit, 1.0)
                break
        if "Emission Strength" in b.inputs:
            b.inputs["Emission Strength"].default_value = emit_str
    return m


# Albedo alzati: misurando la banda d'orizzonte per azimut, il lato opposto
# al sole scendeva a L=0.20 e la fiancata della cisterna che guarda la camera
# ci finiva dentro (rgb 36,33,30, con la scritta illeggibile). Un piazzale al
# crepuscolo ha comunque luce ambientale: il nero pieno era irrealistico.
M_ASFALTO = mat("Asfalto", (0.038, 0.042, 0.047), rough=0.62)
M_CAPANNONE = mat("Capannone", (0.090, 0.098, 0.108), rough=0.85)
M_LAMPADA = mat("Lampada sodio", (1.0, 0.72, 0.36), emit=(1.0, 0.66, 0.30), emit_str=90.0)
M_PALO = mat("Palo", (0.035, 0.037, 0.040), rough=0.7)


def add(prim, nome, materiale, **kw):
    prim(**kw)
    ob = bpy.context.object
    ob.name = nome
    ob.data.materials.append(materiale)
    return ob


# piazzale
add(bpy.ops.mesh.primitive_plane_add, "Piazzale", M_ASFALTO, size=800, location=(0, 0, 0))

# skyline industriale: e' cio' che struttura la fascia d'orizzonte nel riflesso
for i in range(34):
    a = 2 * math.pi * i / 34 + random.uniform(-0.05, 0.05)
    d = random.uniform(55, 130)
    h = random.uniform(6, 16)
    w = random.uniform(14, 34)
    add(bpy.ops.mesh.primitive_cube_add, f"Capannone {i}", M_CAPANNONE,
        size=1, location=(math.cos(a) * d, math.sin(a) * d, h / 2))
    ob = bpy.context.object
    ob.scale = (w, random.uniform(10, 26), h)

# lampioni: i riflessi caldi puntiformi sull'inox
for i in range(9):
    a = 2 * math.pi * i / 9 + 0.3
    d = random.uniform(16, 30)
    x, y = math.cos(a) * d, math.sin(a) * d
    alt = random.uniform(8, 11)
    add(bpy.ops.mesh.primitive_cylinder_add, f"Palo {i}", M_PALO,
        vertices=10, radius=0.13, depth=alt, location=(x, y, alt / 2))
    add(bpy.ops.mesh.primitive_uv_sphere_add, f"Lampada {i}", M_LAMPADA,
        segments=14, ring_count=8, radius=0.36, location=(x, y, alt))

# cielo fisico al crepuscolo
mondo = bpy.data.worlds.new("Crepuscolo")
scene.world = mondo
mondo.use_nodes = True
nodi = mondo.node_tree
bg = nodi.nodes["Background"]
bg.inputs["Strength"].default_value = 1.0
cielo = nodi.nodes.new("ShaderNodeTexSky")
# in Blender 5.x il Nishita e' diventato MULTIPLE_SCATTERING
for tipo in ('MULTIPLE_SCATTERING', 'NISHITA', 'SINGLE_SCATTERING', 'HOSEK_WILKIE'):
    try:
        cielo.sky_type = tipo
        break
    except TypeError:
        continue
cielo.sun_elevation = math.radians(1.6)
cielo.sun_rotation = math.radians(205)
# Foschia alta: a densita' pulita il cielo a 3 gradi resta comunque azzurro
# diurno, e il mezzo finirebbe per riflettere solo freddo. Sono polvere e
# aerosol a produrre la fascia ambrata all'orizzonte del crepuscolo.
for attr, val in (
    ("sun_intensity", 0.30),   # basso: in JPEG il disco solare clippa comunque
    ("turbidity", 9.0),
    ("dust_density", 5.0),
    ("air_density", 1.5),
    ("ozone_density", 2.0),
    ("altitude", 120),
):
    if hasattr(cielo, attr):
        setattr(cielo, attr, val)
nodi.links.new(cielo.outputs["Color"], bg.inputs["Color"])

# camera panoramica equirettangolare, all'altezza della cisterna
cam_d = bpy.data.cameras.new("EnvCam")
cam_d.type = 'PANO'
for owner, attr in ((cam_d, "panorama_type"), (getattr(cam_d, "cycles", None), "panorama_type")):
    if owner is not None and hasattr(owner, attr):
        try:
            setattr(owner, attr, 'EQUIRECTANGULAR')
            break
        except Exception:
            pass
cam = bpy.data.objects.new("EnvCam", cam_d)
cam.location = (0, 0, 3.0)
cam.rotation_euler = (math.radians(90), 0, 0)   # equirect guarda l'orizzonte
scene.collection.objects.link(cam)
scene.camera = cam

scene.render.engine = 'CYCLES'
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.render.resolution_x = 2048
scene.render.resolution_y = 1024
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 88
scene.render.filepath = out
# Standard, non AgX: la mappa deve restare dati per il PMREM di three.js,
# non un'immagine gia' interpretata per l'occhio
scene.view_settings.view_transform = 'Standard'
scene.view_settings.exposure = 0.35

bpy.ops.render.render(write_still=True)
print(f"AMBIENTE SCRITTO {scene.render.filepath}")
