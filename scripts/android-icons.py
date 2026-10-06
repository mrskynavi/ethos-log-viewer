# Erzeugt App-Icons und Startbild für android/ aus pwa/icons (einmalig, Ergebnis ist eingecheckt)
import glob, os
from PIL import Image, ImageDraw
root = os.path.join(os.path.dirname(__file__), '..')
res = os.path.join(root, 'android', 'app', 'src', 'main', 'res')
mask = Image.open(os.path.join(root, 'pwa', 'icons', 'maskable-512.png')).convert('RGBA')
icon = Image.open(os.path.join(root, 'pwa', 'icons', 'icon-512.png')).convert('RGBA')
bg = mask.getpixel((0, 0))
for d, s in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
    out = os.path.join(res, 'mipmap-' + d)
    n = round(48 * s)
    icon.resize((n, n), Image.LANCZOS).save(os.path.join(out, 'ic_launcher.png'))
    r = mask.resize((n, n), Image.LANCZOS)
    m = Image.new('L', (n * 4, n * 4), 0); ImageDraw.Draw(m).ellipse((0, 0, n * 4 - 1, n * 4 - 1), fill=255)
    rr = Image.new('RGBA', (n, n), (0, 0, 0, 0)); rr.paste(r, (0, 0), m.resize((n, n), Image.LANCZOS))
    rr.save(os.path.join(out, 'ic_launcher_round.png'))
    # adaptives Icon: 108 dp, sichtbar sind nur die mittleren 72 dp
    f = round(108 * s); k = round(f * 0.8)
    fg = Image.new('RGBA', (f, f), bg); fg.paste(mask.resize((k, k), Image.LANCZOS), ((f - k) // 2, (f - k) // 2))
    fg.save(os.path.join(out, 'ic_launcher_foreground.png'))
for p in glob.glob(os.path.join(res, 'drawable*', 'splash.png')):
    w, h = Image.open(p).size
    sp = Image.new('RGB', (w, h), (15, 20, 26)); k = round(min(w, h) * 0.35)
    sp.paste(icon.resize((k, k), Image.LANCZOS), ((w - k) // 2, (h - k) // 2), icon.resize((k, k), Image.LANCZOS))
    sp.save(p)
print('#%02X%02X%02X' % bg[:3])
