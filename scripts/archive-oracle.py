"""Independent native-tool archive payload checks; never extracts onto disk."""
from pathlib import Path
import subprocess,sys,io,zipfile
from PIL import Image
src,out=map(Path,sys.argv[1:3]);count=0
def entries(p):
 return subprocess.check_output(['/usr/bin/bsdtar','-tf',str(p)]).decode().splitlines()
def payload(p,n):return subprocess.check_output(['/usr/bin/bsdtar','-xOf',str(p),n])
for p in sorted(out.iterdir()):
 if p.name.startswith('pages-') and p.suffix=='.cbz':original=src/('pages.'+p.stem.split('-')[1])
 elif p.name in ['pages.zip','pages.tar','pages.7z']:original=src/p.name
 elif p.name=='small.cbz':original=src/'small.cbr'
 else:continue
 names=entries(original);assert names==entries(p),(p,'ordered entries')
 for n in names:
  left,right=payload(original,n),payload(p,n)
  if left==right:continue
  assert Path(n).suffix.lower() in ('.png','.jpg','.jpeg'),(p,n,'protected resource')
  with Image.open(io.BytesIO(left)) as a,Image.open(io.BytesIO(right)) as b:
   assert a.size==b.size,(p,n,'geometry')
   for k in ('icc_profile','exif','dpi','gamma','Author'):assert a.info.get(k)==b.info.get(k),(p,n,k)
 count+=1;print(p.name+': ordered native listing, protected payloads and image geometry/metadata passed')
assert count>=8,('missing archive outputs',count)
print('Archive oracle:',count,'passed')
