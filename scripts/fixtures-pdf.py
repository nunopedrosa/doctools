"""Synthetic deterministic PDF graph fixtures; original xrefs checked by native QPDF."""
from pathlib import Path
import subprocess,zlib
R=Path('tests/fixtures');O=R/'multiformat/pdf';O.mkdir(exist_ok=True)
def stream(d,b):return (d[:-2]+f' /Length {len(b)} >>').encode()+b'\nstream\n'+b+b'\nendstream'
def write(name,objs):
 data=bytearray(b'%PDF-1.7\n%\xe2\xe3\xcf\xd3\n');offset=[0]
 for i,obj in enumerate(objs,1):offset.append(len(data));data+=f'{i} 0 obj\n'.encode()+(obj.encode() if isinstance(obj,str) else obj)+b'\nendobj\n'
 pos=len(data);data+=f'xref\n0 {len(objs)+1}\n0000000000 65535 f \n'.encode()
 for n in offset[1:]:data+=f'{n:010} 00000 n \n'.encode()
 data+=f'trailer\n<< /Size {len(objs)+1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n{pos}\n%%EOF\n'.encode();(O/(name+'.pdf')).write_bytes(data)
jpeg=(R/'photo.jpg').read_bytes()
from PIL import Image
w,h=Image.open(R/'photo.jpg').size
base=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /CropBox [0 0 390 490] /Rotate 0 /Resources << /XObject << /Im 5 0 R >> >> /Contents 4 0 R >>',stream('<< >>',b'q 300 0 0 300 10 10 cm /Im Do Q\n'),stream(f'<< /Type /XObject /Subtype /Image /Width {w} /Height {h} /BitsPerComponent 8 /ColorSpace /DeviceRGB /Filter /DCTDecode >>',jpeg),'(unreferenced sentinel)','<< /Title (Synthetic PDF) /Producer (Smaller test) /Custom <00ff81> >>']
rich=base.copy()
rich[0]='<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [9 0 R] >> /Names << /EmbeddedFiles << /Names [(fixture.txt) 11 0 R] >> >> /Outlines 13 0 R /StructTreeRoot 14 0 R /MarkInfo << /Marked true >> /Metadata 17 0 R /OpenAction 19 0 R >>'
rich[2]=rich[2].replace('/Contents 4 0 R','/Contents 4 0 R /Annots [8 0 R 9 0 R] /StructParents 0').replace('/Im 5 0 R','/Im 5 0 R /Fm 16 0 R').replace('/Resources <<','/Resources << /Font << /F1 18 0 R >>')
rich[3]=stream('<< >>',b'/P <</MCID 0>> BDC BT /F1 12 Tf 20 400 Td (Preserved text) Tj ET EMC q 300 0 0 300 10 10 cm /Fm Do Q\n')
rich += ['<< /Type /Annot /Subtype /Link /Rect [10 10 80 30] /A << /S /URI /URI (https://example.invalid/not-fetched) >> >>','<< /Type /Annot /Subtype /Widget /FT /Tx /T (name) /V (preserved value) /Rect [10 40 120 60] /P 3 0 R /F 4 >>',stream('<< /Type /EmbeddedFile /Subtype /text#2Fplain >>',b'protected attachment\x00\xff'),'<< /Type /Filespec /F (fixture.txt) /EF << /F 10 0 R >> >>','<< /Title (Bookmark) /Parent 13 0 R /Dest [3 0 R /Fit] >>','<< /Type /Outlines /First 12 0 R /Last 12 0 R /Count 1 >>','<< /Type /StructTreeRoot /K [15 0 R] /ParentTree << /Nums [0 [15 0 R]] >> >>','<< /Type /StructElem /S /P /P 14 0 R /Pg 3 0 R /K 0 >>',stream('<< /Type /XObject /Subtype /Form /BBox [0 0 1 1] /Resources << /XObject << /Im 5 0 R >> >> >>',b'/Im Do\n'),stream('<< /Type /Metadata /Subtype /XML >>',b'<metadata>Protected UTF-8 metadata</metadata>'),'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Action /S /JavaScript /JS (globalThis.PDF_SCRIPT_EXECUTED=true) >>']
write('features',rich)
shared=base.copy();shared[1]='<< /Type /Pages /Kids [3 0 R 8 0 R] /Count 2 >>';shared.append(base[2]);write('shared-images',shared)
masked=base.copy();masked[4]=stream(f'<< /Type /XObject /Subtype /Image /Width {w} /Height {h} /BitsPerComponent 8 /ColorSpace /DeviceRGB /Mask [0 0 0 0 0 0] /Filter /DCTDecode >>',jpeg);write('masked',masked)
empty=base.copy();empty[2]=empty[2].replace('/XObject << /Im 5 0 R >>','');empty[3]=stream('<< >>',b'q Q\n');empty[4]='null';write('no-image',empty)
signed=base+['<< /Type /Sig /ByteRange [0 1 2 3] /Contents <00> >>'];write('signed-field',signed)
bad=bytearray((O/'features.pdf').read_bytes());bad[bad.index(b'startxref')+10:bad.index(b'startxref')+14]=b'0000';(O/'invalid-xref.pdf').write_bytes(bad)
subprocess.run(['qpdf','--encrypt','','owner','256','--',str(O/'features.pdf'),str(O/'encrypted-empty-password.pdf')],check=True)
subprocess.run(['qpdf','--object-streams=generate',str(O/'features.pdf'),str(O/'object-stream.pdf')],check=True)
for p in O.glob('*.pdf'):
 if p.stem=='invalid-xref':continue
 subprocess.run(['qpdf','--check',str(p)],check=True,stdout=subprocess.DEVNULL)
print('Synthetic PDF fixtures checked with native qpdf')
raw=base.copy();raw[4]=stream('<< /Type /XObject /Subtype /Image /Width 12 /Height 12 /BitsPerComponent 8 /ColorSpace /DeviceRGB >>',bytes(range(216))*2);write('raw-image',raw)
flate=base.copy();flate[4]=stream('<< /Type /XObject /Subtype /Image /Width 12 /Height 12 /BitsPerComponent 8 /ColorSpace /DeviceRGB /Filter /FlateDecode >>',zlib.compress(bytes(range(216))*2));write('flate-image',flate)
