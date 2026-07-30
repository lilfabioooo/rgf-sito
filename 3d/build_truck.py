"""
RGF — autoarticolato Mercedes-Benz Actros con cisterna.
Costruzione parametrica in Blender.

Assi (Blender, Z-up):  X = lunghezza (muso a +X), Y = larghezza, Z = altezza.
Suolo a Z=0, ruota di riferimento raggio 0.54 con mozzo a Z=0.54.

Le parti simmetriche si modellano solo sul lato +Y e ricevono un modificatore
Mirror rispetto all'empty "MirrorPivot": una sola fonte di verita' per la
geometria di entrambe le fiancate.
"""

import bpy
import bmesh
import math
from mathutils import Vector

R90 = math.radians(90)


# ----------------------------------------------------------------------------
# scena pulita
# ----------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

colls = {}
for nome in ("Motrice", "Semirimorchio", "Ruote", "Set"):
    c = bpy.data.collections.new(nome)
    scene.collection.children.link(c)
    colls[nome] = c

pivot = bpy.data.objects.new("MirrorPivot", None)
scene.collection.objects.link(pivot)


# ----------------------------------------------------------------------------
# materiali
# ----------------------------------------------------------------------------
def mat(nome, base, metallic, rough, coat=0.0, emit=None, emit_str=0.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    for chiave in ("Coat Weight", "Clearcoat", "Coat"):
        if chiave in b.inputs:
            b.inputs[chiave].default_value = coat
            break
    if emit is not None:
        for chiave in ("Emission Color", "Emission"):
            if chiave in b.inputs:
                b.inputs[chiave].default_value = (*emit, 1.0)
                break
        if "Emission Strength" in b.inputs:
            b.inputs["Emission Strength"].default_value = emit_str
    return m


M = {
    "cab":     mat("Vernice cabina", (0.80, 0.83, 0.86), 0.05, 0.22, coat=1.0),
    "tank":    mat("Alluminio cisterna", (0.78, 0.81, 0.84), 0.85, 0.20),
    "chrome":  mat("Cromo", (0.90, 0.91, 0.93), 1.00, 0.06),
    "steel":   mat("Acciaio", (0.55, 0.58, 0.61), 0.85, 0.30),
    "dark":    mat("Plastica scura", (0.045, 0.050, 0.056), 0.10, 0.45),
    # la calandra e' plastica grigio scuro, non nero assoluto: a 0.03 le
    # lamelle spariscono e il frontale diventa una macchia piatta
    "grille":  mat("Calandra", (0.075, 0.082, 0.090), 0.15, 0.40),
    "grate":   mat("Grigliato", (0.055, 0.062, 0.068), 0.60, 0.65),
    "rubber":  mat("Gomma", (0.014, 0.016, 0.018), 0.00, 0.95),
    "glass":   mat("Vetro", (0.020, 0.030, 0.040), 0.30, 0.05),
    "hub":     mat("Cerchio", (0.48, 0.51, 0.54), 0.90, 0.25),
    # verde di livrea, non insegna al neon: emissione via
    "green":   mat("Verde RGF", (0.048, 0.55, 0.29), 0.10, 0.38),
    "lightOn": mat("Faro", (0.95, 0.88, 0.75), 0.10, 0.10, emit=(1.0, 0.72, 0.38), emit_str=3.0),
    "amber":   mat("Luce ingombro", (1.0, 0.72, 0.30), 0.10, 0.15, emit=(1.0, 0.55, 0.15), emit_str=4.0),
    "tail":    mat("Fanale posteriore", (0.28, 0.03, 0.03), 0.10, 0.25, emit=(1.0, 0.09, 0.05), emit_str=3.0),
    "plate":   mat("Targa", (0.72, 0.75, 0.78), 0.05, 0.45),
    "adr":     mat("Targa ADR", (0.93, 0.44, 0.05), 0.05, 0.40),
}


# ----------------------------------------------------------------------------
# helper di costruzione
# ----------------------------------------------------------------------------
def sistema(ob, materiale, coll="Motrice", mirror=False, bevel=None,
            bevel_seg=3, smooth=False, angolo=30.0):
    """Materiale, collezione e modificatori ricorrenti."""
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    colls[coll].objects.link(ob)

    ob.data.materials.clear()
    ob.data.materials.append(M[materiale])

    if bevel:
        m = ob.modifiers.new("Bevel", 'BEVEL')
        m.width = bevel
        m.segments = bevel_seg
        m.limit_method = 'ANGLE'
        m.angle_limit = math.radians(angolo)
    if mirror:
        m = ob.modifiers.new("Mirror", 'MIRROR')
        m.mirror_object = pivot
        m.use_axis = (False, True, False)
    if smooth:
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def _nuovo(nome, bm, x, y, z, rot):
    me = bpy.data.meshes.new(nome)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nome, me)
    ob.location = (x, y, z)
    ob.rotation_euler = rot
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _rot_asse(asse):
    return {'X': (0, R90, 0), 'Y': (R90, 0, 0), 'Z': (0, 0, 0)}[asse]


