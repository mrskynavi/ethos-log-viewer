# Zeichnet das App-Symbol von MM Flight Analyzer und erzeugt daraus alle App-Icons
# (build/icon.png für Mac/Windows, pwa/icons für Web-App und Android). Danach scripts/android-icons.py laufen lassen.
# Oben Höhen- und Vario-Kurve mit Messcursor und KI-Funke, unten die Familienleiste mit dem MM-Zeichen von Mächler Modelle.
# Braucht cairosvg (pip install cairosvg).
import io, os
import cairosvg
from PIL import Image
root = os.path.join(os.path.dirname(__file__), '..')

NAVY, BLUE, ORANGE = '#13213D', '#2F80ED', '#F2994A'
# MM-Zeichen, Einheiten wie im Logo: 338 breit, 345 hoch
MM = 'M0 0V345M338 0V345M55 0L169 165L283 0M65 345V130L169 280L273 130V345'

def mm(cx, cy, h, sw=34):
    s = h / 345
    return (f'<g transform="translate({cx - 169 * s:.1f},{cy - 172.5 * s:.1f}) scale({s:.4f})"><path d="{MM}" fill="none" '
            f'stroke="#ffffff" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/></g>')

def smooth(pts):
    """Catmull-Rom durch die Punkte als kubische Bézier-Kurve."""
    d = f'M{pts[0][0]} {pts[0][1]}'
    for i in range(1, len(pts)):
        p0, p1, p2, p3 = pts[max(i - 2, 0)], pts[i - 1], pts[i], pts[min(i + 1, len(pts) - 1)]
        d += (f' C{p1[0] + (p2[0] - p0[0]) / 6:.0f} {p1[1] + (p2[1] - p0[1]) / 6:.0f}'
              f' {p2[0] - (p3[0] - p1[0]) / 6:.0f} {p2[1] - (p3[1] - p1[1]) / 6:.0f} {p2[0]} {p2[1]}')
    return d

def spark(x, y, r, outline=True):
    q = 0.16; st = f' stroke="#ffffff" stroke-width="{14 / r:.3f}" stroke-linejoin="round"' if outline else ''
    return (f'<g transform="translate({x},{y}) scale({r})"><path d="M0 -1 Q{q} -{q} 1 0 Q{q} {q} 0 1 Q-{q} {q} -1 0 '
            f'Q-{q} -{q} 0 -1Z" fill="url(#ki)"{st}/></g>')

ALT = smooth([(120, 560), (230, 470), (320, 500), (420, 330), (520, 380), (620, 250), (720, 300), (880, 210)])
VARIO = smooth([(120, 640), (220, 600), (320, 660), (420, 560), (520, 640), (620, 540), (720, 620), (880, 600)])
CHART = (f'<path d="{ALT} L880 760 L120 760 Z" fill="{BLUE}" opacity="0.12"/>'
         f'<path d="{ALT}" fill="none" stroke="{BLUE}" stroke-width="30" stroke-linecap="round"/>'
         f'<path d="{VARIO}" fill="none" stroke="{ORANGE}" stroke-width="22" stroke-linecap="round"/>'
         f'<line x1="620" y1="200" x2="620" y2="740" stroke="{NAVY}" stroke-width="12" stroke-dasharray="26 22" stroke-linecap="round" opacity="0.7"/>'
         f'<circle cx="620" cy="250" r="34" fill="#ffffff" stroke="{BLUE}" stroke-width="18"/>'
         f'<circle cx="620" cy="542" r="30" fill="#ffffff" stroke="{ORANGE}" stroke-width="16"/>'
         + spark(620, 125, 80) + spark(725, 90, 32, False))
DEFS = '<linearGradient id="ki" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A855F7"/><stop offset="1" stop-color="#6D28D9"/></linearGradient>'

def svg(radius, maskable=False):
    """Symbol auf 1024×1024. radius = Eckenradius (0 = eckig). maskable: Inhalt im sicheren Kreis (Android schneidet zu)."""
    if maskable:   # Diagramm und MM in den sicheren Kreis (Radius 40 %) verkleinern, Leiste bleibt randlos
        body = (f'<rect y="700" width="1024" height="324" fill="{NAVY}"/>'
                f'<g transform="translate(512,450) scale(0.62) translate(-512,-450)">{CHART}</g>' + mm(512, 820, 110))
    else:
        body = f'<rect y="760" width="1024" height="264" fill="{NAVY}"/>' + CHART + mm(512, 892, 150)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>{DEFS}'
            f'<clipPath id="c"><rect width="1024" height="1024" rx="{radius}"/></clipPath></defs>'
            f'<g clip-path="url(#c)"><rect width="1024" height="1024" fill="#ffffff"/>{body}</g></svg>')

def render(n, radius, inset=0, maskable=False):
    """Symbol mit n Pixel Kantenlänge, inset = transparenter Rand (macOS-Raster)."""
    k = n - 2 * inset
    im = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg(radius * 1024 / k if k else 0, maskable).encode(),
                                                output_width=k, output_height=k))).convert('RGBA')
    out = Image.new('RGBA', (n, n), (0, 0, 0, 0)); out.alpha_composite(im, (inset, inset))
    return out

icons = os.path.join(root, 'pwa', 'icons')
render(1024, 185, 100).save(os.path.join(root, 'build', 'icon.png'))
render(512, 96).save(os.path.join(icons, 'icon-512.png'))
render(192, 36).save(os.path.join(icons, 'icon-192.png'))
render(512, 0, maskable=True).save(os.path.join(icons, 'maskable-512.png'))
render(180, 0).convert('RGB').save(os.path.join(icons, 'apple-touch-icon.png'))
render(32, 6).save(os.path.join(icons, 'favicon-32.png'))
