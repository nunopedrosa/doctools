from pathlib import Path
from PIL import Image, ImageCms, PngImagePlugin
import io, struct, zlib, zipfile, json
root=Path('tests/fixtures');root.mkdir(parents=True,exist_ok=True)
profile=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
for mode in ('RGBA','P','L','RGB'):
 im=Image.new(mode,(256,192))
 if mode=='P': im.putpalette([i for x in range(256) for i in (x,255-x,x)])
 for y in range(im.height):
  for x in range(im.width):
   im.putpixel((x,y), ((x,y,120,0 if x<16 else 255) if mode=='RGBA' else (x,y,120) if mode=='RGB' else (x+y)%256))
 info=PngImagePlugin.PngInfo();info.add_text('Author','doctools fixture');info.add(b'gAMA',struct.pack('>I',45455));info.add(b'vpAg',b'preserve-unknown-safe')
 im.save(root/f'{mode}.png',compress_level=0,pnginfo=info,icc_profile=profile,dpi=(144,144))
im=Image.open(root/'RGB.png'); exif=Image.Exif();exif[274]=6
for name,options in [('photo',{}),('progressive',{'progressive':True}),('gray',{}),('cmyk',{})]:
 src=im.convert('L' if name=='gray' else 'CMYK' if name=='cmyk' else 'RGB')
 src.save(root/f'{name}.jpg',quality=93,optimize=False,exif=exif,icc_profile=profile,dpi=(144,144),**options)
a=Image.new('RGBA',(8,8),'red');b=Image.new('RGBA',(8,8),'blue');a.save(root/'animated.png',save_all=True,append_images=[b],duration=100,loop=0)
(root/'unsupported.gif').write_bytes(b'GIF89a'+b'\x01\0\x01\0')
(root/'bad.png').write_bytes(b'not a PNG')
big=bytearray((root/'RGBA.png').read_bytes());big[16:24]=struct.pack('>II',100000,100000);big[29:33]=struct.pack('>I',zlib.crc32(big[12:29]));(root/'huge.png').write_bytes(big)
print('Generated image fixtures')
CT='http://schemas.openxmlformats.org/package/2006/content-types'
REL='http://schemas.openxmlformats.org/package/2006/relationships'
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
def package(media=True,strict=False):
 w='http://purl.oclc.org/ooxml/wordprocessingml/main' if strict else W
 r='http://purl.oclc.org/ooxml/officeDocument/relationships' if strict else R
 parts={'[Content_Types].xml':f'''<Types xmlns="{CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="bin" ContentType="application/octet-stream"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'''.encode(),
 '_rels/.rels':f'<Relationships xmlns="{REL}"><Relationship Id="rDoc" Type="{r}/officeDocument" Target="word/document.xml"/></Relationships>'.encode(),
 'word/document.xml':f'<w:document xmlns:w="{w}" xmlns:r="{r}"><w:body><w:p><w:r><w:t>Lossless DOCX fixture</w:t></w:r><w:ins w:id="1" w:author="Fixture"><w:r><w:t>Tracked text</w:t></w:r></w:ins></w:p><w:sectPr/></w:body></w:document>'.encode(),
 'docProps/custom.xml':b'<properties>Preserve me exactly</properties>',
 'word/comments.xml':f'<w:comments xmlns:w="{w}"/>'.encode(),
 'word/header1.xml':f'<w:hdr xmlns:w="{w}"/>'.encode(),
 'word/embeddings/object.bin':b'opaque embedded object\x00\xff',
 'word/_rels/document.xml.rels':f'<Relationships xmlns="{REL}"><Relationship Id="external" Type="{r}/image" TargetMode="External" Target="https://example.invalid/no-fetch.png"/></Relationships>'.encode()}
 if media:
  for n in ['RGBA.png','photo.jpg','animated.png','unsupported.gif','progressive.jpg']:
   parts['word/media/'+n]=(root/n).read_bytes()
  parts['word/_rels/header1.xml.rels']=f'<Relationships xmlns="{REL}"><Relationship Id="rImage" Type="{r}/image" Target="media/RGBA%2Epng"/></Relationships>'.encode()
 return parts
