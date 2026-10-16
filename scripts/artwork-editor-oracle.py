"""Independent Krita import/render comparison of original and optimized ORA."""
from pathlib import Path
import subprocess
from PIL import Image
out=Path('tests/output/krita');out.mkdir(exist_ok=True)
for label,source in [('original','tests/fixtures/multiformat/layers.ora'),('optimized','tests/output/multiformat/layers.ora')]:
 subprocess.run(['/Applications/krita.app/Contents/MacOS/krita','--nosplash','--export','--export-filename',str((out/(label+'.png')).resolve()),str(Path(source).resolve())],check=True,timeout=60)
with Image.open(out/'original.png') as a,Image.open(out/'optimized.png') as b:assert a.size==b.size and a.convert('RGBA').tobytes()==b.convert('RGBA').tobytes()
print('Krita original/result ORA imports and renders are pixel-identical')
