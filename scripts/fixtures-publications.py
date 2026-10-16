"""Deterministic synthetic publications and artwork; no personal content."""
from pathlib import Path
import zipfile,io
from PIL import Image
R=Path('tests/fixtures');O=R/'multiformat'
NS='urn:oasis:names:tc:opendocument:xmlns:'
def write(name,mime,parts):
 with zipfile.ZipFile(O/name,'w') as z:
  for path,data in {'mimetype':mime,**parts}.items():
   i=zipfile.ZipInfo(path,(2026,1,1,0,0,0));i.compress_type=zipfile.ZIP_STORED if path=='mimetype' else zipfile.ZIP_DEFLATED;i.external_attr=0o100644<<16
   z.writestr(i,data.encode() if isinstance(data,str) else data)
def odf(ext,t):
 mime='application/vnd.oasis.opendocument.'+t
 body=t.replace('-template','');body={'text':'text','spreadsheet':'spreadsheet','presentation':'presentation','graphics':'drawing'}[body]
 p={'content.xml':f'<office:document-content xmlns:office="{NS}office:1.0" office:version="1.3"><office:body><office:{body}/></office:body></office:document-content>', 'styles.xml':f'<office:document-styles xmlns:office="{NS}office:1.0"/>','meta.xml':f'<office:document-meta xmlns:office="{NS}office:1.0"/>','Pictures/texture.png':(R/'textured.png').read_bytes(),'Pictures/photo.jpg':(R/'photo.jpg').read_bytes()}
 manifest=f'<manifest:manifest xmlns:manifest="{NS}manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="{mime}"/>'
 for n in p:manifest+=f'<manifest:file-entry manifest:full-path="{n}" manifest:media-type="'+('image/png' if n.endswith('.png') else 'image/jpeg' if n.endswith('.jpg') else 'text/xml')+'"/>'
 p['META-INF/manifest.xml']=manifest+'</manifest:manifest>';write('mixed.'+ext,mime,p)
 if ext=='odt':
  bad=dict(p);bad['META-INF/manifest.xml']=p['META-INF/manifest.xml'].replace('</manifest:file-entry>','') if False else p['META-INF/manifest.xml'].replace('/>', '><manifest:encryption-data/></manifest:file-entry>',1);write('encrypted.odt',mime,bad)
 if ext=='ods':write('signed.ods',mime,{**p,'META-INF/documentsignatures.xml':'<sig/>'})
for e,t in {'odt':'text','ods':'spreadsheet','odp':'presentation','odg':'graphics','ott':'text-template','ots':'spreadsheet-template','otp':'presentation-template','otg':'graphics-template'}.items():odf(e,t)
container='<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="Book/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
def epub(version='3.0'):
 return {'META-INF/container.xml':container,'Book/package.opf':f'<package xmlns="http://www.idpf.org/2007/opf" version="{version}" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:synthetic</dc:identifier><dc:title>Fixture</dc:title><dc:language>en</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="cover" href="images/texture%20one.png" media-type="image/png"/><item id="photo" href="images/photo.jpg" media-type="image/jpeg"/><item id="font" href="font.otf" media-type="font/otf"/></manifest><spine><itemref idref="chapter"/></spine></package>', 'Book/chapter.xhtml':'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Fixture</title><script>fetch("https://example.invalid/never-execute")</script></head><body><p>Preserved text</p><img src="images/texture%20one.png" alt=""/></body></html>','Book/images/texture one.png':(R/'textured.png').read_bytes(),'Book/images/photo.jpg':(R/'photo.jpg').read_bytes(),'Book/font.otf':b'synthetic preservation-only font bytes\x00\xff'}
