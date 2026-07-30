"""
Aggiunge al modello la strada e il marchio RGF ambiente.

   blender -b rgf-truck.blend --python add_strada_logo.py -- <out.blend>

Convenzioni ereditate da build_truck.py: X = lunghezza (muso a +X),
Y = larghezza, Z = altezza, suolo a Z=0, ruota di raggio 0.54.
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
out_blend = argv[0]
QUI = os.path.dirname(os.path.abspath(__file__))

scene = bpy.context.scene


def coll(nome):
    c = bpy.data.collections.get(nome)
    if c is None:
        c = bpy.data.collections.new(nome)
        scene.collection.children.link(c)
    return c


def mat(nome, base, rough=0.6, metallic=0.0, emit=None, emit_str=0.0):
    m = bpy.data.materials.get(nome)
    if m:
        return m
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


def piano(nome, sx, sy, x, y, z, materiale, collezione):
    me = bpy.data.meshes.new(nome)
    bm = bmesh.new()
    v = [
        bm.verts.new((-sx / 2, -sy / 2, 0)),
        bm.verts.new((sx / 2, -sy / 2, 0)),
        bm.verts.new((sx / 2, sy / 2, 0)),
        bm.verts.new((-sx / 2, sy / 2, 0)),
    ]
    bm.faces.new(v)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nome, me)
    ob.location = (x, y, z)
    ob.data.materials.append(materiale)
    collezione.objects.link(ob)
    return ob


# ============================================================
# STRADA
# ============================================================
C_STRADA = coll("Strada")

M_ASFALTO = mat("Asfalto strada", (0.021, 0.024, 0.027), rough=0.52)
# La segnaletica è vernice sporca, non bianco puro: a 0.9 di albedo con il
# bloom acceso le strisce bruciano e sembrano al neon.
M_SEGNI = mat("Segnaletica", (0.34, 0.335, 0.32), rough=0.72)

LUNG = 260.0        # abbastanza da sparire nella nebbia invece che finire
LARG = 10.0         # due corsie da 5 m, mezzo centrato

# Terreno intorno: senza, il bordo esterno dell'asfalto tagliava una riga
# netta su tutta la larghezza dell'inquadratura. Sta sotto di un millimetro
# per non litigare con l'asfalto sullo z-buffer.
M_TERRENO = mat("Terreno", (0.012, 0.014, 0.016), rough=0.88)
piano("Terreno", 520, 520, 0, 0, 0.001, M_TERRENO, C_STRADA)

piano("Asfalto", LUNG, LARG, 0, 0, 0.004, M_ASFALTO, C_STRADA)

# Righe di margine: simmetriche, così la lettura regge da entrambi i lati
for segno in (1, -1):
    piano(f"Margine {segno}", LUNG, 0.16, 0, segno * (LARG / 2 - 0.42), 0.006,
          M_SEGNI, C_STRADA)

# Righe di mezzeria tratteggiate. Un solo oggetto con tutti i tratti: 40
# oggetti separati sarebbero 40 draw call per due righe bianche.
def tratteggio(nome, y, lung_tratto=3.0, vuoto=6.0):
    me = bpy.data.meshes.new(nome)
    bm = bmesh.new()
    x = -LUNG / 2
    while x < LUNG / 2:
        x1 = min(x + lung_tratto, LUNG / 2)
        v = [
            bm.verts.new((x, y - 0.08, 0)),
            bm.verts.new((x1, y - 0.08, 0)),
            bm.verts.new((x1, y + 0.08, 0)),
            bm.verts.new((x, y + 0.08, 0)),
        ]
        bm.faces.new(v)
        x = x1 + vuoto
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nome, me)
    ob.location = (0, 0, 0.006)
    ob.data.materials.append(M_SEGNI)
    C_STRADA.objects.link(ob)
    return ob


for segno in (1, -1):
    tratteggio(f"Mezzeria {segno}", segno * 2.5)


# ============================================================
# MARCHIO RGF AMBIENTE
# ============================================================
C_LOGO = coll("Marchio")

# Anello scuro e foglia verde, come il marchio del sito. In chiaro su chiaro
# — anello bianco su lamiera bianca, foglia verde tenue su inox — il marchio
# spariva: su un mezzo la livrea deve reggere il contrasto a distanza.
M_LOGO_VERDE = mat("Marchio verde", (0.048, 0.55, 0.29), rough=0.38)
M_LOGO_SCURO = mat("Marchio scuro", (0.026, 0.032, 0.038), rough=0.44)


def anello(nome, r_est, spessore, seg=64):
    """Corona piatta: l'importatore SVG di Blender non porta i contorni."""
    me = bpy.data.meshes.new(nome)
    bm = bmesh.new()
    r_int = r_est - spessore
    est, inte = [], []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        est.append(bm.verts.new((math.cos(a) * r_est, math.sin(a) * r_est, 0)))
        inte.append(bm.verts.new((math.cos(a) * r_int, math.sin(a) * r_int, 0)))
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((inte[i], est[i], est[j], inte[j]))
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    return bpy.data.objects.new(nome, me)


