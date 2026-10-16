"""Independent comparison: Pillow raw samples and system jpegtran canonical coefficients."""
from pathlib import Path
from PIL import Image
import sys, subprocess, hashlib, struct
original,output=map(Path,sys.argv[1:3])
count=0
for p in sorted(output.iterdir()):
 if p.suffix.lower() not in ('.png','.jpg','.jpeg'):continue
 a=original/p.name
 with Image.open(a) as x,Image.open(p) as y:
  assert x.size==y.size,(p,'dimensions')
  if x.mode in ('I;16','I;16B','I'):
   left=list(x.get_flattened_data())
   right=list(y.get_flattened_data()) if y.mode in ('I;16','I;16B','I') else [v*257 for v in y.convert('L').get_flattened_data()]
   assert left==right,(p,'16-bit samples')
  else:
   assert x.convert('RGBA').tobytes()==y.convert('RGBA').tobytes(),(p,'pixels')
  if p.suffix=='.png':
   # Palette indices are compared through RGBA above, including transparent RGB values.
   for k in ('icc_profile','dpi','gamma','Author','exif'):
    assert x.info.get(k)==y.info.get(k),(p,k)
 if p.suffix in ('.jpg','.jpeg'):
  # Fixed native jpegtran scan/Huffman decisions make coefficient-equivalent inputs canonical.
  def canonical(path):return subprocess.check_output(['jpegtran','-copy','all','-optimize',str(path)])
  assert canonical(a)==canonical(p),(p,'JPEG coefficients/metadata')
 count+=1;print(f'{p.name}: pixels, dimensions, metadata'+(' and JPEG coefficients' if p.suffix=='.jpg' else '')+' preserved')
assert count, 'No optimized fixtures found'
print(f'Independent oracle: {count} images passed')
