"""Independent ZIP package preservation checks (Python zipfile, Pillow, jpegtran)."""
from pathlib import Path
import sys,zipfile,struct,io,subprocess,tempfile
from PIL import Image
src,out=map(Path,sys.argv[1:3]);count=0
extensions={'.docx','.dotx','.pptx','.ppsx','.potx','.xlsx','.xltx','.vsdx','.kmz'}
def compressed(path,info):
 with path.open('rb') as f:
  f.seek(info.header_offset);h=f.read(30);n,x=struct.unpack_from('<HH',h,26);f.seek(n+x,1);return f.read(info.compress_size)
for p in sorted(out.iterdir()):
 if p.suffix not in extensions:continue
 original=src/p.name
 with zipfile.ZipFile(original) as a,zipfile.ZipFile(p) as b:
  assert a.namelist()==b.namelist(),(p,'entry order');assert a.comment==b.comment,(p,'comment')
  for x,y in zip(a.infolist(),b.infolist()):
   assert (x.date_time,x.external_attr,x.comment)==(y.date_time,y.external_attr,y.comment),(p,x.filename,'metadata')
   left,right=a.read(x),b.read(y)
   if left==right:
    assert compressed(original,x)==compressed(p,y),(p,x.filename,'compressed protected bytes');continue
   assert Path(x.filename).suffix.lower() in ('.png','.jpg','.jpeg'),(p,x.filename,'protected non-image bytes')
   with Image.open(io.BytesIO(left)) as l,Image.open(io.BytesIO(right)) as r:
    assert l.size==r.size,(p,x.filename,'dimensions')
    for k in ('icc_profile','dpi','exif','gamma','Author'):
     assert l.info.get(k)==r.info.get(k),(p,x.filename,k)
    if p.suffix!='.kmz':assert l.convert('RGBA').tobytes()==r.convert('RGBA').tobytes(),(p,x.filename,'pixels')
   if p.suffix!='.kmz' and Path(x.filename).suffix.lower() in ('.jpg','.jpeg'):
    with tempfile.TemporaryDirectory() as d:
     l=Path(d)/'in.jpg';r=Path(d)/'out.jpg';l.write_bytes(left);r.write_bytes(right)
     assert subprocess.check_output(['jpegtran','-copy','all','-optimize',str(l)])==subprocess.check_output(['jpegtran','-copy','all','-optimize',str(r)]),(p,x.filename,'coefficients')
 count+=1;print(p.name+': entry order, metadata, protected bytes and images passed')
assert count,'No output packages found'
print(f'Package oracle: {count} outputs passed')
