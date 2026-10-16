"""Generate synthetic editor-compatible fixtures with local QA libraries only."""
from pathlib import Path
import subprocess,zipfile,re,tempfile,json
from datetime import datetime
from openpyxl import Workbook
from openpyxl.drawing.image import Image
from openpyxl.comments import Comment
out=Path('tests/fixtures/multiformat').resolve();image=Path('tests/fixtures/textured.png').resolve()
module=Path('/Users/nfp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs')
js='''const Pptx=require(process.argv[1]);const p=new Pptx();p.layout='LAYOUT_WIDE';p.author='Synthetic QA';p.subject='Non-personal fixture';for(let i=0;i<2;i++){const s=p.addSlide();s.addText('Preserved slide '+(i+1),{x:1,y:0.5,w:8,h:1,fontSize:24});s.addImage({path:process.argv[2],x:1,y:2,w:4,h:3});s.addNotes('Protected speaker notes');}p.writeFile({fileName:process.argv[3]});'''
subprocess.run(['node','-e',js,str(module),str(image),str(out/'realistic.pptx')],check=True)
w=Workbook();s=w.active;s.title='Synthetic';s['A1']=12;s['B1']='=A1*2';s['A1'].comment=Comment('Protected comment','Synthetic QA');s.add_image(Image(str(image)),'D4');w.properties.created=w.properties.modified=datetime(2026,1,1);w.save(out/'realistic.xlsx')
for name in ['realistic.pptx','realistic.xlsx']:
 p=out/name
 with zipfile.ZipFile(p) as z:parts=[(i.filename,z.read(i)) for i in z.infolist()]
 with tempfile.TemporaryDirectory(prefix='smaller-normalize-') as d:
  q=Path(d)/name
  with zipfile.ZipFile(q,'w') as z:
   for name,data in parts:
    if name=='docProps/core.xml':data=re.sub(rb'(<dcterms:(created|modified)[^>]*>)[^<]*',rb'\g<1>2026-01-01T00:00:00Z',data)
    info=zipfile.ZipInfo(name,(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=(0o40755<<16|16) if name.endswith('/') else 0o100644<<16;z.writestr(info,data)
  p.write_bytes(q.read_bytes())
print('Generated realistic PPTX (PptxGenJS '+json.loads((module/'package.json').read_text())['version']+') and XLSX (openpyxl)')