p=epub();write('mixed.epub','application/epub+zip',p);write('epub2.epub','application/epub+zip',epub('2.0'))
enc='<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:e="http://www.w3.org/2001/04/xmlenc#"><e:EncryptedData><e:EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><e:CipherData><e:CipherReference URI="Book/font.otf"/></e:CipherData></e:EncryptedData></encryption>'
write('obfuscated-font.epub','application/epub+zip',{**p,'META-INF/encryption.xml':enc})
for name,parts in [('signed.epub',{**p,'META-INF/signatures.xml':'<sig/>'}),('unknown-encryption.epub',{**p,'META-INF/encryption.xml':enc.replace('http://www.idpf.org/2008/embedding','urn:unknown')}),('encrypted-image.epub',{**p,'META-INF/encryption.xml':enc.replace('Book/font.otf','Book/images/photo.jpg')}),('bad-spine.epub',{**p,'Book/package.opf':p['Book/package.opf'].replace('idref="chapter"','idref="missing"')}),('bad-container.epub',{**p,'META-INF/container.xml':'<bad/>'})]:write(name,'application/epub+zip',parts)
p2={**p,'META-INF/container.xml':container.replace('</rootfiles>','<rootfile full-path="Other/package.opf" media-type="application/oebps-package+xml"/></rootfiles>'),'Other/package.opf':p['Book/package.opf'].replace('href="','href="../Book/')};write('multiple.epub','application/epub+zip',p2)
for ext in ['odt','epub']:(O/(ext+'-as-zip.zip')).write_bytes((O/('mixed.'+ext)).read_bytes())
# Flat synthetic composited layers with a nested stack and preserved editor metadata.
def png(im):
 b=io.BytesIO();im.save(b,format='PNG',compress_level=0);return b.getvalue()
a=Image.new('RGBA',(120,90));a.putdata([((x*7+y*3)%256,(x*3+y*11)%256,(x*13+y*5)%256,255) for y in range(90) for x in range(120)]);b=Image.new('RGBA',(120,90),(230,80,40,128));c=Image.alpha_composite(a,b)
stack='<image version="0.0.3" w="120" h="90" name="Synthetic"><stack><stack name="Nested"><layer name="Café" src="data/top.png" x="0" y="0" opacity="1.0" visibility="visible" composite-op="svg:src-over"/></stack><layer name="Background" src="data/base.png" x="0" y="0" opacity="1.0" composite-op="svg:src-over"/></stack></image>'
p={'stack.xml':stack,'data/base.png':png(a),'data/top.png':png(b),'mergedimage.png':png(c),'Thumbnails/thumbnail.png':png(c),'editor-data.bin':b'opaque extension'}
write('layers.ora','image/openraster',p)
for name,path in [('missing-layer.ora','data/top.png'),('missing-composite.ora','mergedimage.png'),('missing-thumbnail.ora','Thumbnails/thumbnail.png')]:write(name,'image/openraster',{k:v for k,v in p.items() if k!=path})
write('traversal.ora','image/openraster',{**p,'stack.xml':stack.replace('data/top.png','../escape.png')})
write('damaged.ora','image/openraster',{**p,'data/top.png':b'not png'})
(O/'ora-as-zip.zip').write_bytes((O/'layers.ora').read_bytes())
print('Generated ODF, EPUB and ORA structural fixtures')
# Reader/conformance fixtures omit synthetic opaque font bytes and executable content.
for version in ['2.0','3.0']:
 p=epub(version);p['Book/chapter.xhtml']=p['Book/chapter.xhtml'].replace('<script>fetch("https://example.invalid/never-execute")</script>','')
 p.pop('Book/font.otf');p['Book/package.opf']=p['Book/package.opf'].replace('<item id="font" href="font.otf" media-type="font/otf"/>','')
 if version=='3.0':
  p['Book/package.opf']=p['Book/package.opf'].replace('</metadata>','<meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata>').replace('</manifest>','<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest>')
  p['Book/nav.xhtml']='<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">Chapter</a></li></ol></nav></body></html>'
 else:
  p['Book/package.opf']=p['Book/package.opf'].replace('<spine>','<spine toc="ncx">').replace('</manifest>','<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest>')
  p['Book/toc.ncx']='<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:synthetic"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head><docTitle><text>Fixture</text></docTitle><navMap><navPoint id="chapter" playOrder="1"><navLabel><text>Chapter</text></navLabel><content src="chapter.xhtml"/></navPoint></navMap></ncx>'
 p['Book/images/texture-one.png']=p.pop('Book/images/texture one.png')
 for name in list(p):
  if isinstance(p[name],str):p[name]=p[name].replace('urn:uuid:synthetic','urn:uuid:550e8400-e29b-41d4-a716-446655440000').replace('texture%20one.png','texture-one.png').replace('<img src=','<p><img src=').replace('alt=""/>','alt=""/></p>')
 write('conformant-'+version[0]+'.epub','application/epub+zip',p)
