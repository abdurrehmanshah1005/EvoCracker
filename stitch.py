import os
from PIL import Image

def stitch(src_dir, dest_path, frame_w, frame_h):
    if not os.path.exists(src_dir):
        print(f"Skipping {src_dir}")
        return
    files = [f for f in os.listdir(src_dir) if f.endswith('.png')]
    # Try to sort numerically if possible (e.g. idle1.png, idle2.png)
    files.sort(key=lambda x: int(''.join(filter(str.isdigit, x))) if any(c.isdigit() for c in x) else 0)
    
    if not files:
        return
    
    total_width = frame_w * len(files)
    result = Image.new("RGBA", (total_width, frame_h))
    
    for i, file in enumerate(files):
        img = Image.open(os.path.join(src_dir, file))
        result.paste(img, (i * frame_w, 0))
    
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    result.save(dest_path)
    print(f"Stitched {len(files)} frames to {dest_path}")

base = "public/assets/characters/space-marine-lite/Sprites"
dest = "public/assets/characters/space-marine-lite/spritesheets"
stitch(os.path.join(base, "Idle", "sprites"), os.path.join(dest, "idle.png"), 75, 48)
stitch(os.path.join(base, "Run with Gun", "sprites"), os.path.join(dest, "run.png"), 75, 48)
stitch(os.path.join(base, "Shoot", "sprites"), os.path.join(dest, "shoot.png"), 75, 48)
stitch(os.path.join(base, "Die", "sprites"), os.path.join(dest, "hurt.png"), 75, 48)
stitch(os.path.join(base, "Jump with Gun", "sprites"), os.path.join(dest, "jump.png"), 75, 48)