def foglia(nome):
    """Importa il path della foglia dall'SVG del sito e lo rende mesh."""
    prima = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=os.path.join(QUI, "logo-rgf.svg"))
    nuovi = [o for o in bpy.data.objects if o not in prima]
    if not nuovi:
        return None

    bpy.ops.object.select_all(action='DESELECT')
    for o in nuovi:
        o.select_set(True)
    bpy.context.view_layer.objects.active = nuovi[0]
    bpy.ops.object.convert(target='MESH')
    if len(nuovi) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = nome

    # L'SVG entra in metri-da-CSS: si normalizza a lato 1 e si centra.
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    d = max(ob.dimensions.x, ob.dimensions.y) or 1.0
    ob.scale = (1 / d, 1 / d, 1 / d)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return ob


def marchio(nome, x, y, z, dim, faccia_y=1):
    """Anello + foglia, montati piatti sul fianco che guarda +Y (o -Y)."""
    g_anello = anello(f"{nome} anello", 0.5, 0.085)
    g_anello.data.materials.append(M_LOGO_SCURO)
    C_LOGO.objects.link(g_anello)

    g_foglia = foglia(f"{nome} foglia")
    if g_foglia is None:
        return []
    for c in list(g_foglia.users_collection):
        c.objects.unlink(g_foglia)
    C_LOGO.objects.link(g_foglia)
    g_foglia.data.materials.clear()
    g_foglia.data.materials.append(M_LOGO_VERDE)
    g_foglia.scale = (0.62, 0.62, 0.62)

    pezzi = [g_anello, g_foglia]
    for p in pezzi:
        # il disegno sta nel piano XY: lo si ribalta sul fianco del mezzo
        p.rotation_euler = (math.pi / 2, 0, math.pi if faccia_y > 0 else 0)
        p.location = (x, y, z)
        base = p.scale.x
        p.scale = (base * dim, base * dim, base * dim)
        # spessore minimo, altrimenti a filo sparisce contro la lamiera
        s = p.modifiers.new("Solidify", 'SOLIDIFY')
        s.thickness = 0.012
        s.offset = 1
    return pezzi


# Solo sulla porta della cabina.
# Sul mantello serviva uno Shrinkwrap per seguire la curvatura, ma l'anello ha
# vertici solo lungo la circonferenza: senza suddivisione radiale le facce
# piatte tagliavano il cilindro e la corona usciva spezzata. La porta è piana
# e pulita, ed è dove il marchio sta sui mezzi veri. La cisterna porta già la
# scritta "RGF ambiente", quindi il mezzo resta comunque marchiato su entrambi
# i volumi.
marchio("Marchio porta", 3.92, 1.252, 1.94, 0.84, faccia_y=1)

bpy.ops.wm.save_as_mainfile(filepath=out_blend)

n = len([o for o in bpy.data.objects if o.type == 'MESH'])
print(f"RISULTATO oggetti_mesh={n} strada={len(C_STRADA.objects)} marchio={len(C_LOGO.objects)}")
