"""Independent native QPDF/Poppler content and rendering check."""
from pathlib import Path
import subprocess,json,tempfile,sys,hashlib,re
src,out=map(Path,sys.argv[1:3]);count=0
for p in sorted(out.glob('*.pdf')):
 original=src/p.name
 if not original.exists():continue
 subprocess.run(['qpdf','--check',str(p)],check=True,stdout=subprocess.DEVNULL)
 def graph(path):return json.loads(subprocess.check_output(['qpdf','--json','--json-stream-data=none',str(path)]))
 a,b=graph(original),graph(p);assert len(a['pages'])==len(b['pages']),(p,'pages')
 assert len(a.get('attachments',{}))==len(b.get('attachments',{})),(p,'attachments')
 def scrub(v):
  if isinstance(v,dict):return {k:scrub(x) for k,x in v.items() if k not in ('object','parent')}
  if isinstance(v,list):return [scrub(x) for x in v]
  if isinstance(v,str) and re.fullmatch(r'\d+ \d+ R',v):return 'REFERENCE'
  return v
 assert scrub(a.get('acroform'))==scrub(b.get('acroform')),(p,'form fields')
 def stream(path,ref):return subprocess.check_output(['qpdf','--show-object='+ref.replace(' R','').replace(' ',','),'--filtered-stream-data',str(path)])
 for x,y in zip(a['pages'],b['pages']):
  assert len(x['contents'])==len(y['contents'])
  for l,r in zip(x['contents'],y['contents']):assert stream(original,l)==stream(p,r),(p,'page content/text')
 for name,attachment in a.get('attachments',{}).items():assert stream(original,attachment['preferredcontents'])==stream(p,b['attachments'][name]['preferredcontents']),(p,'attachment bytes')
 def commands(path):
  return subprocess.check_output(['qpdf','--qdf','--object-streams=disable','--stream-data=uncompress',str(path),'-'])
 # Separate render checks ensure both files are usable by an independent reader.
 with tempfile.TemporaryDirectory() as d:
  for label,path in [('a',original),('b',p)]:subprocess.run(['pdftoppm','-scale-to','700','-png',str(path),str(Path(d)/label)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)
  assert list(Path(d).glob('b-*.png'))
 count+=1;print(p.name+': qpdf validity, text/form/attachment inventories and Poppler rendering passed')
assert count>=5,count
print('PDF oracle:',count,'passed')