def doc(name,parts,compression=zipfile.ZIP_DEFLATED):
 with zipfile.ZipFile(root/name,'w',compression=compression) as z:
  for n,b in parts.items():z.writestr(n,b)
base=package();doc('mixed.docx',base);doc('strict.docx',package(strict=True));doc('empty.docx',package(False))
for name,path,data in [('signed.docx','_xmlsignatures/sig1.xml',b'<signature/>'),('traversal.docx','../evil',b'evil'),('bad-xml.docx','word/document.xml',b'<broken>'),('entity.docx','word/document.xml',b'<!DOCTYPE x [<!ENTITY e "bad">]><x>&e;</x>'),('broken-rel.docx','word/_rels/document.xml.rels',f'<Relationships xmlns="{REL}"><Relationship Id="bad" Type="{R}/image" Target="media/missing.png"/></Relationships>'.encode())]:
 p=dict(base);p[path]=data;doc(name,p)
p=dict(base);p['custom/sig.xml']=b'<sig/>';p['_rels/.rels']=p['_rels/.rels'].replace(b'</Relationships>',f'<Relationship Id="sig" Type="http://schemas.openxmlformats.org/package/2006/relationships/digital-signature/origin" Target="custom/sig.xml"/></Relationships>'.encode());doc('signed-rel.docx',p)
p=dict(base);p.pop('word/document.xml');doc('missing.docx',p)
p=dict(base);p['[Content_Types].xml']=p['[Content_Types].xml'].replace(b'wordprocessingml.document.main+xml',b'presentationml.presentation.main+xml');doc('wrong-type.docx',p)
with zipfile.ZipFile(root/'duplicate.docx','w') as z:
 for n,b in base.items():z.writestr(n,b)
 z.writestr('word/document.xml',base['word/document.xml'])
doc('stored.docx',base,zipfile.ZIP_STORED)
raw=bytearray((root/'stored.docx').read_bytes());n=struct.unpack_from('<H',raw,26)[0];extra=struct.unpack_from('<H',raw,28)[0];raw[30+n+extra]^=1;(root/'crc.docx').write_bytes(raw)
raw=bytearray((root/'stored.docx').read_bytes());raw[8]=99;(root/'header-mismatch.docx').write_bytes(raw)
raw=bytearray((root/'stored.docx').read_bytes());raw[6]|=1;(root/'encrypted.docx').write_bytes(raw)
(root/'office-encrypted.docx').write_bytes(bytes.fromhex('D0CF11E0A1B11AE1')+b'encrypted')
print('Generated DOCX fixtures')
def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b))
(root/'interlaced.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,6,0,0,1))+chunk(b'IDAT',zlib.compress(b'\0\xff\0\0\xff',0))+chunk(b'IEND',b''))
raw=b''
for x0,y0,dx,dy in [(0,0,8,8),(4,0,8,8),(0,4,4,8),(2,0,4,4),(0,2,2,4),(1,0,2,2),(0,1,1,2)]:
 for y in range(y0,16,dy):
  row=b''.join(bytes((x*15,y*15,100,(x+y)*8)) for x in range(x0,16,dx))
  if row:raw+=b'\0'+row
(root/'interlaced.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',16,16,8,6,0,0,1))+chunk(b'IDAT',zlib.compress(raw,0))+chunk(b'IEND',b''))
p=dict(base);p['word/document.xml']=p['word/document.xml'].decode().encode('utf-16');doc('utf16.docx',p)
raw=bytearray((root/'mixed.docx').read_bytes());at=raw.find(b'PK\x01\x02');struct.pack_into('<I',raw,at+24,1);(root/'false-size.docx').write_bytes(raw)
