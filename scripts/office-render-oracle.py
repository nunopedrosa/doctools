"""Open synthetic Office originals/results with LibreOffice and compare page pixels."""
from pathlib import Path
import subprocess,tempfile
from PIL import Image
root=Path('tests/fixtures/multiformat');output=Path('tests/output/multiformat');renders=Path('tests/output/render-formats')
for ext in ['pptx','xlsx']:
 rendered=[]
 for label,source in [('original',root),('optimized',output)]:
  dest=(renders/ext/label).resolve();dest.mkdir(parents=True,exist_ok=True)
  with tempfile.TemporaryDirectory(prefix='smaller-lo-render-') as d:
   subprocess.run(['/Applications/LibreOffice.app/Contents/MacOS/soffice','-env:UserInstallation='+Path(d).as_uri(),'--headless','--convert-to','pdf','--outdir',str(dest),str((source/('realistic.'+ext)).resolve())],check=True,timeout=60)
  pdf=dest/'realistic.pdf';assert pdf.exists(),pdf
  subprocess.run(['pdftoppm','-scale-to','1400','-png',str(pdf),str(dest/'page')],check=True,timeout=60)
  rendered.append(sorted(dest.glob('page-*.png')))
 assert rendered[0] and len(rendered[0])==len(rendered[1]),ext
 for a,b in zip(*rendered):
  with Image.open(a) as x,Image.open(b) as y:assert x.size==y.size and x.convert('RGBA').tobytes()==y.convert('RGBA').tobytes(),(ext,a.name)
 print(ext+': '+str(len(rendered[0]))+' LibreOffice/Poppler pages pixel-identical')
