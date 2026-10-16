"""Independent publication ZIP/pixel preservation, mandatory local header checks."""
from pathlib import Path
import sys,zipfile,struct,io,xml.etree.ElementTree as ET
from PIL import Image
src,out=map(Path,sys.argv[1:3]);count=0
for p in sorted(out.iterdir()):
 if p.suffix not in ('.odt','.ods','.odp','.odg','.ott','.ots','.otp','.otg','.epub','.ora'):continue
 original=src/p.name
 with zipfile.ZipFile(original) as a,zipfile.ZipFile(p) as b:
  assert a.namelist()==b.namelist(),(p,'ordered resources')
  data=p.read_bytes();assert data[:4]==b'PK\x03\x04';assert struct.unpack_from('<H',data,8)[0]==0;assert struct.unpack_from('<HH',data,26)==(8,0);assert data[30:38]==b'mimetype'
  assert a.read('mimetype')==b.read('mimetype')
  for n in a.namelist():
   left,right=a.read(n),b.read(n)
   if left==right:continue
   assert Path(n).suffix.lower() in ('.png','.jpg','.jpeg'),(p,n,'protected publication bytes')
   with Image.open(io.BytesIO(left)) as l,Image.open(io.BytesIO(right)) as r:
    assert l.size==r.size,(p,n,'dimensions')
    if p.suffix=='.ora':assert l.convert('RGBA').tobytes()==r.convert('RGBA').tobytes(),(p,n,'exact artwork')
  if p.suffix=='.ora':
   layers=[Image.open(io.BytesIO(b.read(n))).convert('RGBA') for n in ['data/base.png','data/top.png']]
   expected=Image.alpha_composite(*layers);actual=Image.open(io.BytesIO(b.read('mergedimage.png'))).convert('RGBA');assert expected.tobytes()==actual.tobytes()
 count+=1;print(p.name+': first stored mimetype, protected XML/resources and image geometry passed')
assert count==10,count
print('Publication oracle:',count,'passed')
