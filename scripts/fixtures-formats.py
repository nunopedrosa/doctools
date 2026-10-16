"""Deterministic non-personal package fixtures; no application or network execution."""
from pathlib import Path
import zipfile, posixpath
ROOT=Path('tests/fixtures'); OUT=ROOT/'multiformat'; OUT.mkdir(exist_ok=True)
CT='http://schemas.openxmlformats.org/package/2006/content-types'
REL='http://schemas.openxmlformats.org/package/2006/relationships'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
TYPES={
 'docx':('word/document.xml','wordprocessingml.document','document','http://schemas.openxmlformats.org/wordprocessingml/2006/main'),
 'dotx':('word/document.xml','wordprocessingml.template','document','http://schemas.openxmlformats.org/wordprocessingml/2006/main'),
 'pptx':('ppt/presentation.xml','presentationml.presentation','presentation','http://schemas.openxmlformats.org/presentationml/2006/main'),
 'ppsx':('ppt/presentation.xml','presentationml.slideshow','presentation','http://schemas.openxmlformats.org/presentationml/2006/main'),
 'potx':('ppt/presentation.xml','presentationml.template','presentation','http://schemas.openxmlformats.org/presentationml/2006/main'),
 'xlsx':('xl/workbook.xml','spreadsheetml.sheet','workbook','http://schemas.openxmlformats.org/spreadsheetml/2006/main'),
 'xltx':('xl/workbook.xml','spreadsheetml.template','workbook','http://schemas.openxmlformats.org/spreadsheetml/2006/main'),
 'vsdx':('visio/document.xml','VISIO','VisioDocument','http://schemas.microsoft.com/office/visio/2012/main')}
def write(name,parts):
 with zipfile.ZipFile(OUT/name,'w') as z:
  z.comment=b'synthetic package archive comment'
  for path,data in parts.items():
   info=zipfile.ZipInfo(path,(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;info.comment=b'fixture part'
   z.writestr(info,data.encode() if isinstance(data,str) else data)
def office(ext, relocated=False):
 main,ctype,root,ns=TYPES[ext]
 if relocated: main='custom/location/main.xml'
 ctype='application/vnd.ms-visio.drawing.main+xml' if ctype=='VISIO' else 'application/vnd.openxmlformats-officedocument.'+ctype+'.main+xml'
 relation='http://schemas.microsoft.com/visio/2010/relationships/document' if ext=='vsdx' else R+'/officeDocument'
 folder=posixpath.dirname(main)
 return {
 '[Content_Types].xml':f'<Types xmlns="{CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="bin" ContentType="application/octet-stream"/><Override PartName="/{main}" ContentType="{ctype}"/></Types>',
 '_rels/.rels':f'<Relationships xmlns="{REL}"><Relationship Id="main" Type="{relation}" Target="{main}"/></Relationships>',
 main:f'<x:{root} xmlns:x="{ns}"/>',
 folder+'/_rels/'+posixpath.basename(main)+'.rels':f'<Relationships xmlns="{REL}"><Relationship Id="img" Type="{R}/image" Target="media/texture.png"/><Relationship Id="external" Type="{R}/image" Target="https://example.invalid/no-fetch.jpg" TargetMode="External"/></Relationships>',
 folder+'/media/texture.png':(ROOT/'textured.png').read_bytes(),
 folder+'/media/photo.jpg':(ROOT/'photo.jpg').read_bytes(),
 folder+'/media/unsupported.gif':(ROOT/'unsupported.gif').read_bytes(),
 folder+'/embeddings/object.bin':b'opaque protected object\0\xff',
 'docProps/custom.xml':'<properties>protected comments, formula =SUM(A1:A3), notes</properties>'}
for ext in TYPES:write('mixed.'+ext,office(ext))
write('relocated.pptx',office('pptx',True))
for name,ext in [('hidden-vba.pptx','pptx'),('vba-content-type.xlsx','xlsx'),('vba-relationship.docx','docx'),('signed.vsdx','vsdx'),('missing-image.pptx','pptx'),('duplicate-rel.xlsx','xlsx'),('wrong-root.potx','potx'),('wrong-main-type.dotx','dotx'),('encoded-traversal.xlsx','xlsx')]:
 p=office(ext);main=TYPES[ext][0];rels=posixpath.dirname(main)+'/_rels/'+posixpath.basename(main)+'.rels'
 if name.startswith('hidden-vba'):p['ppt/vbaProject.bin']=b'VBA project'
 elif name.startswith('vba-content'):p['[Content_Types].xml']=p['[Content_Types].xml'].replace('application/octet-stream','application/vnd.ms-office.vbaProject')
 elif name.startswith('vba-relationship'):p[rels]=p[rels].replace(R+'/image',R+'/vbaProject')
 elif name.startswith('signed'):p['_xmlsignatures/sig.xml']='<signature/>'
 elif name.startswith('missing-image'):p[rels]=p[rels].replace('media/texture.png','media/missing.png')
 elif name.startswith('duplicate-rel'):p[rels]=p[rels].replace('Id="external"','Id="img"')
 elif name.startswith('wrong-root'):p[main]='<wrong xmlns="urn:invalid"/>'
 elif name.startswith('wrong-main'):p['[Content_Types].xml']=p['[Content_Types].xml'].replace('wordprocessingml.template','wordprocessingml.document')
 elif name.startswith('encoded-traversal'):p[rels]=p[rels].replace('media/texture.png','%2E%2E/%2E%2E/escape.png')
 write(name,p)
kml='<kml xmlns="http://www.opengis.net/kml/2.2"><Document><GroundOverlay><Icon><href>images/texture.png</href></Icon></GroundOverlay><Placemark><description>Protected map</description><Point><coordinates>-9,38,0</coordinates></Point></Placemark><Icon><href>https://example.invalid/no-fetch.jpg</href></Icon></Document></kml>'
kmz={'first.kml':kml,'nested/second.kml':'<kml xmlns="http://www.opengis.net/kml/2.2"/>','images/texture.png':(ROOT/'textured.png').read_bytes(),'images/photo.jpg':(ROOT/'photo.jpg').read_bytes(),'models/mesh.dae':b'opaque model data'}
write('mixed.kmz',kmz)
write('missing-kml.kmz',{'texture.png':(ROOT/'textured.png').read_bytes()})
write('entity.kmz',{'doc.kml':'<!DOCTYPE kml [<!ENTITY e "bad">]><kml xmlns="http://www.opengis.net/kml/2.2">&e;</kml>'})
print('Generated Office/Visio/KMZ fixtures')
p=office('docx');p['doc.kml']='<kml xmlns="http://www.opengis.net/kml/2.2"/>';p['word/vbaProject.bin']=b'macro';write('hybrid.kmz',p)
p=office('docx');p={k.replace('word/document.xml','document.xml').replace('word/_rels/document.xml.rels','_rels/document.xml.rels'):v for k,v in p.items()};p['_rels/.rels']=p['_rels/.rels'].replace('word/document.xml','document.xml');p['[Content_Types].xml']=p['[Content_Types].xml'].replace('/word/document.xml','/document.xml');p['_rels/document.xml.rels']=p['_rels/document.xml.rels'].replace('Target="media/','Target="word/media/');write('root-main.docx',p)