def box(nome, sx, sy, sz, x, y, z, rot=(0, 0, 0)):
    """Scala congelata nella mesh: il Bevel lavora in unita' di mondo, con
    una scala non applicata i raccordi verrebbero diversi su ogni asse."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((sx, sy, sz)), verts=bm.verts)
    return _nuovo(nome, bm, x, y, z, rot)


def cyl(nome, r, depth, x, y, z, asse='X', vertici=32, tappi=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=tappi, cap_tris=False, segments=vertici,
                          radius1=r, radius2=r, depth=depth)
    return _nuovo(nome, bm, x, y, z, _rot_asse(asse))


def sfera(nome, r, x, y, z, sx=1.0, seg=40, anelli=24):
    bm = bmesh.new()
    try:
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=anelli, radius=r)
    except TypeError:                      # Blender < 3.0
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=anelli, diameter=r)
    if sx != 1.0:
        bmesh.ops.scale(bm, vec=Vector((sx, 1, 1)), verts=bm.verts)
    return _nuovo(nome, bm, x, y, z, (0, 0, 0))


def torus(nome, maggiore, minore, x, y, z, asse='X', seg=64, seg_min=12):
    bm = bmesh.new()
    for i in range(seg):
        a = 2 * math.pi * i / seg
        centro = Vector((math.cos(a) * maggiore, math.sin(a) * maggiore, 0))
        radiale = Vector((math.cos(a), math.sin(a), 0))
        for j in range(seg_min):
            b = 2 * math.pi * j / seg_min
            bm.verts.new(centro + radiale * (math.cos(b) * minore)
                         + Vector((0, 0, math.sin(b) * minore)))
    bm.verts.ensure_lookup_table()
    for i in range(seg):
        for j in range(seg_min):
            a0 = i * seg_min
            a1 = ((i + 1) % seg) * seg_min
            j1 = (j + 1) % seg_min
            bm.faces.new((bm.verts[a0 + j], bm.verts[a0 + j1],
                          bm.verts[a1 + j1], bm.verts[a1 + j]))
    return _nuovo(nome, bm, x, y, z, _rot_asse(asse))


def arco(nome, r, largh, span, x, y, z, n=20, spessore=0.02):
    """Parafango: settore di cilindro con asse Y, aperto in basso.
    Il Solidify gli da' spessore reale — in Three.js era un guscio a
    faccia singola che andava reso DoubleSide."""
    bm = bmesh.new()
    a0 = math.radians(90 - span / 2)
    passo = math.radians(span) / n
    griglia = []
    for i in range(n + 1):
        a = a0 + passo * i
        px, pz = math.cos(a) * r, math.sin(a) * r
        griglia.append((bm.verts.new((px, -largh / 2, pz)),
                        bm.verts.new((px, largh / 2, pz))))
    for i in range(n):
        bm.faces.new((griglia[i][0], griglia[i][1],
                      griglia[i + 1][1], griglia[i + 1][0]))
    ob = _nuovo(nome, bm, x, y, z, (0, 0, 0))
    m = ob.modifiers.new("Solidify", 'SOLIDIFY')
    m.thickness = spessore
    m.offset = -1
    return ob


# ============================================================================
# MOTRICE — cabina X 2.45..4.87, Z 1.05..3.67, Y +-1.23
# ============================================================================
sistema(box("Cabina", 2.42, 2.46, 2.62, 3.66, 0, 2.36), "cab", bevel=0.14, bevel_seg=4)
# Niente deflettore di tetto: qualunque cassa appoggiata sul tetto leggeva
# come una vasca aperta, e su una motrice da cisterna spesso non c'e' —
# il tetto piatto a 3.67 sta anche piu' vicino ai 3.53 del mantello.
# Restano le alette laterali, che convogliano l'aria sul semirimorchio.
sistema(box("Aletta laterale", 0.54, 0.09, 1.00, 2.60, 1.16, 2.86, rot=(0, 0, 0.10)),
        "cab", mirror=True, bevel=0.04)

# Fronte, dal basso: paraurti 0.62-1.28, calandra 1.33-2.38, parabrezza
# 2.44-3.58. La cornice sta 0.15 per lato dentro la cabina: quel filo di
# lamiera e' il montante, senza il quale parabrezza e finestrini si saldano
# in un'unica fascia nera.
sistema(box("Cornice parabrezza", 0.07, 2.16, 1.26, 4.90, 0, 3.01, rot=(0, -0.06, 0)),
        "dark", bevel=0.03)
sistema(box("Parabrezza", 0.05, 2.02, 1.14, 4.945, 0, 3.01, rot=(0, -0.06, 0)),
        "glass", bevel=0.025)
sistema(box("Visiera", 0.42, 2.48, 0.13, 4.80, 0, 3.63, rot=(0, -0.06, 0)),
        "cab", bevel=0.04)
for i, yy in enumerate((0.0, 0.43, 0.86)):
    sistema(box(f"Luce ingombro {i}", 0.09, 0.15, 0.07, 4.78, yy, 3.72),
            "amber", mirror=(yy > 0), bevel=0.02)

sistema(box("Finestrino porta", 1.06, 0.05, 0.70, 4.06, 1.235, 2.92),
        "glass", mirror=True, bevel=0.03)
sistema(box("Oblo basso", 0.32, 0.05, 0.28, 4.58, 1.235, 2.18),
        "glass", mirror=True, bevel=0.02)
sistema(box("Profilo porta A", 0.03, 0.035, 1.85, 3.44, 1.238, 2.20), "dark", mirror=True)
sistema(box("Profilo porta B", 0.03, 0.035, 1.85, 4.68, 1.238, 2.20), "dark", mirror=True)
sistema(box("Profilo porta C", 1.24, 0.035, 0.03, 4.06, 1.238, 1.30), "dark", mirror=True)
sistema(box("Maniglia", 0.20, 0.05, 0.06, 3.62, 1.245, 2.55), "chrome", mirror=True, bevel=0.015)
sistema(box("Filetto verde", 1.90, 0.03, 0.09, 3.70, 1.245, 1.36), "green", mirror=True)

# calandra: 1.33-2.38, con la stella nella meta' alta
sistema(box("Calandra", 0.10, 2.12, 1.05, 4.90, 0, 1.855), "grille", bevel=0.04)
for i, zz in enumerate((1.40, 1.58, 1.76)):
    sistema(box(f"Lamella {i}", 0.09, 1.98, 0.06, 4.94, 0, zz), "steel", bevel=0.02)
sistema(box("Lamella corta", 0.09, 0.78, 0.06, 4.94, 0.78, 2.00), "steel", mirror=True, bevel=0.02)
sistema(box("Lamella alta", 0.09, 1.98, 0.06, 4.94, 0, 2.28), "steel", bevel=0.02)

# stella a tre punte
STAR = (4.985, 2.00)
sistema(torus("Stella anello", 0.285, 0.028, STAR[0], 0, STAR[1], seg=48, seg_min=10),
        "chrome", smooth=True)
for i in range(3):
    a = i * 2 * math.pi / 3
    sistema(box(f"Stella raggio {i}", 0.05, 0.05, 0.28,
                STAR[0], math.sin(a) * 0.14, STAR[1] + math.cos(a) * 0.14,
                rot=(-a, 0, 0)),
            "chrome", bevel=0.015)
sistema(sfera("Stella mozzo", 0.055, STAR[0] + 0.01, 0, STAR[1], seg=20, anelli=12),
        "chrome", smooth=True)

# paraurti
sistema(box("Paraurti", 0.44, 2.56, 0.66, 4.80, 0, 0.95), "cab", bevel=0.08)
sistema(box("Spoiler inferiore", 0.34, 2.44, 0.30, 4.84, 0, 0.48), "dark", bevel=0.05)
# il faro e' incassato: cornice scura piu' grande della lente, che sporge di
# poco. A filo del paraurti le lenti leggevano come adesivi bianchi.
sistema(box("Faro cornice", 0.16, 0.62, 0.42, 4.92, 0.92, 1.00), "dark", mirror=True, bevel=0.05)
sistema(box("Faro lente", 0.06, 0.46, 0.26, 5.005, 0.92, 1.00), "lightOn", mirror=True, bevel=0.03)
sistema(box("Fendinebbia cornice", 0.10, 0.26, 0.20, 4.95, 0.62, 0.70), "dark", mirror=True, bevel=0.03)
sistema(box("Fendinebbia", 0.06, 0.18, 0.12, 4.995, 0.62, 0.70), "lightOn", mirror=True, bevel=0.02)
sistema(box("Presa aria", 0.08, 0.30, 0.30, 4.99, 1.10, 0.82), "dark", mirror=True, bevel=0.04)
sistema(box("Targa", 0.04, 0.36, 0.16, 5.02, 0, 0.50), "plate", bevel=0.012)

# specchi
# specchi sporgenti ma compatti: con lo scatolato alto 0.70 appeso 0.48 sotto
# il braccio sembrava un periscopio
sistema(box("Braccio specchio", 0.07, 0.46, 0.07, 4.62, 1.44, 3.40), "dark", mirror=True, bevel=0.02)
sistema(box("Staffa specchio", 0.07, 0.07, 0.20, 4.62, 1.65, 3.32), "dark", mirror=True, bevel=0.02)
sistema(box("Specchio corpo", 0.10, 0.21, 0.44, 4.60, 1.66, 3.06), "dark", mirror=True, bevel=0.035)
sistema(box("Specchio vetro", 0.03, 0.15, 0.36, 4.54, 1.66, 3.06), "glass", mirror=True)
sistema(box("Specchio grandangolo", 0.09, 0.19, 0.22, 4.60, 1.64, 2.72), "dark", mirror=True, bevel=0.03)

# gradini
sistema(box("Vano gradini", 0.52, 0.14, 0.72, 4.28, 1.20, 0.72), "dark", mirror=True, bevel=0.04)
for i, zz in enumerate((0.42, 0.70, 0.98)):
    sistema(box(f"Gradino {i}", 0.46, 0.20, 0.05, 4.28, 1.24, zz), "steel", mirror=True, bevel=0.015)

# telaio e organi
sistema(box("Longherone", 4.88, 0.16, 0.28, 2.44, 0.42, 1.02), "dark", mirror=True, bevel=0.03)
for i, xx in enumerate((4.60, 3.10, 1.95, 0.25)):
    sistema(box(f"Traversa {i}", 0.12, 0.86, 0.22, xx, 0, 1.02), "dark", bevel=0.03)
sistema(cyl("Serbatoio gasolio", 0.34, 1.05, 2.56, 1.02, 0.74, vertici=32), "chrome", smooth=True)
sistema(cyl("Serbatoio AdBlue", 0.28, 0.90, 2.56, -1.02, 0.72, vertici=28), "steel", smooth=True)
for i, xx in enumerate((2.20, 2.92)):
    sistema(torus(f"Cinghia serbatoio {i}", 0.35, 0.028, xx, 1.02, 0.74, seg=24, seg_min=8),
            "steel", smooth=True)
sistema(cyl("Serbatoio aria", 0.18, 0.66, 0.30, 0.70, 0.80, vertici=24),
        "steel", mirror=True, smooth=True)
sistema(cyl("Scarico", 0.06, 0.46, 0.12, -0.95, 0.62, vertici=16), "chrome", smooth=True)
sistema(box("Pedana", 0.90, 2.00, 0.07, 2.05, 0, 1.18), "grate", bevel=0.02)
sistema(box("Armadio dietro cabina", 0.34, 1.60, 1.30, 2.28, 0, 1.90), "dark", bevel=0.04)
sistema(cyl("Ralla", 0.62, 0.09, 0.95, 0, 1.26, asse='Z', vertici=32), "dark", smooth=True)
sistema(box("Staffa ralla", 0.90, 0.20, 0.16, 0.95, 0.45, 1.14), "dark", mirror=True, bevel=0.03)

# parafanghi
# spessore 0.05: a 0.02 il parafango si leggeva come un filo sospeso.
# Solo il passaruota anteriore e' in tinta perche' fa parte del sottoporta;
# quello del motore e' plastica nera come sui mezzi reali — in tinta
# galleggiava come un archetto bianco slegato dal telaio.
sistema(arco("Parafango sterzante", 0.68, 0.52, 150, 3.72, 1.05, 0.54, spessore=0.05),
        "cab", mirror=True, smooth=True)
sistema(arco("Parafango motore", 0.72, 0.68, 158, 1.32, 0.95, 0.54, spessore=0.05),
        "dark", mirror=True, smooth=True)
sistema(box("Paraspruzzi motrice", 0.03, 0.56, 0.46, 0.70, 0.95, 0.32), "rubber", mirror=True)


# ============================================================================
# SEMIRIMORCHIO CISTERNA — mantello X -4.57..1.33, asse Z 2.48, raggio 1.05
# ============================================================================
TZ = 2.48
mantello = sistema(cyl("Mantello", 1.05, 5.90, -1.62, 0, TZ, vertici=56, tappi=False),
                   "tank", coll="Semirimorchio", smooth=True)
sistema(sfera("Calotta anteriore", 1.05, 1.33, 0, TZ, sx=0.42, seg=32, anelli=18),
        "tank", coll="Semirimorchio", smooth=True)
sistema(sfera("Calotta posteriore", 1.05, -4.57, 0, TZ, sx=0.42, seg=32, anelli=18),
        "tank", coll="Semirimorchio", smooth=True)
# anelli fuori dalla fascia della scritta (X -2.95..-0.05)
for i, xx in enumerate((-4.30, -3.60, 0.25, 0.70)):
    sistema(torus(f"Anello {i}", 1.062, 0.030, xx, 0, TZ, seg=48, seg_min=8),
            "steel", coll="Semirimorchio", smooth=True)
sistema(cyl("Fascia verde", 1.072, 0.18, 1.05, 0, TZ, vertici=56),
        "green", coll="Semirimorchio", smooth=True)

# passerella, passi d'uomo, corrimano
sistema(box("Passerella", 4.70, 0.54, 0.06, -2.05, 0, 3.56), "grate",
        coll="Semirimorchio", bevel=0.015)
for i, xx in enumerate((-3.80, -1.75, 0.20)):
    sistema(cyl(f"Passo d'uomo {i}", 0.32, 0.14, xx, 0, 3.60, asse='Z', vertici=28),
            "steel", coll="Semirimorchio", smooth=True)
    sistema(torus(f"Coperchio {i}", 0.33, 0.035, xx, 0, 3.66, asse='Z', seg=28, seg_min=8),
            "chrome", coll="Semirimorchio", smooth=True)
for i, xx in enumerate((-4.30, -3.20, -2.10, -1.00, 0.10)):
    sistema(box(f"Piantone {i}", 0.05, 0.05, 0.34, xx, -0.34, 3.72),
            "steel", coll="Semirimorchio", bevel=0.015)
sistema(box("Corrimano", 4.55, 0.05, 0.05, -2.10, -0.34, 3.87), "steel",
        coll="Semirimorchio", bevel=0.015)

# telaio, appoggi, paraincastro
sistema(box("Piastra ralla", 1.60, 1.90, 0.10, 0.75, 0, 1.36), "dark",
        coll="Semirimorchio", bevel=0.03)
sistema(box("Longherone rimorchio", 5.20, 0.14, 0.24, -2.30, 0.42, 1.24),
        "dark", coll="Semirimorchio", mirror=True, bevel=0.03)
sistema(box("Piede appoggio", 0.17, 0.17, 0.80, -0.45, 0.80, 0.72),
        "steel", coll="Semirimorchio", mirror=True, bevel=0.03)
sistema(box("Piastra piede", 0.34, 0.34, 0.10, -0.45, 0.80, 0.28),
        "dark", coll="Semirimorchio", mirror=True, bevel=0.02)
sistema(box("Traversa appoggi", 1.70, 0.08, 0.08, -0.45, 0, 1.00), "steel",
        coll="Semirimorchio", bevel=0.02)
sistema(box("Barra paraincastro", 2.30, 0.07, 0.09, -1.05, 1.16, 0.74),
        "steel", coll="Semirimorchio", mirror=True, bevel=0.02)
for i, xx in enumerate((-0.30, -1.90)):
    sistema(box(f"Staffa paraincastro {i}", 0.07, 0.07, 0.50, xx, 1.16, 0.98),
            "steel", coll="Semirimorchio", mirror=True, bevel=0.02)
sistema(box("Parafango carrello", 2.42, 0.62, 0.10, -3.45, 0.95, 1.28),
        "dark", coll="Semirimorchio", mirror=True, bevel=0.03)
sistema(box("Bordo parafango", 2.42, 0.06, 0.30, -3.45, 1.25, 1.14),
        "dark", coll="Semirimorchio", mirror=True, bevel=0.02)
sistema(box("Paraspruzzi carrello", 0.03, 0.58, 0.48, -4.98, 0.95, 0.32),
        "rubber", coll="Semirimorchio", mirror=True)

# coda
sistema(box("Armadio pompe", 0.70, 1.95, 1.05, -5.36, 0, 1.62), "steel",
        coll="Semirimorchio", bevel=0.04)
sistema(box("Maniglia armadio", 0.05, 0.50, 0.06, -5.73, 0, 1.62), "chrome",
        coll="Semirimorchio", bevel=0.02)
sistema(torus("Arrotolatubo", 0.36, 0.10, -5.40, 0, 2.42, seg=32, seg_min=12),
        "dark", coll="Semirimorchio", smooth=True)
sistema(box("Paraincastro coda", 0.10, 2.10, 0.16, -5.62, 0, 0.62), "steel",
        coll="Semirimorchio", bevel=0.03)
sistema(box("Supporto paraincastro", 0.10, 0.14, 0.72, -5.50, 0.80, 0.98),
        "steel", coll="Semirimorchio", mirror=True, bevel=0.03)
sistema(box("Fanale coda", 0.09, 0.22, 0.46, -5.74, 0.92, 1.05),
        "tail", coll="Semirimorchio", mirror=True, bevel=0.03)
sistema(box("Targa ADR", 0.05, 0.40, 0.26, -5.74, 0.62, 1.62), "adr",
        coll="Semirimorchio", bevel=0.015)


# ----------------------------------------------------------------------------
# scritta RGF: testo vero, curvato sul mantello con uno Shrinkwrap
# (in Three.js era una texture da canvas su un piano piatto)
# ----------------------------------------------------------------------------
def scritta(testo, materiale, x, z, dim, nome):
    cu = bpy.data.curves.new(nome, 'FONT')
    cu.body = testo
    cu.size = dim
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = 0.004
    ob = bpy.data.objects.new(nome, cu)
    bpy.context.scene.collection.objects.link(ob)
    # in piedi sulla fiancata +Y e leggibile da fuori: per un osservatore a
    # +Y con l'alto su +Z la direzione di lettura e' -X, quindi Z di 180 gradi
    ob.rotation_euler = (R90, 0, math.pi)
    ob.location = (x, 1.30, z)

    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob.select_set(False)

    m = ob.modifiers.new("Shrinkwrap", 'SHRINKWRAP')
    m.target = mantello
    m.wrap_method = 'NEAREST_SURFACEPOINT'
    m.offset = 0.006
    return sistema(ob, materiale, coll="Semirimorchio")


scritta("RGF", "dark", -2.05, TZ + 0.16, 0.62, "Scritta RGF")
scritta("ambiente", "green", -1.05, TZ - 0.20, 0.34, "Scritta ambiente")


# ============================================================================
# RUOTE — sterzante singola, motore e carrello gemellati
# ============================================================================
def ruota(nome, x, y, largh, faccia):
    """parti: (materiale, oggetto, shading liscio)."""
    # Risoluzione tenuta bassa di proposito: a seg=40/seg_min=8 i soli
    # talloni delle 24 ruote facevano il 44% delle facce del modello, per un
    # dettaglio che a schermo sta dentro pochi pixel.
    parti = [("rubber", cyl(f"{nome} pneumatico", 0.54, largh, x, y, 0.54,
                            asse='Y', vertici=28), True)]
    for segno in (1, -1):
        parti.append(("rubber", torus(f"{nome} tallone {segno}", 0.505, 0.045,
                                      x, y + segno * (largh / 2 - 0.02), 0.54,
                                      asse='Y', seg=20, seg_min=5), True))
    if faccia:
        s = y + faccia * (largh / 2 - 0.03)
        parti.append(("hub", cyl(f"{nome} cerchio", 0.33, 0.10, x, s, 0.54,
                                 asse='Y', vertici=28), True))
        # coprimozzo basso e a shading piatto: smussato e profondo 0.12
        # leggeva come una sfera cromata, un occhio in mezzo alla ruota
        parti.append(("chrome", cyl(f"{nome} coprimozzo", 0.115, 0.05,
                                    x, s + faccia * 0.05, 0.54,
                                    asse='Y', vertici=20), False))
        # i fori vanno su tutte le ruote a vista: qui non c'e' il vincolo
        # delle draw call che me li faceva togliere sul carrello
        for i in range(5):
            a = i * 2 * math.pi / 5 + 0.3
            parti.append(("dark", cyl(f"{nome} foro {i}", 0.075, 0.16,
                                      x + math.cos(a) * 0.21, s,
                                      0.54 + math.sin(a) * 0.21,
                                      asse='Y', vertici=14), True))
    for materiale, ob, liscio in parti:
        sistema(ob, materiale, coll="Ruote", smooth=liscio)


ruota("Sterzante SX", 3.72, 1.05, 0.34, 1)
ruota("Sterzante DX", 3.72, -1.05, 0.34, -1)
for i, xx in enumerate((1.32, -2.55, -3.45, -4.35)):
    ruota(f"Asse{i} int SX", xx, 0.80, 0.26, 0)
    ruota(f"Asse{i} est SX", xx, 1.09, 0.26, 1)
    ruota(f"Asse{i} int DX", xx, -0.80, 0.26, 0)
    ruota(f"Asse{i} est DX", xx, -1.09, 0.26, -1)
    sistema(cyl(f"Assale {i}", 0.09, 2.10, xx, 0, 0.54, asse='Y', vertici=16),
            "dark", coll="Ruote", smooth=True)


# ============================================================================
# set: piazzale, luci, camera
# ============================================================================
# raggio 200: a 60 il bordo del disco tagliava una linea d'orizzonte netta
sistema(cyl("Piazzale", 200, 0.1, 0, 0, -0.05, asse='Z', vertici=96), "grate", coll="Set")

mondo = bpy.data.worlds.new("Crepuscolo")
scene.world = mondo
mondo.use_nodes = True
nodi = mondo.node_tree
bg = nodi.nodes["Background"]
bg.inputs["Strength"].default_value = 1.1
# cielo fisico: da' al mantello cromato un gradiente vero da riflettere,
# cosa che un colore piatto non puo' fare.
# In Blender 5.x il Nishita si chiama MULTIPLE_SCATTERING — con il vecchio
# identificatore l'assegnazione sollevava TypeError e il cielo restava piatto.
cielo = nodi.nodes.new("ShaderNodeTexSky")
for tipo in ('MULTIPLE_SCATTERING', 'NISHITA', 'SINGLE_SCATTERING', 'HOSEK_WILKIE'):
    try:
        cielo.sky_type = tipo
        break
    except TypeError:
        continue
cielo.sun_elevation = math.radians(6.5)
cielo.sun_rotation = math.radians(205)
for attr, val in (("sun_intensity", 0.6), ("turbidity", 4.0)):
    if hasattr(cielo, attr):
        setattr(cielo, attr, val)
nodi.links.new(cielo.outputs["Color"], bg.inputs["Color"])


def aim(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def luce(nome, tipo, energia, colore, loc, target, size=2.0, angolo=None):
    d = bpy.data.lights.new(nome, tipo)
    d.energy = energia
    d.color = colore
    if tipo == 'AREA':
        d.size = size
    if tipo == 'SUN' and angolo is not None:
        d.angle = angolo
    ob = bpy.data.objects.new(nome, d)
    ob.location = loc
    colls["Set"].objects.link(ob)
    aim(ob, target)
    return ob


# sole radente da dietro: disegna il profilo della cisterna
luce("Sole", 'SUN', 3.5, (1.0, 0.68, 0.44), (-14, 9, 5), (0, 0, 2.0),
     angolo=math.radians(2))
# chiave sul muso: senza questa il frontale resta in ombra e calandra,
# stella e fari diventano una macchia nera
luce("Chiave frontale", 'AREA', 12000, (1.0, 0.88, 0.76), (15, 10, 6), (3.5, 0, 2.2), size=10)
luce("Riempimento", 'AREA', 15000, (0.66, 0.82, 0.92), (1, 18, 6), (-1.5, 0, 2.0), size=18)
luce("Stacco", 'AREA', 6000, (0.62, 0.80, 1.0), (-9, -8, 7), (-3, 0, 2.4), size=8)
# softbox dall'alto: senza questa il tetto guarda lo zenit scuro del cielo
# mentre i raccordi degli spigoli prendono l'orizzonte chiaro, e la cabina
# legge come una vasca aperta invece che come un tetto piatto
luce("Cielo", 'AREA', 20000, (0.78, 0.85, 0.95), (0, 3, 16), (0, 0, 2.4), size=26)

cam_d = bpy.data.cameras.new("Camera")
cam_d.lens = 55
cam = bpy.data.objects.new("Camera", cam_d)
colls["Set"].objects.link(cam)
scene.camera = cam

scene.render.resolution_x = 1600
scene.render.resolution_y = 900
for vt in ('AgX', 'Filmic', 'Standard'):
    try:
        scene.view_settings.view_transform = vt
        break
    except Exception:
        pass

motori = [i.identifier for i in scene.render.bl_rna.properties['engine'].enum_items]
for m in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
    if m in motori:
        scene.render.engine = m
        break

bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\fabio\sito-rgf\3d\rgf-truck.blend")

mesh_ob = [o for o in bpy.data.objects if o.type == 'MESH']
print("RISULTATO oggetti={} facce={} motore={} view={}".format(
    len(mesh_ob), sum(len(o.data.polygons) for o in mesh_ob),
    scene.render.engine, scene.view_settings.view_transform))
