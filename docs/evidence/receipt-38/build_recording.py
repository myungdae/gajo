from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).parent
frames = []
labels = [
    "1. 행동 허브",
    "2. 직접 입력",
    "3. 취소 후 복귀",
    "4. 식당 결과 직행",
    "5. 뒤로가기 후 복귀",
]
for path, label in zip(sorted(root.glob("0*.png")), labels):
    image = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((10, 10, 205, 42), radius=8, fill="#102a28")
    draw.text((20, 18), label, fill="white")
    frames.extend([image.copy()] * 2)

frames[0].save(
    root / "receipt-38-390x844.gif",
    save_all=True,
    append_images=frames[1:],
    duration=900,
    loop=0,
    optimize=True,
)
