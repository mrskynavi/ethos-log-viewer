# Zeichnet das MM-Zeichen von Mächler Modelle und erzeugt daraus alle App-Icons
# (build/icon.png für Mac/Windows, pwa/icons für Web-App und Android). Danach scripts/android-icons.py laufen lassen.
import os
from PIL import Image, ImageDraw
root = os.path.join(os.path.dirname(__file__), '..')
# Linien des Zeichens, Einheiten wie im Logo: 338 breit, 345 hoch, Strichstärke 27
W, H, SW = 338, 345, 27
LINES = [[(0, 0), (0, H)], [(W, 0), (W, H)],                 # äussere Balken
         [(55, 0), (169, 165), (283, 0)],                     # oberes V
         [(65, H), (65, 130), (169, 280), (273, 130), (273, H)]]  # inneres M

def mark(size, color):
    """MM-Zeichen, size = Höhe in Pixeln inkl. Strich, transparenter Hintergrund."""
    ss = 4; s = size * ss / (H + SW); o = SW / 2 * s
    im = Image.new('RGBA', (round((W + SW) * s), round(size * ss)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    r = SW / 2 * s
    for pts in LINES:
        P = [(o + x * s, o + y * s) for x, y in pts]
        d.line(P, fill=color, width=round(SW * s), joint='curve')
        for x, y in P: d.ellipse((x - r, y - r, x + r, y + r), fill=color)
    return im.resize((round(im.width / ss), round(im.height / ss)), Image.LANCZOS)

def tile(n, inset, radius, markh, bg=(255, 255, 255, 255), fg=(17, 17, 17, 255)):
    ss = 4; im = Image.new('RGBA', (n * ss, n * ss), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((inset * ss, inset * ss, (n - inset) * ss - 1, (n - inset) * ss - 1), radius=radius * ss, fill=bg)
    im = im.resize((n, n), Image.LANCZOS)
    m = mark(markh, fg); im.alpha_composite(m, ((n - m.width) // 2, (n - m.height) // 2))
    return im

icons = os.path.join(root, 'pwa', 'icons')
tile(1024, 100, 185, 470).save(os.path.join(root, 'build', 'icon.png'))
tile(512, 0, 96, 250).save(os.path.join(icons, 'icon-512.png'))
tile(192, 0, 36, 94).save(os.path.join(icons, 'icon-192.png'))
tile(512, 0, 0, 200).save(os.path.join(icons, 'maskable-512.png'))       # Android schneidet zu, Zeichen im sicheren Bereich
tile(180, 0, 0, 92).convert('RGB').save(os.path.join(icons, 'apple-touch-icon.png'))
tile(32, 0, 6, 20).save(os.path.join(icons, 'favicon-32.png'))
